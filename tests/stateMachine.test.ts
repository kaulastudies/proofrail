import { MandateStateMachine, VerificationState } from '../src/policy/stateMachine';
import { Mandate } from '../src/mandates/schema';

describe('MandateStateMachine', () => {
  let mockMandate: Mandate;

  beforeEach(() => {
    mockMandate = {
      mandateId: '123e4567-e89b-12d3-a456-426614174000',
      version: '1.0',
      action: 'SWAP',
      cluster: 'devnet',
      inputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
      outputMint: 'So11111111111111111111111111111111111111112', // WSOL
      maxInputAmount: 1000000n, // 1 USDC
      minOutputAmount: 5000000n, // 0.005 SOL
      destinationAccount: 'Dest111111111111111111111111111111111111111',
      minUsdcReserve: 10000000n, // 10 USDC
      expiry: Date.now() + 3600000,
      nonce: 'nonce123',
      signerIdentity: 'Operator1',
      policyVersion: '1.0'
    };
  });

  test('should initialize in PENDING state', () => {
    const machine = new MandateStateMachine(mockMandate);
    expect(machine.getState()).toBe(VerificationState.PENDING);
    expect(machine.isNextActionAllowed()).toBe(false);
  });

  test('should transition to BLOCKED if policy violated before execution', () => {
    const machine = new MandateStateMachine(mockMandate);
    machine.markBlocked('Unauthorized redirect proposed');
    expect(machine.getState()).toBe(VerificationState.BLOCKED);
    expect(machine.isNextActionAllowed()).toBe(false);
  });

  test('should transition to EXECUTED and then VERIFIED on success', () => {
    const machine = new MandateStateMachine(mockMandate);
    machine.markExecuted('Agent claimed success');
    expect(machine.getState()).toBe(VerificationState.EXECUTED);
    expect(machine.isNextActionAllowed()).toBe(false);

    machine.markVerified('Outcome matches mandate exactly');
    expect(machine.getState()).toBe(VerificationState.VERIFIED);
    expect(machine.isNextActionAllowed()).toBe(true);
  });

  test('should transition to FAILED_VERIFICATION if outcome violates mandate', () => {
    const machine = new MandateStateMachine(mockMandate);
    machine.markExecuted('Agent claimed success');
    machine.markFailedVerification('Destination mismatch: funds sent to attacker');
    expect(machine.getState()).toBe(VerificationState.FAILED_VERIFICATION);
    expect(machine.isNextActionAllowed()).toBe(false);
  });

  test('should transition to UNRESOLVED if evidence is missing or ambiguous', () => {
    const machine = new MandateStateMachine(mockMandate);
    machine.markExecuted('Agent claimed success');
    machine.markUnresolved('RPC node returned inconsistent state');
    expect(machine.getState()).toBe(VerificationState.UNRESOLVED);
    expect(machine.isNextActionAllowed()).toBe(false);
  });

  test('should record history correctly', () => {
    const machine = new MandateStateMachine(mockMandate);
    machine.markExecuted('Agent claimed success');
    machine.markVerified('Outcome matches mandate exactly');
    
    const history = machine.getHistory();
    expect(history.length).toBe(2);
    expect(history[0].from).toBe(VerificationState.PENDING);
    expect(history[0].to).toBe(VerificationState.EXECUTED);
    expect(history[1].from).toBe(VerificationState.EXECUTED);
    expect(history[1].to).toBe(VerificationState.VERIFIED);
  });
});
