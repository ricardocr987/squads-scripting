/**
 * Unified configuration management for all scripts
 * Handles both wallet and multisig configuration with type safety
 */

import { readFileSync, existsSync, writeFileSync } from 'fs';
import { createKeyPairFromBytes, getAddressFromPublicKey } from '@solana/kit';
import type { ConfigData, WalletName, WalletCollection } from './types';

export function getConfigPath(): string {
  return 'config.json';
}

export async function checkConfigExists(): Promise<boolean> {
  try {
    const configPath = getConfigPath();
    return existsSync(configPath);
  } catch (error) {
    return false;
  }
}

export async function loadConfig(): Promise<ConfigData> {
  try {
    const configPath = getConfigPath();
    if (!existsSync(configPath)) {
      throw new Error('config.json not found. Please run the setup first.');
    }
    
    return JSON.parse(readFileSync(configPath, 'utf8'));
  } catch (error) {
    throw new Error(`Failed to load config.json: ${error}`);
  }
}

export async function saveConfig(configData: ConfigData): Promise<void> {
  const configPath = getConfigPath();
  writeFileSync(configPath, JSON.stringify(configData, null, 2));
}

// Wallet Management Functions (Legacy - for backward compatibility)

// Signer Management Functions (Simplified)
export async function loadAllSignersFromConfig(): Promise<void> {
  try {
    // Load all wallets to ensure they exist and are valid
    await loadWalletFromConfig('manager');
    await loadWalletFromConfig('voter1');
    await loadWalletFromConfig('voter2');
    console.log('✅ All signers loaded from config');
  } catch (error) {
    throw new Error(`Failed to load signers from config: ${error}`);
  }
}

// Legacy wallet loading (for backward compatibility)
export async function loadWalletFromConfig(walletName: WalletName): Promise<CryptoKeyPair> {
  try {
    const configData = await loadConfig();
    
    if (!configData[walletName]) {
      throw new Error(`Wallet ${walletName} not found in config.json`);
    }
    
    const walletData = configData[walletName];
    let keypairBytes: Uint8Array;
    
    // Handle both base64 encoded and array formats for backward compatibility
    if (typeof walletData.privateKey === 'string') {
      // New format: base64 encoded 64-byte keypair (32 private + 32 public)
      keypairBytes = new Uint8Array(Buffer.from(walletData.privateKey, 'base64'));
    } else if (Array.isArray(walletData.privateKey)) {
      // Old format: array of numbers
      keypairBytes = new Uint8Array(walletData.privateKey);
    } else {
      throw new Error('Invalid private key format in config.json');
    }
    
    // Validate that we have 64 bytes (32 private + 32 public)
    if (keypairBytes.length !== 64) {
      throw new Error(`Invalid keypair length: expected 64 bytes, got ${keypairBytes.length}`);
    }
    
    return await createKeyPairFromBytes(keypairBytes);
  } catch (error) {
    throw new Error(`Failed to load wallet ${walletName} from config.json: ${error}`);
  }
}

export async function saveKeypairsToConfig(
  manager: CryptoKeyPair, 
  voter1: CryptoKeyPair, 
  voter2: CryptoKeyPair,
  managerKeypairBytes: Uint8Array,
  voter1KeypairBytes: Uint8Array,
  voter2KeypairBytes: Uint8Array
): Promise<void> {
  // Get public key addresses
  const managerAddress = await getAddressFromPublicKey(manager.publicKey);
  const voter1Address = await getAddressFromPublicKey(voter1.publicKey);
  const voter2Address = await getAddressFromPublicKey(voter2.publicKey);
  
  const configData = {
    manager: {
      privateKey: Buffer.from(managerKeypairBytes).toString('base64'),
      publicKey: managerAddress
    },
    voter1: {
      privateKey: Buffer.from(voter1KeypairBytes).toString('base64'),
      publicKey: voter1Address
    },
    voter2: {
      privateKey: Buffer.from(voter2KeypairBytes).toString('base64'),
      publicKey: voter2Address
    }
  };
  
  await saveConfig(configData);
  console.log(`✅ All keypairs saved to: ${getConfigPath()}`);
}

// Multisig Management Functions
export async function loadMultisigAddressFromConfig(): Promise<string> {
  try {
    const configData = await loadConfig();
    
    if (!configData.multisigAddress) {
      throw new Error('Multisig address not found in config.json');
    }
    
    return configData.multisigAddress;
  } catch (error) {
    throw new Error(`Failed to load multisig address from config.json: ${error}`);
  }
}

export async function saveMultisigAddressToConfig(multisigAddress: string): Promise<void> {
  // Read existing config
  let configData: ConfigData = {};
  if (await checkConfigExists()) {
    configData = await loadConfig();
  }
  
  // Add multisig address
  configData.multisigAddress = multisigAddress;
  
  // Write updated config
  await saveConfig(configData);
  console.log(`✅ Multisig address saved to: ${getConfigPath()}`);
}