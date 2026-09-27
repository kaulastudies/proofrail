import { Connection, Keypair, VersionedTransaction, TransactionMessage, PublicKey, TransactionInstruction, AddressLookupTableAccount } from '@solana/web3.js';
import bs58 from 'bs58';
import * as crypto from 'crypto';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config();
dotenv.config({ path: '.env.live' });

async function run() {
  const rpcUrl = process.env.SOLANA_RPC_URL;
  if (!rpcUrl || rpcUrl.startsWith('<')) throw new Error('Please set a valid SOLANA_RPC_URL in .env');

  const secret = process.env.DISPOSABLE_WALLET_SECRET;
  if (!secret) throw new Error('Missing DISPOSABLE_WALLET_SECRET in .env.live');

  const connection = new Connection(rpcUrl, 'finalized');
  const wallet = Keypair.fromSecretKey(bs58.decode(secret));

  console.log('=== PHASE 5: LIVE MANDATE EXECUTION ===');
  console.log('Wallet:', wallet.publicKey.toBase58());
  const balance = await connection.getBalance(wallet.publicKey);
  console.log('Balance:', balance / 1e9, 'SOL');

  if (balance < 5000000) { // 0.005 SOL minimum
    throw new Error('Insufficient balance: ' + (balance / 1e9) + ' SOL. Need at least 0.005 SOL.');
  }

  // === Step 1: Create Mandate ===
  const mandateId = 'live-mandate-001';
  const nonce = crypto.randomBytes(8).toString('hex');
  const amountToSwap = 1000000; // 0.001 SOL in lamports

  console.log('\n--- Step 1: Create Mandate ---');
  console.log('Mandate ID:', mandateId);
  console.log('Nonce:', nonce);
  console.log('Canonical Binding:', mandateId + ':' + nonce);

  // === Step 2: Get Jupiter v2 Quote ===
  console.log('\n--- Step 2: Get Jupiter Quote ---');
  const quoteUrl = 'https://api.jup.ag/swap/v2/quote?inputMint=So11111111111111111111111111111111111111112&outputMint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v&amount=' + amountToSwap + '&slippageBps=50';
  const quoteResponse = await (await fetch(quoteUrl)).json();
  if (!quoteResponse || quoteResponse.error) throw new Error('Quote failed: ' + JSON.stringify(quoteResponse));
  console.log('Quoted SOL input:', amountToSwap / 1e9, 'SOL (' + amountToSwap + ' lamports)');
  console.log('Expected USDC output:', parseInt(quoteResponse.outAmount) / 1e6, 'USDC (' + quoteResponse.outAmount + ' raw)');

  // === Step 3: Build Swap Transaction ===
  console.log('\n--- Step 3: Build Swap Transaction ---');
  const swapResponse = await (
    await fetch('https://api.jup.ag/swap/v2/swap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quoteResponse,
        taker: wallet.publicKey.toString(),
        wrapAndUnwrapSol: true,
      })
    })
  ).json();

  if (!swapResponse.swapTransaction) throw new Error('Swap build failed: ' + JSON.stringify(swapResponse));
  console.log('Swap transaction built, length:', swapResponse.swapTransaction.length);

  // === Step 4: Inject Mandate Memo ===
  console.log('\n--- Step 4: Inject Mandate Binding Memo ---');
  const swapTxBuffer = Buffer.from(swapResponse.swapTransaction, 'base64');
  let transaction = VersionedTransaction.deserialize(swapTxBuffer);

  const addressLookupTableAccounts = await Promise.all(
    transaction.message.addressTableLookups.map(async (lookup) => {
      const res = await connection.getAddressLookupTable(lookup.accountKey);
      return res.value;
    })
  );

  const message = TransactionMessage.decompile(transaction.message, {
    addressLookupTableAccounts: addressLookupTableAccounts as AddressLookupTableAccount[]
  });

  const memoProgramId = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');
  const memoText = mandateId + ':' + nonce;
  const memoIx = new TransactionInstruction({
    keys: [],
    programId: memoProgramId,
    data: Buffer.from(memoText, 'utf8')
  });

  // Insert memo after compute budget instructions
  message.instructions.splice(2, 0, memoIx);
  transaction.message = message.compileToV0Message(addressLookupTableAccounts as AddressLookupTableAccount[]);

  // Verify memo survived recompilation
  const redecompiled = TransactionMessage.decompile(transaction.message, {
    addressLookupTableAccounts: addressLookupTableAccounts as AddressLookupTableAccount[]
  });
  const memoFound = redecompiled.instructions.some(ix =>
    ix.programId.toBase58() === memoProgramId.toBase58()
  );
  console.log('Memo survived recompilation:', memoFound);
  if (!memoFound) throw new Error('FATAL: Memo instruction lost during recompilation!');

  // === Step 5: Fetch fresh blockhash, rebuild, and sign ===
  console.log('\n--- Step 5: Fetch Fresh Blockhash & Sign ---');
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized');
  console.log('Fresh blockhash:', blockhash);

  // Rebuild message with fresh blockhash
  message.recentBlockhash = blockhash;
  transaction.message = message.compileToV0Message(addressLookupTableAccounts as AddressLookupTableAccount[]);
  transaction.sign([wallet]);
  console.log('Transaction signed with fresh blockhash.');

  // === Step 6: Simulate ===
  console.log('\n--- Step 6: Simulate Transaction ---');
  const simulation = await connection.simulateTransaction(transaction);
  console.log('Simulation error:', simulation.value.err);
  console.log('Simulation units consumed:', simulation.value.unitsConsumed);

  if (simulation.value.err) {
    console.error('SIMULATION FAILED. Aborting broadcast.');
    console.error('Error details:', JSON.stringify(simulation.value.err));
    process.exit(1);
  }
  console.log('Simulation PASSED.');

  // === Step 7: Broadcast ===
  console.log('\n--- Step 7: Broadcast Transaction ---');
  const txid = await connection.sendRawTransaction(transaction.serialize(), {
    skipPreflight: true,
    maxRetries: 2
  });
  console.log('Transaction sent! Signature:', txid);

  // === Step 8: Confirm ===
  console.log('\n--- Step 8: Wait for Finalized Confirmation ---');
  const confirmation = await connection.confirmTransaction({
    signature: txid,
    blockhash: blockhash,
    lastValidBlockHeight: lastValidBlockHeight
  }, 'finalized');

  if (confirmation.value.err) {
    console.error('Transaction FAILED on-chain:', JSON.stringify(confirmation.value.err));
    process.exit(1);
  }
  console.log('Transaction FINALIZED.');

  // === Step 9: Fetch Finalized Transaction ===
  console.log('\n--- Step 9: Fetch Finalized Transaction from RPC ---');
  const finalizedTx = await connection.getParsedTransaction(txid, { maxSupportedTransactionVersion: 1 });
  if (!finalizedTx) throw new Error('Could not fetch finalized transaction!');

  // Save raw finalized payload
  const rawPayloadPath = 'scenarios/fixtures/live_finalized_tx.raw.json';
  fs.writeFileSync(rawPayloadPath, JSON.stringify({ signature: txid, transaction: finalizedTx }, null, 2));
  console.log('Saved raw finalized payload to:', rawPayloadPath);

  // Extract actual deltas
  const fee = finalizedTx.meta?.fee || 0;
  console.log('Actual fee:', fee / 1e9, 'SOL (' + fee + ' lamports)');

  // === Step 10: Save Live Mandate ===
  const liveMandate = {
    mandateId,
    version: '1.0',
    action: 'SWAP',
    cluster: 'mainnet-beta',
    inputMint: 'So11111111111111111111111111111111111111112',
    outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    maxInputAmount: String(amountToSwap),
    minOutputAmount: quoteResponse.otherAmountThreshold || quoteResponse.outAmount,
    destinationAccount: wallet.publicKey.toBase58(),
    minUsdcReserve: '0',
    expiry: Date.now() + 3600000,
    nonce,
    signerIdentity: wallet.publicKey.toBase58(),
    policyVersion: '1.0'
  };
  fs.writeFileSync('scenarios/fixtures/live_mandate.json', JSON.stringify(liveMandate, null, 2));

  // === Step 11: Generate Evidence Bundle ===
  console.log('\n--- Step 11: Generate Evidence Bundle ---');
  const rawPayloadHash = crypto.createHash('sha256').update(
    fs.readFileSync(rawPayloadPath, 'utf8')
  ).digest('hex');

  const evidence = {
    mandateId,
    nonce,
    transactionSignature: txid,
    slot: finalizedTx.slot,
    blockTime: finalizedTx.blockTime,
    fee,
    evidenceSource: 'live',
    rawTransactionHash: rawPayloadHash,
    rawPayloadPath,
    capturedAt: new Date().toISOString(),
    verifierVersion: '1.0'
  };

  const evidencePath = 'scenarios/fixtures/live_evidence.json';
  fs.writeFileSync(evidencePath, JSON.stringify(evidence, null, 2));
  console.log('Evidence saved to:', evidencePath);

  // === Step 12: Report ===
  console.log('\n========================================');
  console.log('=== PHASE 5 LIVE EXECUTION REPORT ===');
  console.log('========================================');
  console.log('Transaction Signature:', txid);
  console.log('Finality: finalized');
  console.log('Actual Fee:', fee / 1e9, 'SOL');
  console.log('Mandate ID:', mandateId);
  console.log('Nonce:', nonce);
  console.log('Memo Survived Recompilation:', memoFound);
  console.log('Evidence File:', evidencePath);
  console.log('Raw Payload File:', rawPayloadPath);
  console.log('Raw Payload SHA256:', rawPayloadHash);
  console.log('========================================');
}

run().catch(e => {
  console.error('\nFATAL ERROR:', e.message);
  process.exit(1);
});
