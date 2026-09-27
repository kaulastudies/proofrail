# Colosseum Submission

**Title:** MandateGuard
**Tagline:** Trustless, deterministic on-chain verification for autonomous AI agents.

## Problem
As AI agents evolve from read-only copilots to autonomous on-chain actors, they are increasingly entrusted with private keys and treasury access. Today, the security model relies almost entirely on the agent policing itself. If the LLM hallucinates, gets prompt-injected, or goes rogue, it has a blank check to drain funds or route assets to an attacker. We need a way to cryptographically bind an agent's approved intent to its on-chain execution, preventing it from proceeding if it violates economic constraints.

## Solution
MandateGuard is a deterministic, zero-trust verification layer. Before an agent executes a transaction, a Policy Engine issues a "Mandate"—a strict set of economic constraints (max input, min output, exact destination) locked with a cryptographic nonce. 

When the agent executes the trade and requests to move to the next workflow step, MandateGuard bypasses the agent entirely. It fetches the finalized transaction directly from the Solana RPC, validates the injected nonce (thwarting replay attacks), isolates deterministic infrastructure costs (like ATA rent) from trade capital, and mathematically guarantees all mandate constraints were met. If they were, it returns `VERIFIED`. If the agent went out of bounds, it returns `BLOCKED`, safely halting the autonomous workflow.

## Technical Implementation
- **Policy Definition:** Agents receive strongly-typed JSON Mandates.
- **Execution:** Agents build transactions (e.g., via Jupiter v2 API), inject a canonical memo instruction (`mandateId:nonce`) for cryptographic binding, sign, and broadcast.
- **Verification Engine:** A standalone TypeScript verifier that consumes raw Solana RPC payloads (`getParsedTransaction`). It calculates precise balance deltas across all accounts, cleanly identifies new account rent exemptions (e.g., first-time USDC ATAs), and enforces the mathematical bounds of the mandate.
- **Replay Protection:** The verifier ensures the memo binding matches the mandate exactly, preventing attackers from re-submitting historical transaction signatures to spoof success.

## Why Solana?
Solana's high throughput, deterministic execution, and transparent account model make it the perfect execution environment for autonomous agents. MandateGuard leverages Solana's detailed transaction metadata (`preBalances`, `postBalances`, `preTokenBalances`, `postTokenBalances`) to deterministically reconstruct the exact economic flow of an agent's actions without relying on third-party indexers.

## Traction / Proof
We proved the system on Solana Mainnet. 
During our live mainnet execution, the verifier initially flagged the transaction as `FAILED_VERIFICATION` because it caught a hidden edge case: the Jupiter swap automatically created a new Associated Token Account (ATA), and the verifier correctly noticed the total lamport deduction exceeded the swap limit due to the ~0.00148 SOL rent. We preserved this failure, explicitly patched the verifier to isolate infrastructure rent from swap input, regression-tested it, and successfully verified the exact same immutable transaction. 

This proves MandateGuard's core philosophy: it can deterministically isolate edge cases based on immutable on-chain ground truth, catching unexpected agent behaviors. Our repo includes a zero-SOL deterministic replay demo using this frozen mainnet payload.

## Future Roadmap
- **ZK-Proof Integration:** Generate zero-knowledge proofs of mandate compliance to allow smart contracts to natively gate agent access.
- **Multi-Protocol Support:** Expand beyond Jupiter swaps to verifiable staking, lending (Marginfi/Kamino), and NFT operations.
- **Decentralized Verifier Network:** Distribute the verification step so multiple nodes attest to the agent's compliance before authorizing the next workflow step.
