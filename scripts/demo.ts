import * as fs from 'fs';
import { PublicKey } from '@solana/web3.js';

import { SolanaVerifier } from '../src/verifier/solanaVerifier';
import { Mandate } from '../src/mandates/schema';

const FIXTURE_DIR = 'scenarios/fixtures';

function readJson(path: string): any {
  return JSON.parse(fs.readFileSync(path, 'utf8'));
}

function loadMandate(): Mandate {
  const mandate: Mandate = readJson(
    `${FIXTURE_DIR}/live_mandate.json`
  );

  mandate.maxInputAmount = BigInt(mandate.maxInputAmount);
  mandate.minOutputAmount = BigInt(mandate.minOutputAmount);
  mandate.minUsdcReserve = BigInt(mandate.minUsdcReserve);

  return mandate;
}

/**
 * The raw RPC payload was persisted as JSON.
 *
 * web3.js normally returns PublicKey objects inside
 * transaction.message.accountKeys. JSON serialization converts those
 * PublicKey values into strings, so restore them before replaying the
 * transaction through the real verifier.
 */
function loadFrozenTransaction(): any {
  const raw = readJson(
    `${FIXTURE_DIR}/live_finalized_tx.raw.json`
  );

  const tx = raw.transaction ?? raw;

  if (!tx?.transaction?.message) {
    throw new Error(
      'Frozen transaction fixture has an unexpected structure.'
    );
  }

  const keys = tx.transaction.message.accountKeys;

  if (Array.isArray(keys)) {
    tx.transaction.message.accountKeys = keys.map((entry: any) => {
      if (typeof entry === 'string') {
        return {
          pubkey: new PublicKey(entry),
          signer: false,
          writable: false,
        };
      }

      if (
        entry &&
        typeof entry.pubkey === 'string'
      ) {
        return {
          ...entry,
          pubkey: new PublicKey(entry.pubkey),
        };
      }

      return entry;
    });
  }

  return tx;
}

function printScenario(
  number: number,
  title: string,
  result: any
) {
  console.log('');
  console.log('============================================================');
  console.log(`SCENARIO ${number}: ${title}`);
  console.log('============================================================');
  console.log('Verification Status :', result.verificationStatus);
  console.log(
    'Failed Invariants  :',
    result.failedInvariants.length
      ? result.failedInvariants.join(', ')
      : 'none'
  );
  console.log(
    'Next Action        :',
    result.verificationStatus === 'VERIFIED'
      ? 'AUTHORIZED'
      : 'BLOCKED'
  );
}

async function main() {
  console.log('');
  console.log('============================================================');
  console.log(' MANDATEGUARD — DETERMINISTIC MAINNET REPLAY DEMO');
  console.log('============================================================');
  console.log('');
  console.log('Source: frozen finalized Solana mainnet RPC payload');
  console.log('Verifier: SolanaVerifier v1.1');
  console.log('Network broadcast: DISABLED');
  console.log('SOL spent by this demo: 0');
  console.log('');

  const frozenTx = loadFrozenTransaction();
  const mandate = loadMandate();

  /*
   * Instantiate the production verifier normally.
   *
   * Then replace only its RPC reader with our immutable frozen transaction.
   * Every scenario therefore executes through the exact SolanaVerifier
   * decision logic without accessing the network.
   */
  const verifier = new SolanaVerifier(
    'https://offline.invalid',
    {
      requireMemoBinding: true,
      evidenceSource: 'live',
    }
  );

  (verifier as any).connection = {
    getParsedTransaction: async () => frozenTx,
  };

  const signature =
    readJson(`${FIXTURE_DIR}/live_evidence.json`)
      .transactionSignature;

  if (!signature) {
    throw new Error(
      'Could not recover transaction signature from live_evidence.json'
    );
  }

  console.log('Frozen transaction:', signature);
  console.log(
    'Mandate binding:',
    `${mandate.mandateId}:${mandate.nonce}`
  );

  // ---------------------------------------------------------
  // Scenario 1
  // Real mandate + real immutable mainnet transaction
  // ---------------------------------------------------------

  const validResult =
    await verifier.verifyMandateExecution(
      mandate,
      signature
    );

  printScenario(
    1,
    'VALID MAINNET EXECUTION',
    validResult
  );

  if (validResult.verificationStatus !== 'VERIFIED') {
    throw new Error(
      'Scenario 1 failed: frozen valid transaction was not VERIFIED.'
    );
  }

  // ---------------------------------------------------------
  // Scenario 2
  // Same immutable transaction, different mandate binding.
  // No transaction data is changed.
  // ---------------------------------------------------------

  const replayMandate: Mandate = {
    ...mandate,
    mandateId: 'replayed-mandate',
    nonce: 'wrong-nonce-for-frozen-transaction',
  };

  const replayResult =
    await verifier.verifyMandateExecution(
      replayMandate,
      signature
    );

  printScenario(
    2,
    'REPLAY / WRONG MANDATE BINDING',
    replayResult
  );

  if (
    !replayResult.failedInvariants.includes(
      'missing_or_invalid_mandate_binding'
    )
  ) {
    throw new Error(
      'Scenario 2 failed: replay binding attack was not detected.'
    );
  }

  // ---------------------------------------------------------
  // Scenario 3
  // Same immutable transaction and binding.
  // Change only the authorization policy.
  //
  // Original swap consumed the allowed max input.
  // Reducing authorization by one unit makes the already-realized
  // transaction violate the mandate.
  // ---------------------------------------------------------

  if (mandate.maxInputAmount <= 0n) {
    throw new Error(
      'Cannot construct max-input adversarial scenario.'
    );
  }

  const restrictedMandate: Mandate = {
    ...mandate,
    maxInputAmount: mandate.maxInputAmount - 1n,
  };

  const policyResult =
    await verifier.verifyMandateExecution(
      restrictedMandate,
      signature
    );

  printScenario(
    3,
    'ECONOMIC POLICY VIOLATION',
    policyResult
  );

  if (
    !policyResult.failedInvariants.includes(
      'max_input_exceeded'
    )
  ) {
    throw new Error(
      'Scenario 3 failed: max-input violation was not detected.'
    );
  }

  console.log('');
  console.log('============================================================');
  console.log(' DEMO COMPLETE');
  console.log('============================================================');
  console.log(' ✓ Real frozen mainnet execution       → VERIFIED');
  console.log(
    ' ✓ Wrong mandate / replay             → BLOCKED'
  );
  console.log(
    ' ✓ Economic authorization violation   → BLOCKED'
  );
  console.log(' ✓ Production verifier executed all scenarios');
  console.log(' ✓ Immutable transaction reused throughout');
  console.log(' ✓ No transaction broadcast');
  console.log(' ✓ No SOL spent');
  console.log('============================================================');
  console.log('');
}

main().catch((error) => {
  console.error('');
  console.error('MANDATEGUARD DEMO FAILED');
  console.error(error);
  process.exit(1);
});
