# MandateGuard — 90-Second Demo Script

**Visual:** Terminal split screen. Top half shows the AI Agent's thought process. Bottom half shows MandateGuard's deterministic verification engine.

---

**[0:00 - 0:15] The Premise**
**Speaker:** "Autonomous agents are the future, but right now, giving an agent a wallet is a blank check. If it hallucinates or gets exploited, your treasury is gone. Traditional guardrails rely on the agent policing itself. MandateGuard changes that."

---

**[0:15 - 0:30] "Agent Proposes" & "Policy Allows"**
*(Visual: Agent requests to swap 0.001 SOL for USDC. Policy Engine issues a Mandate with constraints and a cryptographic nonce.)*
**Speaker:** "Here, the agent proposes a trade. Our Policy Engine authorizes it, issuing a cryptographic 'Mandate'. This Mandate defines strict economic bounds: maximum input, minimum output, and exact destination accounts, locked with a unique nonce."

---

**[0:30 - 0:45] "Solana Executes"**
*(Visual: Agent builds the Jupiter transaction, injects the memo binding, signs, and broadcasts. Terminal shows the Solana transaction signature.)*
**Speaker:** "The agent takes that Mandate, builds the trade via Jupiter, injects the nonce into the transaction memo, and executes it on Solana. The trade is live."

---

**[0:45 - 0:65] "MandateGuard Independently Verifies"**
*(Visual: Agent asks to proceed to the next step. MandateGuard steps in, fetching the raw transaction from the Solana RPC—ignoring the agent's claims.)*
**Speaker:** "Now the crucial part. Before the agent is allowed to take its next action, MandateGuard steps in. It completely ignores what the agent *says* happened, and instead fetches the ground truth directly from the Solana RPC. It verifies the memo binding, isolates infrastructure rent costs, and enforces the economic bounds."

---

**[0:65 - 0:90] "Next Action Only Unlocks After VERIFIED"**
*(Visual: Terminal runs the demo script. Shows Scenario 1 passing [VERIFIED]. Shows Scenario 2 [Replay] failing [BLOCKED]. Shows Scenario 3 [Policy Violation] failing [BLOCKED].)*
**Speaker:** "If the trade is valid, MandateGuard returns 'VERIFIED', unlocking the agent's next action. If the agent tries a replay attack, or exceeds its max spend—even by a single lamport—MandateGuard returns 'BLOCKED', halting the workflow immediately. Trustless, deterministic verification for autonomous execution on Solana."
