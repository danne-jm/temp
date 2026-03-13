/// <reference types="node" />
import { Project } from 'ts-morph';
import * as path from 'path';

const project = new Project({
  tsConfigFilePath: path.join(__dirname, '..', '..', 'tsconfig.json'),
});

const TARGET_LOCAL_NAME = 'uuid';
const NEW_LOCAL_NAME = 'uuidConverted';
const TARGET_MODULE = 'uuid';

console.log('Starting UUID migration...');

// Removed the strict '**/*.ts' glob so it automatically includes .tsx files 
// based on your tsconfig.json settings.
for (const sourceFile of project.getSourceFiles()) {
  let changed = false;

  sourceFile.getImportDeclarations()
    .filter(imp => imp.getModuleSpecifierValue() === TARGET_MODULE)
    .forEach(imp => {
      // 1. Handle Default Imports: import uuid from 'uuid';
      const defaultImport = imp.getDefaultImport();
      if (defaultImport && defaultImport.getText() === TARGET_LOCAL_NAME) {
        defaultImport.rename(NEW_LOCAL_NAME);
        changed = true;
      }

      // 2. Handle Named Imports
      imp.getNamedImports().forEach(spec => {
        const alias = spec.getAliasNode();
        
        // a) Handle already aliased imports: import { v4 as uuid } from 'uuid';
        if (alias && alias.getText() === TARGET_LOCAL_NAME) {
          alias.rename(NEW_LOCAL_NAME);
          changed = true;
          return;
        }

        // b) Handle direct named imports: import { uuid } from 'uuid';
        if (!alias && spec.getNameNode().getText() === TARGET_LOCAL_NAME) {
          // Add an alias first, then rename the alias so local references update
          // safely without modifying the original module's export.
          spec.setAlias(TARGET_LOCAL_NAME);
          const newAlias = spec.getAliasNode();
          if (newAlias) {
            newAlias.rename(NEW_LOCAL_NAME);
            changed = true;
          }
        }
      });
    });

  if (changed) {
    console.log(`Updated UUID import in ${sourceFile.getFilePath()}`);
  }
}

// Using async save is generally preferred for I/O performance
project.save().then(() => {
  console.log('UUID migration complete!');
});

//npx ts-node migration/tsmorph/rename-uuid.ts