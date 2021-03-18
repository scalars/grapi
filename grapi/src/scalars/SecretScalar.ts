// import { GraphQLScalarType } from 'graphql';
// import { SHA512 } from 'crypto-js';
//
//
// const serialize = ( value: any ) => {
//     return value;
// };
// const parseValue = ( value: string ) => {
//     return SHA512( value ).toString();
// };
// const parseLiteral = ( ast: any ) => {
//     return SHA512( ast.value ).toString();
// };
//
// const Secret = new GraphQLScalarType( {
//     name: 'Secret',
//     description: 'Encrypt secret string',
//     serialize,
//     parseValue,
//     parseLiteral,
// } );
//
// export { Secret }
