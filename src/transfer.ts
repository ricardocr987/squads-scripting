import { 
  getProgramConfigPda,
  fetchProgramConfig,
} from './utils/squads/index';
import { 
  address,
  createSignerFromKeyPair,
  getAddressFromPublicKey,
} from '@solana/kit';
import { transferInstruction } from './utils/transfer';
import { loadWalletFromConfig } from './utils/config';
import { prompt } from './utils/prompt';
import { signAndSendTransaction } from './utils/sign';
import { checkSolBalance } from './utils/balance';
import { USDC_MINT_DEVNET as USDC_MINT } from './utils/constants';
import { rpc } from './utils/rpc';

async function transferToConfigTreasury(
  sender: CryptoKeyPair,
  amount: number,
  tokenMint: string = USDC_MINT
): Promise<void> {
  console.log('\n💰 Transferring to Config Treasury');
  console.log('==================================\n');
  
  try {
    // Get program config PDA and fetch treasury address
    const [programConfigPda] = await getProgramConfigPda();
    const programConfig = await fetchProgramConfig(rpc, address(programConfigPda));
    const configTreasury = programConfig.data.treasury;
    
    console.log(`📍 Program Config PDA: ${programConfigPda}`);
    console.log(`💰 Config Treasury: ${configTreasury}`);
    console.log(`🪙 Token Mint: ${tokenMint}`);
    console.log(`💵 Amount: ${amount} tokens`);
    
    // Create transfer instruction using Solana Kit
    const transferAmount = BigInt(amount * Math.pow(10, 6)); // Convert to raw token amount (assuming 6 decimals)
    const transferIxns = await transferInstruction(
      await createSignerFromKeyPair(sender),
      transferAmount,
      address(tokenMint),
      address(configTreasury)
    );
    
    console.log('📤 Sending transfer transaction...');
    const senderAddress = await getAddressFromPublicKey(sender.publicKey);
    const signature = await signAndSendTransaction(
      transferIxns,
      [sender],
      senderAddress
    );
    
    console.log(`✅ Transfer to config treasury successful!`);
    console.log(`🔗 Transaction: ${signature}`);
    console.log(`🔗 View on Solana Explorer: https://explorer.solana.com/tx/${signature}?cluster=devnet`);
    console.log(`💰 Transferred ${amount} tokens to config treasury`);
    
  } catch (error) {
    console.error('❌ Error transferring to config treasury:', error);
    if (error && typeof error === 'object' && 'logs' in error) {
      console.error('Transaction logs:', (error as any).logs);
    }
    throw error;
  }
}

async function transferSOLToConfigTreasury(
  sender: CryptoKeyPair,
  amount: number
): Promise<void> {
  console.log('\n💰 Transferring SOL to Config Treasury');
  console.log('=====================================\n');
  
  try {
    // Get program config PDA and fetch treasury address
    const [programConfigPda] = await getProgramConfigPda();
    const programConfig = await fetchProgramConfig(rpc, address(programConfigPda));
    const configTreasury = programConfig.data.treasury;
    
    console.log(`📍 Program Config PDA: ${programConfigPda}`);
    console.log(`💰 Config Treasury: ${configTreasury}`);
    console.log(`💵 Amount: ${amount} SOL`);
    
    // Create SOL transfer instruction
    const transferAmount = BigInt(amount * 1000000000); // Convert to lamports
    const transferIxns = await transferInstruction(
      await createSignerFromKeyPair(sender),
      transferAmount,
      address('So11111111111111111111111111111111111111112'), // SOL mint
      address(configTreasury)
    );
    
    console.log('📤 Sending SOL transfer transaction...');
    const senderAddress = await getAddressFromPublicKey(sender.publicKey);
    const signature = await signAndSendTransaction(
      transferIxns,
      [sender],
      senderAddress
    );
    
    console.log(`✅ SOL transfer to config treasury successful!`);
    console.log(`🔗 Transaction: ${signature}`);
    console.log(`🔗 View on Solana Explorer: https://explorer.solana.com/tx/${signature}?cluster=devnet`);
    console.log(`💰 Transferred ${amount} SOL to config treasury`);
    
  } catch (error) {
    console.error('❌ Error transferring SOL to config treasury:', error);
    if (error && typeof error === 'object' && 'logs' in error) {
      console.error('Transaction logs:', (error as any).logs);
    }
    throw error;
  }
}

async function main() {
  try {
    console.log('💰 Config Treasury Transfer Tool');
    console.log('===============================\n');
    
    // Load sender wallet
    console.log('✅ Loading sender wallet...');
    console.log('Note: Using Manager wallet (has all permissions)');
    const sender = await loadWalletFromConfig('manager');
    const senderAddress = await getAddressFromPublicKey(sender.publicKey);
    console.log(`📍 Sender Address: ${senderAddress}`);
    
    // Check SOL balance
    const solBalance = await checkSolBalance(senderAddress);
    console.log(`💰 Current SOL balance: ${solBalance.toFixed(4)} SOL`);
    
    if (solBalance < 0.01) {
      console.log('❌ Insufficient SOL balance. Please send more SOL to the sender wallet.');
      process.exit(1);
    }
    
    // Get transfer details
    console.log('\n💸 Transfer Details');
    const tokenType = await prompt('Transfer SOL or USDC? (sol/usdc): ');
    
    if (tokenType.toLowerCase() === 'sol') {
      const amountInput = await prompt('Enter SOL amount to transfer: ');
      const amount = parseFloat(amountInput);
      
      if (isNaN(amount) || amount <= 0) {
        console.log('❌ Invalid amount. Please enter a positive number.');
        process.exit(1);
      }
      
      if (amount > solBalance) {
        console.log(`❌ Insufficient SOL balance. Current: ${solBalance.toFixed(4)} SOL, Requested: ${amount} SOL`);
        process.exit(1);
      }
      
      // Confirm transfer
      console.log('\n📋 SOL Transfer Summary:');
      console.log(`👤 Sender: ${senderAddress}`);
      console.log(`💵 Amount: ${amount} SOL`);
      
      const confirm = await prompt('\nProceed with SOL transfer? (y/n): ');
      if (confirm.toLowerCase() !== 'y') {
        console.log('❌ SOL transfer cancelled.');
        process.exit(0);
      }
      
      await transferSOLToConfigTreasury(sender, amount);
      
    } else if (tokenType.toLowerCase() === 'usdc') {
      const amountInput = await prompt('Enter USDC amount to transfer: ');
      const amount = parseFloat(amountInput);
      
      if (isNaN(amount) || amount <= 0) {
        console.log('❌ Invalid amount. Please enter a positive number.');
        process.exit(1);
      }
      
      // Confirm transfer
      console.log('\n📋 USDC Transfer Summary:');
      console.log(`👤 Sender: ${senderAddress}`);
      console.log(`💵 Amount: ${amount} USDC`);
      console.log(`🪙 Token: ${USDC_MINT}`);
      
      const confirm = await prompt('\nProceed with USDC transfer? (y/n): ');
      if (confirm.toLowerCase() !== 'y') {
        console.log('❌ USDC transfer cancelled.');
        process.exit(0);
      }
      
      await transferToConfigTreasury(sender, amount, USDC_MINT);
      
    } else {
      console.log('❌ Invalid token type. Please choose "sol" or "usdc".');
      process.exit(1);
    }
    
    console.log('\n🎉 Transfer completed successfully!');
    console.log('📋 The tokens have been transferred to the config treasury.');
    process.exit(0);
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
