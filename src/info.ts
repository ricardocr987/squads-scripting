import { 
  fetchMultisig,
  fetchVaultTransaction,
  fetchMaybeVaultTransaction,
  fetchProposal,
  fetchMaybeProposal,
  getVaultTransactionPda,
  getProposalPda,
} from './utils/squads/index';
import { 
  address, 
  getAddressFromPublicKey
} from '@solana/kit';
import { loadMultisigAddressFromConfig } from './utils/config';
import { rpc } from './utils/rpc';

interface TransactionInfo {
  index: number;
  vaultTransactionPda: string;
  proposalPda: string;
  vaultTransaction?: any;
  proposal?: any;
  status: string;
  creator?: string;
  vaultIndex?: number;
  approvedCount: number;
  rejectedCount: number;
  cancelledCount: number;
  approvedVoters: string[];
  rejectedVoters: string[];
  cancelledVoters: string[];
  isStale: boolean;
  instructions?: any[];
}

interface MemberInfo {
  address: string;
  permissions: {
    mask: number;
  };
  role: string;
  canPropose: boolean;
  canVote: boolean;
  canExecute: boolean;
}

function formatTimestamp(timestamp: bigint): string {
  const date = new Date(Number(timestamp) * 1000);
  return date.toLocaleString();
}

function getStatusEmoji(status: string): string {
  switch (status) {
    case 'Active': return '🟢';
    case 'Approved': return '✅';
    case 'Executed': return '🚀';
    case 'Rejected': return '❌';
    case 'Cancelled': return '🚫';
    case 'Draft': return '📝';
    case 'Executing': return '⚡';
    default: return '❓';
  }
}

function formatInstructions(instructions: any[]): string {
  if (!instructions || instructions.length === 0) {
    return 'No instructions';
  }
  
  return instructions.map((ix, i) => {
    const programId = ix.programId || 'Unknown';
    const accounts = ix.accounts?.length || 0;
    return `  ${i + 1}. Program: ${programId.slice(0, 8)}... (${accounts} accounts)`;
  }).join('\n');
}

function getMemberRole(permissions: { mask: number }): MemberInfo {
  const mask = permissions.mask;
  const canPropose = (mask & 1) !== 0; // Bit 0: Propose permission
  const canVote = (mask & 2) !== 0;    // Bit 1: Vote permission  
  const canExecute = (mask & 4) !== 0; // Bit 2: Execute permission
  
  let role = 'No permissions';
  if (canPropose && canVote && canExecute) {
    role = 'Full Member (Propose, Vote, Execute)';
  } else if (canVote && canExecute) {
    role = 'Voter & Executor';
  } else if (canVote) {
    role = 'Voter Only';
  } else if (canPropose) {
    role = 'Proposer Only';
  } else if (canExecute) {
    role = 'Executor Only';
  }
  
  return {
    address: '',
    permissions,
    role,
    canPropose,
    canVote,
    canExecute
  };
}

async function fetchTransactionInfo(
  multisigAddress: string, 
  transactionIndex: number
): Promise<TransactionInfo | null> {
  try {
    // Get PDAs
    const [vaultTransactionPda] = await getVaultTransactionPda(multisigAddress, BigInt(transactionIndex));
    const [proposalPda] = await getProposalPda(multisigAddress, BigInt(transactionIndex));
    
    // Fetch vault transaction and proposal data
    const [vaultTransactionResult, proposalResult] = await Promise.allSettled([
      fetchMaybeVaultTransaction(rpc, address(vaultTransactionPda)),
      fetchMaybeProposal(rpc, address(proposalPda))
    ]);
    
    const vaultTransaction = vaultTransactionResult.status === 'fulfilled' ? vaultTransactionResult.value : null;
    const proposal = proposalResult.status === 'fulfilled' ? proposalResult.value : null;
    
    if (!vaultTransaction && !proposal) {
      return null; // Transaction doesn't exist
    }
    
    // Determine status
    let status = 'Unknown';
    let approvedCount = 0;
    let rejectedCount = 0;
    let cancelledCount = 0;
    let approvedVoters: string[] = [];
    let rejectedVoters: string[] = [];
    let cancelledVoters: string[] = [];
    
    if (proposal && proposal.exists) {
      status = proposal.data.status.__kind;
      approvedVoters = proposal.data.approved;
      rejectedVoters = proposal.data.rejected;
      cancelledVoters = proposal.data.cancelled;
      approvedCount = approvedVoters.length;
      rejectedCount = rejectedVoters.length;
      cancelledCount = cancelledVoters.length;
    }
    
    return {
      index: transactionIndex,
      vaultTransactionPda,
      proposalPda,
      vaultTransaction: vaultTransaction?.exists ? vaultTransaction.data : undefined,
      proposal: proposal?.exists ? proposal.data : undefined,
      status,
      creator: vaultTransaction?.exists ? vaultTransaction.data.creator : undefined,
      vaultIndex: vaultTransaction?.exists ? vaultTransaction.data.vaultIndex : undefined,
      approvedCount,
      rejectedCount,
      cancelledCount,
      approvedVoters,
      rejectedVoters,
      cancelledVoters,
      isStale: false, // Will be set based on multisig data
      instructions: vaultTransaction?.exists ? vaultTransaction.data.message?.instructions : undefined
    };
  } catch (error) {
    console.error(`Error fetching transaction ${transactionIndex}:`, error);
    return null;
  }
}

async function main() {
  try {
    console.log('📊 Multisig Information Dashboard');
    console.log('================================\n');
    
    // Load multisig address from config
    console.log('✅ Loading multisig address...');
    const multisigAddress = await loadMultisigAddressFromConfig();
    console.log(`🏛️  Multisig Address: ${multisigAddress}\n`);
    
    // Fetch multisig account data
    console.log('📊 Fetching multisig account data...');
    const multisigAccount = await fetchMultisig(rpc, address(multisigAddress));
    const lastTransactionIndex = Number(multisigAccount.data.transactionIndex);
    const staleTransactionIndex = Number(multisigAccount.data.staleTransactionIndex || 0);
    
    // Display basic multisig information
    console.log('🏛️  MULTISIG INFORMATION');
    console.log('========================');
    console.log(`📍 Address: ${multisigAddress}`);
    console.log(`🔑 Create Key: ${multisigAccount.data.createKey}`);
    console.log(`⚙️  Config Authority: ${multisigAccount.data.configAuthority}`);
    console.log(`🎯 Threshold: ${multisigAccount.data.threshold}`);
    console.log(`⏰ Time Lock: ${multisigAccount.data.timeLock} seconds`);
    console.log(`📈 Total Transactions: ${lastTransactionIndex}`);
    console.log(`🔄 Stale Transaction Index: ${staleTransactionIndex}`);
    console.log(`👥 Total Members: ${multisigAccount.data.members.length}`);
    console.log(`💰 Rent Collector: ${multisigAccount.data.rentCollector || 'None'}`);
    console.log(`🔧 Bump: ${multisigAccount.data.bump}`);
    
    // Determine if multisig is autonomous or controlled
    const isAutonomous = multisigAccount.data.configAuthority === '11111111111111111111111111111111';
    console.log(`🤖 Type: ${isAutonomous ? 'Autonomous (Config changes require voting)' : 'Controlled (Config changes require config authority signature)'}`);
    
    console.log('\n👥 MEMBER ROLES & PERMISSIONS');
    console.log('==============================');
    
    // Display member information with roles
    multisigAccount.data.members.forEach((member, index) => {
      const memberInfo = getMemberRole(member.permissions);
      memberInfo.address = member.key;
      
      console.log(`\n${index + 1}. ${member.key}`);
      console.log(`   🎭 Role: ${memberInfo.role}`);
      console.log(`   📝 Can Propose: ${memberInfo.canPropose ? '✅' : '❌'}`);
      console.log(`   🗳️  Can Vote: ${memberInfo.canVote ? '✅' : '❌'}`);
      console.log(`   ⚡ Can Execute: ${memberInfo.canExecute ? '✅' : '❌'}`);
      console.log(`   🔢 Permission Mask: ${member.permissions.mask} (0b${member.permissions.mask.toString(2).padStart(3, '0')})`);
    });
    
    // Transaction information
    if (lastTransactionIndex === 0) {
      console.log('\n📭 No transactions found in this multisig.');
      return;
    }
    
    console.log('\n🔍 TRANSACTION DETAILS');
    console.log('======================');
    console.log('Fetching transaction details...\n');
    
    // Fetch all transaction information
    const transactions: TransactionInfo[] = [];
    const batchSize = 10; // Process in batches to avoid overwhelming the RPC
    
    for (let i = 1; i <= lastTransactionIndex; i += batchSize) {
      const batch = [];
      for (let j = i; j < Math.min(i + batchSize, lastTransactionIndex + 1); j++) {
        batch.push(fetchTransactionInfo(multisigAddress, j));
      }
      
      const batchResults = await Promise.all(batch);
      transactions.push(...batchResults.filter(tx => tx !== null));
      
      // Show progress
      console.log(`📊 Processed ${Math.min(i + batchSize - 1, lastTransactionIndex)}/${lastTransactionIndex} transactions...`);
    }
    
    // Mark stale transactions
    transactions.forEach(tx => {
      tx.isStale = tx.index <= staleTransactionIndex;
    });
    
    console.log(`\n📋 Found ${transactions.length} transactions:\n`);
    
    // Display transactions
    transactions.forEach((tx, index) => {
      const staleIndicator = tx.isStale ? ' (STALE)' : '';
      const statusEmoji = getStatusEmoji(tx.status);
      
      console.log(`${index + 1}. Transaction #${tx.index} ${statusEmoji} ${tx.status}${staleIndicator}`);
      console.log(`   📍 Vault Transaction: ${tx.vaultTransactionPda}`);
      console.log(`   📍 Proposal: ${tx.proposalPda}`);
      
      if (tx.creator) {
        console.log(`   👤 Creator: ${tx.creator}`);
      }
      
      if (tx.vaultIndex !== undefined) {
        console.log(`   🏦 Vault Index: ${tx.vaultIndex}`);
      }
      
      // Voting information
      console.log(`   🗳️  Votes: ${tx.approvedCount} approved, ${tx.rejectedCount} rejected, ${tx.cancelledCount} cancelled`);
      
      if (tx.approvedVoters.length > 0) {
        console.log(`   ✅ Approved by: ${tx.approvedVoters.map(v => v.slice(0, 8) + '...').join(', ')}`);
      }
      
      if (tx.rejectedVoters.length > 0) {
        console.log(`   ❌ Rejected by: ${tx.rejectedVoters.map(v => v.slice(0, 8) + '...').join(', ')}`);
      }
      
      if (tx.cancelledVoters.length > 0) {
        console.log(`   🚫 Cancelled by: ${tx.cancelledVoters.map(v => v.slice(0, 8) + '...').join(', ')}`);
      }
      
      // Instructions
      if (tx.instructions && tx.instructions.length > 0) {
        console.log(`   📝 Instructions:`);
        console.log(formatInstructions(tx.instructions));
      }
      
      // Timestamp if available
      if (tx.proposal?.status?.timestamp) {
        const timestamp = formatTimestamp(tx.proposal.status.timestamp);
        console.log(`   ⏰ ${tx.status} at: ${timestamp}`);
      }
      
      console.log(''); // Empty line for readability
    });
    
    // Summary
    const activeTransactions = transactions.filter(tx => tx.status === 'Active' && !tx.isStale);
    const approvedTransactions = transactions.filter(tx => tx.status === 'Approved' && !tx.isStale);
    const executedTransactions = transactions.filter(tx => tx.status === 'Executed');
    const rejectedTransactions = transactions.filter(tx => tx.status === 'Rejected');
    const cancelledTransactions = transactions.filter(tx => tx.status === 'Cancelled');
    const staleTransactions = transactions.filter(tx => tx.isStale);
    
    console.log('📊 TRANSACTION SUMMARY');
    console.log('======================');
    console.log(`   🟢 Active: ${activeTransactions.length}`);
    console.log(`   ✅ Approved: ${approvedTransactions.length}`);
    console.log(`   🚀 Executed: ${executedTransactions.length}`);
    console.log(`   ❌ Rejected: ${rejectedTransactions.length}`);
    console.log(`   🚫 Cancelled: ${cancelledTransactions.length}`);
    console.log(`   🔄 Stale: ${staleTransactions.length}`);
    
    if (activeTransactions.length > 0) {
      console.log(`\n💡 Active transactions can be approved or executed.`);
    }
    
    if (approvedTransactions.length > 0) {
      console.log(`💡 Approved transactions are ready for execution.`);
    }
    
    // Permission summary
    console.log('\n🔐 PERMISSION SUMMARY');
    console.log('=====================');
    const proposers = multisigAccount.data.members.filter(m => (m.permissions.mask & 1) !== 0).length;
    const voters = multisigAccount.data.members.filter(m => (m.permissions.mask & 2) !== 0).length;
    const executors = multisigAccount.data.members.filter(m => (m.permissions.mask & 4) !== 0).length;
    
    console.log(`📝 Members who can propose: ${proposers}`);
    console.log(`🗳️  Members who can vote: ${voters}`);
    console.log(`⚡ Members who can execute: ${executors}`);
    console.log(`🎯 Required votes for execution: ${multisigAccount.data.threshold}`);
    
    if (voters < multisigAccount.data.threshold) {
      console.log(`⚠️  WARNING: Threshold (${multisigAccount.data.threshold}) is higher than number of voters (${voters})!`);
    }
    
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

