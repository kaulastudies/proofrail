import { SolanaVerifier } from '../src/verifier/solanaVerifier';
import { Mandate } from '../src/mandates/schema';
import { VerificationState } from '../src/policy/stateMachine';

jest.mock('@solana/web3.js', () => {
  return {
    Connection: jest.fn().mockImplementation(() => ({
      getParsedTransaction: jest.fn()
    }))
  };
});

describe('SolanaVerifier Regression Tests', () => {
  let verifier: SolanaVerifier;
  let mockMandate: Mandate;
  let mockConnection: any;

  beforeEach(() => {
    verifier = new SolanaVerifier('mocked', { requireMemoBinding: true });
    mockConnection = (verifier as any).connection;
    mockMandate = {
      mandateId: 'demo-mandate',
      version: '1.0',
      action: 'SWAP',
      cluster: 'mainnet-beta',
      inputMint: 'USDC_MINT',
      outputMint: 'SOL_MINT', // For native sol test, we should pass native SOL mint if we're testing it, but standard SWAP tests use SOL_MINT which we'll treat as SPL token except in native test
      maxInputAmount: 1000n,
      minOutputAmount: 5000n,
      destinationAccount: 'DEST_ACCOUNT',
      minUsdcReserve: 10000n,
      expiry: Date.now() + 3600000,
      nonce: 'nonce123',
      signerIdentity: 'Operator1',
      policyVersion: '1.0'
    };
  });

  const createMockTx = (
    preBalances: any[],
    postBalances: any[],
    signer: string = 'Operator1',
    memo: string = 'demo-mandate:nonce123'
  ) => ({
    meta: { err: null, preTokenBalances: preBalances, postTokenBalances: postBalances, preBalances: [] as number[], postBalances: [] as number[], fee: 0 },
    transaction: {
      message: {
        accountKeys: [{ pubkey: { toBase58: () => signer }, signer: true }],
        instructions: [{ parsed: memo }]
      }
    },
    blockTime: Math.floor(Date.now() / 1000) - 100
  });

  const stdPre = [
    { accountIndex: 0, mint: 'USDC_MINT', owner: 'Operator1', uiTokenAmount: { amount: '12000' } },
    { accountIndex: 1, mint: 'SOL_MINT', owner: 'DEST_ACCOUNT', uiTokenAmount: { amount: '0' } }
  ];
  
  test('VERIFIED: Happy path', async () => {
    const post = [
      { accountIndex: 0, mint: 'USDC_MINT', owner: 'Operator1', uiTokenAmount: { amount: '11000' } },
      { accountIndex: 1, mint: 'SOL_MINT', owner: 'DEST_ACCOUNT', uiTokenAmount: { amount: '5000' } }
    ];
    mockConnection.getParsedTransaction.mockResolvedValue(createMockTx(stdPre, post));
    const result = await verifier.verifyMandateExecution(mockMandate, 'tx1');
    expect(result.verificationStatus).toBe(VerificationState.VERIFIED);
    expect(result.failedInvariants).toHaveLength(0);
  });

  test('FAILED: destination_mismatch', async () => {
    const pre = [
      { accountIndex: 0, mint: 'USDC_MINT', owner: 'Operator1', uiTokenAmount: { amount: '12000' } },
      { accountIndex: 1, mint: 'SOL_MINT', owner: 'ATTACKER', uiTokenAmount: { amount: '0' } },
      { accountIndex: 2, mint: 'SOL_MINT', owner: 'DEST_ACCOUNT', uiTokenAmount: { amount: '0' } }
    ];
    const post = [
      { accountIndex: 0, mint: 'USDC_MINT', owner: 'Operator1', uiTokenAmount: { amount: '11000' } },
      { accountIndex: 1, mint: 'SOL_MINT', owner: 'ATTACKER', uiTokenAmount: { amount: '5000' } },
      { accountIndex: 2, mint: 'SOL_MINT', owner: 'DEST_ACCOUNT', uiTokenAmount: { amount: '0' } }
    ];
    mockConnection.getParsedTransaction.mockResolvedValue(createMockTx(pre, post));
    const result = await verifier.verifyMandateExecution(mockMandate, 'tx1');
    expect(result.failedInvariants).toContain('destination_mismatch');
  });

  test('FAILED: minimum_output_violation', async () => {
    const post = [
      { accountIndex: 0, mint: 'USDC_MINT', owner: 'Operator1', uiTokenAmount: { amount: '11000' } },
      { accountIndex: 1, mint: 'SOL_MINT', owner: 'DEST_ACCOUNT', uiTokenAmount: { amount: '4000' } }
    ];
    mockConnection.getParsedTransaction.mockResolvedValue(createMockTx(stdPre, post));
    const result = await verifier.verifyMandateExecution(mockMandate, 'tx1');
    expect(result.failedInvariants).toContain('minimum_output_violation');
  });

  test('FAILED: max_input_exceeded', async () => {
    const post = [
      { accountIndex: 0, mint: 'USDC_MINT', owner: 'Operator1', uiTokenAmount: { amount: '10500' } },
      { accountIndex: 1, mint: 'SOL_MINT', owner: 'DEST_ACCOUNT', uiTokenAmount: { amount: '5000' } }
    ];
    mockConnection.getParsedTransaction.mockResolvedValue(createMockTx(stdPre, post));
    const result = await verifier.verifyMandateExecution(mockMandate, 'tx1');
    expect(result.failedInvariants).toContain('max_input_exceeded');
  });

  test('FAILED: mint_mismatch', async () => {
    const pre = [
      { accountIndex: 0, mint: 'USDC_MINT', owner: 'Operator1', uiTokenAmount: { amount: '12000' } },
      { accountIndex: 1, mint: 'WRONG_MINT', owner: 'DEST_ACCOUNT', uiTokenAmount: { amount: '0' } }
    ];
    const post = [
      { accountIndex: 0, mint: 'USDC_MINT', owner: 'Operator1', uiTokenAmount: { amount: '11000' } },
      { accountIndex: 1, mint: 'WRONG_MINT', owner: 'DEST_ACCOUNT', uiTokenAmount: { amount: '5000' } }
    ];
    mockConnection.getParsedTransaction.mockResolvedValue(createMockTx(pre, post));
    const result = await verifier.verifyMandateExecution(mockMandate, 'tx1');
    expect(result.failedInvariants).toContain('mint_mismatch');
  });

  test('FAILED: missing_or_invalid_mandate_binding', async () => {
    const post = [
      { accountIndex: 0, mint: 'USDC_MINT', owner: 'Operator1', uiTokenAmount: { amount: '11000' } },
      { accountIndex: 1, mint: 'SOL_MINT', owner: 'DEST_ACCOUNT', uiTokenAmount: { amount: '5000' } }
    ];
    mockConnection.getParsedTransaction.mockResolvedValue(createMockTx(stdPre, post, 'Operator1', 'invalid_memo'));
    const result = await verifier.verifyMandateExecution(mockMandate, 'tx1');
    expect(result.failedInvariants).toContain('missing_or_invalid_mandate_binding');
  });

  test('FAILED: MULTIPLE INVARIANTS', async () => {
    const pre = [
      { accountIndex: 0, mint: 'USDC_MINT', owner: 'Operator1', uiTokenAmount: { amount: '10500' } },
      { accountIndex: 1, mint: 'SOL_MINT', owner: 'DEST_ACCOUNT', uiTokenAmount: { amount: '0' } }
    ];
    const post = [
      { accountIndex: 0, mint: 'USDC_MINT', owner: 'Operator1', uiTokenAmount: { amount: '8500' } },
      { accountIndex: 1, mint: 'SOL_MINT', owner: 'DEST_ACCOUNT', uiTokenAmount: { amount: '4000' } }
    ];
    mockConnection.getParsedTransaction.mockResolvedValue(createMockTx(pre, post, 'Operator1', 'invalid_memo'));
    const result = await verifier.verifyMandateExecution(mockMandate, 'tx1');
    expect(result.failedInvariants).toContain('max_input_exceeded');
    expect(result.failedInvariants).toContain('minimum_output_violation');
    expect(result.failedInvariants).toContain('reserve_requirement_violation');
    expect(result.failedInvariants).toContain('missing_or_invalid_mandate_binding');
    expect(result.failedInvariants.length).toBe(4);
  });

  test('VERIFIED: Native SOL output with fees correctly handled', async () => {
    const nativeMandate = { ...mockMandate, outputMint: 'So11111111111111111111111111111111111111112' };
    const preTokens = [ { accountIndex: 0, mint: 'USDC_MINT', owner: 'Operator1', uiTokenAmount: { amount: '12000' } } ];
    const postTokens = [ { accountIndex: 0, mint: 'USDC_MINT', owner: 'Operator1', uiTokenAmount: { amount: '11000' } } ];
    
    const mockTx = createMockTx(preTokens, postTokens);
    mockTx.meta.preBalances = [100000000, 0];
    mockTx.meta.postBalances = [99995000, 5000];
    mockTx.meta.fee = 5000;
    
    mockTx.transaction.message.accountKeys = [
      { pubkey: { toBase58: () => 'Operator1' }, signer: true },
      { pubkey: { toBase58: () => 'DEST_ACCOUNT' }, signer: false }
    ];
    
    mockConnection.getParsedTransaction.mockResolvedValue(mockTx);
    const result = await verifier.verifyMandateExecution(nativeMandate, 'tx1');
    
    expect(result.verificationStatus).toBe(VerificationState.VERIFIED);
    expect(result.failedInvariants).toHaveLength(0);
  });

  describe('Memo Binding Checks', () => {
    const post = [
      { accountIndex: 0, mint: 'USDC_MINT', owner: 'Operator1', uiTokenAmount: { amount: '11000' } },
      { accountIndex: 1, mint: 'SOL_MINT', owner: 'DEST_ACCOUNT', uiTokenAmount: { amount: '5000' } }
    ];

    test('exact memo → passes binding check', async () => {
      mockConnection.getParsedTransaction.mockResolvedValue(createMockTx(stdPre, post, 'Operator1', 'demo-mandate:nonce123'));
      const result = await verifier.verifyMandateExecution(mockMandate, 'tx1');
      expect(result.verificationStatus).toBe(VerificationState.VERIFIED);
      expect(result.failedInvariants).not.toContain('missing_or_invalid_mandate_binding');
    });

    test('wrong mandate ID → fails', async () => {
      mockConnection.getParsedTransaction.mockResolvedValue(createMockTx(stdPre, post, 'Operator1', 'wrong-mandate:nonce123'));
      const result = await verifier.verifyMandateExecution(mockMandate, 'tx1');
      expect(result.failedInvariants).toContain('missing_or_invalid_mandate_binding');
    });

    test('wrong nonce → fails', async () => {
      mockConnection.getParsedTransaction.mockResolvedValue(createMockTx(stdPre, post, 'Operator1', 'demo-mandate:wrongnonce'));
      const result = await verifier.verifyMandateExecution(mockMandate, 'tx1');
      expect(result.failedInvariants).toContain('missing_or_invalid_mandate_binding');
    });

    test('missing memo → fails', async () => {
      const tx = createMockTx(stdPre, post, 'Operator1', '');
      tx.transaction.message.instructions = []; // completely remove memo instruction
      mockConnection.getParsedTransaction.mockResolvedValue(tx);
      const result = await verifier.verifyMandateExecution(mockMandate, 'tx1');
      expect(result.failedInvariants).toContain('missing_or_invalid_mandate_binding');
    });
  });

  describe('V1.1 Semantics (Infrastructure Rent & Reserves)', () => {
    const nativeSolMint = 'So11111111111111111111111111111111111111112';

    test('first-time USDC ATA creation separates rent from swap input', async () => {
      // Signer swaps 1000 native lamports for 5000 USDC.
      // Signer ALSO pays 2039280 lamports rent for new USDC ATA.
      // Total spent native lamports: 1000 + 2039280 + 5000(fee) = 2045280.
      
      const v1Mandate = {
        ...mockMandate,
        inputMint: nativeSolMint,
        outputMint: 'USDC_MINT',
        maxInputAmount: 1000n, // Max swap input is 1000 lamports
      };

      const mockTx = createMockTx([], [
        { accountIndex: 2, mint: 'USDC_MINT', owner: 'DEST_ACCOUNT', uiTokenAmount: { amount: '5000' } }
      ]);
      mockTx.transaction.message.accountKeys = [
        { pubkey: { toBase58: () => 'Operator1' }, signer: true },
        { pubkey: { toBase58: () => 'System' }, signer: false },
        { pubkey: { toBase58: () => 'DEST_ACCOUNT' }, signer: false } // New ATA
      ];
      
      mockTx.meta.preBalances = [10000000, 5000000, 0];
      // Signer post = 10000000 - 1000(swap) - 5000(fee) - 2039280(rent) = 7954720
      mockTx.meta.postBalances = [7954720, 5001000, 2039280]; 
      mockTx.meta.fee = 5000;
      
      mockConnection.getParsedTransaction.mockResolvedValue(mockTx);
      const result = await verifier.verifyMandateExecution(v1Mandate, 'tx1');
      
      expect(result.verificationStatus).toBe(VerificationState.VERIFIED);
      expect(result.failedInvariants).not.toContain('max_input_exceeded');
      expect(result.swapInput).toBe('1000');
      expect(result.infrastructureCost).toBe('2039280');
      expect(result.totalWalletExpenditure).toBe('2045280');
    });

    test('pre-existing ATA does not deduct rent incorrectly', async () => {
      const v1Mandate = {
        ...mockMandate,
        inputMint: nativeSolMint,
        outputMint: 'USDC_MINT',
        maxInputAmount: 1000n,
      };

      const mockTx = createMockTx(
        [{ accountIndex: 2, mint: 'USDC_MINT', owner: 'DEST_ACCOUNT', uiTokenAmount: { amount: '500' } }],
        [{ accountIndex: 2, mint: 'USDC_MINT', owner: 'DEST_ACCOUNT', uiTokenAmount: { amount: '5500' } }]
      );
      mockTx.transaction.message.accountKeys = [
        { pubkey: { toBase58: () => 'Operator1' }, signer: true },
        { pubkey: { toBase58: () => 'System' }, signer: false },
        { pubkey: { toBase58: () => 'DEST_ACCOUNT' }, signer: false }
      ];
      
      // ATA already exists with rent. Vault (idx 1) already has 5000000
      mockTx.meta.preBalances = [10000000, 5000000, 2039280];
      mockTx.meta.postBalances = [9994000, 5001000, 2039280]; // Spent 1000 + 5000 fee = 6000
      mockTx.meta.fee = 5000;
      
      mockConnection.getParsedTransaction.mockResolvedValue(mockTx);
      const result = await verifier.verifyMandateExecution(v1Mandate, 'tx1');
      
      expect(result.verificationStatus).toBe(VerificationState.VERIFIED);
      expect(result.swapInput).toBe('1000');
      expect(result.infrastructureCost).toBe('0');
      expect(result.totalWalletExpenditure).toBe('6000');
    });

    test('native SOL reserve calculation uses actual post-balance, not delta', async () => {
      const v1Mandate = {
        ...mockMandate,
        inputMint: nativeSolMint,
        minUsdcReserve: 7000000n, // Must have 7,000,000 lamports remaining
      };

      const mockTx = createMockTx([], [
        { accountIndex: 2, mint: 'USDC_MINT', owner: 'DEST_ACCOUNT', uiTokenAmount: { amount: '5000' } }
      ]);
      mockTx.transaction.message.accountKeys = [
        { pubkey: { toBase58: () => 'Operator1' }, signer: true },
        { pubkey: { toBase58: () => 'System' }, signer: false },
        { pubkey: { toBase58: () => 'DEST_ACCOUNT' }, signer: false }
      ];
      
      mockTx.meta.preBalances = [10000000, 5000000, 0];
      mockTx.meta.postBalances = [7954720, 5001000, 2039280]; // remaining > 7000000
      mockTx.meta.fee = 5000;
      
      mockConnection.getParsedTransaction.mockResolvedValue(mockTx);
      let result = await verifier.verifyMandateExecution(v1Mandate, 'tx1');
      expect(result.failedInvariants).not.toContain('reserve_requirement_violation');

      // Now fail it
      v1Mandate.minUsdcReserve = 8000000n; // requires 8,000,000, but only has 7,954,720
      result = await verifier.verifyMandateExecution(v1Mandate, 'tx1');
      expect(result.failedInvariants).toContain('reserve_requirement_violation');
    });
  });
});
