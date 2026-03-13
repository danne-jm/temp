import { ExecutionContext, Recipe, TreeVisitor } from '@openrewrite/rewrite';
import { JavaScriptVisitor, JS } from '@openrewrite/rewrite/javascript';
import { J } from '@openrewrite/rewrite/java';
import { create, Draft } from 'mutative';

const TARGET_LOCAL_NAME = 'uuid';
const NEW_LOCAL_NAME = 'uuidConverted';
const TARGET_MODULE = 'uuid';

/**
 * Rewrites imports from the `uuid` package so the local name becomes `uuidConverted`.
 *
 * Behaviour mirrors the previous ts-morph script:
 * - Default import `import uuid from "uuid";` -> `import uuidConverted from "uuid";`
 * - Alias in named import `import { v4 as uuid } from "uuid";` -> `import { v4 as uuidConverted } from "uuid";`
 * - Plain named import `import { uuid } from "uuid";` -> `import { uuid as uuidConverted } from "uuid";`
 *
 * All in-file references to the renamed binding are updated to the new local name.
 */
export class RenameUuidImport extends Recipe {
    readonly name = 'com.yourorg.RenameUuidImport';
    readonly displayName = 'Rename uuid import local name to uuidConverted';
    readonly description = 'Updates imports from the uuid package so the local binding is named uuidConverted.';

    async editor(): Promise<TreeVisitor<any, ExecutionContext>> {
        return new RenameUuidImportVisitor();
    }
}

class RenameUuidImportVisitor extends JavaScriptVisitor<ExecutionContext> {
    /** Track which local names should be renamed within the current file. */
    private renameMap: Map<string, string> = new Map();

    async isAcceptable(): Promise<boolean> {
        this.renameMap = new Map();
        return true;
    }

    protected async visitImportDeclaration(jsImport: JS.Import, ctx: ExecutionContext): Promise<J | undefined> {
        const visited = (await super.visitImportDeclaration(jsImport, ctx)) as JS.Import;
        if (!visited.importClause) return visited;

    const modulePath = this.normalizeModule(this.extractModulePath(visited) ?? this.extractModulePath(jsImport));
    if (modulePath && modulePath !== TARGET_MODULE) return visited;

        let changed = false;
        let updatedClause = visited.importClause;

        // Default import handling
        const defaultImport = updatedClause.name?.element;
        if (defaultImport?.simpleName === TARGET_LOCAL_NAME) {
            this.renameMap.set(TARGET_LOCAL_NAME, NEW_LOCAL_NAME);
            changed = true;
            updatedClause = create(updatedClause, (draft: Draft<JS.ImportClause>) => {
                if (draft.name) {
                    draft.name.element = create(defaultImport, (id: Draft<J.Identifier>) => {
                        id.simpleName = NEW_LOCAL_NAME;
                        (id as any).markers = (id as any).markers ?? this.defaultMarkers();
                    });
                }
            });
        }

        // Named imports handling
        const namedBindings = updatedClause.namedBindings as JS.NamedImports | undefined;
        if (namedBindings?.elements) {
            let namedChanged = false;
            const updatedElements = namedBindings.elements.elements.map((rp) => {
                const spec = rp.element as JS.ImportSpecifier;
                const { exported, local } = this.extractNames(spec);
                let updatedSpec = spec;

                // Case: alias exists and matches target
                if (local === TARGET_LOCAL_NAME) {
                    this.renameMap.set(TARGET_LOCAL_NAME, NEW_LOCAL_NAME);
                    namedChanged = true;
                    updatedSpec = create(spec, (draft: Draft<JS.ImportSpecifier>) => {
                        draft.specifier = this.makeAlias(exported, NEW_LOCAL_NAME, spec);
                    });
                }

                // Case: no alias, exported name matches target -> add alias
                if (updatedSpec === spec && !local && exported === TARGET_LOCAL_NAME) {
                    this.renameMap.set(TARGET_LOCAL_NAME, NEW_LOCAL_NAME);
                    namedChanged = true;
                    updatedSpec = create(spec, (draft: Draft<JS.ImportSpecifier>) => {
                        draft.specifier = this.makeAlias(exported, NEW_LOCAL_NAME, spec);
                    });
                }

                if (updatedSpec !== spec) {
                    return create(rp, (rpDraft: Draft<J.RightPadded<JS.ImportSpecifier>>) => {
                        rpDraft.element = updatedSpec;
                    });
                }

                return rp;
            });

            if (namedChanged) {
                changed = true;
                const updatedNamed = create(namedBindings, (draft: Draft<JS.NamedImports>) => {
                    draft.elements.elements = updatedElements;
                });

                updatedClause = create(updatedClause, (draft: Draft<JS.ImportClause>) => {
                    draft.namedBindings = updatedNamed;
                });
            }
        }

        if (!changed) return visited;

        return create(visited, (draft: Draft<JS.Import>) => {
            draft.importClause = updatedClause;
        });
    }

    protected async visitIdentifier(id: J.Identifier, ctx: ExecutionContext): Promise<J | undefined> {
    const visited = (await super.visitIdentifier(id, ctx)) as J.Identifier;
        const newName = this.renameMap.get(visited.simpleName);

        if (!newName) {
            return visited;
        }

        return create(visited, (draft: Draft<J.Identifier>) => {
            draft.simpleName = newName;
        });
    }

    private isInsideImport(): boolean {
        let cursor: any = this.cursor;
        while (cursor) {
            const valueKind = (cursor.value as any)?.kind;
            if (valueKind === J.Kind.Import || valueKind === (JS as any).Kind?.Import) {
                return true;
            }
            cursor = cursor.parent;
        }
        return false;
    }

    private extractModulePath(jsImport: JS.Import): string | undefined {
        const mod = (jsImport.moduleSpecifier as any) ?? {};
        if (typeof mod === 'string') return mod;
        if (typeof mod.value === 'string') return mod.value;
        if (typeof mod.valueSource === 'string') return mod.valueSource;
        if (typeof mod.raw === 'string') return mod.raw;
        if (typeof mod.module === 'string') return mod.module;
        if (typeof mod.text === 'string') return mod.text;

        const inner = (mod as any).value ?? {};
        if (typeof inner === 'string') return inner;
        if (typeof inner.value === 'string') return inner.value;
        if (typeof inner.valueSource === 'string') return inner.valueSource;
        if (typeof inner.raw === 'string') return inner.raw;

        return undefined;
    }

    private normalizeModule(mod?: string): string | undefined {
        if (!mod) return undefined;
        return mod.trim().replace(/['"]/g, '');
    }

    private extractModuleRaw(jsImport: JS.Import): string | undefined {
        const mod = (jsImport.moduleSpecifier as any) ?? {};
        if (typeof mod.valueSource === 'string') return mod.valueSource.replace(/['"]/g, '');
        if (typeof mod.value === 'string') return mod.value.replace(/['"]/g, '');
        if (typeof mod.raw === 'string') return mod.raw.replace(/['"]/g, '');
        if (typeof mod.module === 'string') return mod.module.replace(/['"]/g, '');
        if (typeof mod.text === 'string') return mod.text.replace(/['"]/g, '');
        return undefined;
    }

    private extractNames(spec: JS.ImportSpecifier): { exported: string; local?: string } {
        const s = spec.specifier as any;
        const exported = s?.propertyName?.element?.simpleName ?? s?.propertyName?.simpleName ?? s?.simpleName ?? s?.name?.simpleName ?? TARGET_LOCAL_NAME;
        const local = s?.name?.simpleName ?? (s?.propertyName ? s?.simpleName : undefined) ?? (s?.alias?.simpleName ?? s?.localName?.simpleName);
        return { exported: exported ?? TARGET_LOCAL_NAME, local };
    }

    private makeAlias(exportedName: string, aliasName: string, templateSpec?: JS.ImportSpecifier): JS.Alias {
        const existing = (templateSpec?.specifier as any)?.propertyName?.element ?? (templateSpec?.specifier as any);
        const exportedId = create(existing ?? this.makeIdentifier(exportedName, templateSpec, ''), (draft: Draft<J.Identifier>) => {
            draft.simpleName = exportedName;
            (draft as any).markers = (draft as any).markers ?? this.defaultMarkers();
        });

        const aliasId = this.makeIdentifier(aliasName, templateSpec, ' ');

        return {
            kind: (JS as any).Kind?.Alias ?? (J as any).Kind?.Alias,
            prefix: this.space(),
            markers: this.defaultMarkers(),
            propertyName: {
                kind: J.Kind.RightPadded,
                element: exportedId,
                after: this.space(' '),
                markers: this.defaultMarkers(),
            } as any,
            alias: aliasId,
        } as any;
    }

    private makeIdentifier(name: string, templateSpec?: JS.ImportSpecifier, whitespace = ''): J.Identifier {
        const spec = (templateSpec?.specifier as any) ?? {};
        const base = spec?.propertyName?.element ?? spec?.alias ?? spec;
        const prefix = whitespace !== '' ? this.space(whitespace) : this.space();
        return {
            kind: J.Kind.Identifier,
            prefix,
            markers: base.markers ?? this.defaultMarkers(),
            annotations: base.annotations ?? [],
            type: base.type,
            fieldType: base.fieldType,
            simpleName: name,
        } as any;
    }

    private defaultMarkers() {
        return { kind: 'org.openrewrite.marker.Markers', markers: [] } as any;
    }

    private space(whitespace = ''): J.Space {
        return { kind: J.Kind.Space, comments: [], whitespace, markers: this.defaultMarkers() } as any;
    }
}
