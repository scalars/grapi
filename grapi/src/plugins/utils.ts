import EnumField from '../dataModel/enumField'
import Field from '../dataModel/field'
import ObjectField from '../dataModel/objectField'
import { forEach, transform, upperFirst } from '../lodash'
import { Context } from './interface'

const graphqlType = ( field: Field ): string => {
    let value: string = field.getTypename()

    if ( field.isList() ) {
        value = field.isNonNullItem() ? `[${value}!]` : `[${value}]`
    }

    if ( field.isNonNull() ) {
        value = `${value}!`
    }
    return value
}

export const recursiveCreateType = ( fields: Record<string, Field>, context: Context ): string[] => {
    const { root } = context
    const content: string[] = []
    forEach( fields, ( field, name ) => {
        if ( field instanceof EnumField ) {
            root.addEnum(
                `enum ${field.getTypename()} { ${field.getValues().join( ', ' )} }`,
                field.getDescription()
            )
        }

        if ( field instanceof ObjectField ) {
            // create type for nested object
            const typeFields = recursiveCreateType( field.getFields(), context )
            const objectTypename = upperFirst( name )
            root.addObjectType( `type ${objectTypename} { ${typeFields.join( ' ' )} }` )
        }

        content.push( `${name}: ${graphqlType( field )}` )
    } )

    return content
}

const parseRelationConfig = ( relationConfig ): Record<string, string> => {
    return transform( relationConfig, ( result: any, value: any, key: string ) => {
        if ( value instanceof Object ) {
            result.foreignKey = value.key
            result.side = value.side
        } else {
            result[key] = value
        }
    } )
}

export { parseRelationConfig }
