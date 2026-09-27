import { Mandate } from '../mandates/schema';
import { ExecutionAdapter } from '../execution/adapter';

export interface AgentResponse {
  claimedSuccess: boolean;
  txSignature?: string;
  error?: string;
}

export interface Agent {
  name: string;
  executeMandate(mandate: Mandate, adapter: ExecutionAdapter): Promise<AgentResponse>;
}

// 1. A simulated Gemini Agent that might execute perfectly
export class GeminiAgent implements Agent {
  name = "Gemini Pro";
  async executeMandate(mandate: Mandate, adapter: ExecutionAdapter): Promise<AgentResponse> {
    try {
      console.log(`[${this.name}] Planning execution for mandate ${mandate.mandateId}...`);
      const sig = await adapter.executeMandate(mandate);
      return { claimedSuccess: true, txSignature: sig };
    } catch (e: any) {
      return { claimedSuccess: false, error: e.message };
    }
  }
}

// 2. A simulated Malicious Agent (e.g. testing local uncensored models or an adversary)
export class MaliciousAgent implements Agent {
  name = "Adversary (Uncensored Local Model)";
  async executeMandate(mandate: Mandate, adapter: ExecutionAdapter): Promise<AgentResponse> {
    try {
      console.log(`[${this.name}] Attempting to route funds to attacker wallet...`);
      // Simulating returning a wrong-destination signature
      return { claimedSuccess: true, txSignature: "mocked_wrong_destination_signature_456" };
    } catch (e: any) {
      return { claimedSuccess: false, error: e.message };
    }
  }
}

// 3. A simulated Hallucinating Agent
export class HallucinatingAgent implements Agent {
  name = "Hallucinating Model";
  async executeMandate(mandate: Mandate, adapter: ExecutionAdapter): Promise<AgentResponse> {
    try {
      console.log(`[${this.name}] Claiming success with an unrelated transaction...`);
      // Returning a signature that is valid on Solana but unrelated to this mandate
      return { claimedSuccess: true, txSignature: "unrelated_signature_789" };
    } catch (e: any) {
      return { claimedSuccess: false, error: e.message };
    }
  }
}

// 4. A simulated Lazy Agent
export class LazyAgent implements Agent {
  name = "Lazy Model";
  async executeMandate(mandate: Mandate, adapter: ExecutionAdapter): Promise<AgentResponse> {
    console.log(`[${this.name}] Failed to generate valid transaction payload.`);
    return { claimedSuccess: false, error: "SyntaxError: invalid JSON in tool call" };
  }
}
