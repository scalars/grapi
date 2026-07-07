import {
    ArrayOperator,
    getRelationItemKeyId,
    iterateBaseFilter,
    iterateWhere,
    Mutation,
    Operator,
    RelationShip,
    RelationWhere,
    Where,
    WhereFilter,
    WhereOperator
} from '@grapi/server'
import { FilterListObject } from '@grapi/server/lib/dataModel/type'
import { Db, Filter } from 'mongodb'

import {
    assign,
    capitalize,
    findKey,
    forEach,
    get,
    isEmpty,
    isEqual,
    keys,
    toLower,
    uniqWith
} from './lodash'

// ── Pure filter utilities (no DB dependency) ──────────────────────

/** Classify each filter in an AND/OR group as DB-level (plain fields) or relation-level (nested objects). */
export function classifyFilters(
    filterGroup: Record<string, RelationWhere | Where> | Array<Record<string, RelationWhere>>,
    op: Operator | WhereOperator
): { dbFilters: any[]; relFilters: RelationWhere[] } {
    const dbFilters: any[] = []
    const relFilters: RelationWhere[] = []

    if ( op !== Operator.and && op !== Operator.or ) {
        return { dbFilters, relFilters }
    }

    forEach( filterGroup as Record<string, RelationWhere>, ( item: RelationWhere ) => {
        if ( findKey( item, 'relation' ) ) {
            relFilters.push( item )
        } else {
            dbFilters.push( item )
        }
    } )
    return { dbFilters, relFilters }
}

/** Peel inline field:value pairs (e.g. {status: "ok"}) out of relation filter objects so they can be queried directly against the DB. */
export function peelInlineDbFilters( relFilters: RelationWhere[] ): Where[] {
    let inlineFilters: Where[] = []
    forEach( relFilters, ( item: RelationWhere ) => {
        forEach( item as Record<string, any>, ( value: any, key: string ) => {
            if ( ! get( value, 'relation' ) ) {
                delete ( item as Record<string, any> )[key]
                inlineFilters.push( { [key]: value } )
            }
        } )
    } )
    inlineFilters = uniqWith( inlineFilters, isEqual )
    return inlineFilters
}

/** Group an array of child documents by a parent foreign key. */
export function groupChildrenByParent( children: unknown[], fkValue: string ): Map<string, unknown[]> {
    const grouped = new Map<string, unknown[]>()
    for ( const child of children ) {
        const parentId = ( child as Record<string, any> )[fkValue] as string
        if ( !grouped.has( parentId ) ) grouped.set( parentId, [] )
        grouped.get( parentId )!.push( child )
    }
    return grouped
}

/** Collects nested relation filters from a RelationWhere's filters object. */
export function collectNestedRelations( relationWhere: RelationWhere ): Record<string, RelationWhere> {
    const relations: Record<string, RelationWhere> = {}
    forEach( ( relationWhere.filters || {} ) as Record<string, any>, ( value: RelationWhere, key: string ) => {
        if ( value.relation ) { relations[ key ] = value }
    } )
    return relations
}

/** Extracts AND/OR operator and its associated filters from a Where object. */
export function findRecursiveOperator( where: Where ): { operator?: Operator; filters?: Array<Where> } {
    if ( get( where, Operator.or ) ) {
        return { operator: Operator.or, filters: where[Operator.or] }
    } else if ( get( where, Operator.and ) ) {
        return { operator: Operator.and, filters: where[Operator.and] }
    }
    return {}
}

/** Translates Grapi's Where format into a MongoDB Filter<Document>. */
export function whereToFilterQuery( where: Where | Array<Where>, operator: Operator | undefined = undefined ): Filter<Record<string, unknown>> {
    const filterQuery: Record<string, unknown> = {}
    const operatorMap: Partial<Record<Operator, ( field: string, value: WhereFilter & { to?: unknown; from?: unknown } ) => void>> = {
        [Operator.eq]: ( field, value ) => { filterQuery[field] = value },
        [Operator.contains]: ( field, value ) => { filterQuery[field] = new RegExp( `.*${value}.*`, `i` ) },
        [Operator.notcontains]: ( field, value ) => { filterQuery[field] = new RegExp( `^((?!${value}).)*$`, `i` ) },
        [Operator.neq]: ( field, value ) => { filterQuery[field] = { $ne: value } },
        [Operator.gt]: ( field, value ) => { filterQuery[field] = { $gt: value } },
        [Operator.gte]: ( field, value ) => { filterQuery[field] = { $gte: value } },
        [Operator.lt]: ( field, value ) => { filterQuery[field] = { $lt: value } },
        [Operator.lte]: ( field, value ) => { filterQuery[field] = { $lte: value } },
        [Operator.in]: ( field, value ) => { filterQuery[field] = { $in: value } },
        [Operator.all]: ( field, value ) => { filterQuery[field] = { $all: value } },
        [Operator.notIn]: ( field, value ) => { filterQuery[field] = { $nin: value } },
        [Operator.between]: ( field, value ) => { filterQuery[field] = { $gte: value.from, $lte: value.to } },
        [Operator.object]: ( field, value ) => { assign( filterQuery, value ) },
    }
    if ( isEmpty( where ) === false && ( operator === Operator.or || operator === Operator.and ) ) {
        const filtersQuery: Array<Filter<unknown>> = []
        forEach( where as Array<Where>, ( whereItem: Where ) => {
            if ( isEmpty( whereItem ) === false ) {
                const { operator: innerOp, filters } = findRecursiveOperator( whereItem )
                if ( innerOp ) {
                    filtersQuery.push( whereToFilterQuery( filters!, innerOp ) )
                } else {
                    filtersQuery.push( whereToFilterQuery( whereItem ) )
                }
            }
        } )
        filterQuery[ `$${toLower( operator )}` ] = filtersQuery
    } else {
        iterateWhere( where as Where, ( field, operator, value ) => {
            const handler = operatorMap[operator]
            if ( handler ) { handler( field, value ) }
        } )
    }
    return filterQuery
}

/** Converts a Grapi Mutation into a MongoDB update document. */
export function transformMutation( mutation: Mutation, set: boolean = false ): Record<string, unknown> {
    const payload = set ? { $set: mutation.getData() } : mutation.getData()
    mutation.getArrayOperations().forEach( operation => {
        const { fieldName, operator, value } = operation
        if ( operator == ArrayOperator.set ) {
            if ( set ) {
                payload.$set[fieldName] = value
            } else {
                payload[fieldName] = value
            }
        } else if ( operator == ArrayOperator.add ) {
            payload.$addToSet = { ...payload.$addToSet, [ fieldName ]: { $each: value } }
        } else if ( operator == ArrayOperator.remove ) {
            payload.$pull = { ...payload.$pull, [ fieldName ]: { $in: value } }
        }
    } )
    return payload
}

/** Translates common MongoDB errors into user-friendly messages. */
export function handleMongoDbError( error: unknown, collectionName: string ): void {
    if ( ( error as { code?: number } ).code === 11000 ) {
        const keyValues: string = keys( ( error as { keyValue?: Record<string, unknown> } ).keyValue ).join( ', ' )
        throw new Error(
            `Constraint unique value expected for "${ keyValues }" duplicate on ${ capitalize( collectionName ) } model`,
        )
    } else if ( ( error as { code?: number } ).code === 121 ) {
        throw new Error(
            `Document failed validation on ${ capitalize( collectionName ) } model, review types or required values in data`,
        )
    }
    throw new Error( `${ ( error as { message?: string } ).message }` )
}

// ── Batch pre-fetch utilities ──────────────────────────────────────

/**
 * Pre-fetches one-to-many children for all parent items in a single $in query.
 * Returns a map keyed by `collection:foreignKey` → itemId → children[].
 * Also includes unfiltered totals under `collection:foreignKey:total` (only for EVERY).
 */
export async function batchFetchOneToManyChildren(
    db: Db,
    whereToFilterQueryFn: ( where: Where | Array<Where>, operator?: Operator ) => Filter<Record<string, unknown>>,
    where: Record<string, RelationWhere>,
    data: Array<{ id: string }>
): Promise<Map<string, Map<string, unknown[]>>> {
    const cache = new Map<string, Map<string, unknown[]>>()
    const parentIds = data.map( item => item.id )

    for ( const relationWhere of Object.values( where ) ) {
        const { list, ship, source, foreignKey } = relationWhere.relation || {}
        if ( !list || ship === RelationShip.ManyToMany ) continue

        const { filters, targetKey } = relationWhere
        const fkValue = foreignKey || `${toLower( source || '' )}Id`
        const cacheKey = `${targetKey}:${fkValue}`
        if ( cache.has( cacheKey ) ) continue

        const hasNested = Object.values( relationWhere.filters || {} ).some(
            ( v: any ) => v && v.relation
        )
        if ( hasNested ) continue

        const baseFilters = iterateBaseFilter( filters )
        const filterQuery = whereToFilterQueryFn( {
            ...baseFilters,
            [fkValue]: { [Operator.in]: parentIds },
        } as Where )
        const allChildren = await db.collection( targetKey )
            .find( filterQuery )
            .project( { _id: 0 } )
            .toArray()

        cache.set( cacheKey, groupChildrenByParent( allChildren, fkValue ) )

        const filterType = relationWhere.relation?.filter
        const needsTotals = !filterType || filterType === FilterListObject.EVERY
        if ( needsTotals ) {
            const totalFilterQuery = whereToFilterQueryFn( {
                [fkValue]: { [Operator.in]: parentIds },
            } as Where )
            const allTotalChildren = await db.collection( targetKey )
                .find( totalFilterQuery )
                .project( { _id: 0 } )
                .toArray()
            cache.set( `${cacheKey}:total`, groupChildrenByParent( allTotalChildren, fkValue ) )
        }
    }
    return cache
}

/**
 * Batch-fetches to-one related documents for all items in a single $in query.
 * Returns a map keyed by `collection:key` → itemId → document.
 */
export async function batchFetchToOneRelations(
    db: Db,
    whereToFilterQueryFn: ( where: Where | Array<Where>, operator?: Operator ) => Filter<Record<string, unknown>>,
    where: Record<string, RelationWhere>,
    data: Array<{ id: string }>
): Promise<Map<string, Map<string, unknown>>> {
    const cache = new Map<string, Map<string, unknown>>()

    for ( const relationWhere of Object.values( where ) ) {
        const relation = relationWhere.relation
        if ( !relation || relation.list ) continue

        const { filters, targetKey } = relationWhere

        const hasNested = Object.values( filters || {} ).some(
            ( v: any ) => v && v.relation
        )
        if ( hasNested || get( relationWhere, 'filters.id' ) ) continue

        const itemRefs = data.map( item => getRelationItemKeyId( item, relation ) )
        const key = itemRefs[0]?.key
        if ( !key ) continue

        const ids = itemRefs.map( r => r.itemId ).filter( Boolean )
        if ( isEmpty( ids ) ) continue

        const cacheKey = `${targetKey}:${key}`
        if ( cache.has( cacheKey ) ) continue

        const baseFilters = iterateBaseFilter( filters )
        const filterQuery = whereToFilterQueryFn( {
            ...baseFilters,
            [key]: { [Operator.in]: ids },
        } as unknown as Where )
        const docs = await db.collection( targetKey )
            .find( filterQuery )
            .project( { _id: 0 } )
            .toArray()

        const indexed = new Map<string, unknown>()
        for ( const doc of docs ) {
            indexed.set( ( doc as Record<string, any> )[key] as string, doc )
        }
        cache.set( cacheKey, indexed )
    }
    return cache
}
