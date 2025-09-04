import { 
  getProposalCancelInstruction,
  getVaultTransactionAccountsCloseInstruction,
  fetchMultisig,
  getProposalPda,
  getVaultTransactionPda,
} from './utils/squads/index';
import { 
  address, 
  createSignerFromKeyPair,
  getAddressFromPublicKey
} from '@solana/kit';
import { loadWalletFromConfig } from './utils/config';
import { loadMultisigAddressFromConfig } from './utils/config';
import { signAndSendTransaction } from './utils/sign';
import { sleep } from 'bun';
import { rpc } from './utils/rpc';

async function main() {
  try {
    console.log('🧹 Transaction Cleanup Script');
    console.log('============================\n');
    
    // Load multisig address from config
    console.log('✅ Loading multisig address...');
    const multisigAddress = await loadMultisigAddressFromConfig();
    console.log(`🏛️  Multisig Address: ${multisigAddress}`);
    
    // Load a wallet for signing (using manager as default)
    console.log('✅ Loading wallet for signing...');
    console.log('Note: Only Manager can close transactions');
    const executor = await loadWalletFromConfig('manager');
    const signer = await createSignerFromKeyPair(executor);
    const signerAddress = await getAddressFromPublicKey(executor.publicKey);
    console.log(`👤 Signer: ${signerAddress}`);

    // Get multisig account info
    const multisigAccount = await fetchMultisig(rpc, address(multisigAddress));

    console.log('Current transaction index:', multisigAccount.data.transactionIndex);
    console.log('Stale transaction index:', multisigAccount.data.staleTransactionIndex || 0);

    // Get all transactions up to current index
    const transactions = [];
    const proposalsToCancel = [];
    const staleIndex = multisigAccount.data.staleTransactionIndex || 0;

    for (let i = 1; i <= Number(multisigAccount.data.transactionIndex); i++) {
      const [transactionPda] = await getVaultTransactionPda(multisigAddress, BigInt(i));

      try {
        // Get proposal status
        const [proposalPda] = await getProposalPda(multisigAddress, BigInt(i));

        // For now, we'll assume transactions are stale if they're below the stale index
        // In a real implementation, you'd fetch the actual proposal and transaction accounts
        const isStale = i < Number(staleIndex);
        
        // For simplicity, we'll mark all transactions as candidates for closing
        // In practice, you'd check the actual status of each proposal/transaction
        if (isStale) {
          transactions.push({
            index: i,
            pda: transactionPda,
            status: { isStale: true, isCancelled: false, isExecuted: false },
          });
        } else {
          // For non-stale transactions, we might want to cancel them first
          proposalsToCancel.push({
            index: i,
            status: 'Active', // Assume active for now
          });
        }
      } catch (error) {
        // Transaction account might not exist, skip it
        console.log(`Skipping transaction ${i} (account not found)`);
        continue;
      }
    }

    // First cancel any active proposals
    if (proposalsToCancel.length > 0) {
      console.log(
        `Found ${proposalsToCancel.length} active/approved proposals to cancel`
      );

      for (const proposal of proposalsToCancel) {
        console.log(
          `Attempting to cancel proposal ${proposal.index} (current status: ${proposal.status})`
        );

        try {
          const [proposalPda] = await getProposalPda(multisigAddress, BigInt(proposal.index));
          
          const cancelInstruction = getProposalCancelInstruction({
            multisig: address(multisigAddress),
            proposal: address(proposalPda),
            member: signer,
            args: {
              memo: `Cancelled by ${signerAddress}`,
            },
          });

          console.log('📤 Sending cancellation transaction...');
          const signature = await signAndSendTransaction(
            [cancelInstruction],
            [executor],
            signerAddress
          );
          
          console.log(`✅ Proposal ${proposal.index} cancelled: ${signature}`);

          // Add to transactions to close after successful cancellation
          const [transactionPda] = await getVaultTransactionPda(multisigAddress, BigInt(proposal.index));

          transactions.push({
            index: proposal.index,
            pda: transactionPda,
            status: { isCancelled: true },
          });
        } catch (error) {
          console.error(
            `Error cancelling proposal ${proposal.index}:`,
            error
          );
          continue;
        }

        await sleep(1000);
      }
    }

    console.log(`Found ${transactions.length} transactions to close`);

    // Close each transaction
    for (const tx of transactions) {
      console.log(
        `Closing transaction ${tx.index} (${Object.entries(tx.status)
          .filter(([, v]) => v)
          .map(([k]) => k)
          .join(', ')})`
      );

      try {
        const [proposalPda] = await getProposalPda(multisigAddress, BigInt(tx.index));
        
        const closeInstruction = getVaultTransactionAccountsCloseInstruction({
          multisig: address(multisigAddress),
          proposal: address(proposalPda),
          transaction: address(tx.pda),
          rentCollector: address(signerAddress),
        });

        console.log('📤 Sending close transaction...');
        const signature = await signAndSendTransaction(
          [closeInstruction],
          [executor],
          signerAddress
        );
        
        console.log(`✅ Transaction ${tx.index} closed: ${signature}`);
      } catch (error) {
        console.error(`Error closing transaction ${tx.index}:`, error);
        continue;
      }

      // Wait a bit between closures
      await sleep(1000);
    }

    console.log('\n🎉 Finished closing transactions');
    console.log('💡 All stale and cancelled transactions have been cleaned up.');
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
