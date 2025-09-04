/**
 * Shared transaction utilities for common transaction patterns
 */

import { 
  address, 
  signTransaction,
  getBase64EncodedWireTransaction,
  type Instruction
} from '@solana/kit';
import { prepareTransaction } from './prepare';
import { sendTransaction } from './send';

export async function signAndSendTransaction(
  instructions: Instruction<string>[],
  signers: CryptoKeyPair[],
  feePayer: string
): Promise<string> {
  // Use Solana Kit transaction building
  const transaction = await prepareTransaction(
    instructions,
    feePayer
  );
  
  // Sign transaction
  const signedTransaction = await signTransaction(
    signers,
    transaction
  );

  const wireTransaction = getBase64EncodedWireTransaction(signedTransaction);
  
  // Send and confirm transaction
  return await sendTransaction(wireTransaction);
}