import { ObjectTypeDefinitionNode } from 'graphql'

import { SdlField } from '../field/interface'
import { SdlDirective } from '../interface'
import { SdlNamedType } from './interface'

export default class SdlObjectType implements SdlNamedType<ObjectTypeDefinitionNode> {
    private name: string;
    private typeDef: ObjectTypeDefinitionNode;
    private description: string;
    private interfaces: string[];
    private directives: Record<string, SdlDirective>;
    private fields: Record<string, SdlField>;

    constructor( {
        name,
        description,
        interfaces,
        directives,
        fields,
        typeDef,
    }: {
        name: string;
        description?: string;
        interfaces?: string[];
        directives?: Record<string, SdlDirective>;
        fields?: Record<string, SdlField>;
        typeDef: ObjectTypeDefinitionNode;
    } ) {
        this.name = name
        this.description = description
        this.interfaces = interfaces || []
        this.directives = directives || {}
        this.fields = fields || {}
        this.typeDef = typeDef
    }

    public getName(): string {
        return this.name
    }

    public getField( name: string ): SdlField {
        return this.fields[name]
    }

    public getFields(): Record<string, SdlField> {
        return this.fields
    }

    public getDescription(): string {
        return this.description
    }

    public getInterfaces(): string[] {
        return this.interfaces
    }

    public getDirectives(): Record<string, SdlDirective> {
        return this.directives
    }

    public getTypeDef(): any {
        return this.typeDef
    }
}
