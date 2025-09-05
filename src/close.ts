import { 
  getVaultTransactionAccountsCloseInstruction,
  getVaultTransactionPda,
  getProposalPda,
  fetchMultisig,
  fetchMaybeProposal,
  fetchMaybeVaultTransaction,
} from './utils/squads/index';
import { address, getAddressFromPublicKey } from '@solana/kit';
import { loadWalletFromConfig } from './utils/config';
import { loadMultisigAddressFromConfig } from './utils/config';
import { sleep } from 'bun';
import { rpc } from './utils/rpc';
import { prompt } from './utils/prompt';
import { signAndSendTransaction } from './utils/sign';

async function getClosableTransactions(multisigAddress: string) {
  const multisigAccount = await fetchMultisig(rpc, address(multisigAddress));
  const closableTransactions = [];

  for (let i = 1; i <= Number(multisigAccount.data.transactionIndex); i++) {
    try {
      const [transactionPda] = await getVaultTransactionPda(multisigAddress, BigInt(i));
      const [proposalPda] = await getProposalPda(multisigAddress, BigInt(i));

      // Fetch both vault transaction and proposal data
      const [vaultTransactionResult, proposalResult] = await Promise.allSettled([
        fetchMaybeVaultTransaction(rpc, address(transactionPda)),
        fetchMaybeProposal(rpc, address(proposalPda))
      ]);

      const vaultTransaction = vaultTransactionResult.status === 'fulfilled' ? vaultTransactionResult.value : null;
      const proposal = proposalResult.status === 'fulfilled' ? proposalResult.value : null;

      if (!vaultTransaction || !vaultTransaction.exists) {
        continue; // Skip if vault transaction doesn't exist
      }

      const isStale = i <= Number(multisigAccount.data.staleTransactionIndex || 0);
      let status = 'Unknown';
      let canClose = false;

      if (proposal && proposal.exists) {
        status = proposal.data.status.__kind;
        
        // Can close if: stale, cancelled, executed, or rejected
        canClose = isStale || 
                   status === 'Cancelled' || 
                   status === 'Executed' || 
                   status === 'Rejected';
      } else {
        // If no proposal exists but transaction is stale, we can close it
        canClose = isStale;
        status = 'Stale (No Proposal)';
      }

      if (canClose) {
        closableTransactions.push({
          index: i,
          pda: transactionPda,
          proposalPda: proposalPda,
          status: status,
          isStale: isStale,
          isCancelled: status === 'Cancelled',
          isExecuted: status === 'Executed',
          isRejected: status === 'Rejected',
        });
      }
    } catch (error) {
      continue;
    }
  }

  return closableTransactions;
}

async function selectMember(): Promise<'voter1' | 'voter2' | 'manager'> {
  const members = ['voter1', 'voter2', 'manager'];
  
  console.log('\n👥 Available Members:');
  members.forEach((member, index) => {
    console.log(`   ${index + 1}. ${member}`);
  });
  
  const choice = await prompt('\nSelect member to sign the close transaction (1-3): ');
  const memberIndex = parseInt(choice || '0') - 1;
  
  if (memberIndex < 0 || memberIndex >= members.length) {
    throw new Error('Invalid member selection');
  }
  
  return members[memberIndex] as 'voter1' | 'voter2' | 'manager';
}

async function selectTransactions(transactions: any[]): Promise<any[]> {
  if (transactions.length === 0) {
    return [];
  }
  
  console.log('\n📋 Closable Transactions:');
  transactions.forEach((tx, index) => {
    const statusDetails = [];
    if (tx.isStale) statusDetails.push('Stale');
    if (tx.isCancelled) statusDetails.push('Cancelled');
    if (tx.isExecuted) statusDetails.push('Executed');
    if (tx.isRejected) statusDetails.push('Rejected');
    
    console.log(`   ${index + 1}. Transaction #${tx.index} - ${tx.status}`);
    console.log(`      Details: ${statusDetails.join(', ')}`);
  });
  
  const choice = await prompt(`\nSelect transactions to close (1-${transactions.length}, or 'all' for all): `);
  
  if (choice.toLowerCase() === 'all') {
    return transactions;
  }
  
  const indices = choice.split(',').map(s => parseInt(s.trim()) - 1);
  const selectedTransactions = indices
    .filter(i => i >= 0 && i < transactions.length)
    .map(i => transactions[i]);
  
  if (selectedTransactions.length === 0) {
    throw new Error('No valid transactions selected');
  }
  
  return selectedTransactions;
}

async function main() {
  try {
    console.log('🧹 Transaction Cleanup Script');
    console.log('============================\n');
    
    // Load multisig address from config
    console.log('✅ Loading multisig address...');
    const multisigAddress = await loadMultisigAddressFromConfig();
    console.log(`🏛️  Multisig Address: ${multisigAddress}`);
    
    // Get closable transactions
    console.log('🔍 Fetching closable transactions...');
    const closableTransactions = await getClosableTransactions(multisigAddress);
    
    if (closableTransactions.length === 0) {
      console.log('💡 No transactions found that can be closed.');
      console.log('   All transactions are current or already processed.');
      return;
    }
    
    console.log(`\nFound ${closableTransactions.length} closable transactions`);
    
    // Select transactions to close
    const selectedTransactions = await selectTransactions(closableTransactions);
    if (selectedTransactions.length === 0) {
      console.log('❌ No transactions selected');
      return;
    }
    
    // Select member to sign
    const selectedMember = await selectMember();
    console.log(`\n✅ Selected member: ${selectedMember}`);
    
    // Load the selected member's wallet
    console.log('✅ Loading wallet for signing...');
    const executor = await loadWalletFromConfig(selectedMember);
    const signerAddress = await getAddressFromPublicKey(executor.publicKey);
    console.log(`👤 Signer: ${signerAddress}`);
    
    // Confirm closing
    const confirm = await prompt(`\n🧹 Are you sure you want to close ${selectedTransactions.length} transaction(s)? (y/N): `);
    if (confirm.toLowerCase() !== 'y' && confirm.toLowerCase() !== 'yes') {
      console.log('❌ Transaction closing cancelled');
      return;
    }
    
    console.log(`\n🧹 Closing ${selectedTransactions.length} transaction(s)...`);
    console.log('==========================================\n');

    // Close each selected transaction
    for (const tx of selectedTransactions) {
      const statusDetails = [];
      if (tx.isStale) statusDetails.push('Stale');
      if (tx.isCancelled) statusDetails.push('Cancelled');
      if (tx.isExecuted) statusDetails.push('Executed');
      if (tx.isRejected) statusDetails.push('Rejected');
      
      console.log(`Closing Transaction #${tx.index} - ${tx.status} (${statusDetails.join(', ')})`);

      try {
        const closeInstruction = getVaultTransactionAccountsCloseInstruction({
          multisig: address(multisigAddress),
          proposal: address(tx.proposalPda),
          transaction: address(tx.pda),
          rentCollector: address(signerAddress),
        });

        console.log('📤 Sending close transaction...');
        
        // Prepare transaction using @solana/kit
        const signature = await signAndSendTransaction(
          [closeInstruction],
          [executor],
          signerAddress
        );
        
        console.log(`✅ Transaction #${tx.index} closed successfully by ${selectedMember} with signature ${signature}!`);
      } catch (error) {
        console.error(`❌ Error closing transaction #${tx.index}:`, error);
        continue;
      }

      // Wait a bit between closures
      await sleep(1000);
    }

    console.log('\n🎉 Transaction cleanup completed!');
    console.log('💡 All selected transactions have been closed and cleaned up.');
  } catch (error) {
    console.error('❌ Error closing transactions:', error);
    process.exit(1);
  }
}

export { main };

// Run the script
if (import.meta.main) {
  main();
}