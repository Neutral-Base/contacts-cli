import { google } from "googleapis";

/**
 * List all contact groups from the authenticated user's Google Contacts.
 * @param {google.auth.OAuth2} authClient
 */
export async function listContactGroups(authClient) {
  const people = google.people({ version: "v1", auth: authClient });
  const res = await people.contactGroups.list({
    // increase the max results to 200
    pageSize: 200,
  });
  return res.data;
}
