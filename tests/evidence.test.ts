import { generateEvidenceBundle, hashMandate } from '../src/evidence/bundle';
import { VerificationState } from '../src/policy/stateMachine';
import { Mandate } from '../src/mandates/schema';

describe('Evidence Bundle Generation', () => {
  let mockMandate: Mandate;

  beforeEach(() => {
    mockMandate = {
      mandateId: '123e4567-e89b-12d3-a456-426614174000',
      version: '1.0',
      action: 'SWAP',
      cluster: 'devnet',
      inputMint: 'USDC_MINT',
      outputMint: 'SOL_MINT',
      maxInputAmount: 1000000n,
      minOutputAmount: 5000000n,
      destinationAccount: 'DEST_ACCOUNT',
      minUsdcReserve: 10000000n,
      expiry: Date.now() + 3600000,
      nonce: 'nonce123',
      signerIdentity: 'Operator1',
      policyVersion: '1.0'
    };
  });

  test('should generate a verifiable evidence bundle for VERIFIED state', () => {
    const observations = [
      {
        account: 'DEST_ACCOUNT',
        preBalance: 0n,
        postBalance: 5000000n,
        delta: 5000000n
      },
      {
        account: 'SOURCE_ACCOUNT',
        preBalance: 11000000n,
        postBalance: 10000000n,
        delta: -1000000n
      }
    ];

    const bundle = generateEvidenceBundle(
      mockMandate,
      VerificationState.VERIFIED,
      'mock_signature_123',
      observations
    );

    expect(bundle.verificationStatus).toBe(VerificationState.VERIFIED);
    expect(bundle.mandateHash).toBe(hashMandate(mockMandate));
    expect(bundle.transactionSignature).toBe('mock_signature_123');
    expect(bundle.failedInvariants.length).toBe(0);
    expect(bundle.observations.length).toBe(2);
  });

  test('should generate a bundle for FAILED_VERIFICATION state', () => {
    const observations = [
      {
        account: 'DEST_ACCOUNT',
        preBalance: 0n,
        postBalance: 0n, // Did not receive funds
        delta: 0n
      },
      {
        account: 'ATTACKER_ACCOUNT',
        preBalance: 0n,
        postBalance: 5000000n, // Funds went to wrong account
        delta: 5000000n
      }
    ];

    const bundle = generateEvidenceBundle(
      mockMandate,
      VerificationState.FAILED_VERIFICATION,
      'mock_signature_bad',
      observations,
      ['destination_mismatch', 'min_output_violation']
    );

    expect(bundle.verificationStatus).toBe(VerificationState.FAILED_VERIFICATION);
    expect(bundle.failedInvariants).toContain('destination_mismatch');
    expect(bundle.failedInvariants).toContain('min_output_violation');
  });
});
