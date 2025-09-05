import { 
  getProposalRejectInstruction,
  getProposalPda,
  fetchMultisig,
  fetchMaybeProposal,
} from './utils/squads/index';
import { 
  address,
  createSignerFromKeyPair,
  getAddressFromPublicKey,
  type Address
} from '@solana/kit';
import { loadWalletFromConfig } from './utils/config';
import { loadMultisigAddressFromConfig } from './utils/config';
import { signAndSendTransaction } from './utils/sign';
import { sleep } from 'bun';
import { rpc } from './utils/rpc';
import { prompt } from './utils/prompt';

async function getActiveProposals(multisigAddress: string) {
  const multisigAccount = await fetchMultisig(rpc, address(multisigAddress));
  const activeProposals = [];

  for (let i = 1; i <= Number(multisigAccount.data.transactionIndex); i++) {
    try {
      const [proposalPda] = await getProposalPda(multisigAddress, BigInt(i));
      const proposalResult = await fetchMaybeProposal(rpc, address(proposalPda));
      
      if (proposalResult && proposalResult.exists) {
        const isStale = i <= Number(multisigAccount.data.staleTransactionIndex || 0);
        const status = proposalResult.data.status.__kind;
        
        // Only show active/approved proposals that aren't stale
        if (!isStale && (status === 'Active' || status === 'Approved')) {
          activeProposals.push({
            index: i,
            pda: proposalPda,
            status: status,
            approvedCount: proposalResult.data.approved.length,
            rejectedCount: proposalResult.data.rejected.length,
            cancelledCount: proposalResult.data.cancelled.length,
          });
        }
      }
    } catch (error) {
      continue;
    }
  }

  return activeProposals;
}

async function selectMember(): Promise<'voter1' | 'voter2' | 'manager'> {
  const members = ['voter1', 'voter2', 'manager'];
  
  console.log('\n👥 Available Members:');
  members.forEach((member, index) => {
    console.log(`   ${index + 1}. ${member}`);
  });
  
  const choice = await prompt('\nSelect member to sign the rejection (1-3): ');
  const memberIndex = parseInt(choice || '0') - 1;
  
  if (memberIndex < 0 || memberIndex >= members.length) {
    throw new Error('Invalid member selection');
  }
  
  return members[memberIndex] as 'voter1' | 'voter2' | 'manager';
}

async function selectProposal(proposals: any[]): Promise<any> {
  if (proposals.length === 0) {
    return null;
  }
  
  console.log('\n📋 Active Proposals:');
  proposals.forEach((proposal, index) => {
    console.log(`   ${index + 1}. Proposal #${proposal.index} - ${proposal.status}`);
    console.log(`      Votes: ${proposal.approvedCount} approved, ${proposal.rejectedCount} rejected, ${proposal.cancelledCount} cancelled`);
  });
  
  const choice = await prompt(`\nSelect proposal to reject (1-${proposals.length}): `);
  const proposalIndex = parseInt(choice) - 1;
  
  if (proposalIndex < 0 || proposalIndex >= proposals.length) {
    throw new Error('Invalid proposal selection');
  }
  
  return proposals[proposalIndex];
}

async function main() {
  try {
    console.log('🚫 Proposal Rejection Script');
    console.log('============================\n');
    
    // Load multisig address from config
    console.log('✅ Loading multisig address...');
    const multisigAddress = await loadMultisigAddressFromConfig();
    console.log(`🏛️  Multisig Address: ${multisigAddress}`);
    
    // Get active proposals
    console.log('🔍 Fetching active proposals...');
    const activeProposals = await getActiveProposals(multisigAddress);
    
    if (activeProposals.length === 0) {
      console.log('💡 No active proposals found that can be rejected.');
      console.log('   All proposals are either stale or already processed.');
      return;
    }
    
    console.log(`\nFound ${activeProposals.length} active proposals that can be rejected`);
    
    // Select proposal to reject
    const selectedProposal = await selectProposal(activeProposals);
    if (!selectedProposal) {
      console.log('❌ No proposal selected');
      return;
    }
    
    // Select member to sign
    const selectedMember = await selectMember();
    console.log(`\n✅ Selected member: ${selectedMember}`);
    
    // Load the selected member's wallet
    console.log('✅ Loading wallet for signing...');
    const executor = await loadWalletFromConfig(selectedMember);
    const signer = await createSignerFromKeyPair(executor);
    const signerAddress = await getAddressFromPublicKey(executor.publicKey);
    console.log(`👤 Signer: ${signerAddress}`);
    
    // Confirm rejection
    const confirm = await prompt(`\n🚫 Are you sure you want to reject Proposal #${selectedProposal.index}? (y/N): `);
    if (confirm.toLowerCase() !== 'y' && confirm.toLowerCase() !== 'yes') {
      console.log('❌ Rejection cancelled');
      return;
    }
    
    console.log(`\n🚫 Rejecting Proposal #${selectedProposal.index}...`);
    console.log('==========================================\n');

    try {
      const rejectInstruction = getProposalRejectInstruction({
        multisig: address(multisigAddress),
        proposal: address(selectedProposal.pda),
        member: signer,
        args: {
          memo: `Rejected by ${signerAddress}`,
        },
      });

      console.log('📤 Sending rejection transaction...');
      
      // Send and confirm transaction using utility function
      const signature = await signAndSendTransaction(
        [rejectInstruction],
        [executor],
        signerAddress
      );
      
      console.log(`✅ Proposal #${selectedProposal.index} rejected successfully!`);
      console.log(`🔗 View on Solana Explorer: https://explorer.solana.com/tx/${signature}`);
      
    } catch (error) {
      console.error(`❌ Error rejecting proposal #${selectedProposal.index}:`, error);
      throw error;
    }

    console.log('\n🎉 Proposal rejection completed!');
  } catch (error) {
    console.error('❌ Error rejecting proposal:', error);
    process.exit(1);
  }
}

export { main };

// Run the script
if (import.meta.main) {
  main();
}
