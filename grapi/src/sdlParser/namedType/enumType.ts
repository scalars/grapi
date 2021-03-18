import { EnumTypeDefinitionNode } from 'graphql'

import { SdlDirective } from '../interface'
import { SdlNamedType } from './interface'

export default class SdlEnumType implements SdlNamedType<EnumTypeDefinitionNode> {
    private typeDef: EnumTypeDefinitionNode;
    private name: string;
    private description: string;
    private directives: Record<string, SdlDirective>;
    private values: string[];

    constructor( {
        name,
        description,
        directives,
        values,
        typeDef,
    }: {
        name: string;
        description?: string;
        directives?: Record<string, SdlDirective>;
        values: string[];
        typeDef: EnumTypeDefinitionNode;
    } ) {
        this.name = name
        this.description = description
        this.directives = directives
        this.values = values
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

    public getValues(): string[] {
        return this.values
    }

    public getTypeDef(): any {
        return this.typeDef
    }
}
