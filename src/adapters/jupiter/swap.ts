import { Connection, Keypair, VersionedTransaction } from '@solana/web3.js';
 // using global fetch if Node 18+, but let's just use standard fetch

export class JupiterAdapter {
  private connection: Connection;
  
  constructor(rpcUrl: string) {
    this.connection = new Connection(rpcUrl, 'confirmed');
  }

  public async getQuote(inputMint: string, outputMint: string, amount: bigint) {
    const url = `https://quote-api.jup.ag/v6/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount.toString()}&slippageBps=50`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to get Jupiter quote: ${response.statusText}`);
    }
    return await response.json();
  }

  public async getSwapTransaction(quoteResponse: any, userPublicKey: string, destinationTokenAccount?: string) {
    const requestBody: any = {
      quoteResponse,
      userPublicKey,
      wrapAndUnwrapSol: true,
    };
    
    if (destinationTokenAccount) {
      requestBody.destinationTokenAccount = destinationTokenAccount;
    }

    const response = await fetch('https://quote-api.jup.ag/v6/swap', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`Failed to get swap transaction: ${response.statusText}`);
    }

    const { swapTransaction } = await response.json() as any;
    
    // Deserialize the transaction
    const swapTransactionBuf = Buffer.from(swapTransaction, 'base64');
    const transaction = VersionedTransaction.deserialize(swapTransactionBuf);

    return transaction;
  }

  public async executeSwap(transaction: VersionedTransaction, keypair: Keypair): Promise<string> {
    transaction.sign([keypair]);
    
    const rawTransaction = transaction.serialize();
    const txid = await this.connection.sendRawTransaction(rawTransaction, {
      skipPreflight: false,
      maxRetries: 2
    });
    
    const latestBlockHash = await this.connection.getLatestBlockhash();
    await this.connection.confirmTransaction({
      blockhash: latestBlockHash.blockhash,
      lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
      signature: txid
    }, 'confirmed');
    
    return txid;
  }
}
