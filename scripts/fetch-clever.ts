import { Connection } from '@solana/web3.js';
import * as fs from 'fs';

async function run() {
  const url = 'https://api.mainnet-beta.solana.com';
  const connection = new Connection(url, 'finalized');

  try {
    const slot = await connection.getSlot();
    console.log('Current slot:', slot);
    
    // Fetch block with ONLY signatures
    const block = await connection.getBlock(slot - 2, {
      maxSupportedTransactionVersion: 1,
      transactionDetails: 'signatures'
    });
    
    if (block && (block as any).signatures) {
      const sigs = (block as any).signatures;
      console.log('Found', sigs.length, 'signatures in block');
      for (let i = 0; i < Math.min(20, sigs.length); i++) {
        const sig = sigs[i];
        const parsed = await connection.getParsedTransaction(sig, { maxSupportedTransactionVersion: 1 });
        if (parsed) {
          fs.writeFileSync('scenarios/fixtures/captured_mainnet_jupiter_swap.raw.json', JSON.stringify({ signature: sig, transaction: parsed }, null, 2));
          console.log('Saved RAW payload for sig:', sig);
          return;
        }
      }
    }
  } catch (e: any) {
    console.error('RPC Error:', e.message);
  }
}

run().catch(console.error);
