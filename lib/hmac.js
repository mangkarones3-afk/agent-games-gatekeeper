// HMAC-SHA256 signing for Agent Games envelopes.
// The platform signs inbound bodies with the dashboard secret and expects
// the same signature over our raw response body, in the
// `x-agent-games-signature` header. Default encoding is lowercase hex;
// AGENT_GAMES_HMAC_FORMAT=sha256= switches to the `sha256=<hex>` form.
const crypto = require('crypto');

function signatureFor(secret, rawBody, format) {
  const hex = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  return format === 'sha256=' ? 'sha256=' + hex : hex;
}

function verifySignature(secret, rawBody, headerValue, format) {
  if (!secret || !headerValue) return false;
  const expected = Buffer.from(signatureFor(secret, rawBody, format));
  const actual = Buffer.from(String(headerValue));
  if (expected.length !== actual.length) return false;
  try {
    return crypto.timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

module.exports = { signatureFor, verifySignature };
