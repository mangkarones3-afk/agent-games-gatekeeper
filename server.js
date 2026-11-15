// Proof Gatekeeper agent — Agent Games Season 01 (zkVerify).
// Plain Node http server. Endpoints:
//   GET  /health     -> status incl. startup proof self-test result
//   POST /gatekeeper -> signed task envelope in, signed decision + proof out
//
// Behaviour notes:
// - Inbound HMAC is verified over the RAW body before JSON parsing, when a
//   secret is configured (AGENT_GAMES_HMAC_SECRET from the dashboard).
// - Every response is signed with x-agent-games-signature over its raw body.
// - Preflight envelopes {"type":"agent-games.preflight.v1"} are answered
//   {ok:true, protocolVersion:"v1"}.
// - PROOF_REUSED answers carry no proof (platform excludes them from the
//   reliability bonus). If proof generation ever fails, the decision is
//   still returned without a proof rather than crashing (fail visible).
const http = require('http');
const { signatureFor, verifySignature } = require('./lib/hmac');
const { decide } = require('./gatekeeper/decide');
const { proveTask } = require('./gatekeeper/prove');
const { verifyLocally } = require('./lib/snark');

const PORT = Number(process.env.PORT || 8080);
const HOST = process.env.HOST || '0.0.0.0';
const HMAC_SECRET = process.env.AGENT_GAMES_HMAC_SECRET || '';
const HMAC_FORMAT = process.env.AGENT_GAMES_HMAC_FORMAT || 'hex';
const TASK_ID_MODE = process.env.GATEKEEPER_TASK_ID_MODE || 'keccak';

const VK_HASH = '0x6b79c6012a6d8651f3e13bc4d2a20370280ab49700c90c5316d4168bfbad77b0';

let selfTest = 'pending';

async function runSelfTest() {
  const task = {
    task_id: 'selftest_1',
    registered_vk: VK_HASH,
    proof_vk: VK_HASH,
    minimum: '1000',
    public_balance: '1460',
    expiry_block: '8430000',
    current_block: '8420000',
    recipient: '12345',
    condition_recipient: '12345',
    amount: '500',
    max_transfer: '1000',
    proof_tx: '0xselftest',
  };
  try {
    const { decision } = decide(task);
    const { proof, publicSignals } = await proveTask(task, decision, TASK_ID_MODE);
    const ok = await verifyLocally(publicSignals, proof);
    selfTest = ok ? 'PASS' : 'FAIL (proof did not verify)';
  } catch (e) {
    selfTest = 'FAIL (' + e.message + ')';
  }
  console.log('[selftest] gatekeeper proof self-test:', selfTest);
}

function sendSigned(res, status, obj) {
  const body = JSON.stringify(obj);
  const headers = { 'content-type': 'application/json' };
  if (HMAC_SECRET) {
    headers['x-agent-games-signature'] = signatureFor(HMAC_SECRET, body, HMAC_FORMAT);
  }
  res.writeHead(status, headers);
  res.end(body);
}

const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    return sendSigned(res, 200, {
      ok: true,
      agent: 'proof-gatekeeper',
      hmacConfigured: Boolean(HMAC_SECRET),
      taskIdMode: TASK_ID_MODE,
      selfTest,
    });
  }

  if (req.method === 'POST' && req.url === '/gatekeeper') {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', async () => {
      const raw = Buffer.concat(chunks);
      if (HMAC_SECRET && !verifySignature(HMAC_SECRET, raw, req.headers['x-agent-games-signature'], HMAC_FORMAT)) {
        return sendSigned(res, 401, { ok: false, error: 'bad signature' });
      }
      let task;
      try {
        task = JSON.parse(raw.toString('utf8'));
      } catch {
        return sendSigned(res, 400, { ok: false, error: 'invalid json' });
      }
      if (task && task.type === 'agent-games.preflight.v1') {
        return sendSigned(res, 200, { ok: true, protocolVersion: 'v1' });
      }
      try {
        const started = Date.now();
        // Platform envelopes wrap the condition fields in `input`; decide/prove
        // work on the flat shape (task_id stays at envelope level).
        const input = task && typeof task.input === 'object' && task.input ? task.input : {};
        const flatTask = { ...input, task_id: task.task_id };
        const { decision, reason_code } = decide(flatTask);
        const out = { decision, reason_code };
        if (flatTask.proof_tx) out.proof_tx = flatTask.proof_tx;
        if (reason_code !== 'PROOF_REUSED') {
          try {
            const { proof, publicSignals } = await proveTask(flatTask, decision, TASK_ID_MODE);
            out.proof = proof;
            out.public_signals = publicSignals;
          } catch (e) {
            console.error('[gatekeeper] proof failed for', task.task_id, e.message);
            out.proof_error = 'proof generation failed';
          }
        }
        console.log('[gatekeeper]', task.task_id, decision, reason_code, Date.now() - started + 'ms');
        return sendSigned(res, 200, out);
      } catch (e) {
        console.error('[gatekeeper] handler error', e);
        return sendSigned(res, 500, { ok: false, error: 'handler error' });
      }
    });
    return;
  }

  return sendSigned(res, 404, { ok: false, error: 'not found' });
});

const { ensureCircuits } = require('./scripts/fetch-circuits');

ensureCircuits()
  .then(() => {
    server.listen(PORT, HOST, () => {
      console.log(`[gatekeeper] listening on ${HOST}:${PORT} (hmac ${HMAC_SECRET ? 'on' : 'OFF — set AGENT_GAMES_HMAC_SECRET before going live'})`);
      runSelfTest();
    });
  })
  .catch((e) => {
    console.error('[circuits] could not prepare circuit artifacts:', e.message);
    process.exit(1);
  });
