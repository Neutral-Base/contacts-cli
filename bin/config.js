import dotenv from 'dotenv/config';

export default {
  clientId: process.env.GCP_CLIENT_ID,
  clientSecret: process.env.GCP_CLIENT_SECRET,
  redirectUri: 'http://localhost',
};
