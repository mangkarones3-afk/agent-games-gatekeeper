// Gatekeeper proof generation.
// Circuit inputs: registeredVkHash, proofVkHash, minimum, publicBalance,
// expiryBlock, currentBlock, recipient, conditionRecipient, amount,
// maxTransfer, decision (1=APPROVE, 0=REJECT), taskId, salt (private).
// Public signals (13): a salt-dependent binding hash, then the 12 task
// fields above (minus salt).
//
// taskId mapping is the one open protocol item: the envelope task_id is a
// string (e.g. "gk_24_9d1") and the circuit needs a field element.
// Default mode "keccak": keccak256(utf8(task_id)) mod p. Alternatives via
// GATEKEEPER_TASK_ID_MODE: "numeric" (digits of the id), "hex" (hex chars).
// Confirm against a practice task after registration; switch if rejected.
const crypto = require('crypto');
const { toField, keccak256ModP } = require('../lib/field');
const { prove } = require('../lib/snark');

function taskIdToField(taskId, mode) {
  const id = String(taskId || '');
  if (mode === 'numeric') {
    const digits = id.replace(/\D/g, '');
    return digits ? toField(BigInt(digits)) : 0n;
  }
  if (mode === 'hex') {
    const hex = id.replace(/[^0-9a-fA-F]/g, '');
    return hex ? toField(BigInt('0x' + hex)) : 0n;
  }
  return keccak256ModP([Buffer.from(id, 'utf8')]);
}

function buildInput(task, decision, taskIdMode) {
  return {
    registeredVkHash: String(task.registered_vk),
    proofVkHash: String(task.proof_vk),
    minimum: String(task.minimum),
    publicBalance: String(task.public_balance),
    expiryBlock: String(task.expiry_block),
    currentBlock: String(task.current_block),
    recipient: String(task.recipient),
    conditionRecipient: String(task.condition_recipient),
    amount: String(task.amount),
    maxTransfer: String(task.max_transfer),
    decision: decision === 'APPROVE' ? '1' : '0',
    taskId: taskIdToField(task.task_id, taskIdMode).toString(),
    salt: '0x' + crypto.randomBytes(32).toString('hex'),
  };
}

async function proveTask(task, decision, taskIdMode) {
  return prove(buildInput(task, decision, taskIdMode));
}

module.exports = { taskIdToField, buildInput, proveTask };
