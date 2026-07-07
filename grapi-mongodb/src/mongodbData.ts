import {
    getRelationItemKeyId,
    iterateBaseFilter,
    iterateRelationsWhere,
    iterateWhereFilter,
    Mutation,
    Operator,
    OrderBy,
    Pagination,
    RelationShip,
    RelationWhere,
    Where,
    WhereOperator
} from '@grapi/server'
import { FilterListObject } from '@grapi/server/lib/dataModel/type'
import { Db, Filter } from 'mongodb'

import {
    assign,
    compact,
    concat,
    get,
    includes,
    isEmpty,
    isEqual,
    toLower,
    uniqWith
} from './lodash'
import {
    batchFetchOneToManyChildren,
    batchFetchToOneRelations,
    classifyFilters,
    collectNestedRelations,
    findRecursiveOperator,
    handleMongoDbError,
    peelInlineDbFilters,
    transformMutation,
    whereToFilterQuery,
} from './mongodbUtils'

export class MongodbData {
    readonly db: Db
    readonly collectionName: string

    constructor( db: Db, collectionName: string ) {
        this.db = db
        this.collectionName = collectionName
    }

    // ── Query helpers ────────────────────────────────────────────────

    public async findOneInCollection( filterQuery: Filter<unknown> ): Promise<unknown> {
        return this.db.collection( this.collectionName ).findOne( filterQuery )
    }

    public async findInCollection( filterQuery: Filter<unknown>, orderBy = {}, pagination: Pagination = {} ): Promise<unknown[]> {
        return await this.db.collection( this.collectionName )
            .find( filterQuery )
            .sort( orderBy )
            .skip( pagination.skip || 0 )
            .limit( pagination.take || 0 )
            .project( { _id: 0 } )
            .toArray()
    }

    public whereToFilterQuery( where: Where | Array<Where>, operator: Operator | undefined = undefined ): Filter<Record<string, unknown>> {
        return whereToFilterQuery( where, operator )
    }

    public findRecursiveOperator( where: Where ): { operator?: Operator; filters?: Array<Where> } {
        return findRecursiveOperator( where )
    }

    public transformMutation( mutation: Mutation, set: boolean = false ): Record<string, unknown> {
        return transformMutation( mutation, set )
    }

    public handleMongoDbError( error: unknown ): void {
        handleMongoDbError( error, this.collectionName )
    }

    public async findOneRelation( collectionName: string, where: Where ): Promise<unknown> {
        return this.db.collection( collectionName ).findOne( this.whereToFilterQuery( where ) )
    }

    public async findManyRelation( foreignKey: string, foreignId: string, collectionName: string, where: Where ): Promise<unknown[]> {
        const filterQuery: Filter<unknown> = this.whereToFilterQuery( { ...where, [foreignKey]: { [Operator.eq]: foreignId } } as Where )
        return await this.db.collection( collectionName )
            .find( filterQuery )
            .project( { _id: 0 } )
            .toArray()
    }

    public async filterManyFromManyRelation( sourceSideName: string, targetSideName: string, sourceSideId: string, collection: string, where: Record<string, any> ): Promise<unknown[]> {
        const relationTableName = `_${sourceSideName}_${targetSideName}`
        const relationData = await this.db.collection( relationTableName ).findOne( { sourceSideId } )
        const relationIds: string[] = get( relationData, `targetSideIds`, [] )

        if ( isEmpty( relationIds ) ) return []

        const eqFilter = get( where, 'id.eq' )
        const idsToQuery: string[] = eqFilter
            ? ( includes( relationIds, eqFilter ) ? [ eqFilter ] : [] )
            : relationIds

        if ( isEmpty( idsToQuery ) ) return []

        const batchWhere = { ...where, id: { [Operator.in]: idsToQuery } }
        const filterQuery: Filter<unknown> = this.whereToFilterQuery( batchWhere as unknown as Where )
        return await this.db.collection( collection )
            .find( filterQuery )
            .project( { _id: 0 } )
            .toArray()
    }

    // ── Core recursive filtering ────────────────────────────────────

    public async findRecursive( where: Record<string, any>, orderBy: OrderBy, pagination: Pagination, data: unknown[] = [] ): Promise<unknown[]> {
        let isSeeded = false

        await iterateWhereFilter( where, async ( filterGroup: ( Record<string, RelationWhere> | Array<Record<string, RelationWhere>> ), op: ( Operator | WhereOperator ) ) => {
            if ( op as WhereOperator === WhereOperator.relation ) {
                if ( !isSeeded ) {
                    data = await this.findInCollection( {}, orderBy, pagination )
                    isSeeded = true
                }
                data = await this.executeRelationFilters( filterGroup as Record<string, RelationWhere>, data as Array<{ id: string }> )
                return
            }

            const { dbFilters, relFilters } = classifyFilters( filterGroup, op )

            if ( isEmpty( dbFilters ) === false || op === WhereOperator.base || isEmpty( filterGroup ) ) {
                const filters = isEmpty( dbFilters ) ? filterGroup : dbFilters
                data = await this.findInCollection( whereToFilterQuery( filters, op as Operator ), orderBy, isEmpty( relFilters ) ? pagination : {} )
                isSeeded = true
            }

            if ( isEmpty( relFilters ) === false ) {
                data = await this.combineByOperator( op, relFilters, data, isSeeded )
            }
        } )
        return data
    }

    private async combineByOperator(
        op: Operator | WhereOperator,
        relFilters: RelationWhere[],
        data: unknown[],
        isSeeded: boolean
    ): Promise<unknown[]> {
        const inlineDbFilters = peelInlineDbFilters( relFilters )
        const queryFn = whereToFilterQuery

        const seed: unknown[] = ( op === Operator.or && isEmpty( inlineDbFilters ) )
            ? await this.findInCollection( {} )
            : await this.findInCollection( queryFn( inlineDbFilters as any, op as any ) )

        if ( op === Operator.or ) {
            const results = await Promise.all(
                relFilters.map( rf =>
                    this.executeRelationFilters(
                        rf as unknown as Record<string, RelationWhere>,
                        seed as Array<{ id: string }>
                    )
                )
            )
            data = concat( data, ...results )
            return uniqWith( compact( data ), isEqual )
        }

        let rows = !isSeeded ? seed : data
        for ( const rf of relFilters ) {
            rows = await this.executeRelationFilters(
                rf as unknown as Record<string, RelationWhere>,
                rows as Array<{ id: string }>
            )
        }
        return rows
    }

    // ── Relation filter evaluation ──────────────────────────────────

    public async executeRelationFilters( where: Record<string, RelationWhere>, data: Array<{ id: string }>, filtered: Array<{ id: string }> = [] ): Promise<Array<{ id: string }>> {
        const listCache = await batchFetchOneToManyChildren( this.db, whereToFilterQuery, where, data )
        const toOneCache = await batchFetchToOneRelations( this.db, whereToFilterQuery, where, data )

        for ( const item of data ) {
            const matched = await iterateRelationsWhere( where, async ( relationWhere: RelationWhere ) => {
                return this.evaluateRelationFilter( relationWhere, item, listCache, toOneCache )
            } )
            if ( matched === undefined ) return data
            if ( matched ) filtered.push( item )
        }
        return filtered
    }

    private async evaluateRelationFilter(
        relationWhere: RelationWhere,
        item: { id: string },
        listCache: Map<string, Map<string, unknown[]>>,
        toOneCache: Map<string, Map<string, unknown>>
    ): Promise<boolean> {
        const relations = collectNestedRelations( relationWhere )
        const { list } = relationWhere.relation || {}

        if ( list ) {
            return this.evaluateListRelation( relationWhere, item, relations, listCache )
        }
        return this.evaluateToOneRelation( relationWhere, item, relations, toOneCache )
    }

    // eslint-disable-next-line max-lines-per-function
    private async evaluateListRelation(
        relationWhere: RelationWhere,
        item: { id: string },
        relations: Record<string, RelationWhere>,
        cache: Map<string, Map<string, unknown[]>>
    ): Promise<boolean> {
        const { filters, targetKey } = relationWhere
        const { ship, source, target, filter, foreignKey } = relationWhere.relation || {}
        const isManyToMany = ship === RelationShip.ManyToMany
        const fkValue = foreignKey || `${toLower( source || '' )}Id`
        const cacheKey = `${targetKey}:${fkValue}`
        const cached = cache.get( cacheKey )

        let relationData: unknown[]
        if ( !isManyToMany && cached ) {
            relationData = cached.get( item.id ) || []
        } else if ( isManyToMany ) {
            relationData = await this.filterManyFromManyRelation(
                toLower( source || '' ), toLower( target || '' ),
                item.id, targetKey, iterateBaseFilter( filters )
            )
        } else {
            relationData = await this.findManyRelation(
                fkValue, item.id, targetKey, filters
            )
        }

        let passed: boolean
        if ( filter === FilterListObject.SOME ) {
            passed = !isEmpty( relationData )
        } else if ( filter === FilterListObject.NONE ) {
            passed = isEmpty( relationData )
        } else {
            if ( isEmpty( relationData ) ) {
                passed = false
            } else {
                const totalCacheKey = `${cacheKey}:total`
                const cachedTotal = cache.get( totalCacheKey )
                let totalData: unknown[]
                if ( cachedTotal ) {
                    totalData = cachedTotal.get( item.id ) || []
                } else if ( isManyToMany ) {
                    totalData = await this.filterManyFromManyRelation(
                        toLower( source || '' ), toLower( target || '' ),
                        item.id, targetKey, {}
                    )
                } else {
                    totalData = await this.findManyRelation(
                        fkValue, item.id, targetKey, filters
                    )
                }
                passed = totalData.length === relationData.length
            }
        }

        if ( passed && !isEmpty( relations ) ) {
            const recursive = await this.executeRelationFilters( relations, relationData as Array<{ id: string }> )
            return !isEmpty( recursive )
        }
        return passed
    }

    private async evaluateToOneRelation(
        relationWhere: RelationWhere,
        item: { id: string },
        relations: Record<string, RelationWhere>,
        cache: Map<string, Map<string, unknown>>
    ): Promise<boolean> {
        const relation = relationWhere.relation
        const { itemId, key } = getRelationItemKeyId( item, relation )

        if ( !itemId ) return false

        const filterId = get( relationWhere, 'filters.id' )
        if ( filterId ) {
            const { eq: eqValue, neq: neqValue } = filterId as { eq?: string; neq?: string }
            if ( eqValue !== undefined ) return itemId === eqValue
            if ( neqValue !== undefined ) return itemId !== neqValue
            return false
        }

        const cached = cache.get( `${relationWhere.targetKey}:${key}` )
        const relationData: any = cached
            ? ( cached.get( itemId ) || null )
            : await this.findOneRelation(
                relationWhere.targetKey,
                iterateBaseFilter( assign( { [ key ]: { eq: itemId } }, relationWhere.filters ) )
            )

        if ( relationData && !isEmpty( relations ) ) {
            const recursive = await this.executeRelationFilters( relations, [ relationData as { id: string } ] )
            return !isEmpty( recursive )
        }
        return relationData !== null
    }
}
