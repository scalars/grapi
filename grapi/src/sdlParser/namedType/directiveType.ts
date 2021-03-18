import { DirectiveDefinitionNode } from 'graphql'

import { SdlDirective } from '../interface'
import { SdlNamedType } from './interface'

export default class SdlDirectiveType implements SdlNamedType {
    private typeDef: DirectiveDefinitionNode;
    private name: string;
    private description: string;

    constructor( {
        name,
        description,
        typeDef,
    }: {
        name: string;
        description?: string;
        typeDef: DirectiveDefinitionNode;
    } ) {
        this.name = name
        this.description = description
        this.typeDef = typeDef
    }

    public getName(): string {
        return this.name
    }

    public getDirectives(): Record<string, SdlDirective> {
        return {}
    }

    public getDescription(): string {
        return this.description
    }

    public getTypeDef(): any {
        return this.typeDef
    }
}
