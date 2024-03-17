import fs from 'node:fs';
import path from 'node:path';
import chalk from 'chalk';
import boxen from 'boxen';
import figlet from 'figlet';
import cliSpinners from 'cli-spinners';
import ora from 'ora';
import * as commander from 'commander';

import * as auth from '../lib/google/auth.js';
import * as contactsAPI from '../lib/google/contacts.js';
import * as contactGroupsAPI from '../lib/google/contact-groups.js';

const program = new commander.Command();

const contacts = program.command('contacts');
const contactGroups = program.command('contact-groups');
const utils = program.command('utils');

const __dirname = path.dirname(new URL(import.meta.url).pathname);

contacts
  .command('export')
  .description(
    "Exports contacts for a given account. Note that this does not include 'other' or 'directory' contacts."
  )
  .option(
    '-a, --account <account>',
    'The Google account to list the contacts for'
  )
  .option(
    '-o, --output <output>',
    'The output file to write the contacts to. If not provided, the contacts will be written to the console.'
  )
  // TODO: add more options for more fine-grained control over which contacts to list
  .action(async ({ account, output }) => {
    if (!account) {
      console.error('No account provided');
      process.exit(1);
    }
    try {
      console.info(`Listing contacts for account: ${account}`);

      // Get the access token for the account
      const sourceClient = await auth.authorize(account);
      // Get the contacts for the account
      const contacts = await contactsAPI.listContacts(sourceClient);

      console.info(`Retrieved ${contacts.length} contacts`);

      // Write the contacts to the file systems as a JSON file
      const now = new Date();

      if (output) {
        const filePath = path.join(__dirname, '..', 'output', output);
        fs.writeFileSync(filePath, JSON.stringify(contacts, null, 2));
        console.info(`Contacts written to: ${filePath}`);
        return;
      }

      const outputDir = path.join(__dirname, '..', 'output', account);

      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      const filePath = path.join(outputDir, `contacts-${now}.json`);
      fs.writeFileSync(filePath, JSON.stringify(contacts, null, 2));
    } catch (error) {
      console.error('Error:', error);
    }
  });

contacts
  .command('import')
  .description('Imports contacts to a given account.')
  .option(
    '-s, --source <source>',
    'The Google account to sync the contacts from.'
  )
  .option(
    '-d, --destination <destination>',
    'Optional Google account to sync the contacts to. If not provided a file must be provided instead.'
  )
  .option(
    '-f, --file <file>',
    'Optional file to read the contacts from. If not provided, the contacts will be read from the source account using GAPI.'
  )
  .option(
    '-l, --limit',
    'Limit the number of contacts from the list of contacts, be it from a file or from a source account'
  )
  .option(
    '--contact-groups <contact-groups>',
    'Comma separated list of contact groups to sync the contacts to. If not provided, the contacts will be synced to the default contact group. If the contact group does not exist, it will be created.'
  )
  .action(async (options) => {
    const file = options.file;
    const source = options.source;
    const destination = options.destination;
    const contactGroups = options.contactGroups?.split(',') ?? undefined;

    console.debug('Options:', options);

    if (!destination) {
      console.error('No destination account provided');
      process.exit(1);
    }

    if (file) {
      // Check if the file exists
      if (!fs.existsSync(file)) {
        console.error('File not found');
        process.exit(1);
      }
      // Read the file
      let contacts = JSON.parse(fs.readFileSync(file));

      if (options.limit) {
        contacts = contacts.slice(0, options.limit);
      }

      console.info(`Read ${contacts.length} contacts from file: ${file}`);
      // Get the access token for the destination account
      const destinationClient = await auth.authorize(destination);

      // Sync the contacts
      const { failed } = await contactsAPI.batchCreateContacts(
        destinationClient,
        contacts,
        {
          contactGroups: contactGroups,
        }
      );

      // TODO: add an option to save the successful results to a file

      const outputDir = path.join(__dirname, '..', 'output', destination);

      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      // Write the failed contacts to a file
      const failedFilePath = path.join(
        outputDir,
        `failed-contacts-${new Date()}.json`
      );
      try {
        fs.writeFileSync(failedFilePath, JSON.stringify(failed, null, 2));
      } catch (error) {
        console.error('Error writing failed contacts to file:', error);
      }
    } else if (source && destination) {
      console.error('Not implemented yet');
      process.exit(1);
    } else {
      console.error('No source account or file provided');
      process.exit(1);
    }
  });

contacts
  .command('clean')
  .description(
    'Cleans the contacts for a given account. Cleaning includes removing unnecessary external ids and urls.'
  )
  .option(
    '-a, --account <account>',
    'The Google account to clean the contacts for'
  )
  .option('--urls', 'Remove urls from the contacts')
  .option(
    '--url-type <url-type>',
    'The type of url to remove from the contacts. The command will fail if not provided but the --urls flag is on.'
  )
  .option('--external-ids', 'Remove external ids from the contacts')
  .option(
    '-f, --file <file>',
    'The file to read the contacts from. If not provided, the contacts will be read from the account via API.'
  )
  .action(async ({ account, file, externalIds, urls, urlType }) => {
    // validate command options
    if (!account) {
      console.error('No account provided');
      process.exit(1);
    }

    // if the urls flag is on, the url type must be provided
    if (urls && !urlType) {
      console.error('No url type provided');
      process.exit(1);
    }

    // either the file or the external ids or urls flag must be provided
    if (!file && !externalIds && !urls) {
      console.error('No file or external ids or urls flag provided');
      process.exit(1);
    }

    try {
      console.info(`Cleaning contacts for account: ${account}`);
      // Get the access token for the account
      const sourceClient = await auth.authorize(account);
      // Get the contacts for the account from file
      let contactsData;
      if (file) {
        contactsData = JSON.parse(fs.readFileSync(file));
      } else {
        console.warn(chalk.yellow('Reading contacts from the account'));
        const spinner = ora({
          text: `Retrieving contacts from: ${account}`,
          spinner: cliSpinners.binary,
          color: 'green',
        }).start();
        contactsData = await contactsAPI.listContacts(sourceClient);
        spinner.stop();
      }

      console.info(`Retrieved ${contactsData.length} contacts`);

      // Clean the contacts
      // Remove urls
      if (urls) {
        const { updated, failed } = await contactsAPI.cleanUrls(
          sourceClient,
          contactsData,
          urlType
        );
        console.info(`Updated ${updated.length} contacts`);
        console.info(`Failed to update ${failed.length} contacts`);
      }

      // Remove external ids
      // TODO: implement the removeExternalIds method
      if (externalIds) {
        console.error('Not implemented yet');
        process.exit(1);
      }
    } catch (error) {
      console.error('Error:', error);
    }
  });

contactGroups
  .command('list')
  .description('List all contact groups for a given account')
  .option(
    '-a, --account <account>',
    'The Google account to list the contact groups for'
  )
  .option(
    '-o, --output <file>',
    'The output file to write the contact groups to. If not provided, the contact groups will be written to the console.'
  )
  .action(async ({ account, output }) => {
    if (!account) {
      console.error('No account provided');
      process.exit(1);
    }
    try {
      // Get the access token for the account
      const sourceClient = await auth.authorize(account);
      // Get the contact groups for the account
      const spinner = ora({
        text: `Retrieving contact groups for account: ${account}`,
        spinner: cliSpinners.binary,
        color: 'green',
      }).start();
      const result = await contactGroupsAPI.listContactGroups(sourceClient);
      spinner.stop();
      console.info(`Retrieved ${result.contactGroups.length} contact groups`);
      console.table(
        result.contactGroups.map((group) => ({
          id: group.resourceName,
          name: group.formattedName,
          etag: group.etag,
          'group-type': group.groupType,
        }))
      );

      if (output) {
        // check if the output folder exists
        const outputDir = path.dirname(output);
        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }
        // check if the file exists
        if (fs.existsSync(output)) {
          console.warn('File already exists. Overwriting...');
        }
        // TODO: ask for user confirmation before overwriting the file
        fs.writeFileSync(output, JSON.stringify(result.contactGroups, null, 2));
      }
    } catch (error) {
      console.error('Error:', error);
    }
  });

utils
  .command('summarize-data')
  .description(
    'Summarize the data obtained from the export command. The file must be a valid JSON file.'
  )
  .option('-f, --file <file>', 'The file to summarize')
  .action(async ({ file }) => {
    if (!file) {
      console.error('No file provided');
      process.exit(1);
    }
    // Check if the file exists
    if (!fs.existsSync(file)) {
      console.error('File not found');
      process.exit(1);
    }
    // Read the file
    const contacts = JSON.parse(fs.readFileSync(file));
    console.info(`Read ${contacts.length} contacts from file: ${file}`);
    // Add more summarization logic here.
  });

utils
  .command('test')
  .description('A command to test the CLI')
  .action(() => {
    const spinner = ora({
      text: 'Testing the CLI',
      spinner: cliSpinners.binary,
      color: 'yellow',
    }).start();
    setTimeout(() => {
      spinner.succeed('Test completed');
    }, 5000);
  });

// Welcome message and banner displayed when the CLI is run.

console.log(
  chalk.blue(figlet.textSync('Contacts CLI', { horizontalLayout: 'full' }))
);
console.log(
  boxen(
    chalk.yellow`
A set of tools to manage your Google contacts.
Here is a non-exhaustive list of things you can do:

- List contacts for a given Google account
- Sync contacts between two Google accounts
- Import contacts from a file
- Clean up unused contacts or contacts that fit a certain criteria
- Bulk update contacts
`,
    { padding: 1, margin: 1, borderStyle: 'double' }
  )
);
console.log(
  chalk.green`We are also planning on launching a GUI application, so keep an eye out for that!\n`
);

program.parse(process.argv);
