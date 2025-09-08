import { sleep } from 'bun';
import * as multisig from '@sqds/multisig';
import {
    getAddressFromPublicKey,
    address,
    type Instruction,
    createSignerFromKeyPair
} from '@solana/kit';
import { SYSTEM_PROGRAM_ADDRESS } from '@solana-program/system';
import { fromLegacyTransactionInstruction } from '@solana/compat';
import { 
    getVaultPda,
    getProposalPda,
    fetchMultisig,
    getProposalCreateInstruction,
} from './utils/squads/index';
import { 
    PublicKey,
    SystemProgram,
    LAMPORTS_PER_SOL,
    TransactionMessage
} from '@solana/web3.js';
import { 
    createAssociatedTokenAccountInstruction,
    createTransferInstruction,
    getAssociatedTokenAddress,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
} from '@solana/spl-token';
import { loadWalletFromConfig, loadAllSignersFromConfig } from './utils/config';
import { loadMultisigAddressFromConfig } from './utils/config';
import { signAndSendTransaction } from './utils/sign';
import { prompt } from './utils/prompt';
import { USDC_MINT_DEVNET as USDC_MINT } from './utils/constants';
import { solanaConnection, rpc } from './utils/rpc';
import { checkSolBalance, checkUSDCBalance } from './utils/balance';

async function proposePaymentTransaction(
  multisigPda: string,
  recipientAddress: string,
  amount: number,
  paymentType: 'SOL' | 'USDC',
  proposer: CryptoKeyPair
): Promise<void> {
  console.log('\n💸 Creating payment proposal...');
  
  try {
    console.log(`💸 Payment amount: ${amount} ${paymentType}`);
    
    // Get multisig account info to get the next transaction index
    const multisigAccount = await fetchMultisig(rpc, address(multisigPda));
    
    const currentTransactionIndex = Number(multisigAccount.data.transactionIndex);
    const newTransactionIndex = BigInt(currentTransactionIndex + 1);
    
    console.log(`📊 Current Transaction Index: ${currentTransactionIndex}`);
    console.log(`📊 New Transaction Index: ${newTransactionIndex}`);
    
    // Get the vault PDA for the multisig
    const [vaultPda] = await getVaultPda(multisigPda, 0);
    
    console.log(`💰 Treasury PDA: ${vaultPda}`);
    
    let transferInstruction: any;
    let transferAmount: bigint;
    let instructions: any[] = [];
    
    if (paymentType === 'SOL') {
      // Create SOL transfer instruction
      transferAmount = BigInt(amount * LAMPORTS_PER_SOL); // Convert to lamports
      
      transferInstruction = SystemProgram.transfer({
        fromPubkey: new PublicKey(vaultPda),
        toPubkey: new PublicKey(recipientAddress),
        lamports: transferAmount,
      });
      
      instructions = [transferInstruction];
      
      console.log('📋 SOL transfer instruction created');
      console.log(`  From: ${vaultPda}`);
      console.log(`  To: ${recipientAddress}`);
      console.log(`  Amount: ${transferAmount.toString()} lamports (${amount} SOL)`);
    } else {
      // Create USDC transfer instruction
      transferAmount = BigInt(amount * Math.pow(10, 6)); // Convert to raw USDC amount (6 decimals)
      
      // Get associated token addresses
      const vaultTokenAccount = await getAssociatedTokenAddress(
        new PublicKey(USDC_MINT),
        new PublicKey(vaultPda),
        true // allowOwnerOffCurve for PDA
      );
      
      const recipientTokenAccount = await getAssociatedTokenAddress(
        new PublicKey(USDC_MINT),
        new PublicKey(recipientAddress)
      );
      
      // Check if recipient token account exists
      try {
        const accountInfo = await solanaConnection.getAccountInfo(recipientTokenAccount);
        if (accountInfo) {
          console.log('✅ Recipient token account already exists');
        } else {
          console.log('📋 Recipient token account does not exist, will create it');
          // Create the associated token account instruction
          const createTokenAccountInstruction = createAssociatedTokenAccountInstruction(
            new PublicKey(vaultPda), // payer (the vault will pay for the account creation)
            recipientTokenAccount, // associated token account address
            new PublicKey(recipientAddress), // owner
            new PublicKey(USDC_MINT), // mint
            TOKEN_PROGRAM_ID,
            ASSOCIATED_TOKEN_PROGRAM_ID
          );
          instructions.push(createTokenAccountInstruction);
        }
      } catch (error) {
        console.log('📋 Recipient token account does not exist, will create it');
        // Create the associated token account instruction
        const createTokenAccountInstruction = createAssociatedTokenAccountInstruction(
          new PublicKey(vaultPda), // payer (the vault will pay for the account creation)
          recipientTokenAccount, // associated token account address
          new PublicKey(recipientAddress), // owner
          new PublicKey(USDC_MINT), // mint
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID
        );
        instructions.push(createTokenAccountInstruction);
      }
      
      // Create transfer instruction
      const transferInstruction = createTransferInstruction(
        vaultTokenAccount,
        recipientTokenAccount,
        new PublicKey(vaultPda), // The vault PDA will be the authority
        transferAmount,
        [],
        TOKEN_PROGRAM_ID
      );
      instructions.push(transferInstruction);
      
      console.log('📋 USDC transfer instructions created');
      console.log(`  From: ${vaultTokenAccount.toString()}`);
      console.log(`  To: ${recipientTokenAccount.toString()}`);
      console.log(`  Amount: ${transferAmount.toString()} raw USDC (${amount} USDC)`);
      console.log(`  Instructions: ${instructions.length} (${instructions.length === 1 ? 'transfer only' : 'create account + transfer'})`);
      if (instructions.length > 1) {
        console.log(`  📝 Will create recipient token account before transfer`);
      }
    }
    
    const proposerAddress = await getAddressFromPublicKey(proposer.publicKey);
    
    // Create the vault transaction using Squads SDK
    const vaultTransaction = multisig.instructions.vaultTransactionCreate({
      multisigPda: new PublicKey(multisigPda),
      transactionIndex: newTransactionIndex,
      creator: new PublicKey(proposerAddress),
      vaultIndex: 0,
      ephemeralSigners: 0,
      transactionMessage: new TransactionMessage({
        payerKey: new PublicKey(proposerAddress),
        recentBlockhash: (await solanaConnection.getLatestBlockhash()).blockhash,
        instructions: instructions,
      }),
      memo: `Payment of ${amount} ${paymentType} to ${recipientAddress}`,
    });
    
    console.log('📤 Creating vault transaction...');
    
    // Convert the Squads SDK instruction to @solana/kit format
    const vaultInstruction = fromLegacyTransactionInstruction(vaultTransaction);
    
    // Send and confirm transaction using proposer
    const vaultTxSignature = await signAndSendTransaction(
      [vaultInstruction as Instruction<string>],
      [proposer],
      proposerAddress
    );
    
    console.log(`✅ Vault transaction created: ${vaultTxSignature}`);
    
    // Create proposal instruction using Codama generated instructions
    const [proposalPda] = await getProposalPda(multisigPda, newTransactionIndex);
    const createProposalIx = getProposalCreateInstruction({
      multisig: address(multisigPda),
      proposal: address(proposalPda),
      creator: await createSignerFromKeyPair(proposer),
      rentPayer: await createSignerFromKeyPair(proposer),
      systemProgram: SYSTEM_PROGRAM_ADDRESS,
      transactionIndex: newTransactionIndex,
      draft: false, // This ensures the proposal is active and ready for voting
    });
    
    console.log('📤 Creating proposal...');
        
    // Send and confirm transaction using proposer
    const proposalTxSignature = await signAndSendTransaction(
      [createProposalIx],
      [proposer],
      proposerAddress
    );
    
    console.log(`✅ Proposal created: ${proposalTxSignature}`);
    
    // Get the proposal PDA    
    await sleep(2000); // Wait a bit longer for account initialization
    
    console.log(`\n🎉 Payment proposal created successfully!`);
    console.log(`🔗 View on Solana Explorer: https://explorer.solana.com/tx/${proposalTxSignature}?cluster=devnet`);
    console.log(`💸 Proposed payment: ${amount} ${paymentType} to ${recipientAddress}`);
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
    
    // Load all signers from config
    console.log('✅ Loading signers from config...');
    await loadAllSignersFromConfig();
    
    // Load multisig address from config.json
    console.log('✅ Loading multisig address...');
    const multisigAddress = await loadMultisigAddressFromConfig();
    console.log(`🏛️  Multisig Address: ${multisigAddress}`);

    // Load the manager wallet for proposing
    const proposer = await loadWalletFromConfig('manager');
    const proposerAddress = await getAddressFromPublicKey(proposer.publicKey);
    console.log(`👤 Proposer Address: ${proposerAddress}`);
        
    const multisigAccount = await fetchMultisig(rpc, address(multisigAddress));
    console.log(`👥 Members: ${multisigAccount.data.members.length}`);
    console.log(`🗳️  Threshold: ${multisigAccount.data.threshold}`);
    console.log(`📊 Transaction Index: ${multisigAccount.data.transactionIndex}`);
    
    // Get payment details
    console.log('\n💸 Payment Details');
    const recipientInput = await prompt('Enter recipient wallet address: ');
    if (!recipientInput.trim()) {
      console.log('❌ Recipient address is required.');
      throw new Error('Recipient address is required');
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
      throw new Error('Invalid payment type choice');
    }
    
    // Get vault address and display vault balances before prompting for amount
    const [vaultPda] = await getVaultPda(multisigAddress, 0);
    console.log('\n💰 Multisig Vault Balances:');
    const vaultSolBalance = await checkSolBalance(address(vaultPda));
    const vaultUsdcBalance = await checkUSDCBalance(address(vaultPda));
    console.log(`🏛️  ${vaultPda.slice(0, 8)}...: ${vaultSolBalance.toFixed(4)} SOL, ${vaultUsdcBalance.toFixed(4)} USDC`);
    
    const amountInput = await prompt(`Enter payment amount in ${paymentType}: `);
    const amount = parseFloat(amountInput);
    if (isNaN(amount) || amount <= 0) {
      console.log('❌ Invalid amount. Please enter a positive number.');
      throw new Error('Invalid amount');
    }
    
    // Display payment proposal summary
    console.log('\n📋 Payment Proposal Summary:');
    console.log(`🏛️  Multisig: ${multisigAddress}`);
    console.log(`👥 Recipient: ${recipientInput}`);
    console.log(`💵 Amount: ${amount} ${paymentType}`);
    console.log(`🗳️  Required Votes: ${multisigAccount.data.threshold}`);
    console.log('🚀 Proceeding with payment proposal...');
    
    // Create the payment proposal
    await proposePaymentTransaction(multisigAddress, recipientInput, amount, paymentType, proposer);    
    
    console.log('\n🎉 Payment proposal completed successfully!');
    console.log('📋 The proposal is now pending approval from multisig members.');
    
  } catch (error) {
    console.error('❌ Error:', error);
    if (error && typeof error === 'object' && 'logs' in error) {
      console.error('Transaction logs:', (error as any).logs);
    }
    throw error; // Let the CLI handle the error gracefully
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
