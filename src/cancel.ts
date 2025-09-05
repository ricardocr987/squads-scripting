import { 
  getProposalCancelInstruction,
  getProposalPda,
  fetchMultisig,
} from './utils/squads/index';
import { 
  address,
  createSignerFromKeyPair,
  getAddressFromPublicKey,
  type Address
} from '@solana/kit';
import { loadWalletFromConfig } from './utils/config';
import { loadMultisigAddressFromConfig } from './utils/config';
import { prepareTransaction } from './utils/prepare';
import { sendTransaction } from './utils/send';
import { signTransaction, getBase64EncodedWireTransaction, type Instruction } from '@solana/kit';
import { sleep } from 'bun';
import { rpc } from './utils/rpc';

async function main() {
  try {
    console.log('🚫 Proposal Cancellation Script');
    console.log('===============================\n');
    
    // Load multisig address from config
    console.log('✅ Loading multisig address...');
    const multisigAddress = await loadMultisigAddressFromConfig();
    console.log(`🏛️  Multisig Address: ${multisigAddress}`);
    
    // Load a wallet for signing (using voter1 as default)
    console.log('✅ Loading wallet for signing...');
    console.log('Note: Only Voters can cancel proposals');
    const executor = await loadWalletFromConfig('voter1');
    const signer = await createSignerFromKeyPair(executor);
    const signerAddress = await getAddressFromPublicKey(executor.publicKey);
    console.log(`👤 Signer: ${signerAddress}`);

    // Get multisig account info
    const multisigAccount = await fetchMultisig(rpc, address(multisigAddress));

    console.log('Current transaction index:', multisigAccount.data.transactionIndex);
    console.log('Stale transaction index:', multisigAccount.data.staleTransactionIndex || 0);

    // Get all transactions up to current index
    const proposalsToCancel = [];

    for (let i = 1; i <= Number(multisigAccount.data.transactionIndex); i++) {
      try {
        // Get proposal status
        const [proposalPda] = await getProposalPda(multisigAddress, BigInt(i));

        // Check if proposal exists and get its status
        const isStale = i < Number(multisigAccount.data.staleTransactionIndex || 0);
        
        // For stale proposals, we can cancel them
        if (isStale) {
          proposalsToCancel.push({
            index: i,
            pda: proposalPda,
            status: 'Stale',
          });
        }
      } catch (error) {
        // Proposal account might not exist, skip it
        continue;
      }
    }

    console.log(`\nFound ${proposalsToCancel.length} stale proposals that can be cancelled\n`);

    if (proposalsToCancel.length === 0) {
      console.log('💡 No stale proposals found that can be cancelled.');
      console.log('   All proposals are either current or already processed.');
      return;
    }

    // Cancel stale proposals
    console.log('🚫 Cancelling stale proposals...');
    console.log('================================\n');

    for (const proposal of proposalsToCancel) {
      console.log(
        `Attempting to cancel proposal ${proposal.index} (status: ${proposal.status})`
      );

      try {
        const cancelInstruction = getProposalCancelInstruction({
          multisig: address(multisigAddress),
          proposal: address(proposal.pda),
          member: signer,
          args: {
            memo: `Cancelled by ${signerAddress}`,
          },
        });

        console.log('📤 Sending cancellation transaction...');
        
        // Prepare transaction using @solana/kit
        const transaction = await prepareTransaction(
          [cancelInstruction as Instruction<string>],
          signerAddress
        );
        
        // Sign transaction
        const signedTransaction = await signTransaction(
          [executor],
          transaction
        );
        
        // Get wire transaction
        const wireTransaction = getBase64EncodedWireTransaction(signedTransaction);
        
        // Send transaction
        const signature = await sendTransaction(wireTransaction);
        
        console.log(`✅ Proposal ${proposal.index} cancelled`);
        console.log(`🔗 View on Solana Explorer: https://explorer.solana.com/tx/${signature}`);
        
      } catch (error) {
        console.error(
          `Error cancelling proposal ${proposal.index}:`,
          error
        );
        continue;
      }

      await sleep(1000);
    }

    console.log('\n🎉 Finished cancelling proposals');
    console.log('💡 All eligible stale proposals have been cancelled.');
  } catch (error) {
    console.error('❌ Error cancelling proposals:', error);
    process.exit(1);
  }
}

export { main };

// Run the script
if (import.meta.main) {
  main();
}

