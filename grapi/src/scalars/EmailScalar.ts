import { GraphQLScalarType } from 'graphql'
import { isEmail } from 'validator'

const parseAndSerializeValue = ( value: string ): string => {
    if ( isEmail( value ) ) {
        return value
    }
    throw new Error ( `Wrong "${value}" email. Does not match the standard` )
}

const parseLiteral = ( ast: any ): string => {
    if ( isEmail( ast.value ) ) {
        return ast.value
    }
    throw new Error ( `Wrong "${ast.value}" email. Does not match the standard` )
}

const Email = new GraphQLScalarType( {
    name: 'Email',
    description: 'Email format',
    serialize: parseAndSerializeValue,
    parseValue: parseAndSerializeValue,
    parseLiteral,
} )

export { Email }
