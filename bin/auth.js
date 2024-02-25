import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { google } from 'googleapis';
// load env variables
import config from './config.js';

// Get the directory name of the current module
const __dirname = path.dirname(new URL(import.meta.url).pathname);
// Update these paths to use environment variables or another secure method
const SCOPES = ['https://www.googleapis.com/auth/contacts'];
const TOKENS_DIR = path.join(__dirname, '..', '.tokens');

// Modify this function to accept an identifier for the account
function getTokenPath(accountEmail) {
  return `${TOKENS_DIR}/${accountEmail}.json`;
}

export async function authorize(accountEmail) {
  const tokenPath = getTokenPath(accountEmail);
  try {
    const token = JSON.parse(fs.readFileSync(tokenPath));
    const oauth2Client = new google.auth.OAuth2(
      config.clientId,
      config.clientSecret,
      'urn:ietf:wg:oauth:2.0:oob'
    );
    oauth2Client.setCredentials(token); // This line is crucial
    return oauth2Client;
  } catch (error) {
    // check if the error is due to the file not existing
    if (error.code === 'ENOENT') {
      console.warn(
        'Error reading token file as it does not exist. Prompting for user authorization.'
      );
      return getAccessToken(accountEmail);
    } else {
      throw error;
    }
  }
}

/**
 * Get and store new token after prompting for user authorization, and then return the authorized OAuth2 client.
 * @param {'string'} accountEmail The type of account to authorize
 */
export async function getAccessToken(accountEmail) {
  // Make sure that the TOKENS_DIR exists
  if (!fs.existsSync(TOKENS_DIR)) {
    fs.mkdirSync(TOKENS_DIR, { recursive: true });
  }
  const tokenPath = getTokenPath(accountEmail);

  const oauth2Client = new google.auth.OAuth2(
    config.clientId,
    config.clientSecret,
    'urn:ietf:wg:oauth:2.0:oob'
  );

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    login_hint: accountEmail,
  });

  console.log('Authorize this app by visiting this url:', authUrl);
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const code = await new Promise((resolve) => {
    rl.question('Enter the code from that page here: ', (code) => {
      rl.close();
      resolve(code);
    });
  });

  const token = await new Promise((resolve, reject) => {
    oauth2Client.getToken(code, (err, token) => {
      if (err) {
        reject(err);
      }
      resolve(token);
    });
  });

  oauth2Client.setCredentials(token);
  fs.writeFileSync(tokenPath, JSON.stringify(token));
  console.log('Token stored to', tokenPath);
  return oauth2Client;
}
