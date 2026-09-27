import { Connection, Keypair, VersionedTransaction } from '@solana/web3.js';
import bs58 from 'bs58';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config();
dotenv.config({ path: '.env.live' });

async function run() {
  const rpcUrl = process.env.SOLANA_RPC_URL;
  if (!rpcUrl) throw new Error('Missing SOLANA_RPC_URL in .env');
  
  const secret = process.env.DISPOSABLE_WALLET_SECRET;
  if (!secret) throw new Error('Missing DISPOSABLE_WALLET_SECRET in .env.live');
  
  const connection = new Connection(rpcUrl, 'finalized');
  const wallet = Keypair.fromSecretKey(bs58.decode(secret));
  
  console.log('Wallet:', wallet.publicKey.toBase58());
  const balance = await connection.getBalance(wallet.publicKey);
  console.log('Balance:', balance / 1e9, 'SOL');
  
  if (balance < 0.005) {
    throw new Error('Insufficient balance for a swap + fees. Please fund this wallet with ~0.01 SOL.');
  }

  // 1. Get Quote for 0.001 SOL -> USDC
  console.log('Fetching Jupiter Quote...');
  const amountToSwap = Math.floor(0.001 * 1e9); 
  const quoteUrl = 'https://quote-api.jup.ag/v6/quote?inputMint=So11111111111111111111111111111111111111112&outputMint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v&amount=' + amountToSwap + '&slippageBps=50';
  
  const quoteResponse = await (await fetch(quoteUrl)).json();
  
  if (!quoteResponse || quoteResponse.error) {
    throw new Error('Failed to get quote: ' + JSON.stringify(quoteResponse));
  }
  
  // 2. Get Swap Transaction
  console.log('Building Swap Transaction...');
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

  if (!swapResponse.swapTransaction) {
    throw new Error('Failed to get swap transaction: ' + JSON.stringify(swapResponse));
  }
  console.log('Swap transaction built successfully. Ready to execute!');
  console.log('NOTE: Execution is paused. The script is ready for Phase 5.');
}

run().catch(console.error);
