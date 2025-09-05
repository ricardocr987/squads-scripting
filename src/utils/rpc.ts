import { web3 } from "@coral-xyz/anchor";
import { 
  createDefaultRpcTransport, 
  createRpc, 
  createSolanaRpcApi,
} from "@solana/rpc";
import { config } from "process";

if (!process.env.RPC_URL) {
  throw new Error('RPC_URL is not set');
}

// RPC HTTP Transport
const quicknodeRpcTransport = createDefaultRpcTransport({ 
  url: process.env.RPC_URL 
});

// Create API
const solanaApi = createSolanaRpcApi({ defaultCommitment: 'confirmed' });

// Create RPC client
export const rpc = createRpc({ 
  api: solanaApi, 
  transport: quicknodeRpcTransport 
});

export const solanaConnection = new web3.Connection(
  process.env.RPC_URL,
  'confirmed'
);
