import * as fs from 'fs';
import { hashMandate, VerificationEvidence } from '../src/evidence/bundle';
import { VerificationState } from '../src/policy/stateMachine';
import { SolanaVerifier } from '../src/verifier/solanaVerifier';
import { Mandate } from '../src/mandates/schema';

// A mock connection that intercepts getParsedTransaction and returns a fixture
class MockedConnectionVerifier extends SolanaVerifier {
  constructor(private fixturePath: string) {
    super('https://api.mainnet-beta.solana.com', { requireMemoBinding: true });
    // Overwrite the connection's getParsedTransaction to load from the fixture
    (this as any).connection.getParsedTransaction = async (sig: string) => {
      if (fs.existsSync(this.fixturePath)) {
        const fixtureData = JSON.parse(fs.readFileSync(this.fixturePath, 'utf8'));
        if (fixtureData.signature === sig) {
          return fixtureData.transaction;
        }
      }
      return null;
    };
  }
}

async function verifyLive(mandateFile: string, signature: string, fixturePath?: string) {
  if (!fs.existsSync(mandateFile)) {
    console.error(`Error: Mandate file ${mandateFile} not found.`);
    process.exit(1);
  }

  const mandate = JSON.parse(fs.readFileSync(mandateFile, 'utf8')) as Mandate;

  let verifier: SolanaVerifier;
  if (fixturePath) {
    console.log(`Using deterministic fixture from ${fixturePath} instead of live RPC`);
    verifier = new MockedConnectionVerifier(fixturePath);
  } else {
    verifier = new SolanaVerifier('https://api.mainnet-beta.solana.com', { requireMemoBinding: true });
  }

  console.log(`\nVerifying mandate against transaction ${signature}...`);
  const bundle = await verifier.verifyMandateExecution(mandate, signature);

  console.log(`\n=== Verification Output ===`);
  console.log(`Status: ${bundle.verificationStatus}`);
  if (bundle.failedInvariants.length > 0) {
    console.log(`Failed Invariants: ${bundle.failedInvariants.join(', ')}`);
  } else {
    console.log(`All invariants passed.`);
  }

  const outBundlePath = `evidence_${signature}.json`;
  fs.writeFileSync(outBundlePath, JSON.stringify(bundle, (key, value) => typeof value === 'bigint' ? value.toString() : value, 2));
  console.log(`\nGenerated evidence bundle at ${outBundlePath}`);
}

function verifyEvidence(evidenceFile: string) {
  if (!fs.existsSync(evidenceFile)) {
    console.error(`Error: Evidence file ${evidenceFile} not found.`);
    process.exit(1);
  }

  const raw = fs.readFileSync(evidenceFile, 'utf8');
  let evidence: any;
  try {
    evidence = JSON.parse(raw);
  } catch (e) {
    console.error("Error: Invalid JSON in evidence bundle.");
    process.exit(1);
  }

  console.log(`\nReplaying evidence bundle...`);
  console.log(`Transaction: ${evidence.transactionSignature}`);
  console.log(`Claimed Status: ${evidence.verificationStatus}`);

  const recomputedHash = hashMandate(evidence.mandate);
  
  if (recomputedHash !== evidence.mandateHash) {
    console.error(`[FAIL] Mandate hash mismatch! Evidence has been tampered with.`);
    console.error(`Expected: ${recomputedHash}`);
    console.error(`Actual:   ${evidence.mandateHash}`);
    process.exit(1);
  } else {
    console.log(`[PASS] Mandate hash verified.`);
  }

  if (evidence.verificationStatus === VerificationState.VERIFIED) {
    console.log(`[PASS] State is VERIFIED. Next action is authorized.`);
  } else {
    console.log(`[FAIL] State is ${evidence.verificationStatus}. Next action remains BLOCKED.`);
    console.log(`Failed Invariants: ${evidence.failedInvariants.join(', ')}`);
  }

  console.log("\nEvidence verification replay successful.\n");
}

const args = process.argv.slice(2);
const command = args[0];

if (command === 'verify' && args.length >= 3) {
  let mandateFile = '';
  let tx = '';
  let fixture = '';
  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--mandate') mandateFile = args[++i];
    else if (args[i] === '--tx') tx = args[++i];
    else if (args[i] === '--fixture') fixture = args[++i];
  }
  verifyLive(mandateFile, tx, fixture).catch(console.error);
} else if (command === 'replay' && args[1]) {
  verifyEvidence(args[1]);
} else {
  console.log("Usage:");
  console.log("  npx ts-node scripts/cli.ts verify --mandate <mandate.json> --tx <signature> [--fixture <fixture.json>]");
  console.log("  npx ts-node scripts/cli.ts replay <evidence.json>");
}
