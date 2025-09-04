// From https://solana.stackexchange.com/questions/16703/can-anchor-client-be-used-with-solana-web3-js-2-0rc
import { createFromRoot } from "codama";
import { rootNodeFromAnchor } from "@codama/nodes-from-anchor";
import { renderVisitor } from "@codama/renderers-js";
import path from "path";
import { promises as fs } from "fs";

// Load the Squads IDL from JSON file
const loadSquadsIDL = async () => {
  console.log('🔧 Loading Squads IDL from JSON file...');
  const idlPath = path.join(process.cwd(), 'squads_multisig_program.json');
  const idlContent = await fs.readFile(idlPath, 'utf-8');
  return JSON.parse(idlContent);
};

async function createCodamaClient() {
  console.log('🔧 Creating Codama client for Squads IDL...');
  
  try {
    // Load the IDL
    const idl = await loadSquadsIDL();
    if (!idl.address) idl.address = "SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf";
    
    // Instantiate Codama
    const codama = createFromRoot(rootNodeFromAnchor(idl));
    
    // Render JavaScript
    const generatedPath = path.join("dist", "js-client");
    codama.accept(renderVisitor(generatedPath));
    
    console.log('✅ Codama client generated successfully!');
    console.log(`📁 Generated files in: ${generatedPath}`);
    
  } catch (error) {
    console.error('❌ Error creating Codama client:', error);
    throw error;
  }
}

createCodamaClient();
