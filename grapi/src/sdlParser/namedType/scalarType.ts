import { ScalarTypeDefinitionNode } from 'graphql'

import { SdlDirective } from '../interface'
import { SdlNamedType } from './interface'

export default class SdlScalarType implements SdlNamedType {
    private typeDef: ScalarTypeDefinitionNode;
    private name: string;
    private description: string;
    private directives: Record<string, SdlDirective>;

    constructor( {
        name,
        description,
        directives,
        typeDef,
    }: {
        name: string;
        description?: string;
        directives?: Record<string, SdlDirective>;
        typeDef: ScalarTypeDefinitionNode;
    } ) {
        this.name = name
        this.description = description
        this.directives = directives || {}
        this.typeDef = typeDef
    }

    public getName(): string {
        return this.name
    }

    public getDescription(): string {
        return this.description
    }

    public getDirectives(): Record<string, SdlDirective> {
        return this.directives
    }

    public getTypeDef(): any {
        return this.typeDef
    }
}
