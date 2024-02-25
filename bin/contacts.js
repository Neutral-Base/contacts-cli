import cliProgress from "cli-progress";
import { google } from "googleapis";

/**
 * List all contacts from the authenticated user's Google Contacts.
 * This will run recursively until all contacts are fetched.
 * Note: This does not fetch the "Other Contacts" or "Directory Contacts" groups.
 * TODO: Add support for fetching "Other Contacts" and "Directory Contacts" groups.
 * @param {google.auth.OAuth2} authClient - The authenticated Google OAuth client.
 */
export async function listContacts(authClient) {
  const people = google.people({ version: "v1", auth: authClient });
  const results = [];
  let nextPageToken = null;
  do {
    const res = await people.people.connections.list({
      resourceName: "people/me",
      pageSize: 1000,
      pageToken: nextPageToken,
      // The fields to include in the response. By default we try to get all the fields.
      // TODO: allow users to specify which fields they want to retrieve.
      personFields:
        "addresses,ageRanges,biographies," +
        "birthdays,calendarUrls,clientData," +
        "coverPhotos,emailAddresses,events," +
        "externalIds,genders,imClients," +
        "interests,locales,locations," +
        "memberships,metadata,miscKeywords," +
        "names,nicknames,occupations," +
        "organizations,phoneNumbers,photos," +
        "relations,sipAddresses,skills," +
        "urls,userDefined",
    });
    results.push(res.data.connections);
    nextPageToken = res.data.nextPageToken;
  } while (nextPageToken);
  return results.flat();
}

/**
 * Recursively remove the metadata and resourceName fields from the object. These
 * fields are automatically generated by the Google People API and are not meant to
 * be written by the user.
 * @param {*} obj
 */
function objectCleaner(obj) {
  const keys = Object.keys(obj);
  for (const key of keys) {
    if (key === "id" || key === "resourceName") {
      delete obj[key];
    }
    if (typeof obj[key] === "object") {
      objectCleaner(obj[key]);
    }
  }
}

/**
 * Process the contact data and return a cleaned up version of the data
 * @param {*} contactData
 * @param {*} options
 * @returns
 */
function processContact(contactData, options) {
  // Get user-defined memberships from the options object
  let defaultMembership = [
    {
      contactGroupMembership: {
        contactGroupResourceName: "contactGroups/myContacts",
      },
    },
  ];
  // If the contactGroups option is provided, add the contact to the specified groups
  if (options.contactGroups) {
    defaultMembership = defaultMembership.concat(
      options.contactGroups.map((group) => {
        return {
          contactGroupMembership: {
            contactGroupResourceName: `contactGroups/${group}`,
          },
        };
      })
    );
  }
  // We need to remove some of the fields from the contact that are only meant for reading
  // and generated automatically by the Google People API
  // remove the top-level metadata field
  delete contactData.metadata;
  // remove reosurceName from the contact
  delete contactData.resourceName;
  // remove etaag from the contact
  delete contactData.etag;
  // remove the photo field from the contact
  delete contactData.photos;
  delete contactData.coverPhotos;
  // Remove the contact metadata
  delete contactData.metadata;
  // Only include names that have source type of CONTACT
  if (contactData.names) {
    contactData.names = contactData.names.filter(
      (name) => name.metadata?.source?.type === "CONTACT"
    );
  }
  // Only include email addresses that have source type of CONTACT
  if (contactData.emailAddresses) {
    contactData.emailAddresses = contactData.emailAddresses.filter(
      (email) => email.metadata?.source?.type === "CONTACT"
    );
  }
  // Replace the memberships field with the default membership
  contactData.memberships = defaultMembership;
  // Clean up the contact data, removing any metadata and resourceName fields
  objectCleaner(contactData);
  return contactData;
}

/**
 * Create a new contact in the authenticated user's Google Contacts.
 * @param {google.auth.OAuth2} authClient
 * @param {*} contactData
 * @param {*} options
 */
export async function createContact(authClient, contactData, options = {}) {
  // Process the contact data
  contactData = await processContact(contactData, options);

  const people = google.people({ version: "v1", auth: authClient });
  people.people
    .createContact({
      requestBody: contactData,
    })
    .then((res) => {
      return res.data;
    })
    .catch((error) => {
      console.error("error message:", error.response?.data?.error?.message);
    });
}

/**
 * Create multiple contacts in the authenticated user's Google Contacts.
 * @param {*} authClient
 * @param {*} contacts
 * @param {*} options
 */
export async function batchCreateContacts(authClient, contacts, options = {}) {
  // Process the contacts before adding them to batches
  const processedContacts = contacts.map((contact) => {
    return {
      contactPerson: processContact(contact, options),
    };
  });

  const BATCH_SIZE = 25;
  const people = google.people({ version: "v1", auth: authClient });
  const results = [];
  const failed = [];
  const progress = new cliProgress.SingleBar(
    {},
    cliProgress.Presets.shades_classic
  );
  progress.start(processedContacts.length, 0);

  for (let i = 0; i < processedContacts.length; i += BATCH_SIZE) {
    const batch = processedContacts.slice(i, i + BATCH_SIZE);

    people.people
      .batchCreateContacts({
        requestBody: {
          contacts: batch,
        },
      })
      .then((res) => {
        results.push(res.data);
      })
      .catch((error) => {
        failed.push(batch);
        console.error("error message:", error.response?.data?.error?.message);
      });

    // wait for 5 seconds before making the next request
    await new Promise((resolve) => setTimeout(resolve, 5000));
    progress.increment(batch.length);
  }

  progress.stop();
  return {
    results,
    failed,
  };
}