import { Keypair } from '@solana/web3.js';
import * as fs from 'fs';
import bs58 from 'bs58';

async function run() {
  const wallet = Keypair.generate();
  const publicKey = wallet.publicKey.toBase58();
  const secretKey = bs58.encode(wallet.secretKey);
  
  console.log('--- NEW DISPOSABLE WALLET GENERATED ---');
  console.log('Public Key:', publicKey);
  
  const envPath = '.env.live';
  fs.writeFileSync(envPath, 'DISPOSABLE_WALLET_SECRET=' + secretKey + '\r\n');
  console.log('\nSaved secret key to', envPath);
  console.log('WARNING: Do NOT commit this file. Only use for this tiny live swap.');
  
  const gitignore = fs.existsSync('.gitignore') ? fs.readFileSync('.gitignore', 'utf8') : '';
  if (!gitignore.includes('.env.live')) {
    fs.appendFileSync('.gitignore', '\r\n.env.live\r\n');
  }
}

run().catch(console.error);
