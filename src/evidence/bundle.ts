import { Mandate } from '../mandates/schema';
import { VerificationState } from '../policy/stateMachine';
import * as crypto from 'crypto';

export interface Observation {
  account: string;
  preBalance: bigint;
  postBalance: bigint;
  delta: bigint;
}

export interface VerificationEvidence {
  mandate: Mandate;
  mandateHash: string;
  policyVersion: string;
  transactionSignature: string | null;
  observations: Observation[];
  verifierVersion: string;
  evidenceSource: 'synthetic' | 'captured_mainnet' | 'live';
  rawTransactionHash?: string;
  normalizedEvidenceHash?: string;
  verificationStatus: VerificationState;
  failedInvariants: string[];
  
  // Financial breakdown
  swapInput?: string;
  infrastructureCost?: string;
  networkFee?: string;
  totalWalletExpenditure?: string;
  actualOutput?: string;
  
  replayStatus?: string;
  
  evidenceTimestamps: {
    generatedAt: number;
    transactionFinalizedAt?: number;
  };
  trustAssumptions: string[];
}

export function hashMandate(mandate: Mandate): string {
  // Convert BigInts to strings for stable JSON serialization
  const stableMandate = JSON.stringify(mandate, (_, v) => typeof v === 'bigint' ? v.toString() : v);
  return crypto.createHash('sha256').update(stableMandate).digest('hex');
}

export function generateEvidenceBundle(
  mandate: Mandate,
  status: VerificationState,
  txSignature: string | null,
  observations: Observation[],
  failedInvariants: string[] = [],
  evidenceSource: 'synthetic' | 'captured_mainnet' | 'live' = 'synthetic',
  rawTransactionHash?: string,
  financials?: {
    swapInput: string;
    infrastructureCost: string;
    networkFee: string;
    totalWalletExpenditure: string;
    actualOutput: string;
  },
  replayStatus?: string
): VerificationEvidence {
  const bundle: VerificationEvidence = {
    mandate,
    mandateHash: hashMandate(mandate),
    policyVersion: mandate.policyVersion,
    transactionSignature: txSignature,
    observations,
    verifierVersion: '1.1',
    evidenceSource,
    rawTransactionHash,
    verificationStatus: status,
    failedInvariants,
    ...financials,
    replayStatus,
    evidenceTimestamps: {
      generatedAt: Date.now(),
      transactionFinalizedAt: txSignature ? Date.now() - 5000 : undefined // Mock finalized time
    },
    trustAssumptions: [
      'RPC Node is honest',
      'Execution was finalized'
    ]
  };

  // Compute normalized hash by hashing the rest of the bundle (excluding the hash itself)
  const clone = { ...bundle };
  delete clone.normalizedEvidenceHash;
  bundle.normalizedEvidenceHash = crypto.createHash('sha256')
    .update(JSON.stringify(clone, (_, v) => typeof v === 'bigint' ? v.toString() : v))
    .digest('hex');

  return bundle;
}
