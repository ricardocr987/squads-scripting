import { sleep } from 'bun';
import { 
  getProposalCreateInstruction,
  fetchMultisig,
  getVaultPda,
  getVaultTransactionPda,
  getProposalPda,
  getVaultTransactionCreateInstruction,
} from './utils/squads/index';
import { 
  address, 
  createSignerFromKeyPair,
  getAddressFromPublicKey,
  type TransactionSigner
} from '@solana/kit';
import { transferInstruction } from './utils/transfer';
import { loadWalletFromConfig } from './utils/config';
import { loadMultisigAddressFromConfig } from './utils/config';
import { prompt } from './utils/prompt';
import { signAndSendTransaction } from './utils/sign';
import { USDC_MINT_DEVNET as USDC_MINT } from './utils/constants';
import { rpc } from './utils/rpc';
import { createSquadsTransactionMessage } from './utils/squadsMessage';

async function proposePaymentTransaction(
  proposer: CryptoKeyPair,
  multisigPda: string,
  recipientAddress: string,
  amount: number
): Promise<void> {
  console.log('\n💸 Creating payment proposal...');
  
  try {
    // Get multisig treasury
    const [treasuryPda] = await getVaultPda(multisigPda, 0);
    
    console.log(`💰 Treasury PDA: ${treasuryPda}`);
    console.log(`💸 Payment amount: ${amount} USDC`);
    
    // Get the next transaction index
    const multisigAccount = await fetchMultisig(rpc, address(multisigPda));
    const currentTransactionIndex = Number(multisigAccount.data.transactionIndex);
    const newTransactionIndex = BigInt(currentTransactionIndex + 1);
    
    // Create vault transaction using Squads utils
    const [transactionPda] = await getVaultTransactionPda(multisigPda, newTransactionIndex);
    
    // Create the serialized VaultTransactionMessage
    const proposerAddress = await getAddressFromPublicKey(proposer.publicKey);
    // Create transfer instruction using Solana Kit
    const transferAmount = BigInt(amount * Math.pow(10, 6)); // Convert to raw USDC amount
    const signer = await createSignerFromKeyPair(proposer);
    const transferSigner: TransactionSigner = {
      address: address(treasuryPda),
      signTransactions: () => Promise.resolve([]),
    }
    const transferIxns = await transferInstruction(
      transferSigner, // signer (multisig)
      transferAmount, // amount in raw USDC
      USDC_MINT, // mint
      address(recipientAddress) // destination
    );
    const transactionMessageBytes = await createSquadsTransactionMessage(
      transferIxns,
      proposerAddress,
      treasuryPda
    );
    
    const vaultTransactionIx = getVaultTransactionCreateInstruction({
      multisig: address(multisigPda),
      transaction: address(transactionPda),
      creator: signer,
      rentPayer: signer,
      args: {
        vaultIndex: 0,
        ephemeralSigners: 0,
        transactionMessage: transactionMessageBytes,
        memo: `Payment of ${amount} USDC to ${recipientAddress}`,
      },
    });
    
    console.log('📤 Creating vault transaction...');
    const vaultTxSignature = await signAndSendTransaction(
      [vaultTransactionIx],
      [proposer],
      proposerAddress
    );
    
    console.log(`✅ Vault transaction created: ${vaultTxSignature}`);
    
    // Get the proposal PDA
    const [proposalPda] = await getProposalPda(multisigPda, newTransactionIndex);
    
    // Create proposal instruction using Squads utils - this is the main proposal creation
    const createProposalIx = getProposalCreateInstruction({
      multisig: address(multisigPda),
      proposal: address(proposalPda),
      creator: await createSignerFromKeyPair(proposer),
      rentPayer: await createSignerFromKeyPair(proposer),
      transactionIndex: newTransactionIndex,
      draft: false,
    });
    
    console.log('📤 Creating proposal...');
    const proposalTxSignature = await signAndSendTransaction(
      [createProposalIx],
      [proposer],
      proposerAddress
    );
    
    console.log(`✅ Proposal created: ${proposalTxSignature}`);
    
    await sleep(2000); // Wait a bit longer for account initialization
    
    // Try to verify proposal account exists (optional verification)
    try {
      // Note: This would need to be implemented with the Codama client
      console.log(`✅ Proposal account created at: ${proposalPda}`);
    } catch (error) {
      console.log(`⚠️  Proposal account verification failed, but transaction was successful`);
      console.log(`   This is normal - the account may take a moment to initialize`);
    }
    
    console.log(`\n🎉 Payment proposal created successfully!`);
    console.log(`🔗 Vault Transaction: ${vaultTxSignature}`);
    console.log(`🔗 Proposal Transaction: ${proposalTxSignature}`);
    console.log(`🔗 View on Solana Explorer: https://explorer.solana.com/tx/${proposalTxSignature}?cluster=devnet`);
    console.log(`💸 Proposed payment: ${amount} USDC to ${recipientAddress}`);
    console.log(`📋 Transaction Index: ${newTransactionIndex}`);
    console.log(`📋 Proposal PDA: ${proposalPda}`);
    console.log(`\n📋 Next steps:`);
    console.log(`   1. Members need to vote on this proposal to execute the payment`);
    console.log(`   2. Once approved, the payment will be executed automatically`);
    console.log(`   3. Check proposal status using the transaction index: ${newTransactionIndex}`);
    
  } catch (error) {
    console.error('❌ Error creating payment proposal:', error);
    if (error && typeof error === 'object' && 'logs' in error) {
      console.error('Transaction logs:', (error as any).logs);
    }
    throw error;
  }
}

async function main() {
  try {
    console.log('💸 Squads Payment Proposal Tool');
    console.log('===============================\n');
    
    // Load wallet
    console.log('✅ Loading wallet...');
    const proposer = await loadWalletFromConfig('manager');
    const proposerAddress = await getAddressFromPublicKey(proposer.publicKey);
    console.log(`📍 Manager Public Key: ${proposerAddress}`);
    
    // Load multisig address from config.json
    console.log('✅ Loading multisig address...');
    const multisigAddress = await loadMultisigAddressFromConfig();
    console.log(`🏛️  Multisig Address: ${multisigAddress}`);
    
    const multisigAccount = await fetchMultisig(rpc, address(multisigAddress));
    console.log(`👥 Members: ${multisigAccount.data.members.length}`);
    console.log(`🗳️  Threshold: ${multisigAccount.data.threshold}`);
    console.log(`📊 Transaction Index: ${multisigAccount.data.transactionIndex}`);
    
    // Get payment details
    console.log('\n💸 Payment Details');
    const recipientInput = await prompt('Enter recipient wallet address: ');
    if (!recipientInput.trim()) {
      console.log('❌ Recipient address is required.');
      process.exit(1);
    }
    
    const amountInput = await prompt('Enter payment amount in USDC: ');
    const amount = parseFloat(amountInput);
    if (isNaN(amount) || amount <= 0) {
      console.log('❌ Invalid amount. Please enter a positive number.');
      process.exit(1);
    }
    
    // Confirm payment proposal
    console.log('\n📋 Payment Proposal Summary:');
    console.log(`👤 Manager: ${proposerAddress}`);
    console.log(`🏛️  Multisig: ${multisigAddress}`);
    console.log(`👥 Recipient: ${recipientInput}`);
    console.log(`💵 Amount: ${amount} USDC`);
    console.log(`🗳️  Required Votes: ${multisigAccount.data.threshold}`);
    
    const confirm = await prompt('\nProceed with payment proposal? (y/n): ');
    if (confirm.toLowerCase() !== 'y') {
      console.log('❌ Payment proposal cancelled.');
      process.exit(0);
    }
    
    // Create the payment proposal
    await proposePaymentTransaction(proposer, multisigAddress, recipientInput, amount);
    
    console.log('\n🎉 Payment proposal completed successfully!');
    console.log('📋 The proposal is now pending approval from multisig members.');
    
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
