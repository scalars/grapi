import { GraphQLScalarType } from 'graphql'
import { Kind } from 'graphql/language'


function identity( value ): any {
    return value
}

function parseLiteral( ast, variables ): any {
    switch ( ast.kind ) {
    case Kind.STRING:
    case Kind.BOOLEAN:
        return ast.value

    case Kind.INT:
    case Kind.FLOAT:
        return parseFloat( ast.value )

    case Kind.OBJECT:
    {
        const value = Object.create( null )
        ast.fields.forEach( function ( field ) {
            value[field.name.value] = parseLiteral( field.value, variables )
        } )
        return value
    }

    case Kind.LIST:
        return ast.values.map( function ( n ) {
            return parseLiteral( n, variables )
        } )

    case Kind.NULL:
        return null

    case Kind.VARIABLE:
    {
        const name = ast.name.value
        return variables ? variables[name] : undefined
    }

    default:
        return undefined
    }
}


const Json = new GraphQLScalarType( {
    name: 'JSON',
    description: 'The `JSON` scalar type represents JSON values as specified by [ECMA-404](http://www.ecma-international.org/publications/files/ECMA-ST/ECMA-404.pdf).',
    serialize: identity,
    parseValue: identity,
    parseLiteral: parseLiteral
} )

const JsonObject = new GraphQLScalarType( {
    name: 'Json',
    description: 'The `Json` scalar type represents Json values.',
    serialize: identity,
    parseValue: identity,
    parseLiteral: parseLiteral
} )

export { Json, JsonObject }
