import {
  type Instruction,
  address,
  type Address,
  AccountRole,
  type ReadonlyUint8Array,
} from '@solana/kit';
import { rpc } from './rpc';
import * as beet from "@metaplex-foundation/beet";
import * as beetSolana from "@metaplex-foundation/beet-solana";
import { 
  PublicKey, 
  TransactionInstruction,
  AddressLookupTableAccount,
  MessageAccountKeys,
  MessageV0,
  type AccountKeysFromLookups,
  type MessageAddressTableLookup as SolanaMessageAddressTableLookup
} from "@solana/web3.js";

// CompiledKeys implementation (simplified version from Squads SDK)
class CompiledKeys {
  private staticAccountKeys: PublicKey[] = [];
  private writableSigners: PublicKey[] = [];
  private readonlySigners: PublicKey[] = [];
  private writableNonSigners: PublicKey[] = [];
  private readonlyNonSigners: PublicKey[] = [];

  static compile(instructions: TransactionInstruction[], payerKey: PublicKey): CompiledKeys {
    const compiled = new CompiledKeys();
    
    // Add payer as first writable signer
    compiled.writableSigners.push(payerKey);
    
    // Process all instructions
    instructions.forEach(instruction => {
      // Add program ID as readonly non-signer
      if (!compiled.readonlyNonSigners.some(key => key.equals(instruction.programId))) {
        compiled.readonlyNonSigners.push(instruction.programId);
      }
      
      // Process instruction accounts
      instruction.keys.forEach(key => {
        if (key.isSigner) {
          if (key.isWritable) {
            if (!compiled.writableSigners.some(k => k.equals(key.pubkey))) {
              compiled.writableSigners.push(key.pubkey);
            }
          } else {
            if (!compiled.readonlySigners.some(k => k.equals(key.pubkey))) {
              compiled.readonlySigners.push(key.pubkey);
            }
          }
        } else {
          if (key.isWritable) {
            if (!compiled.writableNonSigners.some(k => k.equals(key.pubkey))) {
              compiled.writableNonSigners.push(key.pubkey);
            }
          } else {
            if (!compiled.readonlyNonSigners.some(k => k.equals(key.pubkey))) {
              compiled.readonlyNonSigners.push(key.pubkey);
            }
          }
        }
      });
    });
    
    // Build static account keys array
    compiled.staticAccountKeys = [
      ...compiled.writableSigners,
      ...compiled.readonlySigners,
      ...compiled.writableNonSigners,
      ...compiled.readonlyNonSigners,
    ];
    
    return compiled;
  }

  extractTableLookup(lookupTable: AddressLookupTableAccount): [SolanaMessageAddressTableLookup, { writable: PublicKey[], readonly: PublicKey[] }] | undefined {
    // Simplified implementation - return undefined for now
    return undefined;
  }

  getMessageComponents(): [{ numRequiredSignatures: number, numReadonlySignedAccounts: number, numReadonlyUnsignedAccounts: number, numWritableNonSigners: number }, PublicKey[]] {
    const numRequiredSignatures = this.writableSigners.length + this.readonlySigners.length;
    const numReadonlySignedAccounts = this.readonlySigners.length;
    const numReadonlyUnsignedAccounts = this.readonlyNonSigners.length;
    const numWritableNonSigners = this.writableNonSigners.length;

    // Debug output
    console.log('CompiledKeys debug:', {
      writableSigners: this.writableSigners.length,
      readonlySigners: this.readonlySigners.length,
      writableNonSigners: this.writableNonSigners.length,
      readonlyNonSigners: this.readonlyNonSigners.length,
      totalStaticKeys: this.staticAccountKeys.length,
      numRequiredSignatures,
      numReadonlySignedAccounts,
      numReadonlyUnsignedAccounts,
      numWritableNonSigners,
    });

    return [{
      numRequiredSignatures,
      numReadonlySignedAccounts,
      numReadonlyUnsignedAccounts,
      numWritableNonSigners,
    }, this.staticAccountKeys];
  }
}

// Define the beet serializers to match the Squads SDK format exactly
export type CompiledMsInstruction = {
  programIdIndex: number;
  accountIndexes: number[];
  data: number[];
};

export const compiledMsInstructionBeet =
  new beet.FixableBeetArgsStruct<CompiledMsInstruction>(
    [
      ["programIdIndex", beet.u8],
      ["accountIndexes", smallArray(beet.u8, beet.u8)],
      ["data", smallArray(beet.u16, beet.u8)],
    ],
    "CompiledMsInstruction"
  );

export type MessageAddressTableLookup = {
  /** Address lookup table account key */
  accountKey: PublicKey;
  /** List of indexes used to load writable account addresses */
  writableIndexes: number[];
  /** List of indexes used to load readonly account addresses */
  readonlyIndexes: number[];
};

export const messageAddressTableLookupBeet =
  new beet.FixableBeetArgsStruct<MessageAddressTableLookup>(
    [
      ["accountKey", beetSolana.publicKey],
      ["writableIndexes", smallArray(beet.u8, beet.u8)],
      ["readonlyIndexes", smallArray(beet.u8, beet.u8)],
    ],
    "MessageAddressTableLookup"
  );

export type TransactionMessage = {
  payerKey: PublicKey;
  recentBlockhash: string;
  instructions: TransactionInstruction[];
};

// Serialized transaction message type for beet serialization
export type SerializedTransactionMessage = {
  numSigners: number;
  numWritableSigners: number;
  numWritableNonSigners: number;
  accountKeys: PublicKey[];
  instructions: CompiledMsInstruction[];
  addressTableLookups: MessageAddressTableLookup[];
};

export const transactionMessageBeet =
  new beet.FixableBeetArgsStruct<SerializedTransactionMessage>(
    [
      ["numSigners", beet.u8],
      ["numWritableSigners", beet.u8],
      ["numWritableNonSigners", beet.u8],
      ["accountKeys", smallArray(beet.u8, beetSolana.publicKey)],
      ["instructions", smallArray(beet.u8, compiledMsInstructionBeet)],
      [
        "addressTableLookups",
        smallArray(beet.u8, messageAddressTableLookupBeet),
      ],
    ],
    "SerializedTransactionMessage"
  );

// Helper functions for small arrays (from Squads SDK)
function smallArray<T, V = Partial<T>>(
  lengthBeet: beet.FixedSizeBeet<number>,
  element: beet.Beet<T, V>
): beet.FixableBeet<T[], V[]> {
  return {
    toFixedFromData(buf: Buffer, offset: number): beet.FixedSizeBeet<T[], V[]> {
      const len = lengthBeet.read(buf, offset);
      const cursorStart = offset + lengthBeet.byteSize;
      let cursor = cursorStart;

      const fixedElements: beet.FixedSizeBeet<T, V>[] = new Array(len);
      for (let i = 0; i < len; i++) {
        const fixedElement = beet.fixBeetFromData(
          element,
          buf,
          cursor
        ) as beet.FixedSizeBeet<T, V>;
        fixedElements[i] = fixedElement;
        cursor += fixedElement.byteSize;
      }
      return fixedSizeSmallArray(
        lengthBeet,
        fixedElements,
        cursor - cursorStart
      );
    },

    toFixedFromValue(vals: V[]): beet.FixedSizeBeet<T[], V[]> {
      if (!Array.isArray(vals)) {
        throw new Error(`${vals} should be an array`);
      }

      let elementsSize = 0;
      const fixedElements: beet.FixedSizeBeet<T, V>[] = new Array(vals.length);

      for (let i = 0; i < vals.length; i++) {
        const val = vals[i];
        if (val === undefined) {
          throw new Error(`Value at index ${i} is undefined`);
        }
        const fixedElement: beet.FixedSizeBeet<T, V> = beet.fixBeetFromValue<
          T,
          V
        >(element, val);
        fixedElements[i] = fixedElement;
        elementsSize += fixedElement.byteSize;
      }
      return fixedSizeSmallArray(lengthBeet, fixedElements, elementsSize);
    },

    description: `smallArray`,
  };
}

function fixedSizeSmallArray<T, V = Partial<T>>(
  lengthBeet: beet.FixedSizeBeet<number>,
  elements: beet.FixedSizeBeet<T, V>[],
  elementsByteSize: number
): beet.FixedSizeBeet<T[], V[]> {
  const len = elements.length;
  const firstElement = len === 0 ? "<EMPTY>" : elements[0]?.description || "<UNKNOWN>";

  return {
    write: function (buf: Buffer, offset: number, value: V[]): void {
      if (value.length !== len) {
        throw new Error(
          `array length ${value.length} should match len ${len}`
        );
      }
      lengthBeet.write(buf, offset, len);

      let cursor = offset + lengthBeet.byteSize;
      for (let i = 0; i < len; i++) {
        const element = elements[i];
        if (!element) {
          throw new Error(`Element at index ${i} is undefined`);
        }
        const val = value[i];
        if (val === undefined) {
          throw new Error(`Value at index ${i} is undefined`);
        }
        element.write(buf, cursor, val);
        cursor += element.byteSize;
      }
    },

    read: function (buf: Buffer, offset: number): T[] {
      const size = lengthBeet.read(buf, offset);
      if (size !== len) {
        throw new Error("invalid byte size");
      }

      let cursor = offset + lengthBeet.byteSize;
      const arr: T[] = new Array(len);
      for (let i = 0; i < len; i++) {
        const element = elements[i];
        if (!element) {
          throw new Error(`Element at index ${i} is undefined`);
        }
        arr[i] = element.read(buf, cursor);
        cursor += element.byteSize;
      }
      return arr;
    },
    byteSize: lengthBeet.byteSize + elementsByteSize,
    length: len,
    description: `Array<${firstElement}>(${len})[ ${lengthBeet.byteSize} + ${elementsByteSize} ]`,
  };
}

/**
 * Main function to convert TransactionMessage to serialized bytes (from Squads SDK)
 */
export function transactionMessageToMultisigTransactionMessageBytes({
  message,
  addressLookupTableAccounts,
  vaultPda,
}: {
  message: TransactionMessage;
  addressLookupTableAccounts?: any[];
  vaultPda: PublicKey;
}): Uint8Array {
  // Use custom implementation of `message.compileToV0Message` that allows instruction programIds
  // to also be loaded from `addressLookupTableAccounts`.
  const compiledMessage = compileToWrappedMessageV0({
    payerKey: message.payerKey,
    recentBlockhash: message.recentBlockhash,
    instructions: message.instructions,
    addressLookupTableAccounts,
  });

  // We use custom serialization for `transaction_message` that ensures as small byte size as possible.
  const serializedData = {
    numSigners: compiledMessage.header.numRequiredSignatures,
    numWritableSigners:
      compiledMessage.header.numRequiredSignatures -
      compiledMessage.header.numReadonlySignedAccounts,
    numWritableNonSigners:
      compiledMessage.staticAccountKeys.length -
      compiledMessage.header.numRequiredSignatures -
      compiledMessage.header.numReadonlyUnsignedAccounts,
    accountKeys: compiledMessage.staticAccountKeys,
    instructions: compiledMessage.compiledInstructions.map((ix) => {
      return {
        programIdIndex: ix.programIdIndex,
        accountIndexes: Array.from(ix.accountKeyIndexes),
        data: Array.from(ix.data),
      };
    }),
    addressTableLookups: compiledMessage.addressTableLookups,
  };

  // Debug output
  console.log('Serialization debug:', {
    numSigners: serializedData.numSigners,
    numWritableSigners: serializedData.numWritableSigners,
    numWritableNonSigners: serializedData.numWritableNonSigners,
    accountKeysCount: serializedData.accountKeys.length,
    instructionsCount: serializedData.instructions.length,
    addressTableLookupsCount: serializedData.addressTableLookups.length,
    totalAccountKeys: serializedData.accountKeys.length,
  });

  const [transactionMessageBytes] = transactionMessageBeet.serialize(serializedData);

  return transactionMessageBytes;
}

/**
 * Creates a VaultTransactionMessage structure and serializes it for Squads
 * This follows the exact Squads SDK approach
 */
export async function createSquadsTransactionMessage(
  instructions: Instruction<string>[],
  feePayer: string,
  vaultPda: string
): Promise<Uint8Array> {
  // Get the latest blockhash
  const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();
  
  // Convert Solana Kit instructions to TransactionInstruction format
  const transactionInstructions: TransactionInstruction[] = instructions.map(ix => {
    const accounts = 'accounts' in ix ? ix.accounts : [];
    return new TransactionInstruction({
      programId: new PublicKey(ix.programAddress),
      keys: (accounts || []).map(account => ({
        pubkey: new PublicKey(account.address),
        isSigner: account.role === AccountRole.WRITABLE_SIGNER || account.role === AccountRole.READONLY_SIGNER,
        isWritable: account.role === AccountRole.WRITABLE || account.role === AccountRole.WRITABLE_SIGNER,
      })),
      data: Buffer.from(ix.data || new Uint8Array(0)),
    });
  });
  
  // Create TransactionMessage structure
  const message: TransactionMessage = {
    payerKey: new PublicKey(feePayer),
    recentBlockhash: latestBlockhash.blockhash,
    instructions: transactionInstructions,
  };
  
  // Use the main Squads SDK function
  const vaultPdaKey = new PublicKey(vaultPda);
  const serialized = transactionMessageToMultisigTransactionMessageBytes({
    message,
    vaultPda: vaultPdaKey,
  });
  
  // Debug output
  console.log('Serialized transaction message length:', serialized.length);
  console.log('Serialized transaction message (first 50 bytes):', Array.from(serialized.slice(0, 50)));
  
  return new Uint8Array(serialized);
}

/**
 * Compiles a TransactionMessage to a wrapped V0 message following Squads approach
 */
export function compileToWrappedMessageV0({
  payerKey,
  recentBlockhash,
  instructions,
  addressLookupTableAccounts,
}: {
  payerKey: PublicKey;
  recentBlockhash: string;
  instructions: TransactionInstruction[];
  addressLookupTableAccounts?: AddressLookupTableAccount[];
}) {
  const compiledKeys = CompiledKeys.compile(instructions, payerKey);

  const addressTableLookups = new Array<SolanaMessageAddressTableLookup>();
  const accountKeysFromLookups: AccountKeysFromLookups = {
    writable: [],
    readonly: [],
  };
  const lookupTableAccounts = addressLookupTableAccounts || [];
  for (const lookupTable of lookupTableAccounts) {
    const extractResult = compiledKeys.extractTableLookup(lookupTable);
    if (extractResult !== undefined) {
      const [addressTableLookup, { writable, readonly }] = extractResult;
      addressTableLookups.push(addressTableLookup);
      accountKeysFromLookups.writable.push(...writable);
      accountKeysFromLookups.readonly.push(...readonly);
    }
  }

  const [header, staticAccountKeys] = compiledKeys.getMessageComponents();
  const accountKeys = new MessageAccountKeys(
    staticAccountKeys,
    accountKeysFromLookups
  );
  const compiledInstructions = accountKeys.compileInstructions(instructions);
  return new MessageV0({
    header,
    staticAccountKeys,
    recentBlockhash,
    compiledInstructions,
    addressTableLookups,
  });
}
