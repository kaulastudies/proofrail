import { Connection, ParsedTransactionWithMeta, PublicKey } from '@solana/web3.js';
import { Mandate } from '../mandates/schema';
import { VerificationState } from '../policy/stateMachine';
import { VerificationEvidence, generateEvidenceBundle, Observation } from '../evidence/bundle';

import * as crypto from 'crypto';

export interface VerifierConfig {
  requireMemoBinding: boolean;
  evidenceSource?: 'synthetic' | 'captured_mainnet' | 'live';
}

export class SolanaVerifier {
  private connection: Connection;
  private config: VerifierConfig;

  constructor(rpcUrl?: string, config: VerifierConfig = { requireMemoBinding: true, evidenceSource: 'synthetic' }) {
    const url = rpcUrl || process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
    this.connection = new Connection(url, 'finalized');
    this.config = config;
  }

  public async verifyMandateExecution(mandate: Mandate, signature: string): Promise<VerificationEvidence> {
    const failedInvariants: string[] = [];
    const observations: Observation[] = [];
    
    try {
      const tx = await this.connection.getParsedTransaction(signature, {
        maxSupportedTransactionVersion: 0,
      });

      if (!tx) {
        return generateEvidenceBundle(mandate, VerificationState.UNRESOLVED, signature, [], ['transaction_not_found'], this.config.evidenceSource);
      }
      
      const rawTxHash = crypto.createHash('sha256').update(JSON.stringify(tx)).digest('hex');

      if (tx.meta?.err) {
        return generateEvidenceBundle(mandate, VerificationState.FAILED_VERIFICATION, signature, [], ['transaction_failed'], this.config.evidenceSource, rawTxHash);
      }

      const accountKeys = tx.transaction.message.accountKeys;
      const getPubkeyStr = (ak: any) => typeof ak.pubkey === 'string' ? ak.pubkey : ak.pubkey.toBase58();

      const signer = accountKeys.find(ak => ak.signer);
      if (!signer || getPubkeyStr(signer) !== mandate.signerIdentity) {
        failedInvariants.push('unauthorized_signer');
      }
      
      const feePayer = getPubkeyStr(accountKeys[0]);
      const txFee = BigInt(tx.meta?.fee || 0);

      // 2.5 Tx-to-Mandate Binding (Anti-replay)
      if (this.config.requireMemoBinding) {
        const expectedMemo = `${mandate.mandateId}:${mandate.nonce}`;
        let foundMemo = false;
        
        const instructions = tx.transaction.message.instructions;
        for (const ix of instructions) {
          if ('parsed' in ix && typeof ix.parsed === 'string') {
             if (ix.parsed === expectedMemo) {
               foundMemo = true;
               break;
             }
          }
        }
        
        if (!foundMemo) {
          failedInvariants.push('missing_or_invalid_mandate_binding');
        }
      }

      // 3. Reconstruct balances
      const preTokenBalances = tx.meta?.preTokenBalances || [];
      const postTokenBalances = tx.meta?.postTokenBalances || [];
      const preBalances = tx.meta?.preBalances || [];
      const postBalances = tx.meta?.postBalances || [];

      const balanceChanges = new Map<string, { pre: bigint, post: bigint, mint: string, owner: string }>();

      const tokenAccountIndices = new Set<number>();

      // Token Balances
      for (const pre of preTokenBalances) {
        tokenAccountIndices.add(pre.accountIndex);
        balanceChanges.set(`${pre.mint}-${pre.owner}`, {
          pre: BigInt(pre.uiTokenAmount.amount),
          post: 0n,
          mint: pre.mint,
          owner: pre.owner || ''
        });
      }

      for (const post of postTokenBalances) {
        tokenAccountIndices.add(post.accountIndex);
        const key = `${post.mint}-${post.owner}`;
        if (balanceChanges.has(key)) {
          const entry = balanceChanges.get(key)!;
          entry.post = BigInt(post.uiTokenAmount.amount);
        } else {
          balanceChanges.set(key, {
            pre: 0n,
            post: BigInt(post.uiTokenAmount.amount),
            mint: post.mint,
            owner: post.owner || ''
          });
        }
      }
      
      // Native SOL handling (lamports)
      const nativeSolMint = 'So11111111111111111111111111111111111111112'; 
      // Track rent paid by the signer for new account creation (e.g. ATA creation)
      let rentPaidBySigner = 0n;
      
      // First pass: detect rent on ALL accounts (including token accounts)
      for (let i = 0; i < accountKeys.length; i++) {
        const preLamports = BigInt(preBalances[i] || 0);
        const postLamports = BigInt(postBalances[i] || 0);
        
        // Detect ATA/account creation rent: accounts that went from 0 lamports to rent-exempt minimum
        // (rent-exempt minimum is ~0.00203928 SOL = 2039280 lamports for token accounts)
        const isNewAccountRent = preLamports === 0n && postLamports > 0n && postLamports <= 3000000n && !accountKeys[i].signer;
        if (isNewAccountRent) {
            rentPaidBySigner += postLamports;
        }
      }
      
      // Second pass: track native SOL balance changes (excluding token accounts)
      for (let i = 0; i < accountKeys.length; i++) {
        if (tokenAccountIndices.has(i)) {
           continue; // Skip token accounts (they are already tracked via token balances)
        }

        const ownerStr = getPubkeyStr(accountKeys[i]);

        const preLamports = BigInt(preBalances[i] || 0);
        const postLamports = BigInt(postBalances[i] || 0);
        
        let delta = postLamports - preLamports;
        if (ownerStr === feePayer) {
            delta += txFee; 
        }
        
        if (delta !== 0n) {
           const key = `${nativeSolMint}-${ownerStr}-native`;
           // Since multiple native accounts for the same owner could exist (e.g. system accounts), we sum them
           if (balanceChanges.has(key)) {
               const existing = balanceChanges.get(key)!;
               existing.post += delta;
           } else {
               balanceChanges.set(key, {
                   pre: 0n,
                   post: delta,
                   mint: nativeSolMint,
                   owner: ownerStr
               });
           }
        }
      }

      let outputReceivedAtDest = 0n;
      let inputSpentBySigner = 0n;
      let anyOutputMintReceived = false;
      let anyInputMintSpent = false;
      
      // Track actual remaining balances for reserve checks
      const actualRemainingBalances = new Map<string, bigint>();
      for (const pre of preTokenBalances) {
        actualRemainingBalances.set(`${pre.mint}-${pre.owner}`, BigInt(pre.uiTokenAmount.amount));
      }
      for (const post of postTokenBalances) {
        actualRemainingBalances.set(`${post.mint}-${post.owner}`, BigInt(post.uiTokenAmount.amount));
      }

      for (const [key, change] of balanceChanges.entries()) {
        let delta = change.post - change.pre;
        
        if (delta === 0n) continue;

        observations.push({
          account: change.owner,
          preBalance: change.pre,
          postBalance: change.post,
          delta
        });

        if (change.mint === mandate.outputMint && delta > 0n) {
          anyOutputMintReceived = true;
          if (change.owner === mandate.destinationAccount) {
            outputReceivedAtDest += delta;
          }
        }
        
        if (change.mint === mandate.inputMint && delta < 0n) {
          anyInputMintSpent = true;
          if (change.owner === mandate.signerIdentity) {
            let spent = delta * -1n;
            // For native SOL swaps, exclude ATA creation rent from input spent
            if (change.mint === nativeSolMint && rentPaidBySigner > 0n) {
              spent = spent > rentPaidBySigner ? spent - rentPaidBySigner : 0n;
            }
            inputSpentBySigner += spent;
            
            // Reserve check: use actual remaining balance from token accounts, not the delta
            const reserveKey = `${change.mint}-${change.owner}`;
            const remainingBalance = actualRemainingBalances.get(reserveKey);
            if (remainingBalance !== undefined && remainingBalance < mandate.minUsdcReserve) {
              failedInvariants.push('reserve_requirement_violation');
            }
            // For native SOL, check actual lamport balance of the signer
            if (change.mint === nativeSolMint && remainingBalance === undefined) {
              const signerIdx = accountKeys.findIndex(ak => getPubkeyStr(ak) === mandate.signerIdentity);
              if (signerIdx >= 0) {
                const remainingLamports = BigInt(postBalances[signerIdx] || 0);
                if (remainingLamports < mandate.minUsdcReserve) {
                  failedInvariants.push('reserve_requirement_violation');
                }
              }
            }
          }
        }
      }

      if (!anyOutputMintReceived || !anyInputMintSpent) {
        failedInvariants.push('mint_mismatch');
      }

      if (inputSpentBySigner > mandate.maxInputAmount) {
        failedInvariants.push('max_input_exceeded');
      }

      if (outputReceivedAtDest < mandate.minOutputAmount) {
        if (anyOutputMintReceived && outputReceivedAtDest === 0n) {
          failedInvariants.push('destination_mismatch');
        } else {
          failedInvariants.push('minimum_output_violation');
        }
      }

      if (tx.blockTime && tx.blockTime * 1000 > mandate.expiry) {
        failedInvariants.push('mandate_expired');
      }

      const finalState = failedInvariants.length > 0 
        ? VerificationState.FAILED_VERIFICATION 
        : VerificationState.VERIFIED;

      return generateEvidenceBundle(
        mandate,
        finalState,
        signature,
        observations,
        failedInvariants,
        this.config.evidenceSource,
        rawTxHash,
        {
          swapInput: inputSpentBySigner.toString(),
          infrastructureCost: rentPaidBySigner.toString(),
          networkFee: txFee.toString(),
          totalWalletExpenditure: (inputSpentBySigner + rentPaidBySigner + txFee).toString(),
          actualOutput: outputReceivedAtDest.toString(),
        }
      );

    } catch (error) { 
      return generateEvidenceBundle(mandate, VerificationState.UNRESOLVED, signature, [], ['rpc_error_or_missing_evidence'], this.config.evidenceSource);
    }
  }
}
