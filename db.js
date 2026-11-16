// Connects to MongoDB. If MongoDB is not running, starts the local mongod.exe automatically.
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const mongoose = require('mongoose');
const { MONGO_URI, MONGOD_PATH, DB_PATH } = require('./config');

let mongodProcess = null;

function tryConnect() {
  return mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 2500 });
}

function startMongod() {
  if (!fs.existsSync(MONGOD_PATH)) {
    throw new Error(`MongoDB is not running and mongod.exe was not found at ${MONGOD_PATH}`);
  }
  fs.mkdirSync(DB_PATH, { recursive: true });
  const logPath = path.join(path.dirname(DB_PATH), 'mongod.log');
  console.log('[db] Starting local MongoDB...');
  mongodProcess = spawn(
    MONGOD_PATH,
    ['--dbpath', DB_PATH, '--port', '27017', '--bind_ip', '127.0.0.1', '--logpath', logPath, '--logappend'],
    { stdio: 'ignore', windowsHide: true }
  );
  mongodProcess.on('exit', (code) => {
    if (code) console.error(`[db] mongod exited with code ${code} (see ${logPath})`);
    mongodProcess = null;
  });
}

async function connectDB() {
  try {
    await tryConnect();
  } catch {
    startMongod();
    let lastErr;
    for (let i = 0; i < 15; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      try {
        await tryConnect();
        lastErr = null;
        break;
      } catch (e) {
        lastErr = e;
      }
    }
    if (lastErr) throw lastErr;
  }
  console.log('[db] Connected to MongoDB:', MONGO_URI);
}

// Stops the MongoDB we started, cleanly (so all data is written to disk)
async function stopMongod() {
  if (!mongodProcess) return;
  const proc = mongodProcess;
  try { await mongoose.connection.db.admin().command({ shutdown: 1 }); } catch {}
  await new Promise((resolve) => { const t = setTimeout(() => { proc.kill(); resolve(); }, 8000); proc.once('exit', () => { clearTimeout(t); resolve(); }); if (proc.exitCode !== null) { clearTimeout(t); resolve(); } });
}

module.exports = { connectDB, stopMongod };
