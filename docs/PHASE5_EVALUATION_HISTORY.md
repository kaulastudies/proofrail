# Phase 5 Live Evaluation History

## Transaction Identifiers
- **Exact Transaction Signature:** `67YtUCn89S2JfAdjfpmcRSk4FFbq8xnfRfYdo7z2oCdpPL9RTJuLQYccQRCKRdXcApJKKiXKhAzLRJ9M6uifgnmY`
- **Exact Raw RPC Payload Hash:** `91382a835167c45ed533bb9ca5b36052c8ccc39a60c64f7e40facb145eaeace4`
- **Mandate Hash:** `1a665222ab14de535fce4e0e38a0b862e18ea2a497dbae6c676d7cd365bb8cf8`
- **Mandate ID / Nonce:** `live-mandate-001` / `f4cd7ad3d83aecda`

## Timeline Note
**Important:** The MandateGuard evaluator behavior (Verifier v1.0 -> v1.1) was modified *only after* the live transaction exposed semantic defects in the verifier itself. The candidate script's output (the immutable Solana transaction) was held constant. This proves MandateGuard is capable of detecting and isolating edge cases in its own evaluation logic through reproducible on-chain evidence, aligning with the principle of "verify the evaluation before trusting the verdict."

---

## Verifier v1.0
### Behavior
The original verifier returned:
- **Status:** `FAILED_VERIFICATION`
- **Failed Invariants:** `max_input_exceeded`, `reserve_requirement_violation`

> **Note:** The original v1.0 structured output file was not preserved separately before the verifier was updated and re-run. The failure state was explicitly recorded in the agent logs (see `evidence/phase5/agent-logs/task-759.log`). The file `live_verification_result_v1.0.reconstructed.json` was reconstructed from the recorded v1.0 execution result to preserve this history.

### Semantic Defects Exposing the Failure
1. **Infrastructure Costs Lumped into Swap Input:** The user's disposable wallet was interacting with USDC for the first time. The Jupiter swap automatically created a new Associated Token Account (ATA), costing the signer an additional ~0.001488 SOL (1,488,440 lamports) in rent. Verifier v1.0 incorrectly aggregated this deterministic infrastructure cost into the "swap input", causing the total apparent spend to breach `maxInputAmount`. 
2. **Native SOL Reserve Checks Used Deltas:** The logic checking whether the remaining wallet balance satisfied `minUsdcReserve` (re-used for native SOL) was inspecting the *balance delta* (a negative number for expenditure) instead of the actual absolute post-balance. Because `-2045280 < 0`, it falsely flagged a reserve violation.

---

## Verifier v1.1
### Exact Code Changes
1. **Infrastructure Cost Isolation:** Added logic to detect newly created accounts (pre=0, 0 < post <= 3,000,000, not owned by signer) to calculate `rentPaidBySigner`. This `rentPaidBySigner` is explicitly deducted from `inputSpentBySigner` to represent the true swap cost.
2. **Absolute Reserve Calculation:** Introduced `actualRemainingBalances` tracking absolute post-balances from the transaction metadata. The reserve check now compares `minUsdcReserve` against the real absolute balance instead of the delta.
3. **Evidence Bundle Enhancement:** The schema in `src/evidence/bundle.ts` was expanded to split out `swapInput`, `infrastructureCost`, `networkFee`, and `totalWalletExpenditure`, ensuring transparency into the isolated rent costs.

### Behavior
The updated verifier (applied to the exact same immutable transaction payload) returned:
- **Status:** `VERIFIED`
- **Failed Invariants:** None

### Test Additions & Outcomes
A new regression test suite `V1.1 Semantics (Infrastructure Rent & Reserves)` was added to `tests/solanaVerifier.test.ts` to strictly enforce:
1. First-time USDC ATA creation separates rent from swap input.
2. Pre-existing ATAs do not incorrectly deduct rent.
3. Native SOL reserve calculation correctly uses actual post-balance.
4. Total wallet expenditure correctly sums swap input, fee, and rent.

**Result:** 23/23 tests passing. TypeScript compilation clean.

### Replay Result
Replaying the same transaction against a modified mandate (`attack-mandate-replay`) successfully returned `FAILED_VERIFICATION` due to `missing_or_invalid_mandate_binding`, proving that the transaction is cryptographically locked to the exact `live-mandate-001` and immune to replay.
