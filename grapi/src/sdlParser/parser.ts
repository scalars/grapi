import {
    DirectiveDefinitionNode,
    DocumentNode,
    EnumTypeDefinitionNode,
    Kind,
    ObjectTypeDefinitionNode,
    parse,
    print,
    visit 
} from 'graphql'

import { get, reduce, values } from '../lodash'
import { SdlDirectiveType, SdlEnumType, SdlObjectType, SdlScalarType } from './namedType'
import { SdlNamedType } from './namedType/interface'
import { createSdlField, parseDirectiveNode } from './utils'

const parseNodeToSdlObjectType = (
    documentNode: DocumentNode,
    node: ObjectTypeDefinitionNode,
    getSdlNamedType: ( name: string ) => SdlNamedType,
): SdlObjectType => {
    const fields = reduce( node.fields, ( result, fieldNode ) => {
        result[fieldNode.name.value] = createSdlField( documentNode, fieldNode, getSdlNamedType )
        return result
    }, {} )
    const directives = reduce( node.directives, ( result, directiveNode ) => {
        result[directiveNode.name.value] = parseDirectiveNode( directiveNode )
        return result
    }, {} )
    const interfaces: string[] = node.interfaces.map( namedTypeNode => namedTypeNode.name.value )

    // create SdlObjectType
    return new SdlObjectType( {
        typeDef: node,
        name: node.name.value,
        description: get( node, 'description.value' ),
        directives,
        interfaces,
        fields,
    } )
}

const parseNodeToSdlEnumType = ( node: EnumTypeDefinitionNode ): SdlEnumType => {
    return new SdlEnumType( {
        typeDef: node,
        name: node.name.value,
        description: get( node, 'description.value' ),
        values: node.values.map( valueDefNode => valueDefNode.name.value ),
    } )
}

export const parseDefinitionNodeToSdl = ( node: DirectiveDefinitionNode ): string => {
    return print( node )
}

export class SdlParser {
    private namedTypeMap: Record<string, SdlNamedType> = {};

    public parse( sdl: string ): SdlNamedType[] {
        const documentAST = parse( sdl )
        // construct SdlObjectType with SdlFields
        visit( documentAST, {
            enter: ( node, key: string, parent, path ) => {
                // Is directive definition
                if ( node.kind === Kind.DIRECTIVE_DEFINITION ) {
                    // find scalar in map
                    const scalarName: string = node.name.value
                    this.namedTypeMap[scalarName] = new SdlDirectiveType( { typeDef: node, name: scalarName } )
                    return false
                }
                // if scalar
                if ( node.kind === Kind.SCALAR_TYPE_DEFINITION ) {
                    // find scalar in map
                    const scalarName: string = node.name.value
                    this.namedTypeMap[scalarName] = new SdlScalarType( { typeDef: node, name: scalarName } )
                    return false
                }

                // if objectType
                if ( node.kind === Kind.OBJECT_TYPE_DEFINITION ) {
                    this.namedTypeMap[node.name.value] = parseNodeToSdlObjectType( documentAST, node, this.getSdlNamedType )
                    return false
                }

                // if enum
                if ( node.kind === Kind.ENUM_TYPE_DEFINITION ) {
                    this.namedTypeMap[node.name.value] = parseNodeToSdlEnumType( node )
                    return false
                }
            },
        } )

        return values( this.namedTypeMap )
    }

    public getSdlNamedType = ( name: string ): SdlNamedType => {
        return this.namedTypeMap[name]
    };
}
