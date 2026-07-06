import { Operator, Where, WhereFilter, WhereOperator } from '..'
import { RelationShip, RelationType } from '../dataModel/relation/types'
import { FilterListObject } from '../dataModel/type'
import { forEach, has, isEmpty, keys, omit, transform } from '../lodash'

export interface RelationWhereConfig {
    foreignKey: string;
    filter: FilterListObject,
    source: string;
    target: string;
    ship: RelationShip;
    list: boolean;
    type: RelationType;
}

export interface RelationWhere {
    sourceKey: string;
    targetKey: string;
    relation: RelationWhereConfig;
    filters: Where;
}

/**
 * Iterates over a flat Where object calling callback for each field:operator:value combination.
 *
 * Example: given `{ name: { contains: "dsd" }, age: { gt: 18 } }`
 * it calls:
 *   callback("name", "contains", "dsd")
 *   callback("age",  "gt",       18)
 */
export const iterateWhere = ( where: Where, callback: ( field: string, op: Operator, value: WhereFilter ) => void ): void => {
    for ( const [ field, operators ] of Object.entries( where ) ) {
        if ( typeof operators !== 'object' ) continue
        for ( const [ op, value ] of Object.entries( operators ) ) {
            callback( field, op as Operator, value as WhereFilter )
        }
    }
}

export const iterateRelationsWhere = async ( where: Record<string, RelationWhere>, callback: ( relationWhere: RelationWhere ) => Promise<boolean> ): Promise<boolean> => {
    let filter = true
    for ( const filterKey in where ) {
        filter = filter && await callback( where[ filterKey ] )
        if ( !filter ) { return filter }
    }
    return filter
}

export const iterateWhereFilter = async (
    where: ( Record<string, RelationWhere> | Array<Record<string, RelationWhere>>  ),
    callback: (
        relationWhere: ( Record<string, RelationWhere> | Array<Record<string, RelationWhere>> ),
        operator: Operator|WhereOperator
    ) => Promise<void>
): Promise<void> => {
    if ( isEmpty( where ) ) { await callback( {}, undefined ) }
    // Clean base filters from where
    const baseFilter: Record<string, RelationWhere> = transform( where as any, ( result: Record<string, RelationWhere>, value: RelationWhere, key: string ) => {
        if ( key !== Operator.or && key !== Operator.and && has( value, 'filters' ) === false ) {
            result[ key ] = value
        }
        return result
    } )
    if ( isEmpty( baseFilter ) === false ) {
        // Execute Base Filters
        await callback( baseFilter, WhereOperator.base )
    }
    const filters: Record<string, RelationWhere> = omit( where, keys( baseFilter ) ) as any
    // Still there are relation filters on base ?
    if ( isEmpty( filters ) === false ) {
        // Execute relation filters
        const relationFilters: Record<string, RelationWhere> = {}
        for ( const filterKey in filters ) {
            if ( filterKey === Operator.or || filterKey === Operator.and ) {
                await callback( filters[ filterKey ] as any, filterKey as Operator )
            } else {
                relationFilters[ filterKey ] = filters[ filterKey ]
            }
        }
        if ( isEmpty( relationFilters ) === false ) {
            await callback( relationFilters, WhereOperator.relation )
        }
    }
    // TODO Implement async Promise.all forEach lodash
}

export const iterateWhereRelationsFilter =  async ( relationFilter: Record<string, RelationWhere>, callback: ( relationWhere: RelationWhere ) => Promise<void> ): Promise<void> => {
    forEach( relationFilter, async ( value: RelationWhere ) => {
        await callback( value )
    } )
}

export const iterateBaseFilter = ( where: Where ): Where => {
    return transform( where, ( result: Record<string, Where>, value: any, key: string ) => {
        if ( key !== Operator.or && key !== Operator.and && has( value, 'filters' ) === false ) {
            result[ key ] = value
        }
        return result
    } )
}

export const getRelationItemKeyId = ( item: any, relation: RelationWhereConfig ): { itemId: string; key: string} => {
    const itemId: string = item[ relation.foreignKey]
    if ( itemId ) {
        return { itemId, key: `id` }
    }
    return { itemId: item.id, key: relation.foreignKey }
}
