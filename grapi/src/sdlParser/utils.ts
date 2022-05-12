import {
    BooleanValueNode,
    DirectiveNode,
    DocumentNode,
    EnumValueNode,
    FieldDefinitionNode,
    FloatValueNode,
    GraphQLBoolean,
    GraphQLFloat,
    GraphQLID,
    GraphQLInt,
    GraphQLString,
    InputValueDefinitionNode,
    IntValueNode,
    Kind,
    ListTypeNode,
    ListValueNode,
    NamedTypeNode,
    NonNullTypeNode,
    ObjectFieldNode,
    ObjectValueNode,
    StringValueNode,
    TypeDefinitionNode,
    TypeNode,
    ValueNode,
} from 'graphql'

import { last, reduce } from '../lodash'
import {
    CustomScalarField,
    EnumField,
    ObjectField,
    ScalarField,
} from './field'
import { SdlField } from './field/interface'
import {
    BooleanValue,
    EnumValue,
    FloatValue,
    IntValue,
    ListValue,
    NullValue,
    ObjectValue,
    StringValue
} from './inputValue'
import { InputValue } from './inputValue/interface'
import { SdlDirective } from './interface'
import SdlEnumType from './namedType/enumType'
import { SdlNamedType } from './namedType/interface'
import SdlObjectType from './namedType/objectType'

const isSpecifiedScalar = ( type: string ): boolean => {
    if ( ! type ) return false
    return (
        type === GraphQLString.name ||
        type === GraphQLInt.name ||
        type === GraphQLFloat.name ||
        type === GraphQLBoolean.name ||
        type === GraphQLID.name
    )
}

export const parseDirectiveInput = ( node: ValueNode | unknown ): InputValue => {
    const inputValues = {
        [Kind.INT]: () => new IntValue( { value: parseInt( ( node as IntValueNode ).value ) } ),
        [Kind.FLOAT]: () => new FloatValue( { value: parseFloat( ( node as FloatValueNode ).value ) } ),
        [Kind.STRING]: () => new StringValue( { value: ( node as StringValueNode ).value } ),
        [Kind.BOOLEAN]: () => new BooleanValue( { value: ( node as BooleanValueNode ).value } ),
        [Kind.ENUM]: () => new EnumValue( { value: ( node as EnumValueNode ).value } ),
        [Kind.OBJECT]: () => new ObjectValue( {
            fields: reduce( ( node as ObjectValueNode ).fields, ( result, field: ObjectFieldNode ) => {
                result[field.name.value] = parseDirectiveInput( field.value )
                return result
            }, {} )
        } ),
        [Kind.LIST]: () => new ListValue( {
            values: ( node as ListValueNode ).values.map( nestedNode => parseDirectiveInput( nestedNode ) )
        } ),
        [Kind.NULL]: () => new NullValue()
    }
    const inputValue = inputValues[( node as ValueNode ).kind]

    if ( ! inputValue ) {
        throw new Error( `not supported type in directive parsing: ${( node as ValueNode ).kind}` )
    }
    return inputValue()
}

export const parseDirectiveNode = ( node: DirectiveNode | InputValueDefinitionNode ): SdlDirective => {
    return {
        args: reduce( ( node as DirectiveNode ).arguments || [], ( result, argNode ) => {
            result[argNode.name.value] = parseDirectiveInput( argNode.value )
            return result
        }, {} ),
    }
}

export const findTypeInDocumentAst = ( node: DocumentNode, name: string ): Kind | null => {
    const foundNode = node.definitions.find( ( defNode: TypeDefinitionNode ) => {
        return defNode.name.value === name
    } )
    return foundNode ? foundNode.kind : null
}

export const parseWrappedType = ( node: TypeNode, typeWrapped: string[] = [] ): {type: string; wrapped: string[]} => {
    const wrappedTypes = {
        [Kind.NON_NULL_TYPE]: () => parseWrappedType(
            ( node as NonNullTypeNode ).type, typeWrapped.concat( Kind.NON_NULL_TYPE )
        ),
        [Kind.LIST_TYPE]: () => parseWrappedType(
            ( node as ListTypeNode ).type, typeWrapped.concat( Kind.LIST_TYPE )
        ),
        [Kind.NAMED_TYPE]: () => ( { type: ( node as NamedTypeNode ).name.value, wrapped: typeWrapped } )
    }
    return wrappedTypes[node.kind]()
}

export const createSdlField = (
    documentNode: DocumentNode,
    node: FieldDefinitionNode,
    getSdlNamedType: ( name: string ) => SdlNamedType,
): SdlField => {
    const typeNode = node.type
    const { type, wrapped } = parseWrappedType( typeNode )
    // not dealing with nested list for now
    const nonNull = wrapped[0] === Kind.NON_NULL_TYPE
    const list = ( wrapped[0] === Kind.LIST_TYPE || wrapped[1] === Kind.LIST_TYPE )
    const itemNonNull = ( list && last( wrapped ) === Kind.NON_NULL_TYPE )

    // construct directives
    const directives = reduce( node.directives, ( result, directiveNode ) => {
        result[directiveNode.name.value] = parseDirectiveNode( directiveNode )
        return result
    }, {} )
    // field configs
    const fieldConfigs = { typename: type, nonNull, list, itemNonNull, directives }

    if ( isSpecifiedScalar( type ) ) {
        return new ScalarField( fieldConfigs )
    }

    const nodeType: Kind = findTypeInDocumentAst( documentNode, type )
    if ( !nodeType ) {
        throw new Error( `type of "${type}" not found in document` )
    }
    const nodeTypes = {
        [Kind.SCALAR_TYPE_DEFINITION]: () => new CustomScalarField( fieldConfigs ),
        [Kind.ENUM_TYPE_DEFINITION]: () => {
            const enumField = new EnumField( fieldConfigs )
            enumField.setEnumType(
                () => getSdlNamedType( enumField.getTypeName() ) as SdlEnumType,
            )
            return enumField
        },
        [Kind.OBJECT_TYPE_DEFINITION]: () => {
            const field = new ObjectField( fieldConfigs )
            field.setObjectType(
                () => getSdlNamedType( field.getTypeName() ) as SdlObjectType,
            )
            return field
        }
    }
    return nodeTypes[nodeType]()
}
