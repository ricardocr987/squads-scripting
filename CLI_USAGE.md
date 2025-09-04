# Squads Multisig Scripting CLI

A unified command-line interface for managing Squads multisig operations on Solana.

## Quick Start

```bash
# Run the CLI
bun run cli

# Or run individual scripts
bun run start    # Setup and initialize
bun run info     # View multisig information
bun run propose  # Create payment proposals
bun run approve  # Vote on proposals
bun run execute  # Execute approved transactions
```

## First Time Setup

When you run the CLI for the first time, it will automatically:

1. **Generate Wallets**: Create Manager and Voter wallets
   - **Manager**: Can propose, vote, and execute (full permissions)
   - **Voter1**: Can only vote
   - **Voter2**: Can only vote

2. **Create Multisig**: Set up a multisig with:
   - 3 members total
   - Threshold of 2 votes required
   - Proper permission structure

3. **Save Configuration**: Store all wallet keys and multisig address in `config.json`

## Available Commands

### 🚀 Setup & Initialize
- **Purpose**: Create multisig, generate wallets, and set up the system
- **When to use**: First time setup (automatically run by CLI)
- **Requirements**: None

### 📊 View Information
- **Purpose**: Display multisig status, members, and transaction details
- **When to use**: Check multisig state, view transaction history
- **Requirements**: Existing configuration

### 💸 Create Payment Proposal
- **Purpose**: Propose a USDC payment transaction for multisig approval
- **When to use**: When you want to send USDC from the multisig
- **Requirements**: Manager wallet (can propose)

### ✅ Approve Transaction
- **Purpose**: Vote to approve a pending transaction proposal
- **When to use**: When a proposal needs your vote
- **Requirements**: Manager or Voter wallet (can vote)

### 🚀 Execute Transaction
- **Purpose**: Execute an approved transaction
- **When to use**: After a transaction has been approved
- **Requirements**: Manager wallet (can execute)

### 💰 Transfer to Treasury
- **Purpose**: Transfer SOL or USDC to the config treasury
- **When to use**: When you need to fund the system
- **Requirements**: Manager wallet

### 🧹 Cleanup Transactions
- **Purpose**: Close stale or cancelled transactions to reclaim rent
- **When to use**: Periodic maintenance
- **Requirements**: Manager wallet

### ⚙️ Manage Multisig Config
- **Purpose**: Create and execute multisig configuration changes
- **When to use**: When you need to modify multisig settings
- **Requirements**: Manager wallet

## Wallet Structure

The system uses a 3-wallet structure:

- **Manager** (`manager`): Full permissions (propose, vote, execute)
- **Voter1** (`voter1`): Vote-only permissions
- **Voter2** (`voter2`): Vote-only permissions

## Configuration

All settings are stored in `config.json`:
- Wallet private keys (base64 encoded)
- Public key addresses
- Multisig address

## Security Notes

- Private keys are stored in base64 format in `config.json`
- Keep `config.json` secure and never commit it to version control
- This is designed for Devnet usage only

## Troubleshooting

### "Configuration not found"
- Run the CLI and it will automatically set up the system
- Or run `bun run start` manually

### "Insufficient SOL balance"
- Send SOL to the Manager wallet for transaction fees
- Use a Solana faucet for Devnet SOL

### "Transaction failed"
- Check the transaction logs for detailed error information
- Ensure you have sufficient SOL for transaction fees
- Verify the multisig has the required permissions

## Development

The CLI is built with:
- **Bun**: Runtime and package manager
- **@solana/kit**: Solana utilities
- **Squads SDK**: Multisig operations
- **TypeScript**: Type safety

## Network

- **Default**: Solana Devnet
- **RPC**: Configured in `src/utils/rpc.ts`
- **USDC Mint**: Devnet USDC mint address
