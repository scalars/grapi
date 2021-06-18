import { RelationField, RelationType } from '../dataModel'
import EnumField from '../dataModel/enumField'
import Field from '../dataModel/field'
import ObjectField from '../dataModel/objectField'
import { DataModelType } from '../dataModel/type'
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
        let nonNullType = ``
        let argumentsField = ``
        if ( ! field.isScalar() && field.getType() !== DataModelType.OBJECT ) {
            const relationField = field as RelationField
            const relationType = relationField.getRelationType()
            const relationTo = relationField.getRelationTo()
            const relationNamings = relationTo.getNamings()
            if (
                relationType === RelationType.biManyToMany ||
                (
                    relationField.isList() && (
                        relationType === RelationType.biOneToMany ||
                        relationType === RelationType.uniOneToMany
                    )
                )
            ) {
                // TODO Add support for orderBy Input
                // first: Int
                // last: Int
                // before: String
                // after: String
                // orderBy: ${relationNamings.capitalSingular}OrderInput
                nonNullType = `!`
                argumentsField = `(
                    where: ${relationNamings.capitalSingular}WhereInput
                )`
            }
        }

        content.push( `${name}${argumentsField}: ${graphqlType( field )}${nonNullType}` )
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
