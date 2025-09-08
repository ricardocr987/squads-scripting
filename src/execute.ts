import { 
  getVaultTransactionExecuteInstruction,
  fetchMultisig,
  getProposalPda,
  getTransactionPda,
} from './utils/squads/index';
import { 
  address, 
  createSignerFromKeyPair,
  getAddressFromPublicKey,
  signTransaction,
  getBase64EncodedWireTransaction,
  type Instruction
} from '@solana/kit';
import { loadWalletFromConfig, loadAllSignersFromConfig } from './utils/config';
import { loadMultisigAddressFromConfig } from './utils/config';
import { prompt } from './utils/prompt';
import { rpc, solanaConnection } from './utils/rpc';
import { PublicKey } from '@solana/web3.js';
import * as multisig from '@sqds/multisig';
import { fromLegacyTransactionInstruction } from '@solana/compat';
import { signAndSendTransaction } from './utils/sign';

async function executePaymentTransaction(
  multisigPda: string,
  transactionIndex: bigint,
  executor: CryptoKeyPair
): Promise<void> {
  console.log('\n🚀 Executing payment transaction...');
  
  try {
    // Get the proposal and transaction PDAs
    const [proposalPda] = await getProposalPda(multisigPda, transactionIndex);
    const [transactionPda] = await getTransactionPda(multisigPda, transactionIndex);
    
    console.log(`📋 Multisig Address: ${multisigPda}`);
    console.log(`📋 Proposal Address: ${proposalPda}`);
    console.log(`📋 Transaction Address: ${transactionPda}`);
    console.log(`📋 Transaction Index: ${transactionIndex}`);
    
    const executorAddress = await getAddressFromPublicKey(executor.publicKey);
    
    // Create execution instruction using Squads utils
    const executeInstructionResult = await multisig.instructions.vaultTransactionExecute({
      connection: solanaConnection,
      multisigPda: new PublicKey(multisigPda),
      transactionIndex: transactionIndex,
      member: new PublicKey(executorAddress),
    });

    const vaultInstruction = fromLegacyTransactionInstruction(executeInstructionResult.instruction);

    console.log('📤 Preparing execution transaction...');
    
    // Send and confirm transaction using executor
    const signature = await signAndSendTransaction(
      [vaultInstruction as Instruction<string>],
      [executor],
      executorAddress
    );
    
    console.log(`✅ Execution successful!`);
    console.log(`🔗 View on Solana Explorer: https://explorer.solana.com/tx/${signature}?cluster=devnet`);
    
  } catch (error) {
    console.error('❌ Execution failed:', error);
    if (error && typeof error === 'object' && 'logs' in error) {
      console.error('Transaction logs:', (error as any).logs);
    }
    throw error;
  }
}

async function main() {
  try {
    console.log('🚀 Payment Transaction Execution');
    console.log('================================\n');
    
    // Load all signers from config
    console.log('✅ Loading signers from config...');
    await loadAllSignersFromConfig();
    
    // Load multisig address from config
    console.log('✅ Loading multisig address...');
    const multisigAddress = await loadMultisigAddressFromConfig();
    console.log(`🏛️  Multisig Address: ${multisigAddress}`);
    
    // Get multisig info to find the latest transaction
    const multisigAccount = await fetchMultisig(rpc, address(multisigAddress));
    console.log(`👥 Members: ${multisigAccount.data.members.length}`);
    console.log(`🗳️  Threshold: ${multisigAccount.data.threshold}`);
    console.log(`📊 Latest Transaction Index: ${multisigAccount.data.transactionIndex}`);
    
    // Get transaction index from user
    const transactionIndexInput = await prompt('Enter transaction index to execute (or press Enter for latest): ');
    const transactionIndex = transactionIndexInput 
      ? BigInt(transactionIndexInput) 
      : multisigAccount.data.transactionIndex;
    
    console.log('Note: Only Manager can execute transactions');
    
    // Load the manager wallet for execution
    const executor = await loadWalletFromConfig('manager');
    const executorAddress = await getAddressFromPublicKey(executor.publicKey);
    console.log(`👤 Executor Address: ${executorAddress}`);
    
    // Display execution confirmation
    console.log('🚀 Proceeding with transaction execution...');
    
    // Execute the transaction
    await executePaymentTransaction(multisigAddress, transactionIndex, executor);
    
    console.log('\n🎉 Transaction executed successfully!');
    console.log('💰 The payment has been processed and sent to the recipient.');
    
  } catch (error) {
    console.error('❌ Script failed:', error);
    throw error; // Let the CLI handle the error gracefully
  }
}

// Run the script
if (import.meta.main) {
  main();
}

export { main };
