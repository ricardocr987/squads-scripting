# Advanced Squads Multisig Management System

A comprehensive TypeScript framework for managing Squads multisig operations on Solana, built with modern development tools including Bun and @solana/kit. This system provides a complete lifecycle management solution for multisig transactions: **Initialize → Propose → Approve → Execute → Cleanup**.

## 🏗️ Architecture & Technology Stack

### Core Technologies

**@solana/kit** is a modern TypeScript framework that provides:
- **Type-safe RPC interactions** with automatic serialization/deserialization
- **Transaction building** with instruction composition and signing

**Squads program** offers:
- **Programmable permissions** with granular access control
- **Proposal lifecycle automation** with configurable thresholds

**Codama** provides:
- **Automated IDL parsing** from Anchor program definitions
- **Type-safe client generation** to build program instructions
- **Runtime validation** of instruction parameters

### System Architecture

```typescript
// Core system components
src/
├── index.ts           // Main CLI entry point with interactive menu
├── start.ts           // Multisig initialization and treasury setup
├── propose.ts         // Payment proposal creation with ATA handling
├── approve.ts         // Member voting and approval system
├── execute.ts         // Transaction execution and confirmation
├── reject.ts          // Interactive proposal rejection
├── cancel.ts          // Stale proposal cancellation
├── close.ts           // Interactive account cleanup and rent recovery
├── config.ts          // Direct multisig configuration management
├── transfer.ts        // Direct transfers to multisig vault
├── info.ts            // Comprehensive multisig information dashboard
└── utils/
    ├── squads/        // Squads utils generated with Codama
    ├── config.ts      // Local file I/O operations
    ├── wallet.ts      // CryptoKeyPair management
    ├── balance.ts     // Token balance monitoring and validation
    ├── transfer.ts    // Transfer instruction utilities
    ├── prepare.ts     // Transaction preparation with @solana/kit
    ├── send.ts        // Transaction sending and confirmation
    ├── sign.ts        // Transaction signing utilities
    └── prompt.ts      // Interactive CLI prompts
```

## 🚀 Quick Start

### Prerequisites

- **Bun** - High-performance JavaScript runtime (https://bun.com/docs/installation)

### Installation

```bash
# Clone repository
git clone https://github.com/ricardocr987/squads-scripting
cd squads-scripting

# Install dependencies
bun install

# Configure environment
cp env.example .env
```

### Environment Configuration

```env
RPC_URL=https://api.devnet.solana.com
```

### Running the System

```bash
# Start the interactive CLI
bun run start

# Or run individual scripts
bun run src/start.ts    # Initialize multisig
bun run src/propose.ts  # Create payment proposal
bun run src/approve.ts  # Approve transaction
bun run src/execute.ts  # Execute transaction
```

## 📋 Complete Script Documentation

### 🎯 Main CLI Interface (`index.ts`)

The central command-line interface that orchestrates all multisig operations.

**Key Features:**
- **Auto-setup detection** - Automatically runs initialization if no config exists
- **Interactive menu** - User-friendly command selection

**Menu Structure:**
```typescript
1. ⚙️ Manage Multisig Config     // Controlled multisig instructions
2. 📊 View Information           // Comprehensive dashboard
3. 💸 Create Payment Proposal    // Transaction proposals
4. ✅ Approve Transaction        // Voting system
5. 🚀 Execute Transaction        // Transaction execution
6. 🚫 Reject Proposals          // Interactive rejection
7. ❌ Cancel Proposals          // Stale proposal cleanup
8. 🧹 Cleanup Transactions      // Account cleanup
9. 💰 Transfer to Treasury      // Direct vault funding
```

### 🚀 System Initialization (`start.ts`)

Comprehensive multisig setup with automated funding and configuration.

**Core Functionality:**
- **Wallet generation** - Creates manager and voter keypairs
- **SOL airdrop** - Requests devnet SOL
- **USDC funding guidance** - Provides Circle faucet instructions
- **Controlled multisig creation** - Sets up controlled multisig with Config Authority
- **Vault funding** - Deposits SOL and USDC to multisig vault
- **Voter Funding** - Sends 0.001 SOL to each voter for transaction fees

**Permission Structure:**
```typescript
const multisigConfig = {
  threshold: 2,                    // 2-of-3 approval required
  timeLock: 0,                    // No time delay for execution
  members: [
    {
      key: managerAddress,
      permissions: { mask: 7 },   // All permissions (PROPOSE + VOTE + EXECUTE)
    },
    {
      key: voter1Address,
      permissions: { mask: 2 },   // Vote permission only
    },
    {
      key: voter2Address,
      permissions: { mask: 2 },   // Vote permission only
    }
  ]
};
```

### ⚙️ Controlled Multisig Configuration (`config.ts`)

**Configuration Features:**
- **Direct management** - No voting required for config changes (Controlled Multisig only)
- **Member management** - Add/remove members with custom permissions
- **Spending limits** - Create and manage token spending limits
- **Rent collector** - Set account for rent collection
- **Interactive interface** - User-friendly configuration menu

**For Regular Multisigs (Non-Controlled):**
If your multisig is NOT controlled, these configuration changes would require a **Config Transaction** instead:
1. **Create Config Transaction** - Propose the configuration change
2. **Approve by Threshold** - Members vote to approve the change
3. **Execute Transaction** - Execute the approved configuration change

This follows the same lifecycle as payment proposals: **Propose → Approve → Execute**.

**Available Operations:**
```typescript
1. AddMember - Add new members with custom permissions
2. RemoveMember - Remove existing members
3. SetRentCollector - Configure rent collection
4. AddSpendingLimit - Create token spending limits
5. RemoveSpendingLimit - Remove spending limits
6. ViewInfo - Display current configuration
7. Exit - Exit the config tool
```

**Member Permission System:**
```typescript
// Permission bitmask system
const permissions = {
  mask: 7  // 0b111 = All permissions
  // Bit 0: Propose permission
  // Bit 1: Vote permission  
  // Bit 2: Execute permission
};

// Common permission combinations
const PROPOSE_ONLY = 1;  // 0b001
const VOTE_ONLY = 2;     // 0b010
const EXECUTE_ONLY = 4;  // 0b100
const ALL_PERMISSIONS = 7; // 0b111
```

**Spending Limit Creation:**
```typescript
const instruction = getMultisigAddSpendingLimitInstruction({
  multisig: address(multisigPda),
  configAuthority: signer,
  spendingLimit: address(spendingLimitPda),
  rentPayer: signer,
  systemProgram: address('11111111111111111111111111111111'),
  createKey: address(createKeyAddress),
  vaultIndex,
  mint: address(mint),
  amount,
  period,
  members: members.map(addr => address(addr)),
  destinations: destinations.map(addr => address(addr)),
  memo: memo || null
});
```

### 📊 Comprehensive Information Dashboard (`info.ts`)

Advanced multisig monitoring and analysis system.

**Dashboard Features:**
- **Real-time vault balances** - SOL and USDC holdings
- **Member analysis** - Permission breakdown and role identification
- **Transaction history** - Complete transaction lifecycle tracking
- **Status monitoring** - Active, approved, executed, rejected transactions

**Transaction Analysis:**
```typescript
// Comprehensive transaction status tracking
const transactions = await Promise.all(
  Array.from({ length: lastTransactionIndex }, (_, i) => 
    fetchTransactionInfo(multisigAddress, i + 1)
  )
);

// Status categorization
const activeTransactions = transactions.filter(tx => tx.status === 'Active' && !tx.isStale);
const approvedTransactions = transactions.filter(tx => tx.status === 'Approved' && !tx.isStale);
const executedTransactions = transactions.filter(tx => tx.status === 'Executed');
```

### 💸 Payment Proposal System (`propose.ts`)

Advanced payment proposal creation with automatic token account handling.

**Key Features:**
- **Dual token support** - SOL and USDC payment proposals
- **ATA creation** - Automatically creates recipient token accounts if needed
- **Transaction batching** - Combines ATA creation and transfer instructions
- **Comprehensive validation** - Checks balances and account existence

**SOL Transfer Implementation:**
```typescript
// Direct SOL transfer using SystemProgram
const transferInstruction = SystemProgram.transfer({
  fromPubkey: new PublicKey(vaultPda),
  toPubkey: new PublicKey(recipientAddress),
  lamports: transferAmount,
});
```

**USDC Transfer with ATA Creation:**
```typescript
// Check if recipient token account exists
const accountInfo = await solanaConnection.getAccountInfo(recipientTokenAccount);
if (!accountInfo) {
  // Create ATA instruction
  const createTokenAccountInstruction = createAssociatedTokenAccountInstruction(
    new PublicKey(vaultPda),        // payer
    recipientTokenAccount,          // ATA address
    new PublicKey(recipientAddress), // owner
    new PublicKey(USDC_MINT),       // mint
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );
  instructions.push(createTokenAccountInstruction);
}

// Add transfer instruction
const transferInstruction = createTransferInstruction(
  vaultTokenAccount,
  recipientTokenAccount,
  new PublicKey(vaultPda),
  transferAmount,
  [],
  TOKEN_PROGRAM_ID
);
```

**Transaction Flow:**
1. **Vault Transaction Creation** - Creates the actual transfer instruction
2. **Proposal Creation** - Makes the transaction available for voting
3. **Instruction Conversion** - Converts web3.js instructions to @solana/kit format
4. **Sign and Send** - Signs transaction and submits to network using utility function

### ✅ Approval Management (`approve.ts`)

Streamlined voting system for transaction approval.

**Core Features:**
- **Interactive member selection** - Choose which member votes
- **Transaction index handling** - Support for specific or latest transactions
- **Permission validation** - Ensures voter has voting rights
- **Real-time feedback** - Shows approval status and transaction details

**Approval Process:**
```typescript
// Create approval instruction codama utils
const approveInstruction = getProposalApproveInstruction({
  multisig: address(multisigPda),
  proposal: address(proposalPda),
  member: await createSignerFromKeyPair(voter),
  args: {
    memo: `Approved by ${voterAddress}`,
  },
});
```

**Voting Workflow:**
1. **Load multisig data** - Fetches current transaction index and member info
2. **Select transaction** - User chooses which transaction to approve
3. **Choose voter** - Select which member will cast the vote
4. **Sign and send** - Creates instruction, signs transaction and submits to network using utility function

### 🚀 Transaction Execution (`execute.ts`)

Execution of approved transactions with comprehensive validation.

**Execution Features:**
- **Pre-execution validation** - Checks approval status and permissions
- **Squads SDK integration** - Uses SDK for execution instructions
- **Instruction conversion** - Converts web3.js to @solana/kit format

**Execution Implementation:**
```typescript
// Create execution instruction using Squads SDK
const executeInstructionResult = await multisig.instructions.vaultTransactionExecute({
  connection: solanaConnection,
  multisigPda: new PublicKey(multisigPda),
  transactionIndex: transactionIndex,
  member: new PublicKey(executorAddress),
});

// Convert to @solana/kit format with @solana/compat
const vaultInstruction = fromLegacyTransactionInstruction(executeInstructionResult.instruction);
```

**Execution Workflow:**
1. **Load transaction data** - Fetches proposal and transaction PDAs
2. **Validate approvals** - Ensures sufficient votes for execution
3. **Check permissions** - Verifies executor has execution rights
4. **Execute transaction** - Creates instruction, signs and submits to network using utility function

### 🚫 Interactive Rejection System (`reject.ts`)

Advanced proposal rejection with member and proposal selection.

**Key Features:**
- **Active proposal detection** - Finds non-stale, active proposals
- **Interactive selection** - Choose specific proposals to reject
- **Member selection** - Pick which member signs the rejection
- **Status validation** - Only allows rejection of active/approved proposals

**Rejection Process:**
```typescript
// Find active proposals
const activeProposals = await getActiveProposals(multisigAddress);

// Filter for rejectable proposals
if (!isStale && (status === 'Active' || status === 'Approved')) {
  activeProposals.push({
    index: i,
    pda: proposalPda,
    status: status,
    approvedCount: proposalResult.data.approved.length,
    rejectedCount: proposalResult.data.rejected.length,
    cancelledCount: proposalResult.data.cancelled.length,
  });
}
```

**Rejection Workflow:**
1. **Scan proposals** - Finds all active proposals
2. **Display options** - Shows available proposals with vote counts
3. **Select proposal** - User chooses which to reject
4. **Choose member** - Select signing member
5. **Confirm action** - User confirms rejection
6. **Execute rejection** - Creates instruction, signs and submits rejection transaction using utility function

### ❌ Stale Proposal Cancellation (`cancel.ts`)

Automated cleanup of stale proposals to free up resources.

**Cancellation Features:**
- **Stale detection** - Identifies proposals below stale transaction index
- **Batch processing** - Handles multiple cancellations efficiently
- **Error resilience** - Continues processing even if individual cancellations fail
- **Progress tracking** - Shows cancellation status for each proposal

**Stale Detection Logic:**
```typescript
// Check if proposal is stale
const isStale = i < Number(multisigAccount.data.staleTransactionIndex || 0);

// Only cancel stale proposals
if (isStale) {
  proposalsToCancel.push({
    index: i,
    pda: proposalPda,
    status: 'Stale',
  });
}
```

**Cancellation Workflow:**
1. **Load multisig data** - Gets current and stale transaction indices
2. **Scan transactions** - Finds all stale proposals
3. **Batch cancellation** - Processes all stale proposals
4. **Error handling** - Continues on individual failures
5. **Progress reporting** - Shows results for each cancellation

### 🧹 Interactive Account Cleanup (`close.ts`)

Comprehensive transaction cleanup with interactive selection.

**Cleanup Features:**
- **Multi-status detection** - Finds stale, cancelled, executed, and rejected transactions
- **Interactive selection** - Choose specific transactions or close all
- **Member selection** - Pick which member signs close transactions
- **Rent recovery** - Reclaims SOL from closed accounts

**Closable Transaction Detection:**
```typescript
// Can close if: stale, cancelled, executed, or rejected
const canClose = isStale || 
                 status === 'Cancelled' || 
                 status === 'Executed' || 
                 status === 'Rejected';
```

**Cleanup Workflow:**
1. **Scan transactions** - Finds all closable transactions
2. **Display options** - Shows transaction status and details
3. **Select transactions** - User chooses which to close
4. **Choose member** - Select signing member
5. **Confirm action** - User confirms cleanup
6. **Execute cleanup** - Creates instruction, signs and submits close transaction using utility function

### 💰 Transfer to Treasury (`transfer.ts`)

Direct transfers to the multisig vault for funding operations.

**Transfer Features:**
- **SOL transfers** - Direct SOL deposits to multisig vault
- **USDC transfers** - Token transfers to vault's USDC account
- **Balance validation** - Ensures sufficient funds before transfer
- **Transaction confirmation** - Verifies successful transfers

**Transfer Implementation:**
```typescript
// SOL transfer to vault
const transferInstruction = SystemProgram.transfer({
  fromPubkey: new PublicKey(senderAddress),
  toPubkey: new PublicKey(vaultPda),
  lamports: transferAmount,
});

// USDC transfer to vault
const transferInstruction = createTransferInstruction(
  senderTokenAccount,
  vaultTokenAccount,
  new PublicKey(senderAddress),
  transferAmount,
  [],
  TOKEN_PROGRAM_ID
);
```

**Transfer Workflow:**
1. **Load vault data** - Fetches vault address and current balances
2. **Validate sender balance** - Ensures sufficient funds for transfer
3. **Create transfer instruction** - Generates appropriate transfer instruction
4. **Sign and send** - Signs transaction and submits to network using utility function
5. **Confirm transfer** - Verifies successful completion

### @solana/kit Integration

Unified API for all Solana operations:

```typescript
// Transaction preparation and sending with @solana/kit utility
const signature = await signAndSendTransaction(
  [instruction],
  [signer],
  payerAddress
);
```

```typescript
// PDA derivation for multisig operations
const [multisigPda] = await getMultisigPda(createKey);
const [vaultPda] = await getVaultPda(multisigPda, 0);
const [proposalPda] = await getProposalPda(multisigPda, transactionIndex);

// Permission-based multisig operations
const instruction = getProposalApproveInstruction({
  multisig: address(multisigPda),
  proposal: address(proposalPda),
  member: await createSignerFromKeyPair(voter),
  args: { memo: `Approved by ${voterAddress}` }
});
```

## 🛡️ Security Considerations

### Key Management
- **CryptoKeyPair-based** key management with proper entropy
- **Base64 encoding** for secure private key storage
- **Type-safe** key operations throughout the system

### Transaction Security
- **Comprehensive validation** before transaction submission
- **Permission-based** access control for all operations
- **Atomic operations** with proper rollback mechanisms

### Network Security
- **RPC endpoint validation** and connection monitoring
- **Transaction confirmation** with configurable commitment levels
- **Rate limiting** and retry mechanisms for RPC calls

## 🎯 Use Cases

### Treasury Management
- **Automated payroll** processing with multisig approval
- **Budget allocation** with spending limits and controls
- **Financial reporting** with transaction history tracking

### Governance Operations
- **Proposal creation** and voting mechanisms

### Program Upgrades
- **Code deployment** with multisig validation

## 🔗 Resources

- **[Squads v4 Documentation](https://v4-sdk-typedoc.vercel.app/)** - Complete SDK reference
- **[Solana Kit Documentation](https://solana-kit.com/)** - Modern Solana development
- **[Codama Documentation](https://codama.idl.dev/)** - IDL client generation

## ⚠️ Important Notes

**This system is designed for development and testing environments only.**

- ✅ Use devnet SOL and USDC from official faucets
- ✅ Never use mainnet keys or real funds with development keys
- ✅ Generated keypairs are for testing purposes only
- ✅ All operations are performed on Solana devnet

## 🤝 Contributing

This system demonstrates advanced Solana development patterns and can serve as a foundation for:
- **Enterprise multisig solutions**
- **Treasury management systems**
- **Governance platforms**
- **DeFi protocol integrations**