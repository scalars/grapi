import { OrderBy } from '..'
import Field from '../dataModel/field'
import Model from '../dataModel/model'
import { DataModelType } from '../dataModel/type'
import { forEach, isEmpty, transform } from '../lodash'
import { orderByInputName } from './constants'
import { Context, Plugin } from './interface'

const enum OrderByEnum {
    ASC = 'ASC',
    DESC = 'DESC'
}

const parserOrder = ( order: Record<string, any> ) => {
    if ( isEmpty( order ) === false ) {
        return transform( order, ( result: OrderBy, value: OrderByEnum, fieldName: string  ) => {
            if ( value === OrderByEnum.ASC ) {
                result[fieldName] = 1
            } else {
                result[fieldName] = -1
            }
            return result
        } )
    }
    return null
}

export default class OrderInputPlugin implements Plugin {
    public visitModel( model: Model, context: Context ): void {
        // list model
        const { root } = context

        // add where input
        const modelOrderInputName = this.getOrderInputName( model )
        // add filter: https://www.opencrud.org/#sec-Data-types
        const orderInput = `input ${modelOrderInputName} {
            ${this.createOrderFilter( model.getFields() )}
        }`
        root.addInput( orderInput )
    }

    public getOrderInputName( model: Model ): string {
        return `${model.getNamings().capitalSingular}OrderInput`
    }

    public static parseOrder( order: Record<string, OrderByEnum> ): OrderBy | null {
        return parserOrder( order )
    }

    public parseOrder( order: Record<string, OrderByEnum> ): OrderBy | null {
        return parserOrder( order )
    }

    private createOrderFilter( fields: Record<string, Field> ): string {
        const inputFields: Array<{fieldName: string; type: string}> = []
        forEach( fields, ( field, name ) => {
            switch ( field.getType()  ) {
            case DataModelType.STRING:
            case DataModelType.INT:
            case DataModelType.FLOAT:
            case DataModelType.ENUM:
            case DataModelType.BOOLEAN:
            case DataModelType.CUSTOM_SCALAR:
            case DataModelType.ID:
                inputFields.push( {
                    fieldName: name,
                    type: orderByInputName,
                } )
                break
            }
        } )

        return inputFields.map( ( { fieldName, type } ) => `${fieldName}: ${type}` ).join( ' ' )
    }
}
