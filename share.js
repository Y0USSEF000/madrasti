// Starts Madrasti and creates a public link that anyone can open (Cloudflare quick tunnel).
// Run with:  node share.js   (or double-click share.bat)
// The link works while this window stays open. A new link is created each time.
const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const { PORT } = require('./config');

// Default place: <your home folder>/tools/cloudflared/cloudflared(.exe)
const CLOUDFLARED = process.env.CLOUDFLARED_PATH
  || path.join(require('os').homedir(), 'tools', 'cloudflared', process.platform === 'win32' ? 'cloudflared.exe' : 'cloudflared');
const LINK_FILE = path.join(__dirname, 'share-link.txt');
const local = `http://localhost:${PORT}`;
let server = null;
let tunnel = null;

const isUp = () => new Promise((resolve) => {
  const req = http.get(`${local}/api/cities`, (res) => { res.resume(); resolve(res.statusCode === 200); });
  req.on('error', () => resolve(false));
  req.setTimeout(2000, () => { req.destroy(); resolve(false); });
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function startServer() {
  if (await isUp()) { console.log(`Madrasti is already running on ${local}`); return; }
  console.log('Starting Madrasti...');
  let exited = false;
  server = spawn(process.execPath, [path.join(__dirname, 'server.js')], { stdio: ['ignore', 'pipe', 'pipe'] });
  let errText = '';
  server.stdout.on('data', (d) => process.stdout.write(d));
  server.stderr.on('data', (d) => { errText += d; });
  server.on('exit', async (code) => {
    exited = true;
    // If another Madrasti is already using the port (started from start.bat for example), just use that one
    if (/EADDRINUSE/.test(errText) && (await isUp())) { server = null; return; }
    if (errText) process.stderr.write(errText);
    console.log(`Madrasti server stopped (code ${code}).`);
    stop(1);
  });
  for (let i = 0; i < 40; i++) {
    if (await isUp()) { if (exited) console.log(`Madrasti is already running on ${local}`); return; }
    await sleep(1000);
  }
  throw new Error('Madrasti did not start. Look at the messages above.');
}

function startTunnel() {
  if (!fs.existsSync(CLOUDFLARED)) throw new Error(`cloudflared was not found at ${CLOUDFLARED}. Download it from Cloudflare, or set CLOUDFLARED_PATH.`);
  console.log('Creating the public link...');
  tunnel = spawn(CLOUDFLARED, ['tunnel', '--url', local, '--no-autoupdate'], { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  let shown = false;
  const onData = (buf) => {
    const m = String(buf).match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
    if (m && !shown) {
      shown = true;
      const url = m[0];
      try { fs.writeFileSync(LINK_FILE, url + '\n'); } catch {}
      try { const clip = spawn('clip'); clip.stdin.end(url); } catch {}
      const line = '='.repeat(url.length + 8);
      console.log(`\n${line}\n    ${url}\n${line}`);
      console.log('This is your public link. It is copied to the clipboard and saved in share-link.txt.');
      console.log('Send it to anyone. It works while this window stays open. Press Ctrl+C to stop sharing.\n');
    }
  };
  tunnel.stdout.on('data', onData);
  tunnel.stderr.on('data', onData);
  tunnel.on('exit', (code) => { console.log(`The public link stopped (code ${code}).`); stop(code ? 1 : 0); });
}

let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  try { fs.unlinkSync(LINK_FILE); } catch {}
  if (tunnel && tunnel.exitCode === null) tunnel.kill();
  if (server && server.exitCode === null) server.kill('SIGINT');
  setTimeout(() => process.exit(code), 1500);
}
process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));

startServer().then(startTunnel).catch((e) => { console.error(e.message); stop(1); });
