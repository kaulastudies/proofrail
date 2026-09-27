import { Connection, Keypair, VersionedTransaction, TransactionMessage, PublicKey, TransactionInstruction, AddressLookupTableAccount } from '@solana/web3.js';
import bs58 from 'bs58';
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
  
  console.log('Wallet:', wallet.publicKey.toBase58());
  const balance = await connection.getBalance(wallet.publicKey);
  console.log('Balance:', balance / 1e9, 'SOL');
  
  if (balance < 0.005) {
    console.warn('WARNING: Insufficient balance. Attempting broadcast anyway...');
  }

  const amountToSwap = Math.floor(0.001 * 1e9); 
  const quoteUrl = 'https://quote-api.jup.ag/v6/quote?inputMint=So11111111111111111111111111111111111111112&outputMint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v&amount=' + amountToSwap + '&slippageBps=50';
  
  console.log('1. Getting Quote...');
  const quoteResponse = await (await fetch(quoteUrl)).json();
  if (!quoteResponse || quoteResponse.error) throw new Error('Quote failed');
  
  console.log('2. Building Swap Transaction...');
  const swapResponse = await (
    await fetch('https://quote-api.jup.ag/v6/swap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quoteResponse,
        userPublicKey: wallet.publicKey.toString(),
        wrapAndUnwrapSol: true,
      })
    })
  ).json();

  if (!swapResponse.swapTransaction) throw new Error('Swap failed');

  console.log('3. Injecting Mandate Binding Memo...');
  const swapTxBuffer = Buffer.from(swapResponse.swapTransaction, 'base64');
  let transaction = VersionedTransaction.deserialize(swapTxBuffer);
  
  // Decompile message to inject our memo
  const addressLookupTableAccounts = await Promise.all(
    transaction.message.addressTableLookups.map(async (lookup) => {
      const res = await connection.getAddressLookupTable(lookup.accountKey);
      return res.value;
    })
  );
  
  const message = TransactionMessage.decompile(transaction.message, {
    addressLookupTableAccounts: addressLookupTableAccounts as AddressLookupTableAccount[]
  });
  
  // Generate random nonce and create live mandate object
  const crypto = require('crypto');
  const nonce = crypto.randomBytes(8).toString('hex');
  const mandateId = 'live-mandate-001';
  
  const liveMandate = {
    mandateId,
    version: '1.0',
    action: 'SWAP',
    cluster: 'mainnet-beta',
    inputMint: 'So11111111111111111111111111111111111111112', // wSOL
    outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
    maxInputAmount: BigInt(amountToSwap).toString(),
    minOutputAmount: BigInt(quoteResponse.outAmount).toString(),
    destinationAccount: wallet.publicKey.toBase58(),
    minUsdcReserve: '0',
    expiry: Date.now() + 3600000,
    nonce,
    signerIdentity: wallet.publicKey.toBase58(),
    policyVersion: '1.0'
  };
  fs.writeFileSync('scenarios/fixtures/live_mandate.json', JSON.stringify(liveMandate, null, 2));
  console.log('Created live mandate:', mandateId, 'with nonce:', nonce);
  
  // Create Mandate Memo Instruction
  const memoProgramId = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');
  const memoText = `${mandateId}:${nonce}`;
  const memoIx = new TransactionInstruction({
    keys: [],
    programId: memoProgramId,
    data: Buffer.from(memoText, 'utf8')
  });
  
  // Add memo right after compute budget instructions
  message.instructions.splice(2, 0, memoIx);
  
  // Recompile
  transaction.message = message.compileToV0Message(addressLookupTableAccounts as AddressLookupTableAccount[]);
  
  console.log('4. Signing and Sending...');
  transaction.sign([wallet]);
  
  const latestBlockhash = await connection.getLatestBlockhash();
  const txid = await connection.sendRawTransaction(transaction.serialize(), {
    skipPreflight: true,
    maxRetries: 2
  });
  console.log('Tx sent!', txid);
  
  await connection.confirmTransaction({
    signature: txid,
    blockhash: latestBlockhash.blockhash,
    lastValidBlockHeight: latestBlockhash.lastValidBlockHeight
  });
  console.log('Tx confirmed!');
  console.log('Success! Live execution completed.');
}

run().catch(console.error);
