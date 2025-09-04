import { 
  getVaultTransactionExecuteInstruction,
  fetchMultisig,
  getProposalPda,
  getVaultTransactionPda,
} from './utils/squads/index';
import { 
  AccountRole,
  address, 
  createSignerFromKeyPair,
  getAddressFromPublicKey
} from '@solana/kit';
import { loadWalletFromConfig } from './utils/config';
import { loadMultisigAddressFromConfig } from './utils/config';
import { prompt, promptWalletChoice, promptYesNo } from './utils/prompt';
import { signAndSendTransaction } from './utils/sign';
import { rpc } from './utils/rpc';

async function executePaymentTransaction(
  executor: CryptoKeyPair,
  multisigPda: string,
  transactionIndex: bigint
): Promise<void> {
  console.log('\n🚀 Executing payment transaction...');
  
  try {
    // Get the proposal and transaction PDAs
    const [proposalPda] = await getProposalPda(multisigPda, transactionIndex);
    const [transactionPda] = await getVaultTransactionPda(multisigPda, transactionIndex);
    const executorAddress = await getAddressFromPublicKey(executor.publicKey);
    const signer = await createSignerFromKeyPair(executor);
    
    console.log(`📋 Multisig Address: ${multisigPda}`);
    console.log(`📋 Proposal Address: ${proposalPda}`);
    console.log(`📋 Transaction Address: ${transactionPda}`);
    console.log(`📋 Transaction Index: ${transactionIndex}`);
    console.log(`👤 Executor: ${executorAddress}`);
    
    // Create execution instruction using Squads utils
    const executeInstruction = getVaultTransactionExecuteInstruction({
      multisig: address(multisigPda),
      proposal: address(proposalPda),
      transaction: address(transactionPda),
      member: signer,
    });
    
    console.log('📤 Sending execution transaction...');
    console.log('🔍 Instruction details:', {
      programAddress: executeInstruction.programAddress,
      accountsCount: executeInstruction.accounts?.length || 0,
      accounts: executeInstruction.accounts?.map(acc => ({
        address: acc.address,
        isSigner: acc.role === AccountRole.WRITABLE_SIGNER,  
      })) || [],
      dataLength: executeInstruction.data?.length || 0,
    });
    const signature = await signAndSendTransaction(
      [executeInstruction],
      [executor],
      executorAddress
    );
    
    console.log(`✅ Execution successful!`);
    console.log(`🔗 Transaction: ${signature}`);
    console.log(`🔗 View on Solana Explorer: https://explorer.solana.com/tx/${signature}`);
    
  } catch (error) {
    console.error('❌ Execution failed:', error);
    throw error;
  }
}

async function main() {
  try {
    console.log('🚀 Payment Transaction Execution');
    console.log('================================\n');
    
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
    
    // Get executor choice (only manager can execute)
    console.log('Note: Only Manager can execute transactions');
    const executorChoice = await promptWalletChoice('Which wallet to use for execution?');
    const executor = await loadWalletFromConfig(executorChoice);
    const signerAddress = await getAddressFromPublicKey(executor.publicKey);
    console.log(`👤 Using ${executorChoice === 'manager' ? 'Manager' : executorChoice === 'voter1' ? 'Voter1' : 'Voter2'} as Executor: ${signerAddress}`);
    
    // Confirm execution
    const confirm = await promptYesNo('Are you sure you want to execute this transaction?');
    if (!confirm) {
      console.log('❌ Execution cancelled by user.');
      return;
    }
    
    // Execute the transaction
    await executePaymentTransaction(executor, multisigAddress, transactionIndex);
    
    console.log('\n🎉 Transaction executed successfully!');
    console.log('💰 The payment has been processed and sent to the recipient.');
    
  } catch (error) {
    console.error('❌ Script failed:', error);
    process.exit(1);
  }
}

// Run the script
if (import.meta.main) {
  main();
}

export { main };
