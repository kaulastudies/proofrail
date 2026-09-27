const web3 = require('@solana/web3.js');
const fs = require('fs');

async function run() {
  const connection = new web3.Connection('https://api.mainnet-beta.solana.com', 'finalized');
  const usdc = new web3.PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
  console.log('Fetching sigs for USDC...');
  const sigs = await connection.getSignaturesForAddress(usdc, { limit: 50 });
  console.log('Got', sigs.length, 'sigs');
  
  for (const sigInfo of sigs) {
    const tx = await connection.getParsedTransaction(sigInfo.signature, { maxSupportedTransactionVersion: 1 });
    if (tx && !tx.meta.err && tx.transaction.message.instructions) {
      const isJup = JSON.stringify(tx).includes('JUP6LkbZbjS1jKKwapdH67DPUehq2A2i3R3f4zK4b2L');
      if (isJup) {
        fs.writeFileSync('scenarios/fixtures/captured_real_tx.json', JSON.stringify({ signature: sigInfo.signature, transaction: tx }, null, 2));
        console.log('Saved real tx:', sigInfo.signature);
        return;
      }
    }
  }
  console.log('No Jupiter tx found in recent USDC transfers.');
}
run().catch(console.error);
