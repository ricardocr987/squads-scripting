#!/usr/bin/env bun
/**
 * Squads Scripting CLI - Main Entry Point
 * Provides a unified interface to interact with all Squads multisig scripts
 */

import { prompt } from './utils/prompt';
import { checkConfigExists } from './utils/config';

// Import all script main functions
import { main as startMain } from './start';
import { main as proposeMain } from './propose';
import { main as approveMain } from './approve';
import { main as executeMain } from './execute';
import { main as transferMain } from './transfer';
import { main as closeMain } from './close';
import { main as rejectMain } from './reject';
import { main as cancelMain } from './cancel';
import { main as infoMain } from './info';
import { main as configMain } from './config';

interface ScriptOption {
  id: string;
  name: string;
  description: string;
  requiresConfig: boolean;
  function: () => Promise<void>;
}

const scripts: ScriptOption[] = [
  {
    id: 'config',
    name: '⚙️  Manage Multisig Config',
    description: 'Create and execute multisig configuration changes',
    requiresConfig: true,
    function: configMain
  },
  {
    id: 'info',
    name: '📊 View Information',
    description: 'Display multisig status, members, and transaction details',
    requiresConfig: true,
    function: infoMain
  },
  {
    id: 'propose',
    name: '💸 Create Payment Proposal',
    description: 'Propose a SOL or USDC payment transaction for multisig approval',
    requiresConfig: true,
    function: proposeMain
  },
  {
    id: 'approve',
    name: '✅ Approve Transaction',
    description: 'Vote to approve a pending transaction proposal',
    requiresConfig: true,
    function: approveMain
  },
  {
    id: 'execute',
    name: '🚀 Execute Transaction',
    description: 'Execute an approved transaction',
    requiresConfig: true,
    function: executeMain
  },
  {
    id: 'reject',
    name: '🚫 Reject Proposals',
    description: 'Reject active proposals',
    requiresConfig: true,
    function: rejectMain
  },
  {
    id: 'cancel',
    name: '❌ Cancel Proposals',
    description: 'Cancel stale proposals',
    requiresConfig: true,
    function: cancelMain
  },
  {
    id: 'close',
    name: '🧹 Cleanup Transactions',
    description: 'Close stale or cancelled transactions to reclaim rent',
    requiresConfig: true,
    function: closeMain
  },
  {
    id: 'transfer',
    name: '💰 Transfer to Treasury',
    description: 'Transfer SOL or USDC to the multisig vault',
    requiresConfig: true,
    function: transferMain
  }
];

function displayWelcome() {
  console.log('🎯 Squads Multisig Scripting CLI');
  console.log('================================\n');
  console.log('This CLI provides access to all Squads multisig operations:');
  console.log('• Setup and initialization');
  console.log('• Transaction proposals and voting');
  console.log('• Execution and management');
  console.log('• Information and monitoring\n');
}

function displayMenu() {
  console.log('📋 Available Commands:');
  console.log('======================\n');
  
  scripts.forEach((script, index) => {
    const configStatus = script.requiresConfig ? '🔒' : '🔓';
    console.log(`${index + 1}. ${script.name} ${configStatus}`);
    console.log(`   ${script.description}\n`);
  });
  
  console.log('0. Exit\n');
}

async function checkPrerequisites(script: ScriptOption): Promise<boolean> {
  if (!script.requiresConfig) {
    return true;
  }
  
  const configExists = await checkConfigExists();
  if (!configExists) {
    console.log('❌ Configuration not found!');
    console.log('💡 Please run the "Setup & Initialize" command first to create the multisig and wallets.');
    console.log('');
    return false;
  }
  
  return true;
}

async function runScript(script: ScriptOption) {
  try {
    console.log(`\n🔄 Running: ${script.name}`);
    console.log('='.repeat(50));
    
    await script.function();
    
  } catch (error) {
    console.error('\n❌ Script failed:', error);
    if (error && typeof error === 'object' && 'logs' in error) {
      console.error('Transaction logs:', (error as any).logs);
    }
    // Don't throw - let the CLI continue running
    console.log('⚠️  Continuing with CLI...');
  }
}

async function ensureSetupComplete(): Promise<boolean> {
  const configExists = await checkConfigExists();
  
  if (!configExists) {
    console.log('🔧 Initial Setup Required');
    console.log('=========================\n');
    console.log('No configuration found. The system needs to be set up first.');
    console.log('This will:');
    console.log('• Generate Manager and Voter wallets');
    console.log('• Create a multisig with proper permissions');
    console.log('• Set up the configuration file\n');
    
    console.log('🚀 Proceeding with initial setup...');
    
    console.log('\n🚀 Running initial setup...');
    console.log('='.repeat(50));
    
    try {
      await startMain();
      console.log('\n✅ Initial setup completed successfully!');
      console.log('🎉 You can now use all CLI commands.\n');
      return true;
    } catch (error) {
      console.error('\n❌ Setup failed:', error);
      if (error && typeof error === 'object' && 'logs' in error) {
        console.error('Transaction logs:', (error as any).logs);
      }
      return false;
    }
  }
  
  return true;
}

async function main() {
  try {
    displayWelcome();
    
    // Ensure setup is complete before showing menu
    const setupComplete = await ensureSetupComplete();
    if (!setupComplete) {
      console.log('❌ Cannot proceed without proper setup.');
      process.exit(1);
    }
    
    while (true) {
      displayMenu();
      
      const choice = await prompt('Select a command (0-8): ');
      const choiceNum = parseInt(choice);
      
      if (choiceNum === 0) {
        console.log('\n👋 Goodbye!');
        process.exit(0);
      }
      
      if (choiceNum < 1 || choiceNum > scripts.length) {
        console.log(`❌ Invalid choice. Please select a number between 0 and ${scripts.length}.\n`);
        continue;
      }
      
      const selectedScript = scripts[choiceNum - 1];
      if (!selectedScript) {
        console.log('❌ Invalid script selection.\n');
        continue;
      }
      
      // Check prerequisites (should always pass now since setup is complete)
      const canRun = await checkPrerequisites(selectedScript);
      if (!canRun) {
        continue;
      }
      
      // Run the script immediately without confirmation
      await runScript(selectedScript);
      
      // Auto-print menu after script execution
      console.log('\n' + '='.repeat(60) + '\n');
    }
    
  } catch (error) {
    console.error('❌ CLI Error:', error);
    process.exit(1);
  }
}

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n\n👋 Goodbye!');
  process.exit(0);
});

// Run the CLI
if (import.meta.main) {
  main();
}

export { main as cliMain };
