const { Connection } = require('@solana/web3.js');
const c = new Connection('https://solana-rpc.publicnode.com');
c.getSlot().then(slot => {
  return c.getBlock(slot - 2, {maxSupportedTransactionVersion: 1, transactionDetails: 'full'});
}).then(b => {
  console.log('Block signatures length:', b.transactions.length);
}).catch(e => console.error(e.message));
