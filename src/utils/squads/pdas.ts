/**
 * PDA derivation functions for Squads Multisig Program
 * These functions derive the Program Derived Addresses (PDAs) used by the Squads program
 */

import { getProgramDerivedAddress, address, getAddressEncoder } from '@solana/kit';
import { SQUADS_MULTISIG_PROGRAM_PROGRAM_ADDRESS } from './programs';

const SEED_PREFIX = 'multisig';
const SEED_PROGRAM_CONFIG = 'program_config';
const SEED_MULTISIG = 'multisig';
const SEED_VAULT = 'vault';
const SEED_TRANSACTION = 'transaction';
const SEED_PROPOSAL = 'proposal';
const SEED_BATCH_TRANSACTION = 'batch_transaction';
const SEED_EPHEMERAL_SIGNER = 'ephemeral_signer';
const SEED_SPENDING_LIMIT = 'spending_limit';
const SEED_TRANSACTION_BUFFER = 'transaction_buffer';

const addressEncoder = getAddressEncoder();

/**
 * Derives the program config PDA
 */
export async function getProgramConfigPda(): Promise<[string, number]> {
  const [pda, bump] = await getProgramDerivedAddress({
    programAddress: SQUADS_MULTISIG_PROGRAM_PROGRAM_ADDRESS,
    seeds: [SEED_PREFIX, SEED_PROGRAM_CONFIG],
  });
  return [pda, bump];
}

/**
 * Derives the multisig PDA from the create key
 */
export async function getMultisigPda(createKey: string): Promise<[string, number]> {
  const [pda, bump] = await getProgramDerivedAddress({
    programAddress: SQUADS_MULTISIG_PROGRAM_PROGRAM_ADDRESS,
    seeds: [
      SEED_PREFIX,
      SEED_MULTISIG,
      addressEncoder.encode(address(createKey)),
    ],
  });
  return [pda, bump];
}

/**
 * Derives the vault PDA from multisig and vault index
 */
export async function getVaultPda(multisig: string, vaultIndex: number): Promise<[string, number]> {
  if (vaultIndex < 0 || vaultIndex >= 256) {
    throw new Error('Invalid vault index');
  }

  const [pda, bump] = await getProgramDerivedAddress({
    programAddress: SQUADS_MULTISIG_PROGRAM_PROGRAM_ADDRESS,
    seeds: [
      SEED_PREFIX,
      addressEncoder.encode(address(multisig)),
      SEED_VAULT,
      new Uint8Array([vaultIndex]),
    ],
  });
  return [pda, bump];
}

/**
 * Derives the ephemeral signer PDA from transaction and ephemeral signer index
 */
export async function getEphemeralSignerPda(transactionPda: string, ephemeralSignerIndex: number): Promise<[string, number]> {
  // Decode the base58 address to get the raw bytes

  const [pda, bump] = await getProgramDerivedAddress({
    programAddress: SQUADS_MULTISIG_PROGRAM_PROGRAM_ADDRESS,
    seeds: [
      SEED_PREFIX,
      addressEncoder.encode(address(transactionPda)),
      SEED_EPHEMERAL_SIGNER,
      new Uint8Array([ephemeralSignerIndex]),
    ],
  });
  return [pda, bump];
}

/**
 * Derives the transaction PDA from multisig and transaction index
 */
export async function getTransactionPda(multisig: string, transactionIndex: bigint): Promise<[string, number]> {
  const indexBuffer = new ArrayBuffer(8);
  const view = new DataView(indexBuffer);
  view.setBigUint64(0, transactionIndex, true); // little-endian

  const [pda, bump] = await getProgramDerivedAddress({
    programAddress: SQUADS_MULTISIG_PROGRAM_PROGRAM_ADDRESS,
    seeds: [
      SEED_PREFIX,
      addressEncoder.encode(address(multisig)),
      SEED_TRANSACTION,
      new Uint8Array(indexBuffer),
    ],
  });
  return [pda, bump];
}

/**
 * Derives the proposal PDA from multisig and transaction index
 */
export async function getProposalPda(multisig: string, transactionIndex: bigint): Promise<[string, number]> {
  const indexBuffer = new ArrayBuffer(8);
  const view = new DataView(indexBuffer);
  view.setBigUint64(0, transactionIndex, true); // little-endian

  const [pda, bump] = await getProgramDerivedAddress({
    programAddress: SQUADS_MULTISIG_PROGRAM_PROGRAM_ADDRESS,
    seeds: [
      SEED_PREFIX,
      addressEncoder.encode(address(multisig)),
      SEED_TRANSACTION,
      new Uint8Array(indexBuffer),
      SEED_PROPOSAL,
    ],
  });
  return [pda, bump];
}

/**
 * Derives the vault transaction PDA from multisig and transaction index
 */
export async function getVaultTransactionPda(multisig: string, transactionIndex: bigint): Promise<[string, number]> {
  const indexBuffer = new ArrayBuffer(8);
  const view = new DataView(indexBuffer);
  view.setBigUint64(0, transactionIndex, true); // little-endian

  const [pda, bump] = await getProgramDerivedAddress({
    programAddress: SQUADS_MULTISIG_PROGRAM_PROGRAM_ADDRESS,
    seeds: [
      SEED_PREFIX,
      addressEncoder.encode(address(multisig)),
      SEED_TRANSACTION,
      new Uint8Array(indexBuffer),
    ],
  });
  return [pda, bump];
}

/**
 * Derives the batch transaction PDA from multisig, batch index, and transaction index
 */
export async function getBatchTransactionPda(multisig: string, batchIndex: bigint, transactionIndex: number): Promise<[string, number]> {
  const batchIndexBuffer = new ArrayBuffer(8);
  const batchView = new DataView(batchIndexBuffer);
  batchView.setBigUint64(0, batchIndex, true); // little-endian

  const transactionIndexBuffer = new ArrayBuffer(4);
  const transactionView = new DataView(transactionIndexBuffer);
  transactionView.setUint32(0, transactionIndex, true); // little-endian

  const [pda, bump] = await getProgramDerivedAddress({
    programAddress: SQUADS_MULTISIG_PROGRAM_PROGRAM_ADDRESS,
    seeds: [
      SEED_PREFIX,
      addressEncoder.encode(address(multisig)),
      SEED_TRANSACTION,
      new Uint8Array(batchIndexBuffer),
      SEED_BATCH_TRANSACTION,
      new Uint8Array(transactionIndexBuffer),
    ],
  });
  return [pda, bump];
}

/**
 * Derives the spending limit PDA from multisig, create key, and vault index
 */
export async function getSpendingLimitPda(multisig: string, createKey: string, vaultIndex: number): Promise<[string, number]> {

  const [pda, bump] = await getProgramDerivedAddress({
    programAddress: SQUADS_MULTISIG_PROGRAM_PROGRAM_ADDRESS,
    seeds: [
      SEED_PREFIX,
      addressEncoder.encode(address(multisig)),
      SEED_SPENDING_LIMIT,
      addressEncoder.encode(address(createKey)),
    ],
  });
  return [pda, bump];
}
