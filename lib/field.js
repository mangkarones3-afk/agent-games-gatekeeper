// Field helpers for the BN128 circuits used by Agent Games.
const { keccak_256 } = require('js-sha3');

const FIELD_PRIME = BigInt(
  '21888242871839275222246405745257275088548364400416034343698204186575808495617'
);

function toField(x) {
  let b;
  if (typeof x === 'bigint') b = x;
  else if (typeof x === 'number') b = BigInt(x);
  else b = BigInt(x); // decimal or 0x-hex string
  const r = b % FIELD_PRIME;
  return r < 0n ? r + FIELD_PRIME : r;
}

function keccak256ModP(buffers) {
  const hex = '0x' + keccak_256(Buffer.concat(buffers));
  return toField(BigInt(hex));
}

module.exports = { FIELD_PRIME, toField, keccak256ModP };
