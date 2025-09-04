import { 
  getMultisigCreateV2Instruction,
  getMultisigPda,
  getVaultPda,
  getProgramConfigPda,
  fetchProgramConfig,
} from './utils/squads/index';
import { 
  address,
  createSignerFromKeyPair,
  generateKeyPair,
  getAddressFromPublicKey,
  type Address
} from '@solana/kit';
import { transferInstruction } from './utils/transfer';
import { 
  checkConfigExists, 
  saveMultisigAddressToConfig,
  saveKeypairsToConfig,
  loadWalletFromConfig,
} from './utils/config';
import { 
  generateManagerVoterWallets,
} from './utils/wallet';
import { prompt } from './utils/prompt';
import { signAndSendTransaction } from './utils/sign';
import { checkSolBalance } from './utils/balance';

// USDC mint address on devnet
import { USDC_MINT_DEVNET as USDC_MINT } from './utils/constants';
import { rpc } from './utils/rpc';

async function requestUserToSendSOL(manager: Address): Promise<void> {
  console.log('\n💰 SOL Funding Required');
  console.log('========================\n');
  
  console.log('📍 Manager Wallet Address:', manager);
  
  // Check current balance first
  const currentBalance = await checkSolBalance(manager);
  console.log(`💰 Current SOL balance: ${currentBalance.toFixed(4)} SOL`);
  
  if (currentBalance >= 0.01) {
    console.log('✅ Sufficient SOL balance already available!');
    return;
  }
  
  console.log('\n💸 Please send SOL to the manager wallet:');
  console.log(`📍 Address: ${manager}`);
  console.log('💰 Required: At least 0.01 SOL (for transaction fees)');
  console.log('🌐 Network: Devnet');
  
  const hasSent = await prompt('\nHave you sent SOL to the manager wallet? (y/n): ');
  if (hasSent.toLowerCase() !== 'y') {
    console.log('❌ Please send SOL to the manager wallet first and run the script again.');
    process.exit(1);
  }
  
  console.log('✅ SOL funding confirmed!');
}

async function createMultisigProgrammatically(manager: CryptoKeyPair, voter1: Address, voter2: Address): Promise<string> {
  console.log('\n🏛️  Creating Multisig Programmatically');
  console.log('=====================================\n');
  
  try {
    // Load wallet from environment or use manager as creator
    const managerAddress = await getAddressFromPublicKey(manager.publicKey);

    // Generate ephemeral key for multisig creation
    const ephemeralKeypair = await generateKeyPair();
    const ephemeralAddress = await getAddressFromPublicKey(ephemeralKeypair.publicKey);
    
    // Calculate multisig PDA using Squads utils
    const [multisigPda] = await getMultisigPda(ephemeralAddress);
    
    // Get program config PDA
    const [programConfigPda] = await getProgramConfigPda();
    const programConfig = await fetchProgramConfig(rpc, address(programConfigPda));
    const configTreasury = programConfig.data.treasury;
    console.log('📋 Multisig Configuration:');
    console.log(`   Manager: ${managerAddress} (can propose, vote, and execute)`);
    console.log(`   Voter1: ${voter1} (can vote only)`);
    console.log(`   Voter2: ${voter2} (can vote only)`);
    console.log(`   Threshold: 2 out of 3 members`);
    console.log(`   Treasury: ${configTreasury}`);
    console.log(`   Multisig: ${multisigPda}`);
    console.log(`   Program Config: ${programConfigPda}`);
    console.log(`   Rent Collector: ${managerAddress}`);
    console.log(`   Config Authority: ${managerAddress}`);
    console.log(`   Create Key: ${ephemeralAddress}`);

    // Create multisig instruction using Squads utils
    const multisigCreateInstruction = getMultisigCreateV2Instruction({
      programConfig: address(programConfigPda),
      treasury: address(configTreasury),
      multisig: address(multisigPda),
      createKey: await createSignerFromKeyPair(ephemeralKeypair),
      creator: await createSignerFromKeyPair(manager),
      systemProgram: address('11111111111111111111111111111111'),
      configAuthority: address(managerAddress),
      threshold: 2,
      members: [
        {
          key: address(managerAddress),
          permissions: {
            mask: 7, // Can propose, vote, and execute (7 = all permissions)
          },
        },
        {
          key: address(voter1),
          permissions: {
            mask: 2, // Can only vote (2 = vote permission)
          },
        },
        {
          key: address(voter2),
          permissions: {
            mask: 2, // Can only vote (2 = vote permission)
          },
        },
      ],
      timeLock: 0,
      rentCollector: address(managerAddress),
      memo: 'Multisig created via Solana Kit and Squads utils',
    });

    // Send and confirm transaction
    const signature = await signAndSendTransaction(
      [multisigCreateInstruction],
      [manager, ephemeralKeypair],
      managerAddress
    );
    
    console.log('✅ Multisig created successfully!');
    console.log(`🔗 Transaction: ${signature}`);
    console.log(`🔗 View on Solana Explorer: https://explorer.solana.com/tx/${signature}`);
    console.log(`🏛️  Multisig Address: ${multisigPda}`);
    
    return multisigPda;
  } catch (error) {
    console.error('❌ Error creating multisig:', error);
    throw error;
  }
}

async function requestUserToSendUSDC(managerAddress: string): Promise<void> {
  console.log('\n💰 USDC Funding Required');
  console.log('========================\n');
  
  console.log('📍 Manager Wallet Address:', managerAddress);
  console.log('🌐 Network: Devnet');
  console.log('💰 Required: At least 0.1 USDC');
  console.log('\n💸 Please send USDC to the manager wallet:');
  console.log(`🔗 USDC Mint Address: ${USDC_MINT}`);
  
  const hasSent = await prompt('\nHave you sent USDC to the manager wallet? (y/n): ');
  if (hasSent.toLowerCase() !== 'y') {
    console.log('❌ Please send USDC to the manager wallet first and run the script again.');
    process.exit(1);
  }
  
  console.log('✅ USDC funding confirmed!');
}

async function sendSOLToVoters(
  sender: CryptoKeyPair,
  voters: Address[],
  amountPerVoter: number = 0.001
): Promise<void> {
  console.log('\n💸 Checking voter SOL balances...');
  
  try {
    // Check each voter's balance first
    const senderAddress = await getAddressFromPublicKey(sender.publicKey);
    const votersNeedingSOL = [];
    const voterBalances = [];
    
    for (const voter of voters) {
      const balance = await checkSolBalance(voter);
      voterBalances.push({ voter, balance });
      
      console.log(`💰 ${voter.slice(0, 8)}...: ${balance.toFixed(4)} SOL`);
      
      if (balance < amountPerVoter) {
        votersNeedingSOL.push(voter);
      }
    }
    
    if (votersNeedingSOL.length === 0) {
      console.log('✅ All voters already have sufficient SOL balance!');
      return;
    }
    
    console.log(`\n💸 Sending ${amountPerVoter} SOL to ${votersNeedingSOL.length} voters who need funding...`);
    
    // Check sender's SOL balance
    const senderBalance = await checkSolBalance(senderAddress);
    const totalRequired = amountPerVoter * votersNeedingSOL.length;
    
    if (senderBalance < totalRequired + 0.01) { // +0.01 for transaction fees
      console.log(`❌ Insufficient SOL balance. Current: ${senderBalance.toFixed(4)} SOL, Required: ${(totalRequired + 0.01).toFixed(4)} SOL`);
      return;
    }
    
    console.log(`💰 Sender SOL balance: ${senderBalance.toFixed(4)} SOL`);
    
    const transferAmount = BigInt(amountPerVoter * 1000000000); // LAMPORTS_PER_SOL equivalent
    const instructions = [];
    
    // Create transfer instructions only for voters who need SOL
    for (const voter of votersNeedingSOL) {
      const transferIxns = await transferInstruction(
        await createSignerFromKeyPair(sender),
        transferAmount,
        address('So11111111111111111111111111111111111111112'), // SOL mint
        address(voter)
      );
      instructions.push(...transferIxns);
    }
    
    console.log('📤 Sending SOL transfers...');
    const signature = await signAndSendTransaction(
      instructions,
      [sender],
      senderAddress
    );
    
    console.log(`✅ SOL transfers successful!`);
    console.log(`🔗 Transaction: ${signature}`);
    console.log(`🔗 View on Solana Explorer: https://explorer.solana.com/tx/${signature}`);
    console.log(`💰 Sent ${amountPerVoter} SOL to ${votersNeedingSOL.length} voters for transaction fees`);
    
  } catch (error) {
    console.error('❌ Error sending SOL to voters:', error);
    // Note: SendTransactionError is from @solana/web3.js, but we'll handle it generically
    if (error && typeof error === 'object' && 'logs' in error) {
      console.error('Transaction logs:', (error as any).logs);
    }
  }
}

async function depositSOLToVault(
  sender: CryptoKeyPair,
  multisigPda: string
): Promise<void> {
  console.log('\n💰 Depositing SOL to vault for initialization...');
  
  try {
    // Get vault PDA (index 0)
    const [vaultPda] = await getVaultPda(multisigPda, 0);
    
    // Create SOL transfer instruction to vault
    const transferAmount = BigInt(0.01 * 1000000000); // 0.01 SOL in lamports
    const transferIxns = await transferInstruction(
      await createSignerFromKeyPair(sender),
      transferAmount,
      address('So11111111111111111111111111111111111111112'), // SOL mint
      address(vaultPda)
    );
    
    console.log('📤 Sending SOL deposit to vault...');
    const senderAddress = await getAddressFromPublicKey(sender.publicKey);
    const signature = await signAndSendTransaction(
      transferIxns,
      [sender],
      senderAddress
    );
    
    console.log(`✅ SOL deposit to vault successful!`);
    console.log(`🔗 Transaction: ${signature}`);
    console.log(`🔗 View on Solana Explorer: https://explorer.solana.com/tx/${signature}`);
    console.log(`💰 Deposited 0.01 SOL to vault for initialization`);
    
  } catch (error) {
    console.error('❌ Error depositing SOL to vault:', error);
    if (error && typeof error === 'object' && 'logs' in error) {
      console.error('Transaction logs:', (error as any).logs);
    }
  }
}

async function createUSDCTransferToMultisig(
  sender: CryptoKeyPair,
  multisigPda: string
): Promise<void> {
  console.log('\n💸 Creating USDC transfer to multisig vault...');
  
  try {
    // Get vault PDA (index 0) - this is where assets are stored
    const [vaultPda] = await getVaultPda(multisigPda, 0);
    
    // Create transfer instruction using Solana Kit
    const transferAmount = BigInt(0.1 * Math.pow(10, 6)); // 0.1 USDC in micro-USDC
    const transferIxns = await transferInstruction(
      await createSignerFromKeyPair(sender),
      transferAmount,
      USDC_MINT,
      address(vaultPda)
    );
    
    console.log('📤 Sending USDC transfer transaction...');
    const senderAddress = await getAddressFromPublicKey(sender.publicKey);
    const signature = await signAndSendTransaction(
      transferIxns,
      [sender],
      senderAddress
    );
    
    console.log(`✅ USDC transfer successful!`);
    console.log(`🔗 Transaction: ${signature}`);
    console.log(`🔗 View on Solana Explorer: https://explorer.solana.com/tx/${signature}`);
    console.log(`💰 Transferred 0.1 USDC to multisig vault`);
    
  } catch (error) {
    console.error('❌ Error transferring USDC:', error);
    if (error && typeof error === 'object' && 'logs' in error) {
      console.error('Transaction logs:', (error as any).logs);
    }
  }
}

async function main() {
  try {
    console.log('🚀 Squads Setup Tool');
    console.log('===================\n');
    
    console.log('📋 This tool will help you:');
    console.log('   1. Create or load Manager and Voter wallets');
    console.log('   2. Request SOL funding for manager wallet');
    console.log('   3. Fund voters with SOL for transaction fees');
    console.log('   4. Create multisig programmatically with proper permissions');
    console.log('   5. Deposit SOL to vault for initialization');
    console.log('   6. Transfer USDC to the multisig vault');
    console.log('\n⚠️  IMPORTANT: This is for Devnet usage!\n');
    
    // Step 1: Create or load Manager and Voter wallets
    let manager: CryptoKeyPair, voter1: CryptoKeyPair, voter2: CryptoKeyPair;
      
    if (await checkConfigExists()) {
      console.log('📁 Found existing config.json, loading wallets...');
      manager = await loadWalletFromConfig('manager');
      voter1 = await loadWalletFromConfig('voter1');
      voter2 = await loadWalletFromConfig('voter2');
    } else {
      console.log('📁 No existing config.json found, generating new wallets...');
      const wallets = await generateManagerVoterWallets();
      manager = wallets.manager;
      voter1 = wallets.voter1;
      voter2 = wallets.voter2;
      
      // Save the generated wallets to config.json
      await saveKeypairsToConfig(
        manager, 
        voter1, 
        voter2,
        wallets.managerKeypairBytes,
        wallets.voter1KeypairBytes,
        wallets.voter2KeypairBytes
      );
    }
    const managerAddress = await getAddressFromPublicKey(manager.publicKey);
    const voter1Address = await getAddressFromPublicKey(voter1.publicKey);
    const voter2Address = await getAddressFromPublicKey(voter2.publicKey);
    
    console.log('✅ Wallets loaded from config.json:');
    console.log(`👤 Manager: ${managerAddress} (can propose, vote, and execute)`);
    console.log(`👤 Voter1: ${voter1Address} (can vote only)`);
    console.log(`👤 Voter2: ${voter2Address} (can vote only)`);

    // Step 2: Request SOL funding for manager wallet
    await requestUserToSendSOL(managerAddress);
    
    // Check SOL balance
    const managerBalance = await checkSolBalance(managerAddress);
    
    console.log(`\n💰 SOL Balance:`);
    console.log(`   Manager: ${managerBalance.toFixed(4)} SOL`);
    
    if (managerBalance < 0.01) {
      console.log('❌ Insufficient SOL balance. Please send more SOL to the manager wallet.');
      process.exit(1);
    }
    
    // Step 3: Send SOL to voters for transaction fees
    console.log('\n💸 Sending SOL to voters for transaction fees...');
    const voters = [voter1Address, voter2Address];
    await sendSOLToVoters(manager, voters, 0.001); // Send 0.001 SOL to each voter
    
    // Step 4: Create multisig programmatically
    const multisigAddress = await createMultisigProgrammatically(manager, voter1Address, voter2Address);
    
    // Save multisig address to config.json
    await saveMultisigAddressToConfig(multisigAddress);
    
    // Step 5: Deposit SOL to vault for initialization
    await depositSOLToVault(manager, multisigAddress);
    
    // Step 6: Request USDC funding
    await requestUserToSendUSDC(managerAddress);
    
    // Step 7: Transfer 0.1 USDC to the multisig vault
    await createUSDCTransferToMultisig(manager, multisigAddress);
    
    console.log('\n🎉 Setup completed successfully!');
    console.log('📝 All configuration saved to config.json');
    console.log('\n🚀 You can now run the payment code to create payment proposals!');
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

// Run the script
if (import.meta.main) {
  main();
}

export { main };