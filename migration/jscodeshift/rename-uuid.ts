// @ts-nocheck
export const parser = 'ts';

const TARGET_MODULE = 'uuid';
const OLD_LOCAL = 'uuid';
const NEW_LOCAL = 'uuidConverted';

export default function transformer(file, api) {
  const j = api.jscodeshift;
  const root = j(file.source);
  let changed = false;
  let renamedBinding = false;

  root
    .find(j.ImportDeclaration, { source: { value: TARGET_MODULE } })
    .forEach(path => {
      const { specifiers = [] } = path.node;

      specifiers.forEach(spec => {
        // Default import: import uuid from 'uuid'
        if (spec.type === 'ImportDefaultSpecifier' && spec.local?.name === OLD_LOCAL) {
          spec.local.name = NEW_LOCAL;
          changed = true;
          renamedBinding = true;
          return;
        }

        if (spec.type !== 'ImportSpecifier') return;

        const importedName = spec.imported?.name;
        const localName = spec.local?.name;

        // Named import with alias: import { uuid as uuid } from 'uuid'
        if (localName === OLD_LOCAL) {
          spec.local.name = NEW_LOCAL;
          renamedBinding = true;
          changed = true;
          return;
        }

        // Named import without alias: import { uuid } from 'uuid'
        if (!spec.local && importedName === OLD_LOCAL) {
          spec.local = j.identifier(NEW_LOCAL);
          renamedBinding = true;
          changed = true;
        }
      });
    });

  // If we renamed the import binding, also rename identifier references
  if (renamedBinding) {
    root.find(j.Identifier, { name: OLD_LOCAL })
      .forEach(path => {
        if (shouldSkipIdentifier(path)) return;
        path.node.name = NEW_LOCAL;
        changed = true;
      });
  }

  return changed ? root.toSource({ quote: 'single' }) : null;
}
  function shouldSkipIdentifier(path) {
    const parent = path.parent.node;
    if (!parent) return false;

    // Do not rename property keys like obj.uuid
    if (parent.type === 'MemberExpression' && parent.property === path.node && !parent.computed) return true;

    // Do not rename object literal keys unless shorthand
    if ((parent.type === 'Property' || parent.type === 'ObjectProperty') && parent.key === path.node && !parent.shorthand) return true;

    // Imports/exports are handled separately
    if (parent.type === 'ImportSpecifier' || parent.type === 'ImportDefaultSpecifier' || parent.type === 'ExportSpecifier') return true;

    return false;
  }

// Run example:
// npx jscodeshift -t migration/jscodeshift/rename-uuid.ts "services/**/*.ts" "pages/**/*.ts" --extensions=ts,tsx --parser=ts
