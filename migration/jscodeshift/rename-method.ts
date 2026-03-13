// @ts-nocheck
export const parser = 'ts';

const OLD_NAME = 'getAllProducts';
const NEW_NAME = 'getAllSellables';

export default function transformer(file, api) {
  const j = api.jscodeshift;
  const root = j(file.source);

  const renameImportSpecifiers = () => {
    root.find(j.ImportSpecifier, { imported: { name: OLD_NAME } })
      .forEach(path => {
        path.node.imported.name = NEW_NAME;
        if (path.node.local && path.node.local.name === OLD_NAME) {
          path.node.local.name = NEW_NAME;
        }
      });
  };

  const renameExportSpecifiers = () => {
    root.find(j.ExportSpecifier, { local: { name: OLD_NAME } })
      .forEach(path => {
        path.node.local.name = NEW_NAME;
        if (path.node.exported && path.node.exported.name === OLD_NAME) {
          path.node.exported.name = NEW_NAME;
        }
      });
  };

  const renameBindings = () => {
    // const getAllProducts = ... OR function getAllProducts() {}
    root.find(j.Identifier, { name: OLD_NAME })
      .forEach(path => {
        if (shouldSkipIdentifier(path)) return;
        path.node.name = NEW_NAME;
      });
  };

  const renameCallExpressions = () => {
    root.find(j.CallExpression, { callee: { type: 'Identifier', name: OLD_NAME } })
      .forEach(path => {
        path.node.callee.name = NEW_NAME;
      });
  };

  renameImportSpecifiers();
  renameExportSpecifiers();
  renameBindings();
  renameCallExpressions();

  return root.toSource({ quote: 'single' });

  function shouldSkipIdentifier(path) {
    const parent = path.parent.node;
    if (!parent) return false;

    // Do not rename property keys like obj.getAllProducts
    if (parent.type === 'MemberExpression' && parent.property === path.node && !parent.computed) return true;

    // Do not rename object literal keys unless shorthand; handled by Identifier replacement
    if ((parent.type === 'Property' || parent.type === 'ObjectProperty') && parent.key === path.node && !parent.shorthand) return true;

    // Import/Export specifiers handled separately
    if (parent.type === 'ImportSpecifier' || parent.type === 'ExportSpecifier') return true;

    return false;
  }
}
