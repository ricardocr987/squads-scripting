# How to Use Squads Multisig Wallets with Solana Kit

Multisig wallets are essential for secure fund management in the crypto ecosystem. Squads v4 provides a powerful multisig solution on Solana, but integrating it with modern development tools can be challenging. This guide walks you through building a complete multisig management system using Squads with Solana Kit, demonstrating how to create, manage, and execute multisig transactions in a type-safe environment.

You'll build a full-featured CLI application that handles the entire multisig lifecycle: initialization, member management, proposal creation, voting, and execution. Learn how to leverage Solana Kit's modern APIs alongside Squads' powerful multisig capabilities to create a robust treasury management system.

## Prerequisites

Before diving into this tutorial, you should have:

- **Basic understanding of Solana development** - Familiarity with accounts, programs and transactions
- **TypeScript knowledge** - The codebase is written in TypeScript with type safety
- **Bun installed** - We'll use Bun as our runtime for its performance (https://bun.com/docs/installation)
- **A Solana devnet RPC endpoint** - We'll be working exclusively on devnet for development purposes
- **Understanding of multisig concepts** - What multisig wallets are and why they're important

## Resources

- [Squads Documentation](https://docs.squads.so/main) - Main Squads documentation
- [Squads v4 SDK](https://v4-sdk-typedoc.vercel.app/) - Complete SDK reference
- [Solana Kit Documentation](https://solana-kit.com/) - Modern Solana development tools
- [Codama Documentation](https://codama.idl.dev/) - IDL client generation

## Setting Up the Development Environment

Let's start by setting up our development environment and understanding the project structure.

### Installation and Configuration

First, clone the repository and install dependencies:

```bash
git clone https://github.com/ricardocr987/squads-scripting
cd squads-scripting
bun install
```

Next, configure your environment:

```bash
cp env.example .env
```

Edit the `.env` file to include your RPC endpoint:

```env
RPC_URL=https://api.devnet.solana.com
```

### Understanding the Architecture

The system is built around a modular architecture that separates concerns

```typescript
// The core components work together to provide a complete multisig management solution:
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
// The `utils/` directory contains specialized modules that abstract complex operations:
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

This architecture ensures that each component has a single responsibility while maintaining clean interfaces between modules.

## Core Technologies and Their Integration

### Solana Kit: Modern Solana Development

Solana Kit represents the next generation of Solana development tools, the key advantages of Solana Kit include:

- **Type-Safe RPC Interactions:** Every RPC call is fully typed with Solana RPC method coverage, catching errors at compile time rather than runtime. This includes reading/writing blockchain data, transaction simulation, and real-time subscriptions.

- **Unified Transaction Handling:** Solana Kit provides a consistent interface for both transaction building and confirmation, including compute budget estimation for reliable blockchain operations.

- **Web Crypto API:** By leveraging native browser and Node.js crypto primitives, Solana Kit keeps applications lightweight while maintaining security and performance. This approach provides native runtime security without external dependencies.

### Squads v4: Advanced Multisig Capabilities

Squads v4 supports programmable permissions with granular access control, configurable time locks and comprehensive proposal lifecycle management with detailed status tracking.

**Permission System:** Squads uses a bitmask system for permissions, allowing granular control over member capabilities:
- `1` = PROPOSE (can create new transaction proposals)
- `2` = VOTE (can approve/reject existing proposals)  
- `4` = EXECUTE (can execute approved transactions)
- `7` = ALL (combination of all permissions)

**Proposal Lifecycle:** Proposals are configured with thresholds and time locks providing additional security layers and follow a structured lifecycle from: **Draft → Active → Approved/Rejected → Executed/Cancelled**

### Codama: Automated Client Generation

Codama automatically generates type-safe clients from Anchor program IDLs, eliminating the need for manual instruction building. This is particularly valuable when working with complex programs like Squads that have numerous instruction variants.

## Building the Multisig System

### Step 1: Multisig Initialization

The initialization process sets up a controlled multisig with proper permissions and funding. Let's examine how this works:

```typescript
const multisigConfig = {
  threshold: 2, // 2-of-3 approval required
  timeLock: 0, // No delay before execution
  createKey: await createSignerFromKeyPair(ephemeralKeypair),// Ephemeral key for PDA derivation (must be unique and used only once)
  creator: await createSignerFromKeyPair(manager), // Creator/fee payer of the multisig account
  configAuthority: address(managerAddress), // Enables direct config changes
  rentCollector: address(managerAddress), // Account that receives reclaimed rent from closed accounts (null = creator receives rent)
  members: [
    {
      key: managerAddress,
      permissions: { mask: 7 }, // Full permissions
    },
    {
      key: voter1Address,
      permissions: { mask: 2 }, // Vote only
    },
    {
      key: voter2Address,
      permissions: { mask: 2 }, // Vote only
    }
  ]
};
```

This configuration creates a 2-of-3 multisig where the manager has full control, while the two voters can only approve or reject proposals. The `configAuthority` field enables direct configuration changes without requiring voting, which is useful for admin tasks.

The initialization process handles several critical tasks:

- **Keypair Generation:** Creates secure keypairs for all participants using Web Crypto API primitives.

  **Security Warning:** The `extractable: true` parameter and file-based storage are used here for development simplicity. More [info](https://solana.stackexchange.com/questions/17378/how-to-generate-and-save-a-keypair-with-solana-kit-solana-web3-js-v2)
  
```typescript
const keypair = await crypto.subtle.generateKey(
  'Ed25519',
  true, // extractable = true to allow exporting private key
  ['sign', 'verify']
);
```

- **Devnet Funding:** Automatically requests SOL airdrops and provides guidance for USDC funding through Circle's faucet.

```typescript
const LAMPORTS_PER_SOL = 1_000_000_000;
const airdropAmount = BigInt(2 * LAMPORTS_PER_SOL)); // 2 SOL from faucet
const signature = await rpc.requestAirdrop(address(manager), lamports(airdropAmount).send();
```

- **Vault Setup:** Deposits initial funds into the multisig vault and distributes SOL to voters for transaction fees.

```typescript
// Get vault PDA (index 0)
const [vaultPda] = await getVaultPda(multisigPda, 0);
// Create SOL transfer instruction to vault
const transferAmount = BigInt(0.01 * LAMPORTS_PER_SOL); // 0.01 SOL in lamports
const signer = await createSignerFromKeyPair(sender);
const transferIxns = await transferInstruction(signer, transferAmount, SOL_MINT, vaultPda):
const signature = await signAndSendTransaction(transferIxns, [sender], senderAddress);
```

- **Transaction Building:** Uses Codama-generated instructions with Solana Kit's transaction utilities:

```typescript
// Prepare the isntruction with codama generated utils
const multisigCreateInstruction = getMultisigCreateV2Instruction(multisigConfig);
// Send and confirm transaction using solana/kit utilities
const transaction = await prepareTransaction([multisigCreateInstruction], feePayer);
const signedTransaction = await signTransaction(signers, transaction);
const wireTransaction = getBase64EncodedWireTransaction(signedTransaction);
await sendTransaction(wireTransaction);
```

### Step 2: Creating Payment Proposals

The proposal system demonstrates one of the most interesting aspects of this integration: combining Squads SDK with Solana Kit. Due to serialization complexities with Codama-generated utilities, the Squads SDK is used for vault transaction creation, converting the result to Solana Kit data structure format. Here's how the proposal creation works:

```typescript
// Create transfer instruction using Squads SDK
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
// Convert to Solana Kit format
const vaultInstruction = fromLegacyTransactionInstruction(vaultTransaction);
// Use unified transaction handling with solana/kit utilities
const signature = await signAndSendTransaction([vaultInstruction], [proposer], proposerAddress);
```

This pattern demonstrates how to bridge different Solana libraries while maintaining type safety and consistency. The `fromLegacyTransactionInstruction` function from `@solana/compat` handles the conversion.

### Step 3: The Voting Process

Voting on a proposed transaction requires loading multisig data, validating member permissions, and following the standard transaction pattern: prepare, sign, send, and confirm.

```typescript
const approveInstruction = getProposalApproveInstruction({
  multisig: address(multisigPda),
  proposal: address(proposalPda),
  member: await createSignerFromKeyPair(voter),
  args: {
    memo: `Approved by ${voterAddress}`,
  },
});
const signature = await signAndSendTransaction([approveInstruction], [voter], voterAddress);
```

### Step 4: Transaction Execution

The execution phase is the final step in the multisig process, where approved transactions are submitted to the Solana network. This requires careful validation to ensure the transaction has received sufficient approvals and the executor has the necessary permissions. The execution process follows the same pattern as other operations - prepare, sign, and submit to the network:

```typescript
const executeInstructionResult = await multisig.instructions.vaultTransactionExecute({
  connection: solanaConnection,
  multisigPda: new PublicKey(multisigPda),
  transactionIndex: transactionIndex,
  member: new PublicKey(executorAddress),
});
const vaultInstruction = fromLegacyTransactionInstruction(executeInstructionResult.instruction);
const signature = await signAndSendTransaction([vaultInstruction], [executor], executorAddress);
```

## Advanced Features and Management

### Configuration Management

Squads supports two types of multisig configurations: controlled and non-controlled. Controlled multisigs allow direct configuration changes without voting, while non-controlled multisigs require the full proposal lifecycle for any changes.

For controlled multisigs, configuration changes are straightforward:

```typescript
const memberArgs: MemberArgs = {
  key: address(newMemberAddress),
  permissions: { mask: permissions }
};
const instruction = getMultisigAddMemberInstruction({
  multisig: address(multisigPda),
  configAuthority: signer,
  rentPayer: signer,
  systemProgram: SYSTEM_PROGRAM_ADDRESS,
  newMember: memberArgs,
  memo: memo || null
});
// Use with @solana/kit transaction utilities
const signature = await signAndSendTransaction([instruction], [proposer], proposerAddress);
```

For non-controlled multisigs, configuration changes would require a **Config Transaction** instead, this follows the same lifecycle as payment proposals: **Propose → Approve → Execute**, ensuring democratic governance of the multisig itself.

### Information Dashboard

The information system provides comprehensive visibility into multisig operations, real-time vault balances, member analysis, and complete transaction history, making it easy to monitor multisig health and activity:

```typescript
const transactions = await Promise.all(
  Array.from({ length: lastTransactionIndex }, (_, i) => 
    fetchTransactionInfo(multisigAddress, i + 1)
  )
);
const activeTransactions = transactions.filter(tx => tx.status === 'Active' && !tx.isStale);
const approvedTransactions = transactions.filter(tx => tx.status === 'Approved' && !tx.isStale);
const executedTransactions = transactions.filter(tx => tx.status === 'Executed');
```

### Stale Proposal Management

The system includes stale proposal detection and cleanup to maintain multisig efficiency. Stale proposals can be safely closed to recover rent:

```typescript
// Identify transactions that can be safely closed to recover rent
async function getClosableTransactions(multisigAddress: string) {
  const multisigAccount = await fetchMultisig(rpc, address(multisigAddress));
  const closableTransactions = [];

  // Iterate through all transactions in the multisig
  for (let i = 1; i <= Number(multisigAccount.data.transactionIndex); i++) {
    const [transactionPda] = await getVaultTransactionPda(multisigAddress, BigInt(i));
    const [proposalPda] = await getProposalPda(multisigAddress, BigInt(i));
    // Fetch both vault transaction and proposal data in parallel
    const [vaultTransactionResult, proposalResult] = await Promise.allSettled([
      fetchMaybeVaultTransaction(rpc, address(transactionPda)),
      fetchMaybeProposal(rpc, address(proposalPda))
    ]);
    const vaultTransaction = vaultTransactionResult.status === 'fulfilled' ? vaultTransactionResult.value : null;
    const proposal = proposalResult.status === 'fulfilled' ? proposalResult.value : null;
    // Skip if vault transaction doesn't exist
    if (!vaultTransaction || !vaultTransaction.exists) continue;
    
    const isStale = i <= Number(multisigAccount.data.staleTransactionIndex || 0);
    let status = 'Unknown';
    if (proposal && proposal.exists) {
      status = proposal.data.status.__kind;
      // Can close if: stale, cancelled, executed, or rejected
      if (isStale || status === 'Cancelled' || status === 'Executed' || status === 'Rejected') {
        closableTransactions.push({
          index: i,
          pda: transactionPda,
          proposalPda: proposalPda,
          status: status,
        });
      }
    }
  }

  return closableTransactions;
}

// Execute cleanup for all closable transactions
const closableTransactions = await getClosableTransactions(multisigAddress);
for (const tx of closableTransactions) {
  const closeInstruction = getVaultTransactionAccountsCloseInstruction({
    multisig: address(multisigAddress),
    proposal: address(tx.proposalPda),
    transaction: address(tx.pda),
    rentCollector: address(signerAddress),
  });

  // Use @solana/kit for transaction execution
  const signature = await signAndSendTransaction(
    [closeInstruction],
    [executor],
    signerAddress
  );
}
```

## Running the Complete System

### Interactive CLI

The system includes a comprehensive CLI that guides users through all operations with intelligent auto-setup detection. If no configuration exists, the system automatically runs initialization to get you started quickly.

```bash
bun run start
```

The CLI provides an intuitive menu system with user-friendly command selection:

1. **⚙️ Manage Multisig Config** - Direct configuration changes for controlled multisigs
2. **📊 View Information** - Comprehensive dashboard with real-time data
3. **💸 Create Payment Proposal** - Propose new transactions
4. **✅ Approve Transaction** - Vote on pending proposals
5. **🚀 Execute Transaction** - Execute approved transactions
6. **🚫 Reject Proposals** - Reject unwanted proposals
7. **❌ Cancel Proposals** - Clean up stale proposals
8. **🧹 Cleanup Transactions** - Recover rent from closed accounts
9. **💰 Transfer to Treasury** - Direct vault funding

### Individual Script Execution

You can also run individual components:

```bash
bun run src/start.ts    # Initialize multisig
bun run src/propose.ts  # Create payment proposal
bun run src/approve.ts  # Approve transaction
bun run src/execute.ts  # Execute transaction
```

## Real-World Applications

This multisig system serves as a foundation for various enterprise applications:

**Treasury Management:** Automated payroll processing with multisig approval, budget allocation with spending limits and controls, and comprehensive financial reporting with transaction history tracking.

**Governance Operations:** Proposal creation and voting mechanisms for decentralized organizations, enabling democratic decision-making processes.

**Program Upgrades:** Code deployment with multisig validation for critical protocol updates, ensuring secure and controlled software releases.

## Security Considerations

**This system is designed exclusively for development and testing environments.**

When working with real funds, follow these critical security guidelines:

- **Never use mainnet keys or real funds with development keys** - Keep development and production environments completely separate
- Always use **tested code** and thoroughly **audit** all operations
- Implement additional security measures like **hardware wallet** integration
- Consider using **time locks** for additional security layers
- **Monitor** for suspicious activity

## Conclusion

This tutorial has demonstrated how to build a comprehensive multisig management system using Squads v4 and Solana Kit. The integration showcases how modern Solana development tools can work together to create robust, type-safe applications that handle complex blockchain operations.

The patterns demonstrated here can be extended to build more sophisticated treasury management systems, governance platforms, and DeFi protocol integrations.

For further exploration, consider implementing hardware wallet integration, advanced spending limits, or integration with other Solana programs. The foundation provided here makes these extensions straightforward while maintaining the security and reliability that multisig systems require.
