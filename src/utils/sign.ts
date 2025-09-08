/**
 * Shared transaction utilities for common transaction patterns
 */

import { 
  assertIsSendableTransaction,
  getSignatureFromTransaction,
  type Instruction,
  signTransaction,
} from '@solana/kit';
import { sendAndConfirmTransaction } from './rpc';
import { prepareTransaction } from './prepare';

export async function signAndSendTransaction(
  instructions: Instruction<string>[],
  signers: CryptoKeyPair[],
  feePayer: string,
  commitment: 'processed' | 'confirmed' | 'finalized' = 'confirmed'
): Promise<string> {  
  // Create transaction message using the new approach
  const transactionMessage =  await prepareTransaction(instructions, feePayer);
  
  // Sign the transaction message
  const signedTransaction = await signTransaction(
    signers,
    transactionMessage
  );
  assertIsSendableTransaction(signedTransaction);

  // Get signature before sending
  const signature = getSignatureFromTransaction(signedTransaction);
  console.log(`Transaction signature: ${signature}`);

  // Send and confirm transaction using the factory
  await sendAndConfirmTransaction(signedTransaction, { commitment });
  
  return signature;
}