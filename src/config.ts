import { 
  getMultisigAddMemberInstruction,
  getMultisigRemoveMemberInstruction,
  getMultisigSetRentCollectorInstruction,
  getMultisigAddSpendingLimitInstruction,
  getMultisigRemoveSpendingLimitInstruction,
  fetchMultisig,
  getSpendingLimitPda,
} from './utils/squads/index';
import { 
  address, 
  createSignerFromKeyPair,
  getAddressFromPublicKey,
  generateKeyPair,
} from '@solana/kit';
import { loadWalletFromConfig } from './utils/config';
import { loadMultisigAddressFromConfig } from './utils/config';
import { prompt } from './utils/prompt';
import { signAndSendTransaction } from './utils/sign';
import { rpc } from './utils/rpc';
import { type MemberArgs } from './utils/squads/types/member';
import { type PeriodArgs } from './utils/squads/types/period';

async function addMember(
  manager: CryptoKeyPair,
  multisigPda: string,
  newMemberAddress: string,
  permissions: number,
  memo?: string
): Promise<void> {
  console.log('\n👥 Adding new member...');
  
  try {
    const managerAddress = await getAddressFromPublicKey(manager.publicKey);
    const signer = await createSignerFromKeyPair(manager);
    
    const memberArgs: MemberArgs = {
      key: address(newMemberAddress),
      permissions: { mask: permissions }
    };
    
    const instruction = getMultisigAddMemberInstruction({
      multisig: address(multisigPda),
      configAuthority: signer,
      rentPayer: signer,
      systemProgram: address('11111111111111111111111111111111'),
      newMember: memberArgs,
      memo: memo || null
    });
    
    console.log(`📋 Adding member: ${newMemberAddress}`);
    console.log(`🔑 Permissions: ${permissions} (0b${permissions.toString(2).padStart(3, '0')})`);
    
    const signature = await signAndSendTransaction(
      [instruction],
      [manager],
      managerAddress
    );
    
    console.log(`✅ Member added successfully!`);
    console.log(`🔗 Transaction: https://explorer.solana.com/tx/${signature}?cluster=devnet`);
    
  } catch (error) {
    console.error('❌ Error adding member:', error);
    throw error;
  }
}

async function removeMember(
  manager: CryptoKeyPair,
  multisigPda: string,
  memberAddress: string,
  memo?: string
): Promise<void> {
  console.log('\n👥 Removing member...');
  
  try {
    const managerAddress = await getAddressFromPublicKey(manager.publicKey);
    const signer = await createSignerFromKeyPair(manager);
    
    const instruction = getMultisigRemoveMemberInstruction({
      multisig: address(multisigPda),
      configAuthority: signer,
      rentPayer: signer,
      systemProgram: address('11111111111111111111111111111111'),
      oldMember: address(memberAddress),
      memo: memo || null
    });
    
    console.log(`📋 Removing member: ${memberAddress}`);
    
    const signature = await signAndSendTransaction(
      [instruction],
      [manager],
      managerAddress
    );
    
    console.log(`✅ Member removed successfully!`);
    console.log(`🔗 Transaction: https://explorer.solana.com/tx/${signature}?cluster=devnet`);
    
  } catch (error) {
    console.error('❌ Error removing member:', error);
    throw error;
  }
}


async function addSpendingLimit(
  manager: CryptoKeyPair,
  multisigPda: string,
  vaultIndex: number,
  mint: string,
  amount: bigint,
  period: PeriodArgs,
  members: string[],
  destinations: string[],
  memo?: string
): Promise<void> {
  console.log('\n💰 Adding spending limit...');
  
  try {
    const managerAddress = await getAddressFromPublicKey(manager.publicKey);
    const signer = await createSignerFromKeyPair(manager);
    
    // Generate a random key for the spending limit
    const createKey = await generateKeyPair();
    const createKeyAddress = await getAddressFromPublicKey(createKey.publicKey);
    
    // Get spending limit PDA
    const [spendingLimitPda] = await getSpendingLimitPda(multisigPda, address(createKeyAddress), 0);
    
    const instruction = getMultisigAddSpendingLimitInstruction({
      multisig: address(multisigPda),
      configAuthority: signer,
      spendingLimit: address(spendingLimitPda),
      rentPayer: signer,
      systemProgram: address('11111111111111111111111111111111'),
      createKey: address(createKeyAddress),
      vaultIndex,
      mint: address(mint),
      amount,
      period,
      members: members.map(addr => address(addr)),
      destinations: destinations.map(addr => address(addr)),
      memo: memo || null
    });
    
    console.log(`📋 Vault Index: ${vaultIndex}`);
    console.log(`🪙 Mint: ${mint}`);
    console.log(`💰 Amount: ${amount}`);
    console.log(`👥 Members: ${members.length}`);
    console.log(`🎯 Destinations: ${destinations.length}`);
    
    const signature = await signAndSendTransaction(
      [instruction],
      [manager],
      managerAddress
    );
    
    console.log(`✅ Spending limit added successfully!`);
    console.log(`🔗 Transaction: https://explorer.solana.com/tx/${signature}?cluster=devnet`);
    
  } catch (error) {
    console.error('❌ Error adding spending limit:', error);
    throw error;
  }
}

async function removeSpendingLimit(
  manager: CryptoKeyPair,
  multisigPda: string,
  spendingLimitAddress: string,
  memo?: string
): Promise<void> {
  console.log('\n💰 Removing spending limit...');
  
  try {
    const managerAddress = await getAddressFromPublicKey(manager.publicKey);
    const signer = await createSignerFromKeyPair(manager);
    
    const instruction = getMultisigRemoveSpendingLimitInstruction({
      multisig: address(multisigPda),
      configAuthority: signer,
      spendingLimit: address(spendingLimitAddress),
      rentCollector: address(managerAddress),
      memo: memo || null
    });
    
    console.log(`📋 Removing spending limit: ${spendingLimitAddress}`);
    
    const signature = await signAndSendTransaction(
      [instruction],
      [manager],
      managerAddress
    );
    
    console.log(`✅ Spending limit removed successfully!`);
    console.log(`🔗 Transaction: https://explorer.solana.com/tx/${signature}?cluster=devnet`);
    
  } catch (error) {
    console.error('❌ Error removing spending limit:', error);
    throw error;
  }
}

async function setRentCollector(
  manager: CryptoKeyPair,
  multisigPda: string,
  rentCollectorAddress: string,
  memo?: string
): Promise<void> {
  console.log('\n🏦 Setting rent collector...');
  
  try {
    const managerAddress = await getAddressFromPublicKey(manager.publicKey);
    const signer = await createSignerFromKeyPair(manager);
    
    const instruction = getMultisigSetRentCollectorInstruction({
      multisig: address(multisigPda),
      configAuthority: signer,
      rentPayer: signer,
      systemProgram: address('11111111111111111111111111111111'),
      rentCollector: address(rentCollectorAddress),
      memo: memo || null
    });
    
    console.log(`📋 Setting rent collector: ${rentCollectorAddress}`);
    
    const signature = await signAndSendTransaction(
      [instruction],
      [manager],
      managerAddress
    );
    
    console.log(`✅ Rent collector set successfully!`);
    console.log(`🔗 Transaction: https://explorer.solana.com/tx/${signature}?cluster=devnet`);
    
  } catch (error) {
    console.error('❌ Error setting rent collector:', error);
    throw error;
  }
}

async function displayMultisigInfo(multisigPda: string): Promise<void> {
  console.log('\n📊 Current Multisig Information');
  console.log('==============================');
  
  try {
    const multisigAccount = await fetchMultisig(rpc, address(multisigPda));
    
    console.log(`🏛️  Multisig Address: ${multisigPda}`);
    console.log(`🎯 Threshold: ${multisigAccount.data.threshold}`);
    console.log(`⏰ Time Lock: ${multisigAccount.data.timeLock} seconds`);
    console.log(`👥 Members: ${multisigAccount.data.members.length}`);
    console.log(`💰 Rent Collector: ${multisigAccount.data.rentCollector?.toString() || 'None'}`);
    
    console.log('\n👥 Current Members:');
    multisigAccount.data.members.forEach((member, index) => {
      const permissions = member.permissions.mask;
      const canPropose = (permissions & 1) !== 0;
      const canVote = (permissions & 2) !== 0;
      const canExecute = (permissions & 4) !== 0;
      
      console.log(`   ${index + 1}. ${member.key.toString()}`);
      console.log(`      Permissions: ${canPropose ? 'Propose' : ''} ${canVote ? 'Vote' : ''} ${canExecute ? 'Execute' : ''}`);
    });
    
  } catch (error) {
    console.error('❌ Error fetching multisig info:', error);
  }
}

async function main() {
  try {
    console.log('⚙️  Squads Config Management Tool');
    console.log('==================================\n');
    
    // Load multisig address from config
    console.log('✅ Loading multisig address...');
    const multisigAddress = await loadMultisigAddressFromConfig();
    console.log(`🏛️  Multisig Address: ${multisigAddress}`);
    
    // Load manager wallet
    console.log('✅ Loading manager wallet...');
    const manager = await loadWalletFromConfig('manager');
    const managerAddress = await getAddressFromPublicKey(manager.publicKey);
    console.log(`👤 Manager: ${managerAddress}`);
    
    // Display current multisig info
    await displayMultisigInfo(multisigAddress);
    
    while (true) {
      console.log('\n🔧 Controlled Multisig Instructions:');
      console.log('1. AddMember - Add a new member to the multisig');
      console.log('2. RemoveMember - Remove a member from the multisig');
      console.log('3. SetRentCollector - Set the rent collector');
      console.log('4. AddSpendingLimit - Add a spending limit');
      console.log('5. RemoveSpendingLimit - Remove a spending limit');
      console.log('6. ViewInfo - Display current multisig information');
      console.log('7. Exit - Exit the config tool');
      
      const choice = await prompt('\nSelect an action (1-7): ');
      
      switch (choice) {
        case '1': {
          const memberAddress = await prompt('Enter new member address: ');
          const permissionsChoice = await prompt('Enter permissions (1=propose, 2=vote, 4=execute, 7=all): ');
          const permissions = parseInt(permissionsChoice) || 7;
          const memo = await prompt('Enter memo (optional): ');
          
          await addMember(manager, multisigAddress, memberAddress, permissions, memo);
          break;
        }
        
        case '2': {
          const memberAddress = await prompt('Enter member address to remove: ');
          const memo = await prompt('Enter memo (optional): ');
          
          await removeMember(manager, multisigAddress, memberAddress, memo);
          break;
        }
        
        case '3': {
          const rentCollectorAddress = await prompt('Enter rent collector address: ');
          const memo = await prompt('Enter memo (optional): ');
          
          await setRentCollector(manager, multisigAddress, rentCollectorAddress, memo);
          break;
        }
        
        case '4': {
          const vaultIndex = await prompt('Enter vault index (0): ');
          const mint = await prompt('Enter mint address: ');
          const amount = await prompt('Enter amount (in smallest units): ');
          const periodType = await prompt('Enter period type (1=OneTime, 2=Day, 3=Week, 4=Month): ');
          const membersInput = await prompt('Enter member addresses (comma-separated): ');
          const destinationsInput = await prompt('Enter destination addresses (comma-separated, empty for any): ');
          const memo = await prompt('Enter memo (optional): ');
          
          const period: PeriodArgs = {
            __kind: periodType === '1' ? 'OneTime' : 
                   periodType === '2' ? 'Day' : 
                   periodType === '3' ? 'Week' : 'Month'
          } as unknown as PeriodArgs;
          
          const members = membersInput.split(',').map(addr => addr.trim()).filter(addr => addr);
          const destinations = destinationsInput.split(',').map(addr => addr.trim()).filter(addr => addr);
          
          await addSpendingLimit(
            manager, 
            multisigAddress, 
            parseInt(vaultIndex), 
            mint, 
            BigInt(amount), 
            period, 
            members, 
            destinations, 
            memo
          );
          break;
        }
        
        case '5': {
          const spendingLimitAddress = await prompt('Enter spending limit address to remove: ');
          const memo = await prompt('Enter memo (optional): ');
          
          await removeSpendingLimit(manager, multisigAddress, spendingLimitAddress, memo);
          break;
        }
        
        case '6': {
          await displayMultisigInfo(multisigAddress);
          break;
        }
        
        case '7': {
          console.log('\n👋 Exiting config tool...');
          return;
        }
        
        default:
          console.log('❌ Invalid choice. Please select 1-7.');
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
    if (error && typeof error === 'object' && 'logs' in error) {
      console.error('Transaction logs:', (error as any).logs);
    }
    process.exit(1);
  }
}

export { main };

// Run the script
if (import.meta.main) {
  main();
}