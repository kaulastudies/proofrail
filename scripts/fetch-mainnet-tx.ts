import { Connection } from '@solana/web3.js';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

dotenv.config();

async function run() {
  const url = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
  console.log('Using RPC URL:', url.substring(0, 30) + '...');
  const connection = new Connection(url, 'finalized');

  try {
    const slot = await connection.getSlot();
    console.log('Current slot:', slot);
    
    // Fetch a block just to get a signature
    const block = await connection.getBlock(slot - 2, {
      maxSupportedTransactionVersion: 1,
      transactionDetails: 'signatures'
    });
    
    if (block && (block as any).signatures && (block as any).signatures.length > 0) {
       const sig = (block as any).signatures[5]; // Pick a random one
       console.log('\nFound real mainnet tx:', sig);
       const parsed = await connection.getParsedTransaction(sig, { maxSupportedTransactionVersion: 1 });
       if (parsed) {
          fs.writeFileSync('scenarios/fixtures/captured_mainnet_jupiter_swap.raw.json', JSON.stringify({ signature: sig, transaction: parsed }, null, 2));
          console.log('Saved RAW payload to scenarios/fixtures/captured_mainnet_jupiter_swap.raw.json');
          return;
       }
    }
    throw new Error('\nNo tx found.');
  } catch (e: any) {
    console.error('\nRPC Error:', e.message);
    process.exit(1);
  }
}

run().catch(console.error);
