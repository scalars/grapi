import { Operator, RelationWhere, Where } from '..'
import { MODEL_DIRECTIVE, MODEL_DIRECTIVE_SOURCE_KEY } from '../constants'
import { RelationField } from '../dataModel'
import Field from '../dataModel/field'
import Model from '../dataModel/model'
import { DataModelType } from '../dataModel/type'
import { RelationWhereConfig } from '../helper'
import { forEach, get, isEmpty, map, mapValues, reduce } from '../lodash'
import { inputDateTimeBetweenName, inputFloatBetweenName, inputIntBetweenName } from './constants'
import { Context, Plugin } from './interface'
import { parseRelationConfig } from './utils'

// constants
const UNDERSCORE = '_'

export default class WhereInputPlugin implements Plugin {
    public visitModel( model: Model, context: Context ): void {
        // object type model dont need whereInput
        if ( model.isObjectType() ) {
            return
        }

        // list model
        const { root } = context

        // add where input
        const modelWhereInputName = this.getWhereInputName( model )
        // add filter: https://www.opencrud.org/#sec-Data-types
        const whereInput = `input ${modelWhereInputName} {
            OR: [${modelWhereInputName}!]
            AND: [${modelWhereInputName}!]
            ${this.createWhereFilter( model.getFields() )}
        }`
        root.addInput( whereInput )

        // add where unique input
        // only use the unique field
        const modelWhereUniqueInputName = this.getWhereUniqueInputName( model )
        const whereUniqueInput = `input ${modelWhereUniqueInputName} {
            ${this.createWhereUniqueFilter( model.getName(), model.getFields() )}
        }`
        root.addInput( whereUniqueInput )
    }

    public getWhereInputName( model: Model ): string {
        return `${model.getNamings().capitalSingular}WhereInput`
    }

    public getWhereUniqueInputName( model: Model ): string {
        return `${model.getNamings().capitalSingular}WhereUniqueInput`
    }

    public parseUniqueWhere( where: Record<string, any> ): Where {
        if ( isEmpty( where ) ) {
            throw new Error( 'You provided an invalid argument for the where selector on Entity. Please provide exactly one unique field and value.' )
        }
        return mapValues( where, value => {
            return { [Operator.eq]: value }
        } ) as Where
    }

    public parseWhere( where: Record<string, any>, model: Model ): Where {
        // parse where: {name: value, price_gt: value}
        // to {name: {eq: value}, price: {gt: value}}
        return this.parseWhereIterate( where, model )
    }

    public parseWhereIterate( where: Record<string, any>, model: Model ): Where {
        return reduce( where, ( result, value, key ) => {
            if ( key === Operator.or || key === Operator.and  ) {
                value = map( value, ( where: Where ) => {
                    return this.parseWhereIterate( where, model )
                } )
                return { [ key as Operator ]: value }
            }
            const { fieldName, operator } = WhereInputPlugin.getNameAndOperator( key )
            const field: RelationField = model.getField( fieldName ) as RelationField
            if ( field && field.getType() === DataModelType.RELATION ) {
                const relationTo: Model = field.getRelationTo()
                const metadataField: Record<string, any> = parseRelationConfig( field.getRelationConfig( ) )
                result[fieldName] = {
                    filters: this.parseWhereIterate( value, relationTo ),
                    sourceKey: get( model.getMetadata( MODEL_DIRECTIVE ), MODEL_DIRECTIVE_SOURCE_KEY ),
                    targetKey: get( relationTo.getMetadata( MODEL_DIRECTIVE ), MODEL_DIRECTIVE_SOURCE_KEY ),
                    relation: {
                        foreignKey: get( metadataField, `foreignKey` ),
                        source: model.getName(),
                        target: relationTo.getName(),
                        side: get( metadataField, `side` ),
                        list: field.isList(),
                        ship: field.getRelation(),
                        type: field.getRelationType()
                    } as RelationWhereConfig
                } as RelationWhere
                return result
            }
            if ( result[fieldName] ) {
                throw new Error( `There can be only one input field named ${ fieldName }_${ operator }` )
            }
            result[fieldName] = { [operator]: value }
            return result
        }, {} as any )
    }

    private static getNameAndOperator( field: string ): {fieldName: string; operator: Operator; object?: string} {
        // split field name and operator from 'price_gt'
        const lastUnderscoreIndex = field.lastIndexOf( UNDERSCORE )

        // no underscore in field, it's a equal operator
        if ( lastUnderscoreIndex < 0 ) {
            return {
                fieldName: field,
                operator: Operator.eq,
            }
        }

        // slice the operator
        const operator = field.slice( lastUnderscoreIndex + 1 )

        // validate the operator
        const validOperator: Operator = Operator[operator]
        if ( !validOperator ) {
            throw new Error( `Operator ${operator} no support` )
        }
        const fieldName = field.slice( 0, lastUnderscoreIndex )
        return { fieldName, operator: validOperator }
    }

    private createWhereFilter( fields: Record<string, Field> ): string {
        // create equals on scalar fields
        let inputFields: Array<{fieldName: string; type: string}> = []
        forEach( fields, ( field, name ) => {
            const typeName: string = field.getTypename()
            switch ( field.getType() ) {
            case DataModelType.STRING:
                inputFields.push( ...WhereInputPlugin.parseEqFilter( name, typeName ) )
                inputFields.push( ...WhereInputPlugin.parseContainsFilter( name, typeName ) )
                inputFields.push( ...WhereInputPlugin.parseInFilter( name, typeName ) )
                break
            case DataModelType.INT:
                inputFields.push( ...WhereInputPlugin.parseEqFilter( name, typeName ) )
                inputFields.push( ...WhereInputPlugin.parseGtLtInFilter( name, typeName ) )
                inputFields.push( {
                    fieldName: `${name}_between`, type: inputIntBetweenName,
                } )
                break
            case DataModelType.FLOAT:
                inputFields.push( ...WhereInputPlugin.parseEqFilter( name, typeName ) )
                inputFields.push( ...WhereInputPlugin.parseGtLtInFilter( name, typeName ) )
                inputFields.push( {
                    fieldName: `${name}_between`, type: inputFloatBetweenName,
                } )
                break
            case DataModelType.ENUM:
                inputFields.push( ...WhereInputPlugin.parseEqFilter( name, typeName ) )
                inputFields.push( ...WhereInputPlugin.parseContainsFilter( name, 'String' ) )
                break
            case DataModelType.ID:
                inputFields.push( ...WhereInputPlugin.parseEqFilter( name, typeName ) )
                inputFields.push( ...WhereInputPlugin.parseInFilter( name, typeName ) )
                break
            case DataModelType.BOOLEAN:
                inputFields.push( ...WhereInputPlugin.parseEqFilter( name, typeName ) )
                break
            case DataModelType.CUSTOM_SCALAR:
                inputFields = WhereInputPlugin.createWhereFilterCustomScalars( inputFields, field, name )
                break
            case DataModelType.RELATION:
                inputFields.push( {
                    fieldName: name,
                    type: `${typeName}WhereInput`,
                } )
                break
            }
        } )

        return inputFields.map( ( { fieldName, type } ) => `${fieldName}: ${type}` ).join( ' ' )
    }

    private static createWhereFilterCustomScalars ( inputFields:  Array<{fieldName: string; type: string}>, field: Field, name: string ): Array<{fieldName: string; type: string}> {
        const typeName: string = field.getTypename()
        switch ( typeName ) {
        case DataModelType.URL:
        case DataModelType.EMAIL:
            inputFields.push( ...WhereInputPlugin.parseEqFilter( name, typeName ) )
            inputFields.push( ...WhereInputPlugin.parseContainsFilter( name, typeName ) )
            break
        case DataModelType.DATE_TIME:
            inputFields.push( ...WhereInputPlugin.parseEqFilter( name, typeName ) )
            inputFields.push( ...WhereInputPlugin.parseGtLtInFilter( name, typeName ) )
            inputFields.push( {
                fieldName: `${name}_between`, type: inputDateTimeBetweenName,
            } )
            break
        }
        return inputFields
    }

    private createWhereUniqueFilter( modelName: string, fields: Record<string, Field> ): string {
        // create equals on scalar fields
        const inputFields: Array<{fieldName: string; type: string}> = []
        forEach( fields, ( field, name ) => {
            if ( field.isUnique() ) {
                inputFields.push( {
                    fieldName: name,
                    type: field.getTypename(),
                } )
            }
        } )

        if ( isEmpty( fields ) ) {
            throw new Error( `no unique field find in model ${modelName}` )
        }
        return inputFields.map( ( { fieldName, type } ) => `${fieldName}: ${type}` ).join( ' ' )
    }

    private static parseEqFilter ( name: string, type: string ): Array<{ fieldName: string; type: string } > {
        return [ { fieldName: name, type }, { fieldName: `${name}_eq`, type }, { fieldName: `${name}_neq`, type } ]
    }

    private static parseContainsFilter ( name: string, type: string ): Array<{ fieldName: string; type: string } > {
        return [ { fieldName: `${name}_contains`, type }, { fieldName: `${name}_notcontains`, type } ]
    }

    private static parseInFilter ( name: string, type: string ): Array<{ fieldName: string; type: string } > {
        return [
            { fieldName: `${name}_in`, type: `[ ${type} ]` }
        ]
    }

    private static parseGtLtInFilter ( name: string, type: string ): Array<{ fieldName: string; type: string } > {
        return [
            { fieldName: `${name}_gt`, type },
            { fieldName: `${name}_gte`, type },
            { fieldName: `${name}_lt`, type },
            { fieldName: `${name}_lte`, type },
            { fieldName: `${name}_in`, type: `[ ${type} ]` }
        ]
    }
}
