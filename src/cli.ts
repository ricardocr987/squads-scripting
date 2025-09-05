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
    id: 'start',
    name: '🚀 Setup & Initialize',
    description: 'Create multisig, generate wallets, and set up the system',
    requiresConfig: false,
    function: startMain
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
    id: 'transfer',
    name: '💰 Transfer to Treasury',
    description: 'Transfer SOL or USDC to the config treasury',
    requiresConfig: true,
    function: transferMain
  },
  {
    id: 'close',
    name: '🧹 Cleanup Transactions',
    description: 'Close stale or cancelled transactions to reclaim rent',
    requiresConfig: true,
    function: closeMain
  },
  {
    id: 'config',
    name: '⚙️  Manage Multisig Config',
    description: 'Create and execute multisig configuration changes',
    requiresConfig: true,
    function: configMain
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
    
    console.log('\n✅ Script completed successfully!');
  } catch (error) {
    console.error('\n❌ Script failed:', error);
    if (error && typeof error === 'object' && 'logs' in error) {
      console.error('Transaction logs:', (error as any).logs);
    }
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
    
    const proceed = await prompt('Proceed with initial setup? (y/n): ');
    if (proceed.toLowerCase() !== 'y') {
      console.log('❌ Setup cancelled. Cannot proceed without configuration.');
      return false;
    }
    
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
        console.log('❌ Invalid choice. Please select a number between 0 and 8.\n');
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
      
      // Confirm execution
      const confirm = await prompt(`\nRun "${selectedScript.name}"? (y/n): `);
      if (confirm.toLowerCase() !== 'y') {
        console.log('❌ Command cancelled.\n');
        continue;
      }
      
      // Run the script
      await runScript(selectedScript);
      
      // Ask if user wants to continue
      const continueChoice = await prompt('\nReturn to main menu? (y/n): ');
      if (continueChoice.toLowerCase() !== 'y') {
        console.log('\n👋 Goodbye!');
        process.exit(0);
      }
      
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
