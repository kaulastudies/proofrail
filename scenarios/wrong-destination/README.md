# Scenario: Wrong Destination

This scenario demonstrates the system's ability to detect and fail verification if an agent executes a technically valid swap but routes the output funds to an unauthorized destination account.

## Workflow
1. Operator approves a mandate for USDC -> SOL swap, specifying their own wallet as the destination.
2. The AI agent maliciously or accidentally routes the output to an attacker's wallet.
3. The transaction settles successfully on Solana.
4. The agent reports SUCCESS.
5. **MandateGuard independent verifier checks the on-chain outcome.**
6. The verifier detects that the required output amount was NOT received by the authorized destination account.
7. Verification status transitions to \FAILED_VERIFICATION\.
8. The next autonomous action is **BLOCKED**.
