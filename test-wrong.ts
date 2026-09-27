import { SolanaVerifier } from './src/verifier/solanaVerifier';
import * as fs from 'fs';
const f = JSON.parse(fs.readFileSync('./scenarios/fixtures/wrong_destination.json', 'utf8'));
const mandate = JSON.parse(fs.readFileSync('./demo-mandate.json', 'utf8'));
const v = new SolanaVerifier('http://localhost');
(v as any).connection.getParsedTransaction = async () => f.transaction;
v.verifyMandateExecution(mandate, 'x').then(r => console.log(r.failedInvariants));
