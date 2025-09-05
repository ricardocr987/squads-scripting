import * as multisig from '@sqds/multisig';
import { fetchMultisig  } from './utils/squads/index';
import { 
  address, 
  getAddressFromPublicKey
} from '@solana/kit';
import { loadWalletFromConfig, loadConfig } from './utils/config';
import { loadMultisigAddressFromConfig } from './utils/config';
import { prompt, promptWalletChoice, promptYesNo } from './utils/prompt';
import { solanaConnection, rpc } from './utils/rpc';
import { sendAndConfirmTransaction } from './utils/web3js';
import { Keypair, PublicKey, Transaction } from '@solana/web3.js';

async function executePaymentTransaction(
  executor: Keypair,
  multisigPda: string,
  transactionIndex: bigint
): Promise<void> {
  console.log('\n🚀 Executing payment transaction...');
  
  try {
    // Get the proposal and transaction PDAs
    const [proposalPda] = multisig.getProposalPda({
      multisigPda: new PublicKey(multisigPda),
      transactionIndex: transactionIndex,
    });
    const [transactionPda] = multisig.getTransactionPda({
      multisigPda: new PublicKey(multisigPda),
      index: transactionIndex,
    });
    const executorAddress = executor.publicKey.toString();
    
    console.log(`📋 Multisig Address: ${multisigPda}`);
    console.log(`📋 Proposal Address: ${proposalPda.toString()}`);
    console.log(`📋 Transaction Address: ${transactionPda.toString()}`);
    console.log(`📋 Transaction Index: ${transactionIndex}`);
    console.log(`👤 Executor: ${executorAddress}`);
    
    // Create execution instruction using @sqds/multisig
    const executeInstructionResult = await multisig.instructions.vaultTransactionExecute({
      connection: solanaConnection,
      multisigPda: new PublicKey(multisigPda),
      transactionIndex: transactionIndex,
      member: executor.publicKey,
    });

    console.log('📋 Execute instruction:', executeInstructionResult);

    console.log('📋 Execute instruction result:', executeInstructionResult);
    
    console.log('📤 Sending execution transaction...');
    
    const executeTx = new Transaction().add(executeInstructionResult.instruction);
    executeTx.recentBlockhash = (
      await solanaConnection.getLatestBlockhash()
    ).blockhash;
    executeTx.feePayer = new PublicKey(executorAddress);

    const signature = await sendAndConfirmTransaction(
      solanaConnection,
      executeTx,
      [executor]
    );
    
    console.log(`✅ Execution successful!`);
    console.log(`🔗 Transaction: ${signature}`);
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
    const executorCryptoKeyPair = await loadWalletFromConfig(executorChoice);
    const executorAddress = await getAddressFromPublicKey(executorCryptoKeyPair.publicKey);
    const configData = await loadConfig();
    
    // Convert CryptoKeyPair to Keypair for @sqds/multisig
    const executor = Keypair.fromSecretKey(
      new Uint8Array(Buffer.from(configData[executorChoice]?.privateKey || '', 'base64'))
    );
    
    console.log(`👤 Using ${executorChoice === 'manager' ? 'Manager' : executorChoice === 'voter1' ? 'Voter1' : 'Voter2'} as Executor: ${executorAddress}`);
    
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
