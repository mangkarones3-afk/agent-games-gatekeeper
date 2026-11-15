// snarkjs wrapper for the official Gatekeeper circuit artifacts.
const path = require('path');
const snarkjs = require('snarkjs');

const WASM = path.join(__dirname, '..', 'circuits', 'gatekeeper.wasm');
const ZKEY = path.join(__dirname, '..', 'circuits', 'gatekeeper_final.zkey');

let vkPromise = null;
function getVerificationKey() {
  if (!vkPromise) vkPromise = snarkjs.zKey.exportVerificationKey(ZKEY);
  return vkPromise;
}

async function prove(input) {
  return snarkjs.groth16.fullProve(input, WASM, ZKEY);
}

async function verifyLocally(publicSignals, proof) {
  const vk = await getVerificationKey();
  return snarkjs.groth16.verify(vk, publicSignals, proof);
}

module.exports = { prove, verifyLocally };
