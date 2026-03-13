import { Recipe } from '@openrewrite/rewrite';
import { JavaScriptVisitor } from '@openrewrite/rewrite/javascript/visitor';
import { J } from '@openrewrite/rewrite/java/tree';

export default class RenameArtPieceMethod extends Recipe {
    
    getDisplayName(): string {
        return "Rename getAllProducts to getAllSellables safely";
    }

    getDescription(): string {
        return "Renames getAllProducts only when it originates from artPiece.service.ts.";
    }

    getVisitor() {
        return new class extends JavaScriptVisitor<any> {
            
            // Keep track of the current file we are visiting
            private currentFilePath: string = "";

            visitCompilationUnit(cu: J.CompilationUnit, ctx: any) {
                // Equivalent to `file.getFilePath()` in your ts-morph loop
                this.currentFilePath = cu.sourcePath;
                return super.visitCompilationUnit(cu, ctx);
            }
            
            visitMethodInvocation(method: J.MethodInvocation, ctx: any) {
                let mi = super.visitMethodInvocation(method, ctx) as J.MethodInvocation;

                if (mi.simpleName === "getAllProducts") {
                    // Equivalent to project.getTypeChecker().getSymbolAtLocation(id)
                    // We ask the OpenRewrite compiler graph: "Where did this method come from?"
                    const declaringType = mi.methodType?.declaringType?.fullyQualifiedName;
                    
                    // In OpenRewrite LSTs, TS module paths become the Fully Qualified Name
                    // e.g., "src.services.artPiece.service"
                    if (declaringType && declaringType.includes('artPiece.service')) {
                        return mi.withName(mi.name.withSimpleName("getAllSellables"));
                    }
                }
                
                return mi;
            }

            visitVariable(variable: J.VariableDeclarations.NamedVariable, ctx: any) {
                let v = super.visitVariable(variable, ctx) as J.VariableDeclarations.NamedVariable;

                // Equivalent to: if (file.getFilePath().includes('artPiece.service.ts'))
                // We only want to rename the local variable definition if we are INSIDE the service file
                if (v.simpleName === "getAllProducts" && this.currentFilePath.includes('artPiece.service.ts')) {
                    return v.withName(v.name.withSimpleName("getAllSellables"));
                }
                
                return v;
            }
        };
    }
}