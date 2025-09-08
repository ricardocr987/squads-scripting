import { web3 } from "@coral-xyz/anchor";
import { 
  createSolanaRpc,
  createSolanaRpcSubscriptions,
  getSignatureFromTransaction,
  sendAndConfirmTransactionFactory,
  generateKeyPairSigner,
  createSignerFromKeyPair,
  type SendableTransaction,
  type KeyPairSigner,
  type TransactionSigner,
  type MessageSigner,
} from "@solana/kit";
import { RPC_URL } from './env';

// Create RPC client using @solana/kit
export const rpc = createSolanaRpc(RPC_URL);
export const rpcSubscriptions = createSolanaRpcSubscriptions(RPC_URL.replace('http', 'ws'));
export const sendAndConfirmTransaction = sendAndConfirmTransactionFactory({ rpc, rpcSubscriptions });

export const solanaConnection = new web3.Connection(
  RPC_URL,
  'confirmed'
);

// Re-export signer types and utilities
export { 
  generateKeyPairSigner,
  createSignerFromKeyPair,
  type KeyPairSigner,
  type TransactionSigner,
  type MessageSigner,
  type SendableTransaction
};