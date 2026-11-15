// Download the official Gatekeeper circuit artifacts if they are missing.
// Used on hosted deploys, where the (binary) artifacts are not in git.
const fs = require('fs');
const https = require('https');
const path = require('path');

const DIR = path.join(__dirname, '..', 'circuits');
const FILES = {
  'gatekeeper.wasm': 'https://agentgames.zkverify.io/circuits/gatekeeper.wasm',
  'gatekeeper_final.zkey': 'https://agentgames.zkverify.io/circuits/gatekeeper_final.zkey',
};

function download(url, dest) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(download(res.headers.location, dest));
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`download ${url} -> HTTP ${res.statusCode}`));
      }
      const tmp = dest + '.tmp';
      const out = fs.createWriteStream(tmp);
      res.pipe(out);
      out.on('finish', () => out.close(() => { fs.renameSync(tmp, dest); resolve(); }));
      out.on('error', reject);
    }).on('error', reject);
  });
}

async function ensureCircuits() {
  fs.mkdirSync(DIR, { recursive: true });
  for (const [name, url] of Object.entries(FILES)) {
    const dest = path.join(DIR, name);
    if (!fs.existsSync(dest) || fs.statSync(dest).size === 0) {
      console.log('[circuits] downloading', name);
      await download(url, dest);
    }
  }
}

if (require.main === module) {
  ensureCircuits().then(() => console.log('[circuits] ready')).catch((e) => {
    console.error('[circuits] failed:', e.message);
    process.exit(1);
  });
}

module.exports = { ensureCircuits };
