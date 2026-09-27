import { SolanaVerifier } from '../src/verifier/solanaVerifier';
import { Mandate } from '../src/mandates/schema';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

dotenv.config();

async function run() {
  const rpcUrl = process.env.SOLANA_RPC_URL;
  if (!rpcUrl) throw new Error('Missing SOLANA_RPC_URL');

  // Load real mandate and evidence
  const mandate: Mandate = JSON.parse(fs.readFileSync('scenarios/fixtures/live_mandate.json', 'utf8'));
  // Convert string amounts to bigint for the verifier
  mandate.maxInputAmount = BigInt(mandate.maxInputAmount);
  mandate.minOutputAmount = BigInt(mandate.minOutputAmount);
  mandate.minUsdcReserve = BigInt(mandate.minUsdcReserve);

  const evidence = JSON.parse(fs.readFileSync('scenarios/fixtures/live_evidence.json', 'utf8'));
  const sig = evidence.transactionSignature;

  console.log('=== MANDATEGUARD LIVE VERIFICATION ===');
  console.log('Transaction Signature:', sig);
  console.log('Mandate ID:', mandate.mandateId);
  console.log('Nonce:', mandate.nonce);
  console.log('Expected Memo:', mandate.mandateId + ':' + mandate.nonce);

  // === Step 1: Verify the live transaction ===
  console.log('\n--- Verification ---');
  const verifier = new SolanaVerifier(rpcUrl, {
    requireMemoBinding: true,
    evidenceSource: 'live'
  });

  const result = await verifier.verifyMandateExecution(mandate, sig);
  console.log('Verification Status:', result.verificationStatus);
  console.log('Failed Invariants:', result.failedInvariants);
  console.log('Next Action Authorized:', result.verificationStatus === 'VERIFIED');

  // === Step 2: Replay Attack Test ===
  console.log('\n--- Replay Attack Test ---');
  const attackMandate: Mandate = {
    ...mandate,
    mandateId: 'attack-mandate-replay',
    nonce: 'attacknonce999',
  };

  const replayResult = await verifier.verifyMandateExecution(attackMandate, sig);
  console.log('Replay Attempt Status:', replayResult.verificationStatus);
  console.log('Replay Failed Invariants:', replayResult.failedInvariants);
  const replayThwarted = replayResult.failedInvariants.includes('missing_or_invalid_mandate_binding');
  console.log('Replay Attack Thwarted:', replayThwarted);
  
  // Add replay status to result bundle
  result.replayStatus = replayThwarted ? 'THWARTED' : 'FAILED_PROTECTION';

  // Save verification result
  fs.writeFileSync('scenarios/fixtures/live_evidence_v1.1.json', JSON.stringify(result, (_, v) => typeof v === 'bigint' ? v.toString() : v, 2));
  console.log('Verification result saved to: scenarios/fixtures/live_evidence_v1.1.json');

  // === Final Report ===
  console.log('\n========================================');
  console.log('=== FINAL VERIFIED REPORT ===');
  console.log('========================================');
  console.log('Transaction Signature:', sig);
  console.log('Finality: finalized');
  console.log('Actual Fee:', evidence.fee / 1e9, 'SOL (' + evidence.fee + ' lamports)');
  console.log('Mandate ID:', mandate.mandateId);
  console.log('Nonce:', mandate.nonce);
  console.log('Verification Status:', result.verificationStatus);
  console.log('Failed Invariants:', JSON.stringify(result.failedInvariants));
  console.log('Next Action Authorized:', result.verificationStatus === 'VERIFIED');
  console.log('Evidence File: scenarios/fixtures/live_evidence.json');
  console.log('Raw Payload File: scenarios/fixtures/live_finalized_tx.raw.json');
  console.log('Replay Attack Thwarted:', replayThwarted);
  console.log('========================================');
}

run().catch(e => {
  console.error('FATAL:', e.message);
  process.exit(1);
});
