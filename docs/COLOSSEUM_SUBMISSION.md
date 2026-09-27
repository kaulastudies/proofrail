# Colosseum Crypto World's Fair — Final Submission Draft

**Project:** MandateGuard  
**Track:** Solana Ecosystem  
**Tagline:** Deterministic post-execution verification for autonomous on-chain agents.

## One-sentence pitch

MandateGuard lets an autonomous agent act on Solana only under a machine-checkable mandate, then independently reconstructs the finalized transaction from RPC data and blocks the next workflow step unless the realized outcome is verified.

## Problem

Autonomous agents can propose and execute on-chain actions, but execution success alone does not prove the intended business action actually happened within policy.

A transaction can finalize while still violating the user's mandate: too much input spent, too little output received, the wrong destination used, the wrong signer involved, or an unrelated historical transaction replayed as "proof."

Most agent stacks trust the same agent that executed the action to report whether it succeeded. MandateGuard moves that decision outside the agent.

## Solution

MandateGuard introduces a deterministic verification layer between execution and continuation:

```
Agent proposes
      ↓
Policy issues Mandate
      ↓
Agent executes on Solana
      ↓
MandateGuard reconstructs finalized outcome
      ↓
VERIFIED → next action allowed
FAILED_VERIFICATION → workflow blocked
```

A Mandate defines enforceable constraints such as:

- maximum input amount
- minimum output amount
- expected input/output mints
- destination account
- authorized signer
- reserve requirement
- unique mandate ID + nonce binding

The verifier ignores the agent's narrative and evaluates the finalized Solana transaction directly from RPC metadata.

## Functionality

The current proof-of-concept includes:

- typed mandate schema
- deterministic policy checks
- Solana transaction reconstruction
- canonical mandate memo binding
- signer, mint, destination, input, output, and reserve checks
- explicit verification state machine
- evidence bundles
- replay-attack protection
- regression tests for first-time ATA rent and native SOL reserve semantics
- offline replay of a real finalized Solana mainnet transaction

Judge demo:

```bash
npm ci
npm test
npm run typecheck
npm run demo
```

The deterministic demo reuses one immutable finalized mainnet payload across three cases:

1. valid mandate → `VERIFIED`
2. altered mandate binding / replay attempt → `FAILED_VERIFICATION`
3. stricter max-input mandate → `FAILED_VERIFICATION`

No network broadcast and no SOL are required for the demo.

## Mainnet Proof

MandateGuard was exercised against a real Jupiter swap on Solana Mainnet.

**Transaction signature:**  
`67YtUCn89S2JfAdjfpmcRSk4FFbq8xnfRfYdo7z2oCdpPL9RTJuLQYccQRCKRdXcApJKKiXKhAzLRJ9M6uifgnmY`

**Frozen raw RPC payload SHA-256:**  
`91382a835167c45ed533bb9ca5b36052c8ccc39a60c64f7e40facb145eaeace4`

The first verifier version produced a false failure because it treated first-time ATA rent as swap input and used balance delta rather than the actual post-balance for the native reserve check.

We preserved that failure, reproduced it, corrected the evaluator semantics, added regression coverage, and replayed the exact same immutable transaction under verifier v1.1.

Current suite: **23/23 tests passing**.

## Novelty

MandateGuard is not another transaction simulator or agent prompt guardrail.

Its core distinction is **continuation gating based on independently verified realized outcome**:

```
NEXT_ACTION_ALLOWED = previous_action.status == VERIFIED
```

The agent is allowed to propose and execute, but it is not the authority on whether its own action satisfied policy.

This separates:

- intent from execution
- execution from verification
- verification from authorization to continue

## Potential Impact

As agent wallets, treasury automation, trading agents, and autonomous protocol workflows grow, a common safety problem appears: downstream actions depend on trusting what happened upstream.

MandateGuard can provide a reusable verification boundary for:

- AI-controlled treasuries
- autonomous trading agents
- DAO operations
- payroll and payment automation
- protocol keepers
- multi-step DeFi workflows
- agent-to-agent commerce

The initial wedge is Solana treasury and swap workflows, where account-level transaction metadata enables deterministic reconstruction of realized outcomes.

## UX

The intended developer experience is deliberately simple:

1. define a Mandate
2. execute through the existing Solana/Jupiter workflow
3. submit the transaction signature for verification
4. receive a deterministic `VERIFIED` or `FAILED_VERIFICATION`
5. gate the next action on that result

For judges and developers, the full proof runs locally with one command:

```bash
npm run demo
```

The demo needs no funded wallet, RPC key, or live transaction.

## Open Source & Composability

MandateGuard is open source under the MIT License.

The verifier is separated from the execution adapter so additional Solana primitives can be integrated without changing the trust model.

Current integration focus:
- Solana RPC
- Jupiter swaps

Planned adapters:
- staking
- lending
- treasury payments
- additional swap venues
- agent-wallet frameworks

## Business Plan

The initial customer is a team building autonomous agents that control real financial value but needs deterministic policy enforcement and audit evidence.

Potential commercial model:

- open-source verifier core
- hosted verification API
- managed evidence retention and audit trails
- enterprise policy packs and protocol adapters
- multi-agent treasury orchestration
- usage-based pricing per verified execution or workflow

The long-term product is a verification and authorization layer for autonomous financial software: agents may decide what to attempt, but MandateGuard decides whether the observed result is safe enough for the workflow to continue.

## Why Solana

Solana provides detailed finalized transaction metadata, account balances, token balances, instruction data, and signatures that make deterministic post-execution reconstruction practical.

Its low transaction costs and fast execution also make multi-step autonomous workflows realistic, increasing the need for an independent verification boundary between steps.

## Repository

https://github.com/kaulastudies/proofrail

## Demo

Run:

```bash
npm ci
npm run demo
```

The repository includes the frozen mainnet payload, verifier evidence, evaluation history, tests, and CI.
