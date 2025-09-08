/**
 * Pure wallet utilities for keypair generation and management
 * No file I/O operations - all configuration handled by config.ts
 */

import { 
  createKeyPairFromBytes, 
  generateKeyPair, 
  getAddressFromPublicKey,
  generateKeyPairSigner,
  createSignerFromKeyPair,
  type KeyPairSigner,
  type TransactionSigner,
  type MessageSigner
} from '@solana/kit';

export async function generateManagerVoterWallets() {
  console.log('🏗️  Creating Manager and Voter Wallets');
  console.log('=====================================\n');
  
  // Generate all keypairs using extractable keys for saving
  console.log('🔑 Generating Manager keypair...');
  const managerKeypair = await generateExtractableKeyPair();
  const managerSigner = await createSignerFromKeyPair(managerKeypair);
  const managerAddress = await getAddressFromPublicKey(managerKeypair.publicKey);
  console.log(`✅ Manager keypair generated`);
  console.log(`📍 Manager Public Key: ${managerAddress}`);
  console.log(`🔗 View on Solana Explorer: https://explorer.solana.com/address/${managerAddress}`);
  
  console.log('🔑 Generating Voter1 keypair...');
  const voter1Keypair = await generateExtractableKeyPair();
  const voter1Signer = await createSignerFromKeyPair(voter1Keypair);
  const voter1Address = await getAddressFromPublicKey(voter1Keypair.publicKey);
  console.log(`✅ Voter1 keypair generated`);
  console.log(`📍 Voter1 Public Key: ${voter1Address}`);
  console.log(`🔗 View on Solana Explorer: https://explorer.solana.com/address/${voter1Address}`);
  
  console.log('🔑 Generating Voter2 keypair...');
  const voter2Keypair = await generateExtractableKeyPair();
  const voter2Signer = await createSignerFromKeyPair(voter2Keypair);
  const voter2Address = await getAddressFromPublicKey(voter2Keypair.publicKey);
  console.log(`✅ Voter2 keypair generated`);
  console.log(`📍 Voter2 Public Key: ${voter2Address}`);
  console.log(`🔗 View on Solana Explorer: https://explorer.solana.com/address/${voter2Address}`);
  
  console.log('\n📋 Wallet Summary:');
  console.log(`👤 Manager: ${managerAddress} (can propose, vote, and execute)`);
  console.log(`👤 Voter1: ${voter1Address} (can vote only)`);
  console.log(`👤 Voter2: ${voter2Address} (can vote only)`);

  // Export the full 64-byte keypair format (32 bytes private + 32 bytes public)
  const managerKeypairBytes = await exportKeypairBytes(managerKeypair);
  const voter1KeypairBytes = await exportKeypairBytes(voter1Keypair);
  const voter2KeypairBytes = await exportKeypairBytes(voter2Keypair);
  
  return { 
    managerKeypair, 
    voter1Keypair, 
    voter2Keypair,
    managerSigner,
    voter1Signer,
    voter2Signer,
    managerKeypairBytes,
    voter1KeypairBytes,
    voter2KeypairBytes
  };
}

/**
 * Generate an extractable keypair for saving/loading
 * This creates a CryptoKeyPair that can be exported to bytes
 */
async function generateExtractableKeyPair(): Promise<CryptoKeyPair> {
  const keypair = await crypto.subtle.generateKey(
    'Ed25519',
    true, // extractable = true to allow exporting private key
    ['sign', 'verify']
  );
  
  // Ensure we have a CryptoKeyPair, not just a CryptoKey
  if ('privateKey' in keypair && 'publicKey' in keypair) {
    return keypair as CryptoKeyPair;
  } else {
    throw new Error('Failed to generate keypair');
  }
}

/**
 * Export keypair as 64-byte array (32 bytes private key + 32 bytes public key)
 * This is the format expected by createKeyPairFromBytes
 */
async function exportKeypairBytes(keypair: CryptoKeyPair): Promise<Uint8Array> {
  // Export private key as JWK to get the raw bytes
  const privateKeyJwk = await crypto.subtle.exportKey('jwk', keypair.privateKey);
  const privateKeyBase64 = privateKeyJwk.d;
  if (!privateKeyBase64) {
    throw new Error('Failed to export private key');
  }
  
  // Decode base64url to get the raw 32 bytes private key
  const privateKeyBytes = new Uint8Array(Buffer.from(privateKeyBase64, 'base64'));
  
  // Export public key as raw bytes
  const publicKeyBytes = new Uint8Array(await crypto.subtle.exportKey('raw', keypair.publicKey));
  
  // Combine private key (32 bytes) + public key (32 bytes) = 64 bytes total
  const keypairBytes = new Uint8Array(64);
  keypairBytes.set(privateKeyBytes, 0);
  keypairBytes.set(publicKeyBytes, 32);
  
  return keypairBytes;
}