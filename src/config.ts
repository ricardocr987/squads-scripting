import { sleep } from 'bun';
import { 
  getConfigTransactionCreateInstruction,
  getConfigTransactionExecuteInstruction,
  fetchMultisig,
  getTransactionPda,
  getProposalPda,
} from './utils/squads/index';
import { 
  address, 
  createSignerFromKeyPair,
  getAddressFromPublicKey,
  type TransactionSigner
} from '@solana/kit';
import { loadWalletFromConfig } from './utils/config';
import { loadMultisigAddressFromConfig } from './utils/config';
import { prompt, promptWalletChoice, promptYesNo } from './utils/prompt';
import { signAndSendTransaction } from './utils/sign';
import { rpc } from './utils/rpc';
import { configAction, type ConfigActionArgs } from './utils/squads/types/configAction';
import { type MemberArgs } from './utils/squads/types/member';
import { type PeriodArgs } from './utils/squads/types/period';

// ConfigTransactionCreate
// It changes the config of the multisig

// https://docs.squads.so/main/development/typescript/instructions/create-config-transaction

async function createConfigTransaction(
  creator: CryptoKeyPair,
  multisigPda: string,
  actions: ConfigActionArgs[],
  memo?: string
): Promise<void> {
  console.log('\n⚙️  Creating config transaction...');
  
  try {
    // Get the next transaction index
    const multisigAccount = await fetchMultisig(rpc, address(multisigPda));
    const currentTransactionIndex = Number(multisigAccount.data.transactionIndex);
    const newTransactionIndex = BigInt(currentTransactionIndex + 1);
    
    // Get the transaction PDA
    const [transactionPda] = await getTransactionPda(multisigPda, newTransactionIndex);
    const creatorAddress = await getAddressFromPublicKey(creator.publicKey);
    const signer = await createSignerFromKeyPair(creator);
    
    console.log(`📋 Multisig Address: ${multisigPda}`);
    console.log(`📋 Transaction Address: ${transactionPda}`);
    console.log(`📋 Transaction Index: ${newTransactionIndex}`);
    console.log(`👤 Creator: ${creatorAddress}`);
    console.log(`🔧 Actions: ${actions.length} config action(s)`);
    
    // Create config transaction instruction
    const configTransactionIx = getConfigTransactionCreateInstruction({
      multisig: address(multisigPda),
      transaction: address(transactionPda),
      creator: signer,
      rentPayer: signer,
      actions,
      memo: memo || null,
    });
    
    console.log('📤 Creating config transaction...');
    const signature = await signAndSendTransaction(
      [configTransactionIx],
      [creator],
      creatorAddress
    );
    
    console.log(`✅ Config transaction created: ${signature}`);
    console.log(`🔗 View on Solana Explorer: https://explorer.solana.com/tx/${signature}?cluster=devnet`);
    
    await sleep(2000); // Wait for account initialization
    
    // Get the proposal PDA
    const [proposalPda] = await getProposalPda(multisigPda, newTransactionIndex);
    
    console.log(`\n🎉 Config transaction created successfully!`);
    console.log(`🔗 Transaction: ${signature}`);
    console.log(`📋 Transaction Index: ${newTransactionIndex}`);
    console.log(`📋 Proposal PDA: ${proposalPda}`);
    console.log(`\n📋 Next steps:`);
    console.log(`   1. Members need to vote on this proposal to execute the config changes`);
    console.log(`   2. Once approved, the config changes will be executed automatically`);
    console.log(`   3. Check proposal status using the transaction index: ${newTransactionIndex}`);
    
  } catch (error) {
    console.error('❌ Error creating config transaction:', error);
    if (error && typeof error === 'object' && 'logs' in error) {
      console.error('Transaction logs:', (error as any).logs);
    }
    throw error;
  }
}

async function executeConfigTransaction(
  executor: CryptoKeyPair,
  multisigPda: string,
  transactionIndex: bigint
): Promise<void> {
  console.log('\n🚀 Executing config transaction...');
  
  try {
    // Get the proposal and transaction PDAs
    const [proposalPda] = await getProposalPda(multisigPda, transactionIndex);
    const [transactionPda] = await getTransactionPda(multisigPda, transactionIndex);
    const executorAddress = await getAddressFromPublicKey(executor.publicKey);
    const signer = await createSignerFromKeyPair(executor);
    
    console.log(`📋 Multisig Address: ${multisigPda}`);
    console.log(`📋 Proposal Address: ${proposalPda}`);
    console.log(`📋 Transaction Address: ${transactionPda}`);
    console.log(`📋 Transaction Index: ${transactionIndex}`);
    console.log(`👤 Executor: ${executorAddress}`);
    
    // Create execution instruction
    const executeInstruction = getConfigTransactionExecuteInstruction({
      multisig: address(multisigPda),
      proposal: address(proposalPda),
      transaction: address(transactionPda),
      member: signer,
      rentPayer: signer,
    });
    
    console.log('📤 Sending execution transaction...');
    const signature = await signAndSendTransaction(
      [executeInstruction],
      [executor],
      executorAddress
    );
    
    console.log(`✅ Config transaction executed successfully!`);
    console.log(`🔗 Transaction: ${signature}`);
    console.log(`🔗 View on Solana Explorer: https://explorer.solana.com/tx/${signature}?cluster=devnet`);
    
  } catch (error) {
    console.error('❌ Execution failed:', error);
    throw error;
  }
}

async function promptConfigActions(): Promise<ConfigActionArgs[]> {
  const actions: ConfigActionArgs[] = [];
  
  console.log('\n🔧 Config Actions Available:');
  console.log('1. AddMember - Add a new member to the multisig');
  console.log('2. RemoveMember - Remove a member from the multisig');
  console.log('3. ChangeThreshold - Change the approval threshold');
  console.log('4. SetTimeLock - Set the time lock period');
  console.log('5. AddSpendingLimit - Add a spending limit');
  console.log('6. RemoveSpendingLimit - Remove a spending limit');
  console.log('7. SetRentCollector - Set the rent collector');
  console.log('8. Done - Finish adding actions');
  
  while (true) {
    const choice = await prompt('\nSelect an action (1-8): ');
    
    switch (choice) {
      case '1': // AddMember
        const memberKey = await prompt('Enter new member public key: ');
        const memberPermissions = await prompt('Enter permissions (Proposer/Executor/Voter): ');
        const memberPermissionsEnum = memberPermissions.toLowerCase() === 'executor' ? 'Executor' : 
                                    memberPermissions.toLowerCase() === 'voter' ? 'Voter' : 'Proposer';
        
        const newMember: MemberArgs = {
          key: address(memberKey),
          permissions: memberPermissionsEnum as any,
        };
        
        actions.push(configAction('AddMember', { newMember }));
        console.log(`✅ Added AddMember action for ${memberKey}`);
        break;
        
      case '2': // RemoveMember
        const oldMemberKey = await prompt('Enter member public key to remove: ');
        actions.push(configAction('RemoveMember', { oldMember: address(oldMemberKey) }));
        console.log(`✅ Added RemoveMember action for ${oldMemberKey}`);
        break;
        
      case '3': // ChangeThreshold
        const thresholdInput = await prompt('Enter new threshold (number): ');
        const newThreshold = parseInt(thresholdInput);
        if (isNaN(newThreshold) || newThreshold <= 0) {
          console.log('❌ Invalid threshold. Please enter a positive number.');
          continue;
        }
        actions.push(configAction('ChangeThreshold', { newThreshold }));
        console.log(`✅ Added ChangeThreshold action: ${newThreshold}`);
        break;
        
      case '4': // SetTimeLock
        const timeLockInput = await prompt('Enter new time lock in seconds: ');
        const newTimeLock = parseInt(timeLockInput);
        if (isNaN(newTimeLock) || newTimeLock < 0) {
          console.log('❌ Invalid time lock. Please enter a non-negative number.');
          continue;
        }
        actions.push(configAction('SetTimeLock', { newTimeLock }));
        console.log(`✅ Added SetTimeLock action: ${newTimeLock} seconds`);
        break;
        
      case '5': // AddSpendingLimit
        const createKey = await prompt('Enter create key for spending limit: ');
        const vaultIndexInput = await prompt('Enter vault index: ');
        const vaultIndex = parseInt(vaultIndexInput);
        const mint = await prompt('Enter token mint address: ');
        const amountInput = await prompt('Enter spending limit amount: ');
        const amount = BigInt(amountInput);
        const periodType = await prompt('Enter period type (OneTime/Day/Week/Month): ');
        const periodTypeEnum = periodType.toLowerCase() === 'onetime' ? 0 :
                              periodType.toLowerCase() === 'day' ? 1 :
                              periodType.toLowerCase() === 'week' ? 2 : 3;
        
        const membersInput = await prompt('Enter member addresses (comma-separated): ');
        const members = membersInput.split(',').map(addr => address(addr.trim()));
        
        const destinationsInput = await prompt('Enter destination addresses (comma-separated, or press Enter for any): ');
        const destinations = destinationsInput.trim() ? 
          destinationsInput.split(',').map(addr => address(addr.trim())) : [];
        
        const periodData: PeriodArgs = periodTypeEnum;
        
        actions.push(configAction('AddSpendingLimit', {
          createKey: address(createKey),
          vaultIndex,
          mint: address(mint),
          amount,
          period: periodData,
          members,
          destinations,
        }));
        console.log(`✅ Added AddSpendingLimit action`);
        break;
        
      case '6': // RemoveSpendingLimit
        const spendingLimitKey = await prompt('Enter spending limit address to remove: ');
        actions.push(configAction('RemoveSpendingLimit', { spendingLimit: address(spendingLimitKey) }));
        console.log(`✅ Added RemoveSpendingLimit action for ${spendingLimitKey}`);
        break;
        
      case '7': // SetRentCollector
        const rentCollectorInput = await prompt('Enter rent collector address (or press Enter for null): ');
        const newRentCollector = rentCollectorInput.trim() ? address(rentCollectorInput) : null;
        actions.push(configAction('SetRentCollector', { newRentCollector }));
        console.log(`✅ Added SetRentCollector action: ${newRentCollector || 'null'}`);
        break;
        
      case '8': // Done
        if (actions.length === 0) {
          console.log('❌ No actions added. Please add at least one action.');
          continue;
        }
        return actions;
        
      default:
        console.log('❌ Invalid choice. Please select 1-8.');
        break;
    }
  }
}

async function main() {
  try {
    console.log('⚙️  Squads Config Transaction Tool');
    console.log('==================================\n');
    
    // Load multisig address from config
    console.log('✅ Loading multisig address...');
    const multisigAddress = await loadMultisigAddressFromConfig();
    console.log(`🏛️  Multisig Address: ${multisigAddress}`);
    
    // Get multisig info
    const multisigAccount = await fetchMultisig(rpc, address(multisigAddress));
    console.log(`👥 Members: ${multisigAccount.data.members.length}`);
    console.log(`🗳️  Threshold: ${multisigAccount.data.threshold}`);
    console.log(`📊 Transaction Index: ${multisigAccount.data.transactionIndex}`);
    
    // Ask user what they want to do
    console.log('\nWhat would you like to do?');
    console.log('1. Create a new config transaction');
    console.log('2. Execute an existing config transaction');
    
    const action = await prompt('Select action (1-2): ');
    
    if (action === '1') {
      // Create config transaction
      console.log('Note: Only Creator and Executor can create config transactions');
      const creatorChoice = await promptWalletChoice('Which wallet to use as creator?');
      const creator = await loadWalletFromConfig(creatorChoice);
      const creatorAddress = await getAddressFromPublicKey(creator.publicKey);
      console.log(`👤 Using ${creatorChoice === 'manager' ? 'Manager' : creatorChoice === 'voter1' ? 'Voter1' : 'Voter2'} as Creator: ${creatorAddress}`);
      
      // Get config actions
      const actions = await promptConfigActions();
      
      // Get memo
      const memo = await prompt('Enter memo (optional): ');
      
      // Confirm transaction
      console.log('\n📋 Config Transaction Summary:');
      console.log(`👤 Creator: ${creatorAddress}`);
      console.log(`🏛️  Multisig: ${multisigAddress}`);
      console.log(`🔧 Actions: ${actions.length} action(s)`);
      console.log(`📝 Memo: ${memo || 'None'}`);
      
      const confirm = await promptYesNo('Proceed with config transaction?');
      if (!confirm) {
        console.log('❌ Config transaction cancelled.');
        return;
      }
      
      // Create the config transaction
      await createConfigTransaction(creator, multisigAddress, actions, memo);
      
    } else if (action === '2') {
      // Execute config transaction
      const transactionIndexInput = await prompt('Enter transaction index to execute: ');
      const transactionIndex = BigInt(transactionIndexInput);
      
      console.log('Note: Only Creator and Executor can execute config transactions');
      const executorChoice = await promptWalletChoice('Which wallet to use for execution?');
      const executor = await loadWalletFromConfig(executorChoice);
      const executorAddress = await getAddressFromPublicKey(executor.publicKey);
      console.log(`👤 Using ${executorChoice === 'manager' ? 'Manager' : executorChoice === 'voter1' ? 'Voter1' : 'Voter2'} as Executor: ${executorAddress}`);
      
      const confirm = await promptYesNo('Are you sure you want to execute this config transaction?');
      if (!confirm) {
        console.log('❌ Execution cancelled by user.');
        return;
      }
      
      // Execute the config transaction
      await executeConfigTransaction(executor, multisigAddress, transactionIndex);
      
    } else {
      console.log('❌ Invalid choice. Please select 1 or 2.');
      return;
    }
    
    console.log('\n🎉 Operation completed successfully!');
    
  } catch (error) {
    console.error('❌ Error:', error);
    if (error && typeof error === 'object' && 'logs' in error) {
      console.error('Transaction logs:', (error as any).logs);
    }
    process.exit(1);
  }
}

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n👋 Goodbye!');
  process.exit(0);
});

export { main };

// Run the script
if (import.meta.main) {
  main();
}