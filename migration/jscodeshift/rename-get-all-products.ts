export const parser = 'tsx'; // Ensures it understands TypeScript and JSX

export default function transformer(file, api) {
  const j = api.jscodeshift;
  const root = j(file.source);

  const oldName = 'getAllProducts';
  const newName = 'getAllSellables';
  
  // STRUCTURAL CONSTRAINT: Target a specific object to avoid collateral damage
  const targetObjectName = 'artPieceService';

  // 1. Function Declarations: function getAllProducts() {}
  root.find(j.FunctionDeclaration, { id: { name: oldName } })
    .forEach(path => {
      path.node.id.name = newName;
    });

  // 2. Variable Declarators: const getAllProducts = () => {}
  root.find(j.VariableDeclarator, { id: { name: oldName } })
    .forEach(path => {
      path.node.id.name = newName;
    });

  // 3. Member Expressions (Method calls): artPieceService.getAllProducts()
  // MODIFIED: Now checks that the caller matches `targetObjectName` WE ARE NOT CHECKING FUNCTION DECLARATIONS!
  root.find(j.MemberExpression, { 
    object: { name: targetObjectName }, 
    property: { name: oldName } 
  })
    .forEach(path => {
      path.node.property.name = newName;
    });

  // 4. Identifier Calls (Direct calls): getAllProducts()
  root.find(j.CallExpression, { callee: { name: oldName } })
    .forEach(path => {
      path.node.callee.name = newName;
    });

  // 5. Imports: import { getAllProducts } from './service'
  // NOTE: You could make this even smarter by constraining the import source:
  // e.g., root.find(j.ImportDeclaration, { source: { value: './artPieceService' } })
  root.find(j.ImportSpecifier, { imported: { name: oldName } })
    .forEach(path => {
      path.node.imported.name = newName;
      // Also update the local variable name if it wasn't aliased
      if (path.node.local.name === oldName) {
        path.node.local.name = newName;
      }
    });

  // 6. Exports: export { getAllProducts }
  root.find(j.ExportSpecifier, { local: { name: oldName } })
    .forEach(path => {
      path.node.local.name = newName;
      if (path.node.exported.name === oldName) {
        path.node.exported.name = newName;
      }
    });

  // 7. Object Properties: const service = { getAllProducts }
  // Babel/TSX parser uses ObjectProperty
  root.find(j.ObjectProperty, { key: { name: oldName } })
    .forEach(path => {
      path.node.key.name = newName;
      
      // Handle shorthand syntax: { getAllProducts } -> { getAllSellables }
      if (path.node.shorthand && path.node.value.name === oldName) {
        path.node.value.name = newName; 
      }
    });

  // Fallback for standard ESTree parsers
  root.find(j.Property, { key: { name: oldName } })
    .forEach(path => {
      path.node.key.name = newName;
      if (path.node.shorthand && path.node.value.name === oldName) {
        path.node.value.name = newName; 
      }
    });

  // Return the transformed source code
  return root.toSource();
}

//jscodeshift -t migration/jscodeshift/rename-get-all-products.ts pages components services lib --extensions=ts,tsx --parser=tsx