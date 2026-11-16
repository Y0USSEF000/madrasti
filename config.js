const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

// Load settings from the .env file (Gmail address and app password, etc.)
const ENV_FILE = path.join(__dirname, '.env');
try { process.loadEnvFile(ENV_FILE); } catch {}

// The secret key that signs the login sessions. A private random key is created the first time
// and saved in .env, so nobody on the internet can guess it.
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = crypto.randomBytes(48).toString('hex');
  try { fs.appendFileSync(ENV_FILE, `\n# Secret key for login sessions (created automatically, keep it private)\nJWT_SECRET=${process.env.JWT_SECRET}\n`); } catch {}
}

module.exports = {
  PORT: process.env.PORT || 5050,
  MONGO_URI: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/madrasti',
  JWT_SECRET: process.env.JWT_SECRET,
  // Portable MongoDB (no admin rights needed). Used only when no MongoDB is already running.
  // Default place: <your home folder>/tools/mongodb/bin/mongod(.exe)
  MONGOD_PATH: process.env.MONGOD_PATH
    || path.join(os.homedir(), 'tools', 'mongodb', 'bin', process.platform === 'win32' ? 'mongod.exe' : 'mongod'),
  DB_PATH: path.join(__dirname, 'data', 'db'),
  UPLOAD_DIR: path.join(__dirname, 'uploads'),
};
