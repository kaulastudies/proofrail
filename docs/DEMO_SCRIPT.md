# MandateGuard — 90-Second Judge Demo

## Recording setup

Use one terminal and the GitHub README. Do not broadcast a new transaction.

Before recording:

```bash
npm ci
npm test -- --runInBand
npm run typecheck
```

For the recorded proof, run only:

```bash
npm run demo
```

---

## 0:00–0:12 — Problem

**Visual:** README title + architecture.

**Say:**

"An autonomous agent can send a valid Solana transaction and still fail the business intent. It might overspend, receive too little, use the wrong destination, or replay an unrelated transaction as proof. MandateGuard separates execution from verification."

---

## 0:12–0:27 — Core design

**Visual:** Architecture diagram.

**Say:**

"The agent receives a machine-checkable Mandate: max input, min output, expected mints, destination, signer, reserve requirement, and a unique mandate binding. The agent can execute, but it cannot authorize its own next step."

---

## 0:27–0:38 — Independent verification

**Visual:** Briefly show `src/verifier/solanaVerifier.ts` or the README flow.

**Say:**

"After execution, MandateGuard independently reconstructs the finalized transaction from Solana data and checks the realized outcome. The workflow continues only if the verifier returns VERIFIED."

---

## 0:38–1:06 — Run the proof

**Visual:** Terminal.

Run:

```bash
npm run demo
```

As the three scenarios print, say:

"This demo uses one frozen, real Solana mainnet transaction and passes it through the production verifier locally. The original mandate verifies. The exact same transaction under the wrong mandate binding is blocked. Then we tighten max input by one unit, and the same transaction is blocked again."

Pause long enough for the three statuses to be visible.

---

## 1:06–1:20 — Evaluation rigor

**Visual:** README evidence section or `docs/PHASE5_EVALUATION_HISTORY.md`.

**Say:**

"The live run also exposed two defects in our first verifier: ATA rent was being counted as swap input, and the SOL reserve check used the wrong balance semantics. We preserved the failure, fixed the evaluator, added regression tests, and replayed the exact immutable transaction."

---

## 1:20–1:30 — Close

**Visual:** Terminal summary + GitHub repo.

**Say:**

"MandateGuard's rule is simple: a successful transaction is not automatically a successful business action. Agents may execute, but only independently verified outcomes unlock what happens next."

---

## What must be visible in the recording

- project name: MandateGuard
- `npm run demo`
- scenario 1: `VERIFIED`
- scenario 2: `missing_or_invalid_mandate_binding`
- scenario 3: `max_input_exceeded`
- "No transaction broadcast"
- "No SOL spent"
- public GitHub repository

## Avoid

- exposing `.env`, RPC endpoints, or wallet secrets
- opening `verify-live.ts` and accidentally invoking live RPC
- claiming the memo nonce is itself a cryptographic proof
- claiming verifier v1.0 passed
- spending additional SOL for the recording
