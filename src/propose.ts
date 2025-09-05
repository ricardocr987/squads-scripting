import { sleep } from 'bun';
import * as multisig from '@sqds/multisig';
import {
    createKeyPairSignerFromBytes,
    getAddressFromPublicKey,
    address,
    AccountRole,
} from '@solana/kit';
import { 
    Transaction, 
    TransactionMessage, 
    Keypair, 
    sendAndConfirmTransaction, 
    PublicKey,
    SystemProgram,
    LAMPORTS_PER_SOL
} from '@solana/web3.js';
import { 
    createAssociatedTokenAccountInstruction,
    createTransferInstruction,
    getAssociatedTokenAddress,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
} from '@solana/spl-token';
import { loadConfig, loadWalletFromConfig } from './utils/config';
import { loadMultisigAddressFromConfig } from './utils/config';
import { prompt } from './utils/prompt';
import { signAndSendTransaction } from './utils/sign';
import { USDC_MINT_DEVNET as USDC_MINT } from './utils/constants';
import { solanaConnection, rpc } from './utils/rpc';
import { fetchMultisig } from './utils/squads/index';

async function proposePaymentTransaction(
  proposer: Keypair,
  multisigPda: string,
  recipientAddress: string,
  amount: number,
  paymentType: 'SOL' | 'USDC'
): Promise<void> {
  console.log('\n💸 Creating payment proposal...');
  
  try {
    // Get proposer address
    const proposerAddress = proposer.publicKey.toString();
    
    console.log(`📍 Proposer Address: ${proposerAddress}`);
    console.log(`💸 Payment amount: ${amount} ${paymentType}`);
    
    // Get multisig account info to get the next transaction index
    const multisigInfo = await multisig.accounts.Multisig.fromAccountAddress(
      solanaConnection,
      new PublicKey(multisigPda)
    );
    
    const currentTransactionIndex = Number(multisigInfo.transactionIndex);
    const newTransactionIndex = BigInt(currentTransactionIndex + 1);
    
    console.log(`📊 Current Transaction Index: ${currentTransactionIndex}`);
    console.log(`📊 New Transaction Index: ${newTransactionIndex}`);
    
    // Get the vault PDA for the multisig
    const [vaultPda] = multisig.getVaultPda({
      multisigPda: new PublicKey(multisigPda),
      index: 0,
    });
    
    console.log(`💰 Treasury PDA: ${vaultPda.toString()}`);
    
    let transferInstruction: any;
    let transferAmount: bigint;
    
    if (paymentType === 'SOL') {
      // Create SOL transfer instruction
      transferAmount = BigInt(amount * LAMPORTS_PER_SOL); // Convert to lamports
      
      transferInstruction = SystemProgram.transfer({
        fromPubkey: vaultPda,
        toPubkey: new PublicKey(recipientAddress),
        lamports: transferAmount,
      });
      
      console.log('📋 SOL transfer instruction created');
      console.log(`  From: ${vaultPda.toString()}`);
      console.log(`  To: ${recipientAddress}`);
      console.log(`  Amount: ${transferAmount.toString()} lamports (${amount} SOL)`);
    } else {
      // Create USDC transfer instruction
      transferAmount = BigInt(amount * Math.pow(10, 6)); // Convert to raw USDC amount (6 decimals)
      
      // Get associated token addresses
      const vaultTokenAccount = await getAssociatedTokenAddress(
        new PublicKey(USDC_MINT),
        vaultPda,
        true // allowOwnerOffCurve for PDA
      );
      
      const recipientTokenAccount = await getAssociatedTokenAddress(
        new PublicKey(USDC_MINT),
        new PublicKey(recipientAddress)
      );
      
      transferInstruction = createTransferInstruction(
        vaultTokenAccount,
        recipientTokenAccount,
        vaultPda, // The vault PDA will be the authority
        transferAmount,
        [],
        TOKEN_PROGRAM_ID
      );
      
      console.log('📋 USDC transfer instruction created');
      console.log(`  From: ${vaultTokenAccount.toString()}`);
      console.log(`  To: ${recipientTokenAccount.toString()}`);
      console.log(`  Amount: ${transferAmount.toString()} raw USDC (${amount} USDC)`);
    }
    
    // Use @sqds/multisig's built-in transaction creation
    // This handles account management properly by using the SDK's methods
    const multisigAccount = await multisig.accounts.Multisig.fromAccountAddress(
      solanaConnection,
      new PublicKey(multisigPda)
    );
    
    // Create the transaction using the multisig's built-in method
    // This should handle the account extraction properly
    const vaultTransaction = multisig.instructions.vaultTransactionCreate({
      multisigPda: new PublicKey(multisigPda),
      transactionIndex: newTransactionIndex,
      creator: new PublicKey(proposerAddress),
      vaultIndex: 0,
      ephemeralSigners: 0,
      transactionMessage: new TransactionMessage({
        payerKey: new PublicKey(proposerAddress),
        recentBlockhash: (await solanaConnection.getLatestBlockhash()).blockhash,
        instructions: [transferInstruction],
      }),
      memo: `Payment of ${amount} ${paymentType} to ${recipientAddress}`,
    });
    
    console.log('📤 Creating vault transaction...');
    
    const createVaultTx = new Transaction().add(vaultTransaction);
    createVaultTx.recentBlockhash = (
        await solanaConnection.getLatestBlockhash()
    ).blockhash;
    createVaultTx.feePayer = new PublicKey(proposerAddress);

    const vaultTxSignature = await sendAndConfirmTransaction(
      solanaConnection,
      createVaultTx,
      [proposer],
      {
        commitment: 'confirmed',
        skipPreflight: false,
      }
    );
    
    console.log(`✅ Vault transaction created: ${vaultTxSignature}`);
    
    // Create proposal instruction using @sqds/multisig
    const createProposalIx = multisig.instructions.proposalCreate({
      multisigPda: new PublicKey(multisigPda),
      transactionIndex: newTransactionIndex,
      creator: new PublicKey(proposerAddress),
      isDraft: false, // This ensures the proposal is active and ready for voting
    });
    
    console.log('📤 Creating proposal...');
    
    const createProposalTx = new Transaction().add(createProposalIx);
    createProposalTx.recentBlockhash = (
        await solanaConnection.getLatestBlockhash()
    ).blockhash;
    createProposalTx.feePayer = new PublicKey(proposerAddress);

    const proposalTxSignature = await sendAndConfirmTransaction(
      solanaConnection,
      createProposalTx,
      [proposer],
      {
        commitment: 'confirmed',
        skipPreflight: false,
      }
    );
    
    console.log(`✅ Proposal created: ${proposalTxSignature}`);
    
    // Get the proposal PDA
    const [proposalPda] = multisig.getProposalPda({
      multisigPda: new PublicKey(multisigPda),
      transactionIndex: newTransactionIndex,
    });
    
    await sleep(2000); // Wait a bit longer for account initialization
    
    console.log(`\n🎉 Payment proposal created successfully!`);
    console.log(`🔗 Vault Transaction: ${vaultTxSignature}`);
    console.log(`🔗 Proposal Transaction: ${proposalTxSignature}`);
    console.log(`🔗 View on Solana Explorer: https://explorer.solana.com/tx/${proposalTxSignature}?cluster=devnet`);
    console.log(`💸 Proposed payment: ${amount} ${paymentType} to ${recipientAddress}`);
    console.log(`📋 Transaction Index: ${newTransactionIndex}`);
    console.log(`📋 Proposal PDA: ${proposalPda.toString()}`);
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
    const configData = await loadConfig();
    const proposerKeypair = Keypair.fromSecretKey(
      new Uint8Array(Buffer.from(configData.manager?.privateKey || '', 'base64'))
    );

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
    
    // Choose payment type
    console.log('\n💰 Payment Type');
    console.log('1. SOL (Solana)');
    console.log('2. USDC (USD Coin)');
    const paymentTypeInput = await prompt('Choose payment type (1 for SOL, 2 for USDC): ');
    
    let paymentType: 'SOL' | 'USDC';
    if (paymentTypeInput === '1') {
      paymentType = 'SOL';
    } else if (paymentTypeInput === '2') {
      paymentType = 'USDC';
    } else {
      console.log('❌ Invalid choice. Please select 1 for SOL or 2 for USDC.');
      process.exit(1);
    }
    
    const amountInput = await prompt(`Enter payment amount in ${paymentType}: `);
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
    console.log(`💵 Amount: ${amount} ${paymentType}`);
    console.log(`🗳️  Required Votes: ${multisigAccount.data.threshold}`);
    
    const confirm = await prompt('\nProceed with payment proposal? (y/n): ');
    if (confirm.toLowerCase() !== 'y') {
      console.log('❌ Payment proposal cancelled.');
      process.exit(0);
    }
    
    // Create the payment proposal
    await proposePaymentTransaction(proposerKeypair, multisigAddress, recipientInput, amount, paymentType);
    
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
