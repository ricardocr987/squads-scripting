/**
 * Shared types for all utilities
 */

import type { Address } from "@solana/kit";

// Wallet types
export type WalletName = 'manager' | 'voter1' | 'voter2';

export interface WalletData {
  privateKey: string; // base64 encoded keypair bytes (64 bytes: 32 private + 32 public)
  publicKey: string;
}

export interface ConfigData {
  manager?: WalletData;
  voter1?: WalletData;
  voter2?: WalletData;
  multisigAddress?: string;
}

// Balance result type
export interface BalanceResult {
  address: Address
  balance: number; // SOL balance
  usdcBalance?: number; // USDC balance
}

// Wallet collection type
export interface WalletCollection {
  manager: CryptoKeyPair;
  voter1: CryptoKeyPair;
  voter2: CryptoKeyPair;
}
