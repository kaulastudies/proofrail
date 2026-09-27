# MandateGuard - Product Specification

## Overview
**MandateGuard** is verified execution infrastructure for autonomous Solana treasury workflows. 

Core promise: **A successful blockchain transaction is not necessarily a successful business action.**

MandateGuard allows an operator to delegate a bounded treasury task to an AI agent, independently verifies what actually happened on-chain, and prevents subsequent autonomous actions until the preceding economic outcome has been verified. 

The system distinguishes:
1. **Authorization** — Was the action permitted?
2. **Execution** — Did the transaction actually settle?
3. **Outcome** — Did the resulting economic state satisfy the approved mandate?
4. **Evidence** — Can another party independently reproduce the verification?

## Architecture Rule
LLM proposes ? deterministic policy validates ? Solana executes ? independent verifier reconstructs outcome ? state machine decides whether workflow may continue

The deterministic verifier/policy system is the absolute authority. LLMs may interpret, propose, and act as agents, but they must NOT be the final authority for verification.

## Core Scope
**MVP Workflow:** USDC ? SOL swap through Jupiter on Solana (devnet/testnet).

## Verification State Machine
The system implements a rigorous state machine for autonomous actions. 

The critical control invariant is: NEXT_ACTION_ALLOWED = previous_action.status == VERIFIED

States:
- **PENDING**: The mandate has been approved by the operator, and execution is authorized but not yet confirmed.
- **EXECUTED**: The agent/execution layer reports that the transaction was completed (e.g., provides a signature).
- **VERIFIED**: The independent verifier has confirmed the on-chain economic outcome satisfies the mandate.
- **FAILED_VERIFICATION**: The independent verifier determined the economic outcome did NOT satisfy the mandate (e.g., funds sent to wrong destination).
- **BLOCKED**: The action was halted before execution due to policy violations (e.g., unauthorized redirect proposed).
- **UNRESOLVED**: Missing evidence, inconsistent RPC responses, unsupported instructions, or ambiguous outcomes. The next action remains blocked.

## Mandate Schema
The typed mandate contains structured parameters for the bounded treasury action.

- mandate_id: Unique identifier for the mandate.
- ersion: Schema version.
- ction: The exact action to perform (e.g., SWAP).
- cluster: The target network (e.g., devnet, mainnet-beta).
- input_mint: Asset to spend.
- output_mint: Asset to receive.
- max_input_amount: Maximum allowed spending.
- min_output_amount: Minimum acceptable output.
- destination_account: The approved recipient wallet.
- min_usdc_reserve: Required treasury reserve preserved after action.
- expiry: Timestamp after which the mandate is invalid.
- 
once: Anti-replay token.
- signer_identity: Entity that approved the mandate.
- policy_version: Policy ruleset to evaluate against.

## Independent Verification
The verifier reconstructs the actual outcome from on-chain evidence, validating:
- Transaction identity/signature binding to the correct mandate.
- Finalized state on the network.
- Correct signer and approved program.
- Actual amounts spent and received respecting limits.
- Approved destination.
- Treasury reserve requirements.
- Expiry and replay checks.

## Evidence Bundle
A portable evidence artifact (JSON) that allows independent reproduction of the verification.
It includes the mandate, mandate hash, policy version, transaction signature, observed state deltas, verifier version, verification status, failed invariants, and timestamps.
Tampering with this evidence causes verification to fail.
