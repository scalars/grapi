import { OrderBy, OrderType } from '..'
import { forEach, isEmpty, orderBy } from '../lodash'

export const sort = ( rows: any[], order?: OrderBy ): any[] => {
    const orderFields: string[] = []
    const orderValues: ( 'asc' | 'desc' )[] = []
    if ( isEmpty( order ) ) {
        return rows
    } else {
        forEach( order, ( orderValue: OrderType, fieldName: string ) => {
            orderFields.push( fieldName )
            orderValues.push( orderValue === OrderType.ASC ? `asc` : `desc` )
        } )
    }
    return orderBy( rows, orderFields, orderValues )
}
