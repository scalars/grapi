import { GraphQLScalarType } from 'graphql'
import isISO8601 from 'validator/lib/isISO8601'

// DateTime scalar
const serialize = ( value: Date ): Date => {
    if( isISO8601( value.toISOString() ) ) {
        return value
    }
    throw new Error( 'DateTime cannot represent an invalid ISO-8601 Date string' )
}
const parseValue = ( value: string ): Date => {
    if( isISO8601( value ) ) {
        return new Date( value )
    }
    throw new Error( 'DateTime cannot represent an invalid ISO-8601 Date string' )
}
const parseLiteral = ( ast: any ): Date => {
    if( isISO8601( ast.value ) ) {
        return new Date( ast.value )
    }
    throw new Error( 'DateTime cannot represent an invalid ISO-8601 Date string' )
}

const DateTime = new GraphQLScalarType( {
    name: 'DateTime',
    description: 'ISO-8601 encoded UTC date string',
    serialize,
    parseValue,
    parseLiteral,
} )

export { DateTime }
