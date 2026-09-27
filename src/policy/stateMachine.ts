import { Mandate } from '../mandates/schema';

export enum VerificationState {
  PENDING = 'PENDING',
  EXECUTED = 'EXECUTED',
  VERIFIED = 'VERIFIED',
  FAILED_VERIFICATION = 'FAILED_VERIFICATION',
  BLOCKED = 'BLOCKED',
  UNRESOLVED = 'UNRESOLVED',
}

export interface StateTransition {
  from: VerificationState;
  to: VerificationState;
  reason?: string;
  timestamp: number;
}

export class MandateStateMachine {
  private currentState: VerificationState;
  private mandate: Mandate;
  private history: StateTransition[];

  constructor(mandate: Mandate) {
    this.mandate = mandate;
    this.currentState = VerificationState.PENDING;
    this.history = [];
  }

  public getState(): VerificationState {
    return this.currentState;
  }

  public getHistory(): StateTransition[] {
    return [...this.history];
  }

  public getMandate(): Mandate {
    return this.mandate;
  }

  private transition(to: VerificationState, reason?: string) {
    this.history.push({
      from: this.currentState,
      to,
      reason,
      timestamp: Date.now(),
    });
    this.currentState = to;
  }

  public markExecuted(reason?: string) {
    if (this.currentState !== VerificationState.PENDING) {
      throw new Error(`Invalid transition: Cannot move from ${this.currentState} to EXECUTED`);
    }
    this.transition(VerificationState.EXECUTED, reason);
  }

  public markVerified(reason?: string) {
    if (this.currentState !== VerificationState.EXECUTED) {
      throw new Error(`Invalid transition: Cannot move from ${this.currentState} to VERIFIED`);
    }
    this.transition(VerificationState.VERIFIED, reason);
  }

  public markFailedVerification(reason?: string) {
    if (this.currentState !== VerificationState.EXECUTED) {
      throw new Error(`Invalid transition: Cannot move from ${this.currentState} to FAILED_VERIFICATION`);
    }
    this.transition(VerificationState.FAILED_VERIFICATION, reason);
  }

  public markBlocked(reason?: string) {
    if (this.currentState !== VerificationState.PENDING) {
      throw new Error(`Invalid transition: Cannot move from ${this.currentState} to BLOCKED`);
    }
    this.transition(VerificationState.BLOCKED, reason);
  }

  public markUnresolved(reason?: string) {
    if (this.currentState !== VerificationState.EXECUTED) {
      throw new Error(`Invalid transition: Cannot move from ${this.currentState} to UNRESOLVED`);
    }
    this.transition(VerificationState.UNRESOLVED, reason);
  }

  public isNextActionAllowed(): boolean {
    return this.currentState === VerificationState.VERIFIED;
  }
}
