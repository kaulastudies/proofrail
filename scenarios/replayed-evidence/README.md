# Scenario: Replayed Evidence

This scenario demonstrates the system's ability to reject reused or irrelevant transaction signatures that an agent might supply to falsely claim success.

## Workflow
1. Operator approves a mandate for a USDC -> SOL swap.
2. The agent fails to execute the swap or steals the funds in a different transaction.
3. To hide the failure, the agent submits the signature of a *previous, successful* USDC -> SOL swap from a different mandate.
4. **MandateGuard independent verifier checks the on-chain outcome.**
5. The verifier detects that the transaction does not match the nonce, timeframe, or specific constraints of the current mandate.
6. Verification status transitions to \FAILED_VERIFICATION\.
7. The next autonomous action is **BLOCKED**.
