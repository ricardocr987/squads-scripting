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
  type Address,
  lamports
} from '@solana/kit';
import { transferInstruction } from './utils/transfer';
import { 
  checkConfigExists, 
  saveMultisigAddressToConfig,
  saveKeypairsToConfig,
  loadWalletFromConfig,
  loadAllSignersFromConfig,
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

async function requestSOLAirdrop(manager: Address): Promise<void> {
  console.log('\n💰 Requesting SOL airdrop...');
  
  // Check current balance first
  let currentBalance = await checkSolBalance(manager);
  
  if (currentBalance >= 0.01) {
    console.log('✅ Sufficient SOL balance available!');
    return;
  }
  
  try {
    // Request airdrop from Solana faucet
    const airdropAmount = 2; // 2 SOL from faucet
    console.log(`📤 Requesting ${airdropAmount} SOL from faucet...`);
    
    // Use the RPC connection to request airdrop
    // Convert SOL to lamports using the lamports function
    const signature = await rpc.requestAirdrop(address(manager), lamports(BigInt(airdropAmount * 1000000000))).send();
    
    console.log(`✅ Airdrop requested! Tx: ${signature}`);
    console.log('⏳ Waiting for confirmation...');
    
    // Wait a bit for the airdrop to be processed
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Check balance again
    currentBalance = await checkSolBalance(manager);
    
    if (currentBalance >= 0.01) {
      console.log('✅ Airdrop successful!');
    } else {
      console.log('⚠️  Airdrop may still be processing. Please try again.');
    }
    
  } catch (error) {
    // Check if it's a 429 Too Many Requests error
    const errorMessage = error && typeof error === 'object' && 'message' in error 
      ? String(error.message) 
      : '';
    
    if (errorMessage.includes('429') || errorMessage.includes('Too Many Requests')) {
      console.log('⚠️  Airdrop rate limited: Too Many Requests');
      console.log('🕐 You can only request 2 airdrops every 8 hours');
      console.log('🔗 Please request airdrop manually: https://faucet.solana.com/');
      console.log('📍 Your wallet address:', manager);
    } else {
      console.log('❌ Programmatic airdrop failed, manual airdrop required');
      console.log('🔗 Please request airdrop manually: https://faucet.solana.com/');
      console.log('📍 Your wallet address:', manager);
    }
    
    console.log('\n📋 Manual SOL Airdrop Required:');
    console.log('1. Visit: https://faucet.solana.com/');
    console.log('2. Select "devnet" from the network dropdown');
    console.log('3. Enter your wallet address:', manager);
    console.log('4. Request 2 SOL (free per 8 hours)');
    console.log('5. Wait for transaction confirmation');
    
    console.log('\n⏳ Waiting for SOL airdrop...');    
    // Wait for user confirmation
    await prompt('Press Enter to continue after receiving SOL...');
    
    console.log('✅ SOL airdrop received!');
  }
}

async function createMultisigProgrammatically(manager: CryptoKeyPair, voter1: Address, voter2: Address): Promise<string> {
  console.log('\n🏛️  Creating multisig...');
  
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

    // Send and confirm transaction using creator
    const signature = await signAndSendTransaction(
      [multisigCreateInstruction],
      [manager, ephemeralKeypair],
      managerAddress
    );
    
    console.log('✅ Multisig created!');
    console.log(`🏛️  Address: ${multisigPda}`);
    console.log(`🔗 Tx: ${signature}`);
    
    return multisigPda;
  } catch (error) {
    console.error('❌ Error creating multisig:', error);
    throw error;
  }
}

async function requestUSDCAirdrop(managerAddress: string): Promise<void> {
  console.log('\n💰 USDC Funding Required');
  console.log('========================\n');
  
  console.log('📍 Manager Wallet Address:', managerAddress);
  console.log('🌐 Network: Devnet');
  console.log('💰 Required: At least 1 USDC');
  
  console.log('\n🚀 Requesting USDC airdrop from Circle Faucet...');
  console.log('🔗 Faucet: https://faucet.circle.com/');
  console.log(`🪙 USDC Mint: ${USDC_MINT}`);
  
  try {
    // Note: Circle faucet requires manual interaction via web interface
    // We'll provide instructions and wait for user confirmation
    console.log('\n📋 Manual USDC Airdrop Required:');
    console.log('1. Visit: https://faucet.circle.com/');
    console.log('2. Select "Solana Devnet" from the network dropdown');
    console.log('3. Enter your wallet address:', managerAddress);
    console.log('4. Request 10 USDC (free per hour)');
    console.log('5. Wait for transaction confirmation');
    
    console.log('\n⏳ Waiting for USDC airdrop...');    
    // Wait for user confirmation
    await prompt('Press Enter to continue after receiving USDC...');
    
    console.log('✅ USDC airdrop received!');
    
  } catch (error) {
    console.error('❌ USDC airdrop setup failed:', error);
    console.log('\n💸 Please manually request USDC from the faucet:');
    console.log('🔗 Faucet: https://faucet.circle.com/');
    console.log(`📍 Address: ${managerAddress}`);
    console.log(`🪙 USDC Mint: ${USDC_MINT}`);
    console.log('🌐 Network: Devnet');
  }
}

async function sendSOLToVoters(
  sender: CryptoKeyPair,
  voters: Address[],
  amountPerVoter: number = 0.2
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
    
    // Send and confirm transaction using sender
    const signature = await signAndSendTransaction(
      instructions,
      [sender],
      senderAddress
    );
    
    console.log(`✅ SOL transfers successful!`);
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
    const transferAmount = BigInt(0.5 * 1000000000); // 0.5 SOL in lamports
    const transferIxns = await transferInstruction(
      await createSignerFromKeyPair(sender),
      transferAmount,
      address('So11111111111111111111111111111111111111112'), // SOL mint
      address(vaultPda)
    );
    
    console.log('📤 Sending SOL deposit to vault...');
    const senderAddress = await getAddressFromPublicKey(sender.publicKey);
    
    // Send and confirm transaction using sender
    const signature = await signAndSendTransaction(
      transferIxns,
      [sender],
      senderAddress
    );
    
    console.log(`✅ SOL deposit to vault successful!`);
    console.log(`🔗 View on Solana Explorer: https://explorer.solana.com/tx/${signature}`);
    console.log(`💰 Deposited 0.5 SOL to vault for initialization`);
    
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
    const transferAmount = BigInt(1 * Math.pow(10, 6)); // 1 USDC in micro-USDC
    const transferIxns = await transferInstruction(
      await createSignerFromKeyPair(sender),
      transferAmount,
      USDC_MINT,
      address(vaultPda)
    );
    
    console.log('📤 Sending USDC transfer transaction...');
    const senderAddress = await getAddressFromPublicKey(sender.publicKey);
    
    // Send and confirm transaction using sender
    const signature = await signAndSendTransaction(
      transferIxns,
      [sender],
      senderAddress
    );
    
    console.log(`✅ USDC transfer successful!`);
    console.log(`🔗 View on Solana Explorer: https://explorer.solana.com/tx/${signature}`);
    console.log(`💰 Transferred 1 USDC to multisig vault`);
    
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
    console.log('   2. Automatically request SOL airdrop from Solana faucet');
    console.log('   3. Fund voters with SOL for transaction fees');
    console.log('   4. Create multisig programmatically with proper permissions');
    console.log('   5. Deposit SOL to vault for initialization');
    console.log('   6. Request USDC airdrop from Circle faucet');
    console.log('   7. Transfer USDC to the multisig vault');
    console.log('\n⚠️  IMPORTANT: This is for Devnet usage!\n');
    
    // Step 1: Create or load Manager and Voter wallets
    let manager: CryptoKeyPair, voter1: CryptoKeyPair, voter2: CryptoKeyPair;
      
    if (await checkConfigExists()) {
      console.log('📁 Found existing config.json, loading wallets...');
      manager = await loadWalletFromConfig('manager');
      voter1 = await loadWalletFromConfig('voter1');
      voter2 = await loadWalletFromConfig('voter2');
      
      // Load all signers for the new system
      await loadAllSignersFromConfig();
    } else {
      console.log('📁 No existing config.json found, generating new wallets...');
      const wallets = await generateManagerVoterWallets();
      manager = wallets.managerKeypair;
      voter1 = wallets.voter1Keypair;
      voter2 = wallets.voter2Keypair;
      
      // Save the generated wallets to config.json
      await saveKeypairsToConfig(
        manager, 
        voter1, 
        voter2,
        wallets.managerKeypairBytes,
        wallets.voter1KeypairBytes,
        wallets.voter2KeypairBytes
      );
      
      // Load all signers for the new system
      await loadAllSignersFromConfig();
    }
    const managerAddress = await getAddressFromPublicKey(manager.publicKey);
    const voter1Address = await getAddressFromPublicKey(voter1.publicKey);
    const voter2Address = await getAddressFromPublicKey(voter2.publicKey);
    
    console.log('✅ Wallets loaded from config.json:');
    console.log(`👤 Manager: ${managerAddress} (can propose, vote, and execute)`);
    console.log(`👤 Voter1: ${voter1Address} (can vote only)`);
    console.log(`👤 Voter2: ${voter2Address} (can vote only)`);

    // Step 2: Request SOL airdrop for manager wallet
    await requestSOLAirdrop(managerAddress);
    
    // Check SOL balance after airdrop attempt
    const managerBalance = await checkSolBalance(managerAddress);
    
    console.log(`\n💰 SOL Balance:`);
    console.log(`   Manager: ${managerBalance.toFixed(4)} SOL`);
    
    if (managerBalance < 0.01) {
      console.log('⚠️  SOL balance still insufficient after airdrop attempt.');
      console.log('🔗 Please request airdrop manually: https://faucet.solana.com/');
      console.log('📍 Your wallet address:', managerAddress);
      console.log('⏳ After receiving SOL, run the script again.');
      process.exit(1);
    }
    
    // Step 3: Send SOL to voters for transaction fees
    console.log('\n💸 Sending SOL to voters for transaction fees...');
    const voters = [voter1Address, voter2Address];
    await sendSOLToVoters(manager, voters, 0.2); // Send 0.2 SOL to each voter
    
    // Step 4: Create multisig programmatically
    const multisigAddress = await createMultisigProgrammatically(manager, voter1Address, voter2Address);
    
    // Save multisig address to config.json
    await saveMultisigAddressToConfig(multisigAddress);
    
    // Step 5: Deposit SOL to vault for initialization
    await depositSOLToVault(manager, multisigAddress);
    
    // Step 6: Request USDC airdrop
    await requestUSDCAirdrop(managerAddress);
    
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