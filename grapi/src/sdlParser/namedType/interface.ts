import { TypeDefinitionNode } from 'graphql'

import { SdlDirective } from '../interface'

export interface SdlNamedType<TypeDef = TypeDefinitionNode> {
    getTypeDef(): TypeDef;
    getName(): string;
    getDescription(): string;
    getDirectives(): Record<string, SdlDirective>;
}
