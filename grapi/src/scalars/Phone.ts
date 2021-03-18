import { GraphQLScalarType } from 'graphql'

const isPhoneOrMobileNumber = ( value: string ): boolean => {
    return /^([0-9]{1})?([0-9]{1})?([0-9]{1})([0-9]{10})|^([0-9]{7})$/.test( value )
}

const parseAndSerializeValue = ( value: string ): string => {
    if ( isPhoneOrMobileNumber( value ) ) {
        return value
    }
    throw new Error ( `Wrong "${value}" format for phone or mobile number.` )
}

const parseLiteral = ( ast: any ): string => {
    if ( isPhoneOrMobileNumber( ast.value ) ) {
        return ast.value
    }
    throw new Error ( `Wrong "${ast.value}" format for phone or mobile number.` )
}


const Phone = new GraphQLScalarType( {
    name: 'Phone',
    description: `Formats from Phone number or mobile number. This data type accept digits with a standard, 7 digits for phone and 11 - 13 digits for mobile number.`,
    serialize: parseAndSerializeValue,
    parseValue: parseAndSerializeValue,
    parseLiteral: parseLiteral
} )

export { Phone }
