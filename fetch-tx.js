const web3 = require('@solana/web3.js');
const fs = require('fs');

async function run() {
  console.log('Fetching signatures...');
  const connection = new web3.Connection('https://api.mainnet-beta.solana.com', 'confirmed');
  const jupProgram = new web3.PublicKey('JUP6LkbZbjS1jKKwapdH67DPUehq2A2i3R3f4zK4b2L');
  
  const sigs = await connection.getSignaturesForAddress(jupProgram, { limit: 5 });
  console.log('Got', sigs.length, 'signatures');
  for (const sigInfo of sigs) {
    console.log('Fetching tx', sigInfo.signature);
    const tx = await connection.getParsedTransaction(sigInfo.signature, { maxSupportedTransactionVersion: 0 });
    if (tx && !tx.meta.err) {
      fs.writeFileSync('fixture_tx.json', JSON.stringify({ signature: sigInfo.signature, tx }, null, 2));
      console.log('Saved sig:', sigInfo.signature);
      return;
    }
  }
}
run().catch(console.error);
