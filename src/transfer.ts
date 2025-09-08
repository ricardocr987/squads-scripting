import { 
  getVaultPda,
} from './utils/squads/index';
import { 
  address,
  createSignerFromKeyPair,
  getAddressFromPublicKey
} from '@solana/kit';
import { transferInstruction } from './utils/transfer';
import { loadWalletFromConfig, loadAllSignersFromConfig, loadMultisigAddressFromConfig } from './utils/config';
import { prompt } from './utils/prompt';
import { signAndSendTransaction } from './utils/sign';
import { checkSolBalance, checkUSDCBalance } from './utils/balance';
import { USDC_MINT_DEVNET as USDC_MINT } from './utils/constants';


async function transferToMultisigVault(
  amount: number,
  tokenMint: string,
  sender: CryptoKeyPair
): Promise<void> {
  console.log('\n💰 Transferring to Multisig Vault');
  console.log('=================================\n');
  
  try {
    // Get multisig vault address
    const multisigAddress = await loadMultisigAddressFromConfig();
    const [vaultPda] = await getVaultPda(multisigAddress, 0);
    
    console.log(`🏛️  Multisig Address: ${multisigAddress}`);
    console.log(`🏦 Vault Address: ${vaultPda}`);
    console.log(`🪙 Token Mint: ${tokenMint}`);
    console.log(`💵 Amount: ${amount} tokens`);
    
    const senderAddress = await getAddressFromPublicKey(sender.publicKey);
    // Create transfer instruction using Solana Kit
    const transferAmount = BigInt(amount * Math.pow(10, 6)); // Convert to raw token amount (assuming 6 decimals)
    const transferIxns = await transferInstruction(
      await createSignerFromKeyPair(sender),
      transferAmount,
      address(tokenMint),
      address(vaultPda)
    );
    
    console.log('📤 Sending transfer transaction...');
    
    // Send and confirm transaction using sender
    const signature = await signAndSendTransaction(
      transferIxns,
      [sender],
      senderAddress
    );
    
    console.log(`✅ Transfer to multisig vault successful!`);
    console.log(`🔗 View on Solana Explorer: https://explorer.solana.com/tx/${signature}?cluster=devnet`);
    console.log(`💰 Transferred ${amount} tokens to multisig vault`);
    
  } catch (error) {
    console.error('❌ Error transferring to multisig vault:', error);
    if (error && typeof error === 'object' && 'logs' in error) {
      console.error('Transaction logs:', (error as any).logs);
    }
    throw error;
  }
}


async function main() {
  try {
    console.log('💰 Multisig Vault Transfer Tool');
    console.log('===============================\n');
    
    // Load all signers from config
    console.log('✅ Loading signers from config...');
    await loadAllSignersFromConfig();
    
    // Load sender wallet for balance checking
    console.log('✅ Loading sender wallet...');
    const sender = await loadWalletFromConfig('manager');
    const senderAddress = await getAddressFromPublicKey(sender.publicKey);
    console.log(`👤 Sender Address: ${senderAddress}`);
    
    // Check SOL balance
    const solBalance = await checkSolBalance(senderAddress);
    const usdcBalance = await checkUSDCBalance(senderAddress);
    console.log(`💰 Current balances: ${solBalance.toFixed(4)} SOL, ${usdcBalance.toFixed(2)} USDC`);
    
    if (solBalance < 0.01) {
      console.log('❌ Insufficient SOL balance. Please send more SOL to the sender wallet.');
      throw new Error('Insufficient SOL balance');
    }
    
    // Get transfer details
    const tokenType = await prompt('Transfer SOL or USDC? (sol/usdc): ');
    
    if (tokenType.toLowerCase() === 'sol') {
      const amountInput = await prompt('Enter SOL amount to transfer: ');
      const amount = parseFloat(amountInput);
      
      if (isNaN(amount) || amount <= 0) {
        console.log('❌ Invalid amount. Please enter a positive number.');
        throw new Error('Invalid amount');
      }
      
      if (amount > solBalance) {
        console.log(`❌ Insufficient SOL balance. Current: ${solBalance.toFixed(4)} SOL, Requested: ${amount} SOL`);
        throw new Error('Insufficient SOL balance');
      }
      
      // Display transfer summary
      console.log('\n📋 SOL Transfer Summary:');
      console.log(`👤 Sender: ${senderAddress}`);
      console.log(`💵 Amount: ${amount} SOL`);
      console.log(`🎯 Destination: Multisig Vault`);
      console.log('🚀 Proceeding with SOL transfer...');
      
      // For SOL transfers to vault, we need to use the SOL mint address
      await transferToMultisigVault(amount, 'So11111111111111111111111111111111111111112', sender);
      
    } else if (tokenType.toLowerCase() === 'usdc') {
      const amountInput = await prompt('Enter USDC amount to transfer: ');
      const amount = parseFloat(amountInput);
      
      if (isNaN(amount) || amount <= 0) {
        console.log('❌ Invalid amount. Please enter a positive number.');
        throw new Error('Invalid amount');
      }
      
      // Display transfer summary
      console.log('\n📋 USDC Transfer Summary:');
      console.log(`👤 Sender: ${senderAddress}`);
      console.log(`💵 Amount: ${amount} USDC`);
      console.log(`🪙 Token: ${USDC_MINT}`);
      console.log(`🎯 Destination: Multisig Vault`);
      console.log('🚀 Proceeding with USDC transfer...');
      
      await transferToMultisigVault(amount, USDC_MINT, sender);
      
    } else {
      console.log('❌ Invalid token type. Please choose "sol" or "usdc".');
      throw new Error('Invalid token type');
    }
    
    console.log('\n🎉 Transfer completed successfully!');
    console.log('📋 The tokens have been transferred to the multisig vault.');
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

// Run the script
if (import.meta.main) {
  main();
}

export { main };


