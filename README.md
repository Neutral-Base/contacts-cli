# Contacts-CLI

## Discalimer:

User be advised.

The following software is still under active development and is not meant for use
in a production environment. The developer of this product will not take any responsibility
for damagers incurred from this tool. Use at your own risk.

## Supported platforms:

Currently, only Google contacts is supported, but we plan on supporting more
in the future.

## Requirements:

- NodeJS v20
- GCP project with the People API enabled

This program has only been tested on MacOS Ventura 13.1. It should however,
work on other systems with the correct NodeJS version.

## Setting up the GCP project:

**Prerequisites**

- A Google Account
- A Google Cloud Platform project (If you don't have one, you'll be guided to create one)

**Steps**

1. **Enable the People API**

   - Navigate to the Google Cloud Console: https://console.cloud.google.com/
   - Select your GCP project from the dropdown at the top.
   - In the search bar, type "People API" and select it from the results.
   - Click the **"Enable"** button.

2. **Configure the OAuth Consent Screen**

   - In the Google Cloud Console, go to **APIs & Services** -> **OAuth Consent Screen**.
   - Select the appropriate user type (Internal or External).
   - Fill out the required app information.

3. **Add Scopes**

   - In the "Scopes" section, click **"Add or Remove Scopes"**.
   - Search for `auth/contacts` and select it (and optionally `auth/contacts.readonly`).
   - Click **"Update"**

4. **Obtain Credentials**

   - Go to **APIs & Services** -> **Credentials**.
   - Click **"Create credentials"** and select **"OAuth client ID"**.
   - Choose `Desktop app` as the application type.
   - Click **"Create"** and store your client ID and client secret securely.

**Important Notes:**

- **Verification:** Apps using sensitive scopes might need verification.
- **Scope Best Practices:** Request only the minimum necessary scopes.

**Code Example (Illustrative: Choose a language)**

## Setting up the CLI:

1. Install the packages.

```bash
# npm
npm install
```

```bash
# yarn
yarn
```

2. Make a copy of `.env.example` and set the environment variables specific to
   your GCP project. You will find these values in the credentials file that you
   obtained from the `Setting up the GCP project` step.

## Usage:

Since this program is not a proper package yet, it is necessary to run commands
from the project root. If for some reason, the program fails, please make sure
that the following folders exist:

- `.tokens`, for storing user auth tokens
- `output` which is the default location for storing results, if applicable

Please make sure to keep the contents of the `.token` file secure.

### Quick commands:

Here are is a list of the most useful commands to get you started with the tool.
Please note that most of these commands support additional arguments, but they
have not been documented as they are either not implemented in their entiretey,
or are undergoing testing.

This document will be updated as changes are made to the commands.

#### Export the contacts of a specific account.

Note that this will only fetch contacts from the main contact list. Contacts
from the `Other` or `Directory` contact groups will not be returned.

```bash
node bin/index.js contacts export -a test@gmail.com
```

#### Import contact data into a specific account from a JSON file

```bash
node bin/index.js contacts import -d desitnation@gmail.com -f <path to file>
```

#### List contact groups of a specific account

```bash
node bin/index.js contact-groups list -a test@gmail.com
```

For saving to a file

```bash
node bin/index.js contact-groups list -a test@gmail.com -o <path to output file>
```

Please note that if the directory does not exist, the program will create the directory for you. If a file with the same name exists, the program will overwrite the file.

#### Clean urls from the contacts of a specific account

This command will remove all urls from the contacts of a specific account. The
`--urls` flag is required to indicate that urls should be removed. You need to
pass in the `--url-type` flag to indicate the type of url to remove.

```bash
node bin/index.js contacts clean --urls --url-type "Dex Contact Details" -f <path to file> -a test@gmail.com
```

If a file is not provided, the data will be fetched from the account.
This may be useful when the data on the local file is outdated.

```bash
node bin/index.js contacts clean --urls --url-type "Dex Contact Details" -a test@gmail.com
```

#### Clean external ids from the contacts of a specific account

Not implemented yet.

### Todo:

- Create npm package
- Introduce semver and release cycles
- Logging
- Support more services such as Apple contacts and Microsoft contacts
- Graciously handle daily limits
- Create more efficient batching for handling failed batches
- Introduce back-off when adding contacts one-by-one
- Implement better error-handling
- Implement unit tests
