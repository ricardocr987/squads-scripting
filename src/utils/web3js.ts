import * as web3 from '@solana/web3.js';
import { rpc } from './rpc';

/**
 * Creates a Web3.js Connection from the existing RPC
 */
export function createWeb3Connection(): web3.Connection {
  // Extract the endpoint from the RPC configuration
  const endpoint = 'https://api.devnet.solana.com'; // Default devnet endpoint
  return new web3.Connection(endpoint, 'confirmed');
}

/**
 * Creates a Web3.js TransactionMessage with the provided instructions
 */
export async function createTransactionMessage(
  instructions: web3.TransactionInstruction[],
  payer: web3.PublicKey
): Promise<web3.TransactionMessage> {
  const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();
  
  return new web3.TransactionMessage({
    payerKey: payer,
    recentBlockhash: latestBlockhash.blockhash,
    instructions,
  });
}

/**
 * Serializes a TransactionMessage to bytes
 */
export function serializeTransactionMessage(message: web3.TransactionMessage): Uint8Array {
  return message.compileToV0Message().serialize();
}

/**
 * Creates and sends a transaction using Web3.js
 */
export async function sendAndConfirmTransaction(
  connection: web3.Connection,
  transaction: web3.Transaction,
  signers: web3.Signer[]
): Promise<string> {
  // Send and confirm the transaction
  const signature = await web3.sendAndConfirmTransaction(
    connection,
    transaction,
    signers,
    {
      commitment: 'confirmed',
      skipPreflight: false,
    }
  );
  
  return signature;
}

/**
 * Creates a Web3.js transaction with the provided instructions
 */
export async function createWeb3Transaction(
  instructions: web3.TransactionInstruction[],
  payer: web3.PublicKey
): Promise<web3.Transaction> {
  const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();
  
  const transaction = new web3.Transaction().add(...instructions);
  transaction.recentBlockhash = latestBlockhash.blockhash;
  transaction.feePayer = payer;
  
  return transaction;
}

/**
 * Converts a @solana/kit address to Web3.js PublicKey
 */
export function toWeb3PublicKey(address: string): web3.PublicKey {
  return new web3.PublicKey(address);
}

/**
 * Converts a @solana/kit instruction to Web3.js TransactionInstruction
 */
export function toWeb3Instruction(instruction: any): web3.TransactionInstruction {
  // Extract accounts from the instruction
  const accounts = instruction.accounts?.map((account: any) => ({
    pubkey: toWeb3PublicKey(account.address || account.value),
    isSigner: account.isSigner || account.role === 'READONLY_SIGNER' || account.role === 'WRITABLE_SIGNER',
    isWritable: account.isWritable || account.role === 'WRITABLE' || account.role === 'WRITABLE_SIGNER',
  })) || [];

  return new web3.TransactionInstruction({
    programId: toWeb3PublicKey(instruction.programAddress),
    keys: accounts,
    data: Buffer.from(instruction.data),
  });
}

/**
 * Creates a Web3.js signer from a @solana/kit signer
 */
export function createWeb3Signer(
  publicKey: web3.PublicKey,
  signer: any
): any {
  return {
    publicKey,
    secretKey: new Uint8Array(64), // Dummy secret key
    signTransaction: async (tx: web3.Transaction) => {
      const signedTxs = await signer.signTransactions([tx]);
      return signedTxs[0];
    },
    signAllTransactions: async (txs: web3.Transaction[]) => {
      return await signer.signTransactions(txs);
    }
  };
}
