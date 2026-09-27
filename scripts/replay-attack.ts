import { SolanaVerifier } from '../src/verifier/solanaVerifier';
import { Mandate } from '../src/mandates/schema';
import * as fs from 'fs';
import { VerificationState } from '../src/policy/stateMachine';

async function run() {
  const fixturePath = 'scenarios/fixtures/captured_mainnet_jupiter_swap.raw.json';
  if (!fs.existsSync(fixturePath)) {
    console.error('Fixture not found.');
    return;
  }
  
  const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
  const sig = fixture.signature || 'mocked_signature';

  // We are an attacker trying to use someone else's swap to prove our mandate.
  const maliciousMandate: Mandate = {
    mandateId: 'attack-mandate-001',
    version: '1.0',
    action: 'SWAP',
    cluster: 'mainnet-beta',
    inputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
    outputMint: 'So11111111111111111111111111111111111111112', // WSOL
    maxInputAmount: 1000n,
    minOutputAmount: 10n,
    destinationAccount: 'OperatorWallet111111111111111111111111111111',
    minUsdcReserve: 0n,
    expiry: Date.now() + 10000000,
    nonce: 'evil-nonce',
    signerIdentity: 'OperatorWallet111111111111111111111111111111',
    policyVersion: '1.0'
  };

  // The verifier expects the connection to return the fixture.
  // We mock it for the test.
  class MockConnectionVerifier extends SolanaVerifier {
    constructor() {
      super('http://localhost');
      (this as any).connection.getParsedTransaction = async () => fixture.transaction || fixture;
    }
  }

  const verifier = new MockConnectionVerifier();
  console.log('--- REPLAY ATTACK TEST ---');
  console.log('Attempting to satisfy attack-mandate-001 using a captured historical transaction...');
  
  const result = await verifier.verifyMandateExecution(maliciousMandate, sig);
  console.log('Status:', result.verificationStatus);
  console.log('Failed Invariants:', result.failedInvariants);
  
  if (result.verificationStatus !== VerificationState.VERIFIED && result.failedInvariants.includes('missing_or_invalid_mandate_binding')) {
    console.log('Replay attack THWARTED. Verifier correctly identified the transaction lacks the specific mandate binding memo.');
  } else {
    console.error('Replay attack SUCCEEDED or failed for the wrong reason!');
  }
}

run().catch(console.error);
