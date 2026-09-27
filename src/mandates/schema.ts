import { z } from 'zod';

export const MandateActionSchema = z.enum(['SWAP', 'TRANSFER']);

export const MandateSchema = z.object({
  mandateId: z.string().uuid(),
  version: z.string(),
  action: MandateActionSchema,
  cluster: z.enum(['devnet', 'mainnet-beta', 'testnet', 'localnet']),
  inputMint: z.string(),
  outputMint: z.string(),
  maxInputAmount: z.bigint(),
  minOutputAmount: z.bigint(),
  destinationAccount: z.string(),
  minUsdcReserve: z.bigint(),
  expiry: z.number(), // Unix timestamp
  nonce: z.string(),
  signerIdentity: z.string(),
  policyVersion: z.string(),
});

export type Mandate = z.infer<typeof MandateSchema>;

// Additional schema for Execution Result
export const ExecutionResultSchema = z.object({
  mandateId: z.string().uuid(),
  transactionSignature: z.string().optional(),
  status: z.enum(['SUCCESS', 'FAILED']),
  agentId: z.string(),
  timestamp: z.number(),
  error: z.string().optional(),
});

export type ExecutionResult = z.infer<typeof ExecutionResultSchema>;
