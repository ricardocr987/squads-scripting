# Advanced Squads Multisig Management System

TypeScript CLI for managing Squads multisig operations, built with development tools including Bun and @solana/kit

This system provides a complete lifecycle management solution for multisig transactions: 

**Initialize multisig → Propose → Approve → Execute → Cleanup**

## 🏗️ Architecture & Technology Stack

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

### Core Technologies

**Squads program**:
- **Programmable permissions** with granular access control (propose, vote, execute)
- **Proposal lifecycle** with configurable thresholds and time locks with configurable thresholds, time locks, and comprehensive status tracking (Draft → Active → Approved/Rejected → Executed/Cancelled)

**@solana/kit**
- **Type-safe RPC interactions** with full TypeScript support for reading/writing blockchain data, transaction simulation, and real-time subscriptions with compile-time validation and comprehensive Solana RPC method coverage
- **Transaction building and confirmation** compute unit estimation for reliable blockchain operations including both send-only and send-and-confirm patterns with customizable confirmation strategies.
- **CryptoKey** Kit leverages JavaScript's Web Crypto API primitives for cryptography, keeping apps lightweight while providing native runtime security and performance

**Codama**:
- **Automated IDL parsing** from Anchor program definitions
- **Type-safe client generation** to build program instructions

## 🚀 Quick Start

### Prerequisites

**Bun** - High-performance JavaScript runtime (https://bun.com/docs/installation)

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

## 📋 CLI Documentation

### 🎯 Entrypoint (`index.ts`)

The central command-line interface that orchestrates all multisig operations.

**Key Features:**
- **Auto-setup detection** - Automatically runs initialization if no config.json exists
- **Interactive menu** - User-friendly command selection

**Menu Structure:**
```typescript
1. ⚙️ Manage Multisig Config     // Controlled multisig instructions
2. 📊 View Information           // Comprehensive dashboard
3. 💸 Create Payment Proposal    // Transaction proposals
4. ✅ Approve Transaction        // Voting system
5. 🚀 Execute Transaction        // Transaction execution
6. 🚫 Reject Proposals          // Proposal rejection
7. ❌ Cancel Proposals          // Stale proposal cleanup
8. 🧹 Cleanup Transactions      // Account cleanup
9. 💰 Transfer to Treasury      // Direct vault funding
```

### 🚀 System Initialization (`start.ts`)

Squads multisig setup with automated funding and configuration.

**Core Functionality:**
- **Keypairs generation** - Creates manager and voter keypairs
- **SOL airdrop** - Requests devnet SOL
- **USDC funding guidance** - Provides Circle faucet instructions
- **Controlled multisig creation** - Sets up controlled multisig with Config Authority
- **Vault funding** - Deposits SOL and USDC to multisig vault
- **Voter Funding** - Sends 0.001 SOL to each voter for transaction fees

**Configuration Structure:**
```typescript
const multisigConfig = {
  threshold: 2, // Minimum number of votes required for proposal approval (2-of-3 approval required)
  timeLock: 0, // Delay in seconds before approved transactions can be executed (0 = immediate)
  createKey: await createSignerFromKeyPair(ephemeralKeypair), // Ephemeral key for PDA derivation (must be unique and used only once)
  creator: await createSignerFromKeyPair(manager), // Creator/fee payer of the multisig account
  configAuthority: address(managerAddress), // Authority that can modify multisig configuration (null = non-controlled multisig)
  rentCollector: address(managerAddress), // Account that receives reclaimed rent from closed accounts (null = creator receives rent)
  members: [
    {
      key: managerAddress,
      permissions: { mask: 7 }, // All permissions (1+2+4 = PROPOSE + VOTE + EXECUTE)
    },
    {
      key: voter1Address,
      permissions: { mask: 2 }, // Vote permission only (can approve/reject proposals)
    },
    {
      key: voter2Address,
      permissions: { mask: 2 }, // Vote permission only (can approve/reject proposals)
    }
  ]
};
```

**Permission Mask Breakdown:**

- 1 = PROPOSE (can create new transaction proposals)
- 2 = VOTE (can approve/reject existing proposals)
- 4 = EXECUTE (can execute approved transactions)
- 7 = ALL (1+2+4 = can propose, vote, and execute)

**Transaction building:**
```typescript
// Prepare the isntruction with codama generated utils
const multisigCreateInstruction = getMultisigCreateV2Instruction(multisigConfig);

// Send and confirm transaction using solana/kit utilities
const transaction = await prepareTransaction([multisigCreateInstruction], feePayer);
const signedTransaction = await signTransaction(signers, transaction);
const wireTransaction = getBase64EncodedWireTransaction(signedTransaction);
await sendTransaction(wireTransaction);
```

### ⚙️ Controlled Multisig Configuration (`config.ts`)

**Configuration Actions:**
- **Direct management** - No voting required for config changes (Controlled Multisig only)
- **Member management** - Add/remove members with custom permissions
- **Spending limits** - Create and manage token spending limits

**Execute config transaction with controlled multisig:**
```typescript
const managerAddress = await getAddressFromPublicKey(manager.publicKey);
const signer = await createSignerFromKeyPair(manager);

const memberArgs: MemberArgs = {
  key: address(newMemberAddress),
  permissions: { mask: permissions }
};

const instruction = getMultisigAddMemberInstruction({
  multisig: address(multisigPda),
  configAuthority: signer,
  rentPayer: signer,
  systemProgram: address('11111111111111111111111111111111'),
  newMember: memberArgs,
  memo: memo || null
});

console.log(`📋 Adding member: ${newMemberAddress}`);
console.log(`🔑 Permissions: ${permissions} (0b${permissions.toString(2).padStart(3, '0')})`);

const signature = await signAndSendTransaction(
  [instruction],
  [manager],
  managerAddress
);
```
**For Regular Multisigs (Non-Controlled):**
These configuration changes would require a **Config Transaction** instead:
1. **Create Config Transaction** - Propose the configuration change
2. **Approve by Threshold** - Members vote to approve the change
3. **Execute Transaction** - Execute the approved configuration change

This follows the same lifecycle as payment proposals: **Propose → Approve → Execute**.

### 📊 Information Dashboard (`info.ts`)

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

**Transaction Flow:**
1. **Vault Transaction Creation** Creates the actual transfer instruction using Squads SDK, propose arbitrary Solana program instructions through your multisig
2. **Proposal Creation** Makes the transaction available for voting using Codama-generated instructions, enables consensus and execution through one-to-one mapping with transaction indices

Technical Note: The transaction message could not be serialized properly with Codama-generated utils, so the Squads SDK (@sqds/multisig) is used for vault transaction creation. The instruction is then converted from web3js TransactionInstruction to the correct solana/kit data structure using `fromLegacyTransactionInstruction` from `@solana/compat`.


**Instruction Conversion Pattern:**
```typescript
// Squads SDK returns web3.js TransactionInstruction
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

// Convert to @solana/kit format for unified handling
const vaultInstruction = fromLegacyTransactionInstruction(vaultTransaction);

// Use with @solana/kit transaction utilities
const signature = await signAndSendTransaction(
  [vaultInstruction as Instruction<string>],
  [proposer],
  proposerAddress
);
```

### ✅ Approval Management (`approve.ts`)

**Core Features:**
- **Load multisig data** - Fetches current transaction index and member info
- **Interactive member selection** - Choose which member votes
- **Transaction index handling** - Support for specific or latest transactions
- **Permission validation** - Ensures voter has voting rights

**Approval Process:**
```typescript
// Create approval instruction
const approveInstruction = getProposalApproveInstruction({
  multisig: address(multisigPda),
  proposal: address(proposalPda),
  member: await createSignerFromKeyPair(voter),
  args: {
    memo: `Approved by ${voterAddress}`,
  },
});

// Use with @solana/kit transaction utilities
const signature = await signAndSendTransaction(
  [vaultInstruction as Instruction<string>],
  [proposer],
  proposerAddress
);
```

### 🚀 Transaction Execution (`execute.ts`)

**Execution Features:**
- **Pre-execution validation** - Checks approval status and permissions

**Execution Implementation:**
```typescript
// Create execution instruction using Squads SDK (returns web3.js format)
const executeInstructionResult = await multisig.instructions.vaultTransactionExecute({
  connection: solanaConnection,
  multisigPda: new PublicKey(multisigPda),
  transactionIndex: transactionIndex,
  member: new PublicKey(executorAddress),
});

// Convert to @solana/kit format using @solana/compat
const vaultInstruction = fromLegacyTransactionInstruction(executeInstructionResult.instruction);

// Use unified @solana/kit transaction handling
const signature = await signAndSendTransaction(
  [vaultInstruction as Instruction<string>],
  [executor],
  executorAddress
);
```

### ❌ Stale Proposal Cancellation (`cancel.ts`)

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
