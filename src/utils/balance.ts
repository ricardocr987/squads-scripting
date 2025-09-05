/**
 * Shared balance utilities for checking SOL and token balances
 */

import { findAssociatedTokenPda, decodeToken } from '@solana-program/token';
import { rpc } from './rpc';
import type { EncodedAccount } from '@solana/accounts';
import { address } from '@solana/kit';
import type { Address, ReadonlyUint8Array } from '@solana/kit';
import { getMintInfo } from './getMint';
import { SOL_MINT, USDC_MINT_DEVNET } from './constants';
import type { BalanceResult } from './types';

export async function getTokenBalance(
  userKey: string,
  tokenMint: string
): Promise<string | null> {
  try {
    // Handle SOL token
    if (tokenMint === SOL_MINT) {
      const { value: solBalance } = await rpc
        .getBalance(address(userKey))
        .send();

      const solUiAmount = Number(solBalance.toString()) / Math.pow(10, 9);
      return solUiAmount.toString();
    }

    // Get token decimals from mint
    const mintInfo = await getMintInfo(tokenMint);
    if (!mintInfo) {
      console.warn('No mint info found for token:', tokenMint);
      return null;
    }

    // Handle other tokens
    const [tokenAta] = await findAssociatedTokenPda({
      mint: address(tokenMint),
      owner: address(userKey),
      tokenProgram: address(mintInfo.programAddress),
    });

    const { value: tokenAccountResponse } = await rpc
      .getAccountInfo(tokenAta, { encoding: 'base64' })
      .send();

    if (!tokenAccountResponse?.data) {
      return null;
    }

    const [base64Data] = tokenAccountResponse.data;
    if (!base64Data) {
      return null;
    }

    const rawData = Buffer.from(base64Data, 'base64');
    const encodedAccount: EncodedAccount<string> = {
      address: tokenAta,
      data: new Uint8Array(rawData) as ReadonlyUint8Array,
      executable: tokenAccountResponse.executable,
      lamports: tokenAccountResponse.lamports,
      programAddress: tokenAccountResponse.owner,
      space: BigInt(0),
    };

    const decodedTokenAccount = decodeToken(encodedAccount);
    if (!decodedTokenAccount) {
      return null;
    }

    const amount = decodedTokenAccount.data.amount.toString();
    const uiAmount = Number(amount) / Math.pow(10, mintInfo.data.decimals);

    return uiAmount.toString();
  } catch (error) {
    console.error('Error fetching token balance:', error);
    return null;
  }
}

export async function checkSolBalance(address: Address): Promise<number> {
  try {
    const balance = await getTokenBalance(address, SOL_MINT);
    return balance ? parseFloat(balance) : 0;
  } catch (error) {
    console.error('Error checking SOL balance:', error);
    return 0;
  }
}

export async function checkUSDCBalance(address: Address): Promise<number> {
  try {
    const balance = await getTokenBalance(address, USDC_MINT_DEVNET);
    return balance ? parseFloat(balance) : 0;
  } catch (error) {
    console.error('Error checking USDC balance:', error);
    return 0;
  }
}

export async function checkBalances(addresses: Address[]): Promise<BalanceResult[]> {
  const balances = [];
  
  for (const address of addresses) {
    const solBalance = await checkSolBalance(address);
    const usdcBalance = await checkUSDCBalance(address);
    balances.push({ address, balance: solBalance, usdcBalance });
    
    console.log(`💰 ${address.slice(0, 8)}...: ${solBalance.toFixed(4)} SOL, ${usdcBalance.toFixed(2)} USDC`);
  }
  
  return balances;
}

export function formatSolBalance(balance: number): string {
  return `${balance.toFixed(4)} SOL`;
}

export function formatUSDCBalance(balance: number): string {
  return `${balance.toFixed(2)} USDC`;
}