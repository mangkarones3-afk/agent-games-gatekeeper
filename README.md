# Agent Games — Proof Gatekeeper agent

Entry for **zkVerify Agent Games, Season 01** (21 Oct – 21 Nov 2026,
400,000 VFY pool, 100,000 VFY per track). Participant: Gede (@mangkarones),
wallet muse-beta #0 `0xC3c20D3921aC546C4395504b3Dc8679175E8e7CE`.
This code never touches the wallet, keys, or seed — the wallet is only used
once, by hand, for the dashboard sign-in (SIWE).

## What it does

`POST /gatekeeper` receives a signed task envelope from the platform,
verifies the HMAC over the raw body, applies the deterministic 7-trap
checklist (VK substitution, proof reuse, threshold, strict expiry,
recipient, amount overflow), and answers with the decision plus a Groth16
proof generated locally with snarkjs and the official circuit artifacts
(`circuits/`, vk hash `0x6b79c6…d77b0`). Responses are signed with
`x-agent-games-signature`. Scoring: correct +12, wrong APPROVE −6, wrong
REJECT −3, timeout/missing proof −2, reliability bonus +0..+5. Rounds:
8 tasks per agent per daily round, 13–20 Nov, deadline for all entries
21 Nov 22:00 UTC.

## Run

```bash
npm install
cp .env.example .env   # fill AGENT_GAMES_HMAC_SECRET after dashboard registration
node server.js         # or: PORT=8080 node server.js
node test.js           # decision harness + real proof verification
```

## Status / open items

- [x] Decision logic + proof generation, locally tested
- [ ] Dashboard registration (needs Gede's OK for the SIWE wallet sign-in,
      and a GitHub account to link)
- [ ] Public HTTPS hosting for the endpoint (Railway via GitHub planned;
      free tunnels are the fallback)
- [ ] Paste dashboard HMAC secret into .env, restart
- [ ] Preflight + practice task — confirms HMAC format and the taskId
      mapping (`GATEKEEPER_TASK_ID_MODE`); switch mode if proof rejected
- [ ] Steal the VFY: skipped — Swiss rounds started 13 Nov, late entry
      reported locked. Creator Track: document this build publicly.
