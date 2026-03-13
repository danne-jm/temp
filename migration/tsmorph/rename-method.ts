/// <reference types="node" />
import { Project } from 'ts-morph';
import * as path from 'path';

// Initialize the project
const project = new Project({
  // Use the root tsconfig so paths/types resolve correctly
  tsConfigFilePath: path.join(__dirname, '..', '..', 'tsconfig.json'),
});

console.log('Starting migration...');

// 1. Grab the specific file where the function is DEFINED
const serviceFile = project.getSourceFileOrThrow('services/artPiece.service.ts');

// 2. Grab the specific variable declaration (idempotent guard if already renamed)
const targetDeclaration = serviceFile.getVariableDeclaration('getAllProducts');

if (!targetDeclaration) {
  console.log('getAllProducts not found – assuming it was already migrated. Nothing to do.');
} else {
  // 3. Rename it!
  // Because the project is strictly structured, `.rename()` will safely update 
  // the definition, the export, the imports in other files, AND the function calls.
  targetDeclaration.rename('getAllSellables');
}

// 4. Save all modified files to disk
project.saveSync();

console.log('Migration complete! Check your files.');
