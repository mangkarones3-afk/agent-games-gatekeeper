// Local harness: decision checklist (all traps + boundaries) and real
// proof generation + local verification for a VALID and a REJECT case.
const assert = require('assert');
const { decide, seenProofTx } = require('./gatekeeper/decide');
const { proveTask } = require('./gatekeeper/prove');
const { verifyLocally } = require('./lib/snark');

const VK = '0x6b79c6012a6d8651f3e13bc4d2a20370280ab49700c90c5316d4168bfbad77b0';
const base = {
  task_id: 'gk_test_1',
  registered_vk: VK,
  proof_vk: VK,
  minimum: '1000',
  public_balance: '1460',
  expiry_block: '8430000',
  current_block: '8420000',
  recipient: '12345',
  condition_recipient: '12345',
  amount: '500',
  max_transfer: '1000',
  proof_tx: '0xtx1',
};

function check(name, patch, expected) {
  const got = decide({ ...base, ...patch });
  assert.strictEqual(got.reason_code, expected, `${name}: got ${got.reason_code}, want ${expected}`);
  console.log('ok -', name, '->', got.decision, got.reason_code);
}

async function main() {
  check('valid condition', {}, 'VALID_CONDITION');
  check('vk substitution', { proof_vk: '0xdead' }, 'VK_SUBSTITUTION');
  check('threshold mismatch', { public_balance: '999' }, 'THRESHOLD_MISMATCH');
  check('balance == minimum is valid', { task_id: 'gk_test_2', proof_tx: '0xtx2', public_balance: '1000' }, 'VALID_CONDITION');
  check('expired (current > expiry)', { task_id: 'gk_test_3', proof_tx: '0xtx3', current_block: '8430001' }, 'EXPIRED_CONDITION');
  check('expired boundary (current == expiry)', { task_id: 'gk_test_4', proof_tx: '0xtx4', current_block: '8430000' }, 'EXPIRED_CONDITION');
  check('recipient mismatch', { task_id: 'gk_test_5', proof_tx: '0xtx5', recipient: '99999' }, 'RECIPIENT_MISMATCH');
  check('amount overflow', { task_id: 'gk_test_6', proof_tx: '0xtx6', amount: '1001' }, 'AMOUNT_OVERFLOW');
  check('amount == max is valid', { task_id: 'gk_test_7', proof_tx: '0xtx7', amount: '1000' }, 'VALID_CONDITION');
  // proof reuse: 0xtx1 was first seen under gk_test_1
  check('proof reused under another task', { task_id: 'gk_test_8', proof_tx: '0xtx1' }, 'PROOF_REUSED');
  check('same-task retry is not reuse', { task_id: 'gk_test_1', proof_tx: '0xtx1' }, 'VALID_CONDITION');
  console.log('seen proof_tx entries:', seenProofTx.size);

  for (const [name, patch] of [
    ['APPROVE proof', {}],
    ['REJECT proof', { public_balance: '10' }],
  ]) {
    const task = { ...base, task_id: 'gk_proof_' + name, proof_tx: '0x' + name, ...patch };
    const { decision } = decide(task);
    const t0 = Date.now();
    const { proof, publicSignals } = await proveTask(task, decision, 'keccak');
    const ok = await verifyLocally(publicSignals, proof);
    assert.strictEqual(ok, true, name + ' did not verify');
    console.log('ok -', name, decision, 'verified locally in', Date.now() - t0 + 'ms', '| public signals:', publicSignals.length);
  }
  console.log('ALL TESTS PASSED');
}

main().catch((e) => {
  console.error('TEST FAILED:', e);
  process.exit(1);
});
