const web3 = require('@solana/web3.js');
const fs = require('fs');

async function run() {
  const connection = new web3.Connection('https://api.mainnet-beta.solana.com', 'finalized');
  console.log('Fetching slot...');
  let slot = await connection.getSlot();
  console.log('Slot:', slot);
  
  let attempts = 0;
  while(attempts < 5) {
    console.log('Fetching block', slot);
    try {
      const block = await connection.getBlock(slot, { maxSupportedTransactionVersion: 1 });
      if (block && block.transactions) {
        for (const tx of block.transactions) {
          const keys = tx.transaction.message.accountKeys.map(ak => typeof ak.pubkey === 'string' ? ak.pubkey : ak.pubkey.toBase58());
          if (keys.includes('JUP6LkbZbjS1jKKwapdH67DPUehq2A2i3R3f4zK4b2L')) {
            const sig = tx.transaction.signatures[0];
            
            // To be exactly matching getParsedTransaction format:
            const parsedTx = await connection.getParsedTransaction(sig, { maxSupportedTransactionVersion: 1 });
            if (parsedTx) {
              fs.writeFileSync('scenarios/fixtures/captured_real_tx.json', JSON.stringify({ signature: sig, transaction: parsedTx }, null, 2));
              console.log('Found and saved parsed tx sig:', sig);
              return;
            }
          }
        }
      }
    } catch(e) { console.error(e.message); }
    slot--;
    attempts++;
  }
}
run().catch(console.error);
