/**
 * Utility for getting mint information
 */

import { rpc } from './rpc';
import { address } from '@solana/kit';
import { decodeMint } from '@solana-program/token';
import type { EncodedAccount } from '@solana/accounts';
import type { ReadonlyUint8Array } from '@solana/kit';

export interface MintInfo {
  data: {
    decimals: number;
    mintAuthority: string | null;
    supply: string;
  };
  programAddress: string;
}

export async function getMintInfo(mintAddress: string): Promise<MintInfo | null> {
  try {
    const { value: mintAccountResponse } = await rpc
      .getAccountInfo(address(mintAddress), { encoding: 'base64' })
      .send();

    if (!mintAccountResponse?.data) {
      return null;
    }

    const [base64Data] = mintAccountResponse.data;
    if (!base64Data) {
      return null;
    }

    const rawData = Buffer.from(base64Data, 'base64');
    const encodedAccount: EncodedAccount<string> = {
      address: address(mintAddress),
      data: new Uint8Array(rawData) as ReadonlyUint8Array,
      executable: mintAccountResponse.executable,
      lamports: mintAccountResponse.lamports,
      programAddress: mintAccountResponse.owner,
      space: BigInt(0),
    };

    const decodedMint = decodeMint(encodedAccount);
    if (!decodedMint) {
      return null;
    }

    return {
      data: {
        decimals: decodedMint.data.decimals,
        mintAuthority: decodedMint.data.mintAuthority?.toString() || null,
        supply: decodedMint.data.supply.toString(),
      },
      programAddress: mintAccountResponse.owner,
    };
  } catch (error) {
    console.error('Error fetching mint info:', error);
    return null;
  }
}
