import { Connection, Keypair, VersionedTransaction, TransactionMessage, PublicKey, TransactionInstruction, AddressLookupTableAccount } from '@solana/web3.js';
import bs58 from 'bs58';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.live' });

async function run() {
  const rpcUrl = 'https://solana-rpc.publicnode.com';
  const secret = process.env.DISPOSABLE_WALLET_SECRET;
  if (!secret) throw new Error('Missing DISPOSABLE_WALLET_SECRET in .env.live');
  
  const connection = new Connection(rpcUrl, 'finalized');
  const wallet = Keypair.fromSecretKey(bs58.decode(secret));
  
  console.log('Wallet:', wallet.publicKey.toBase58());

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
  const mandateId = 'live-mandate-001';
  const nonce = 'nonce123';
  const memoText = mandateId + ':' + nonce;
  const memoIx = new TransactionInstruction({
    keys: [],
    programId: memoProgramId,
    data: Buffer.from(memoText, 'utf8')
  });
  
  message.instructions.splice(2, 0, memoIx);
  transaction.message = message.compileToV0Message(addressLookupTableAccounts as AddressLookupTableAccount[]);
  
  console.log('4. Signing...');
  transaction.sign([wallet]);
  
  console.log('5. Simulating...');
  const simulation = await connection.simulateTransaction(transaction);
  console.log('Simulation Result:', simulation.value);
}

run().catch(console.error);
