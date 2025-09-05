import { 
  getProposalApproveInstruction,
  fetchMultisig,
  getProposalPda,
} from './utils/squads/index';
import { 
  address, 
  createSignerFromKeyPair,
  getAddressFromPublicKey,
  signTransaction,
  getBase64EncodedWireTransaction,
  type Instruction
} from '@solana/kit';
import { loadWalletFromConfig } from './utils/config';
import { loadMultisigAddressFromConfig } from './utils/config';
import { prompt, promptWalletChoice } from './utils/prompt';
import { prepareTransaction } from './utils/prepare';
import { sendTransaction } from './utils/send';
import { rpc } from './utils/rpc';

async function approvePaymentTransaction(
  voter: CryptoKeyPair,
  multisigPda: string,
  transactionIndex: bigint
): Promise<void> {
  console.log('\n✅ Approving payment transaction...');
  
  try {
    // Get the proposal PDA
    const [proposalPda] = await getProposalPda(multisigPda, transactionIndex);
    const voterAddress = await getAddressFromPublicKey(voter.publicKey);
    console.log(`📋 Multisig Address: ${multisigPda}`);
    console.log(`📋 Proposal Address: ${proposalPda}`);
    console.log(`📋 Transaction Index: ${transactionIndex}`);
    console.log(`👤 Voter: ${voterAddress}`);
    
    // Create approval instruction using Squads utils
    const approveInstruction = getProposalApproveInstruction({
      multisig: address(multisigPda),
      proposal: address(proposalPda),
      member: await createSignerFromKeyPair(voter),
      args: {
        memo: `Approved by ${voterAddress}`,
      },
    });
    
    console.log('📤 Preparing approval transaction...');
    
    // Prepare transaction using @solana/kit
    const transaction = await prepareTransaction(
      [approveInstruction as Instruction<string>],
      voterAddress
    );
    
    // Sign transaction
    const signedTransaction = await signTransaction(
      [voter],
      transaction
    );

    // Get wire transaction
    const wireTransaction = getBase64EncodedWireTransaction(signedTransaction);
    
    console.log('📤 Sending approval transaction...');
    const signature = await sendTransaction(wireTransaction);
    
    console.log(`✅ Approval successful!`);
    console.log(`🔗 View on Solana Explorer: https://explorer.solana.com/tx/${signature}`);
    
  } catch (error) {
    console.error('❌ Approval failed:', error);
    throw error;
  }
}

async function main() {
  try {
    console.log('🗳️  Payment Transaction Approval');
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
    const transactionIndexInput = await prompt('Enter transaction index to approve (or press Enter for latest): ');
    const transactionIndex = transactionIndexInput 
      ? BigInt(transactionIndexInput) 
      : multisigAccount.data.transactionIndex;
    
    // Get voter choice (manager and voters can vote)
    console.log('Note: Manager and Voters can vote on proposals');
    const voterChoice = await promptWalletChoice('Which voter to use?');
    const voter = await loadWalletFromConfig(voterChoice);
    const voterAddress = await getAddressFromPublicKey(voter.publicKey);
    console.log(`👤 Using ${voterChoice === 'manager' ? 'Manager' : voterChoice === 'voter1' ? 'Voter1' : 'Voter2'}: ${voterAddress}`);
    
    // Approve the transaction
    await approvePaymentTransaction(voter, multisigAddress, transactionIndex);
    
    console.log('\n🎉 Approval completed successfully!');
    console.log('💡 You can now run the execute script to execute the approved transaction.');
    
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

