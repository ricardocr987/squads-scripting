import { web3 } from "@coral-xyz/anchor";
import { 
  createDefaultRpcTransport, 
  createRpc, 
  createSolanaRpcApi,
} from "@solana/rpc";
import { RPC_URL } from './env';

// RPC HTTP Transport
const quicknodeRpcTransport = createDefaultRpcTransport({ 
  url: RPC_URL 
});

// Create API
const solanaApi = createSolanaRpcApi({ defaultCommitment: 'confirmed' });

// Create RPC client
export const rpc = createRpc({ 
  api: solanaApi, 
  transport: quicknodeRpcTransport 
});

export const solanaConnection = new web3.Connection(
  RPC_URL,
  'confirmed'
);
