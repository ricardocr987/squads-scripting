import { 
  getProposalApproveInstruction,
  fetchMultisig,
  getProposalPda,
} from './utils/squads/index';
import { 
  address, 
  createSignerFromKeyPair,
  getAddressFromPublicKey
} from '@solana/kit';
import { loadMultisigAddressFromConfig, loadAllSignersFromConfig, loadWalletFromConfig } from './utils/config';
import { prompt } from './utils/prompt';
import { rpc } from './utils/rpc';
import { signAndSendTransaction } from './utils/sign';

async function selectMember(): Promise<'voter1' | 'voter2' | 'manager'> {
  const members = ['voter1', 'voter2', 'manager'];
  
  console.log('\n👥 Available Members:');
  members.forEach((member, index) => {
    console.log(`   ${index + 1}. ${member}`);
  });
  
  const choice = await prompt('\nSelect member to sign the approval (1-3): ');
  const memberIndex = parseInt(choice || '0') - 1;
  
  if (memberIndex < 0 || memberIndex >= members.length) {
    throw new Error('Invalid member selection');
  }
  
  return members[memberIndex] as 'voter1' | 'voter2' | 'manager';
}

async function approvePaymentTransaction(
  multisigPda: string,
  transactionIndex: bigint,
  voter: CryptoKeyPair
): Promise<void> {
  console.log('\n✅ Approving payment transaction...');
  
  try {
    const voterAddress = await getAddressFromPublicKey(voter.publicKey);
    
    // Get the proposal PDA
    const [proposalPda] = await getProposalPda(multisigPda, transactionIndex);
    console.log(`📋 Multisig Address: ${multisigPda}`);
    console.log(`📋 Proposal Address: ${proposalPda}`);
    console.log(`📋 Transaction Index: ${transactionIndex}`);
    
    // Create approval instruction using Squads utils
    const approveInstruction = getProposalApproveInstruction({
      multisig: address(multisigPda),
      proposal: address(proposalPda),
      member: await createSignerFromKeyPair(voter),
      args: {
        memo: `Approved by voter`,
      },
    });
    
    console.log('📤 Sending approval transaction...');
    
    // Send and confirm transaction using voter
    const signature = await signAndSendTransaction(
      [approveInstruction],
      [voter],
      voterAddress
    );
    
    console.log(`✅ Approval successful!`);
    console.log(`🔗 View on Solana Explorer: https://explorer.solana.com/tx/${signature}`);
    
  } catch (error) {
    throw error;
  }
}

async function main() {
  try {
    console.log('🗳️  Payment Transaction Approval');
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
    const transactionIndexInput = await prompt('Enter transaction index to approve (or press Enter for latest): ');
    const transactionIndex = transactionIndexInput 
      ? BigInt(transactionIndexInput) 
      : multisigAccount.data.transactionIndex;
    
    console.log('Note: Manager and Voters can vote on proposals');
    
    // Select member for approval
    const selectedMember = await selectMember();
    console.log(`\n✅ Selected member: ${selectedMember}`);
    
    // Load the selected member's wallet
    const voter = await loadWalletFromConfig(selectedMember);
    const voterAddress = await getAddressFromPublicKey(voter.publicKey);
    console.log(`👤 Voter Address: ${voterAddress}`);
    
    // Approve the transaction
    await approvePaymentTransaction(multisigAddress, transactionIndex, voter);
    
    console.log('\n🎉 Approval completed successfully!');
    console.log('💡 You can now run the execute script to execute the approved transaction.');
    
  } catch (error) {
    throw error; // Let the CLI handle the error gracefully
  }
}

// Run the script
if (import.meta.main) {
  main();
}

export { main };

