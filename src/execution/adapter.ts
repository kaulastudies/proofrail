import { Mandate } from '../mandates/schema';

export interface ExecutionAdapter {
  executeMandate(mandate: Mandate): Promise<string>;
}

export class MockExecutionAdapter implements ExecutionAdapter {
  constructor(private mockedSignature: string) {}
  
  async executeMandate(mandate: Mandate): Promise<string> {
    // In a real scenario, this would use Jupiter / Solana web3 to build and sign tx
    return this.mockedSignature;
  }
}
