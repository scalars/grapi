import { GraphQLScalarType } from 'graphql'
import isURL from 'validator/lib/isURL'
const options = {
    protocols: [ 'http', 'https' ],
    require_protocol: true,
    require_valid_protocol: true,
    require_host: true,
    allow_underscores: true,

}
const serializeAndSerialize = ( value: string ): string => {
    if ( isURL( value, options ) ) {
        return value
    }
    throw new Error( `Malformed "${value}" Url, not match with standard` )
}
const parseLiteral = ( ast: any ): string => {
    if ( isURL( ast.value, options ) ) {
        return ast.value
    }
    throw new Error( `Malformed "${ast.value}" Url, not match with standard` )
}

const Url = new GraphQLScalarType( {
    name: 'Url',
    description: 'Url format',
    serialize: serializeAndSerialize,
    parseValue: serializeAndSerialize,
    parseLiteral,
} )

export { Url }
