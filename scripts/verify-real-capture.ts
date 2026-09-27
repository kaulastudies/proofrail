import { SolanaVerifier } from '../src/verifier/solanaVerifier';
import { Mandate } from '../src/mandates/schema';
import * as fs from 'fs';
import { VerificationState } from '../src/policy/stateMachine';

async function run() {
  const fixturePath = 'scenarios/fixtures/captured_mainnet_jupiter_swap.raw.json';
  if (!fs.existsSync(fixturePath)) {
    console.error('Real capture fixture not found. Did the fetch succeed?');
    return;
  }
  
  const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
  const sig = fixture.signature;
  
  // Save metadata separately
  const meta = {
    signature: sig,
    slot: fixture.transaction.slot,
    blockTime: fixture.transaction.blockTime,
    finality: 'finalized',
    captureTimestamp: new Date().toISOString(),
    evidenceSource: 'captured_mainnet'
  };
  fs.writeFileSync('scenarios/fixtures/captured_mainnet_metadata.json', JSON.stringify(meta, null, 2));

  // We are verifying the real transaction against our mandate
  const demoMandate: Mandate = JSON.parse(fs.readFileSync('demo-mandate.json', 'utf8'));

  class MockConnectionVerifier extends SolanaVerifier {
    constructor() {
      super('http://localhost', { requireMemoBinding: true, evidenceSource: 'captured_mainnet' });
      (this as any).connection.getParsedTransaction = async () => fixture.transaction;
    }
  }

  const verifier = new MockConnectionVerifier();
  console.log('--- VERIFYING REAL RAW CAPTURE ---');
  const result = await verifier.verifyMandateExecution(demoMandate, sig);
  console.log('Status:', result.verificationStatus);
  console.log('Failed Invariants:', result.failedInvariants);
  
  if (result.verificationStatus !== VerificationState.VERIFIED && result.failedInvariants.includes('missing_or_invalid_mandate_binding')) {
    console.log('As expected, the raw transaction lacks the specific mandate binding memo and failed verification correctly.');
  } else {
    console.error('Unexpected verification result for a random raw mainnet transaction!');
  }
}

run().catch(console.error);
