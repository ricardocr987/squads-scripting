import { 
  createDefaultRpcTransport, 
  createRpc, 
  createSolanaRpcApi,
} from "@solana/rpc";

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