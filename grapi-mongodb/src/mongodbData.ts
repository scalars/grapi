import {
    ArrayOperator,
    getRelationItemKeyId,
    iterateBaseFilter,
    iterateRelationsWhere,
    iterateWhere,
    iterateWhereFilter,
    Mutation,
    Operator,
    OrderBy,
    Pagination,
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
    compact,
    concat,
    findKey,
    forEach,
    get,
    includes,
    isEmpty,
    isEqual,
    keys,
    toLower,
    uniqWith
} from './lodash'

export class MongodbData {
    readonly db: Db
    readonly collectionName: string

    constructor( db: Db, collectionName: string ) {
        this.db = db
        this.collectionName = collectionName
    }

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

    public async findRecursive ( where: Record<string, any>, orderBy: OrderBy, pagination: Pagination, data: unknown[] = [] ): Promise<unknown[]> {
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

            const { dbFilters, relFilters } = this.classifyFilters( filterGroup, op )

            if ( isEmpty( dbFilters ) === false || op === WhereOperator.base || isEmpty( filterGroup ) ) {
                const filters = isEmpty( dbFilters ) ? filterGroup : dbFilters
                const filterQuery: Filter<unknown> = this.whereToFilterQuery( filters, op as Operator )
                data = await this.findInCollection( filterQuery, orderBy, isEmpty( relFilters ) ? pagination : {} )
                isSeeded = true
            }

            if ( isEmpty( relFilters ) === false ) {
                data = await this.combineByOperator( op, relFilters, data, isSeeded )
            }
        } )
        return data
    }

    /** Classify each filter in an AND/OR group as DB-level (plain fields) or relation-level (nested objects). */
    private classifyFilters(
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
    private peelInlineDbFilters( relFilters: RelationWhere[] ): Where[] {
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

    /** Combine relation filter results using AND (intersection) or OR (union). */
    private async combineByOperator(
        op: Operator | WhereOperator,
        relFilters: RelationWhere[],
        data: unknown[],
        isSeeded: boolean
    ): Promise<unknown[]> {
        const inlineDbFilters = this.peelInlineDbFilters( relFilters )

        // Seed collection for relation traversal.
        // OR with no inline DB filters → query everything so relation matches aren't silently dropped.
        const seed: unknown[] = ( op === Operator.or && isEmpty( inlineDbFilters ) )
            ? await this.findInCollection( {} )
            : await this.findInCollection( this.whereToFilterQuery( inlineDbFilters as any, op as any ) )

        if ( op === Operator.or ) {
            // OR filters are independent — run them in parallel against the same seed
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

        // AND: start from seed (if no prior data) then narrow through each relation filter
        let rows = !isSeeded ? seed : data
        for ( const rf of relFilters ) {
            rows = await this.executeRelationFilters(
                rf as unknown as Record<string, RelationWhere>,
                rows as Array<{ id: string }>
            )
        }
        return rows
    }

    public async executeRelationFilters( where: Record<string, RelationWhere>, data: Array<{ id: string }>, filtered: Array<{ id: string }> = [] ): Promise<Array<{ id: string }>> {
        // Pre-fetch relation data in batch queries to eliminate N+1 round-trips.
        const listCache = await this.batchFetchOneToManyChildren( where, data )
        const toOneCache = await this.batchFetchToOneRelations( where, data )

        for ( const item of data ) {
            const matched = await iterateRelationsWhere( where, async ( relationWhere: RelationWhere ) => {
                return this.evaluateRelationFilter( relationWhere, item, listCache, toOneCache )
            } )
            if ( matched === undefined ) { return data }
            if ( matched ) {
                filtered.push( item )
            }
        }
        return filtered
    }

    /** Collects nested relation filters from a RelationWhere's filters object. */
    private collectNestedRelations( relationWhere: RelationWhere ): Record<string, RelationWhere> {
        const relations: Record<string, RelationWhere> = {}
        forEach( ( relationWhere.filters || {} ) as Record<string, any>, ( value: RelationWhere, key: string ) => {
            if ( value.relation ) { relations[ key ] = value }
        } )
        return relations
    }

    /** Dispatches a single relation filter to list or to-one evaluation. */
    private async evaluateRelationFilter(
        relationWhere: RelationWhere,
        item: { id: string },
        listCache: Map<string, Map<string, unknown[]>>,
        toOneCache: Map<string, Map<string, unknown>>
    ): Promise<boolean> {
        const relations = this.collectNestedRelations( relationWhere )
        const { list } = relationWhere.relation || {}

        if ( list ) {
            return this.evaluateListRelation( relationWhere, item, relations, listCache )
        }
        return this.evaluateToOneRelation( relationWhere, item, relations, toOneCache )
    }

    /** Evaluates a to-many (list) relation filter for one item, using batched cache when available. */
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

        // Fetch children: batched cache → manyToMany query → per-item query
        let relationData: unknown[]
        if ( !isManyToMany && cached ) {
            relationData = cached.get( item.id ) || []
        } else if ( isManyToMany ) {
            relationData = await this.filterManyFromManyRelation(
                toLower( source || '' ),
                toLower( target || '' ),
                item.id,
                targetKey,
                iterateBaseFilter( filters )
            )
        } else {
            relationData = await this.findManyRelation( fkValue, item.id, targetKey, filters )
        }

        // Evaluate SOME / NONE / EVERY
        let passed: boolean
        if ( filter === FilterListObject.SOME ) {
            passed = !isEmpty( relationData )
        } else if ( filter === FilterListObject.NONE ) {
            passed = isEmpty( relationData )
        } else {
            if ( isEmpty( relationData ) ) {
                passed = false
            } else {
                // EVERY: filtered count must equal total count
                const totalCacheKey = `${cacheKey}:total`
                const cachedTotal = cache.get( totalCacheKey )
                let totalData: unknown[]
                if ( cachedTotal ) {
                    totalData = cachedTotal.get( item.id ) || []
                } else if ( isManyToMany ) {
                    totalData = await this.filterManyFromManyRelation(
                        toLower( source || '' ),
                        toLower( target || '' ),
                        item.id,
                        targetKey,
                        {}
                    )
                } else {
                    totalData = await this.findManyRelation( fkValue, item.id, targetKey, filters )
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

    /** Evaluates a to-one relation filter for one item, using batched cache when available. */
    private async evaluateToOneRelation(
        relationWhere: RelationWhere,
        item: { id: string },
        relations: Record<string, RelationWhere>,
        cache: Map<string, Map<string, unknown>>
    ): Promise<boolean> {
        const relation = relationWhere.relation
        const { itemId, key } = getRelationItemKeyId( item, relation )

        if ( !itemId ) return false

        // Short-circuit: direct eq/neq on filters.id without DB query
        const filterId = get( relationWhere, 'filters.id' )
        if ( filterId ) {
            const { eq: eqValue, neq: neqValue } = filterId as { eq?: string; neq?: string }
            if ( eqValue !== undefined ) return itemId === eqValue
            if ( neqValue !== undefined ) return itemId !== neqValue
            return false
        }

        // Batched cache or per-item findOne
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

    /**
     * Pre-fetches one-to-many children for all parent items in a single $in query.
     * Returns a map keyed by `collection:foreignKey` → itemId → children[].
     * Also includes unfiltered totals under `collection:foreignKey:total`.
     * Skips many-to-many relations and relationWheres with nested filters (relations).
     */
    private async batchFetchOneToManyChildren(
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
            if ( cache.has( cacheKey ) ) continue  // already fetched

            // Check if there are nested relations — if so, skip batching
            // (recursive evaluation needs per-item context)
            const hasNested = Object.values( relationWhere.filters || {} ).some(
                ( v: any ) => v && v.relation
            )
            if ( hasNested ) continue

            // Batch fetch: all children for all parents
            const baseFilters = iterateBaseFilter( filters )
            const filterQuery = this.whereToFilterQuery( {
                ...baseFilters,
                [fkValue]: { [Operator.in]: parentIds },
            } as Where )
            const allChildren = await this.db.collection( targetKey )
                .find( filterQuery )
                .project( { _id: 0 } )
                .toArray()

            // Group children by parent foreign key
            const grouped = this.groupChildrenByParent( allChildren, fkValue )
            cache.set( cacheKey, grouped )

            // Unfiltered totals needed only for EVERY evaluation.
            // SOME and NONE don't need them — skip the second query.
            const filterType = relationWhere.relation?.filter
            const needsTotals = !filterType || filterType === FilterListObject.EVERY
            if ( needsTotals ) {
                const totalFilterQuery = this.whereToFilterQuery( {
                    [fkValue]: { [Operator.in]: parentIds },
                } as Where )
                const allTotalChildren = await this.db.collection( targetKey )
                    .find( totalFilterQuery )
                    .project( { _id: 0 } )
                    .toArray()
                cache.set( `${cacheKey}:total`, this.groupChildrenByParent( allTotalChildren, fkValue ) )
            }
        }
        return cache
    }

    /** Group an array of child documents by a parent foreign key. */
    private groupChildrenByParent( children: unknown[], fkValue: string ): Map<string, unknown[]> {
        const grouped = new Map<string, unknown[]>()
        for ( const child of children ) {
            const parentId = ( child as Record<string, any> )[fkValue] as string
            if ( !grouped.has( parentId ) ) grouped.set( parentId, [] )
            grouped.get( parentId )!.push( child )
        }
        return grouped
    }

    /** Batch-fetch to-one related documents for all items in a single $in query. */
    private async batchFetchToOneRelations(
        where: Record<string, RelationWhere>,
        data: Array<{ id: string }>
    ): Promise<Map<string, Map<string, unknown>>> {
        const cache = new Map<string, Map<string, unknown>>()

        for ( const relationWhere of Object.values( where ) ) {
            const relation = relationWhere.relation
            if ( !relation || relation.list ) continue  // to-one only

            const { filters, targetKey } = relationWhere

            // Skip if nested relations or short-circuit id filter present
            const hasNested = Object.values( filters || {} ).some(
                ( v: any ) => v && v.relation
            )
            if ( hasNested || get( relationWhere, 'filters.id' ) ) continue

            // All items share the same key for the same relation
            const itemRefs = data.map( item => getRelationItemKeyId( item, relation ) )
            const key = itemRefs[0]?.key
            if ( !key ) continue

            const ids = itemRefs.map( r => r.itemId ).filter( Boolean )
            if ( isEmpty( ids ) ) continue

            const cacheKey = `${targetKey}:${key}`
            if ( cache.has( cacheKey ) ) continue

            // Single $in query instead of N findOne calls
            const baseFilters = iterateBaseFilter( filters )
            const filterQuery = this.whereToFilterQuery( {
                ...baseFilters,
                [key]: { [Operator.in]: ids },
            } as unknown as Where )
            const docs = await this.db.collection( targetKey )
                .find( filterQuery )
                .project( { _id: 0 } )
                .toArray()

            // Index by key value for O(1) per-item lookup
            const indexed = new Map<string, unknown>()
            for ( const doc of docs ) {
                indexed.set( ( doc as Record<string, any> )[key] as string, doc )
            }
            cache.set( cacheKey, indexed )
        }
        return cache
    }

    /** Query OneToOne relation object, used for applying filters
     * @param colectionName: Collection name where the referenced object lives
     * @param where: Filter with the referenced object ID plus additional filters
     */
    public async findOneRelation( colectionName: string, where: Where ): Promise<unknown> {
        return await this.db.collection( colectionName ).findOne( this.whereToFilterQuery( where ) )
    }

    /** Filter OneToMany — queries if child objects reference a Parent
     * @param foreignKey Attribute name that references the relation
     * @param foreignId ID of the parent object referenced by child objects
     * @param collectionName Collection name where the Parent is referenced
     * @param where Filter to apply on the child objects
     */
    public async findManyRelation( foreignKey: string, foreignId: string, collectionName: string, where: Where ): Promise<unknown[]> {
        const filterQuery: Filter<unknown> = this.whereToFilterQuery( { ...where, [foreignKey]: { [Operator.eq]: foreignId } } as Where )
        return await this.db.collection( collectionName )
            .find( filterQuery )
            .project( { _id: 0 } )
            .toArray()
    }

    /**
     * Filter ManyToMany — resolves relation IDs through the join collection
     * @param sourceSideName
     * @param targetSideName
     * @param sourceSideId
     * @param collection
     * @param where
     */
    public async filterManyFromManyRelation( sourceSideName: string, targetSideName: string, sourceSideId: string, collection: string, where: Record<string, any> ): Promise<unknown[]> {
        const relationTableName = `_${sourceSideName}_${targetSideName}`
        const relationData = await this.db.collection( relationTableName ).findOne( { sourceSideId } )
        const relationIds: string[] = get( relationData, `targetSideIds`, [] )

        if ( isEmpty( relationIds ) ) return []

        // Determine which IDs to query (respect existing id.eq filter)
        const eqFilter = get( where, 'id.eq' )
        const idsToQuery: string[] = eqFilter
            ? ( includes( relationIds, eqFilter ) ? [ eqFilter ] : [] )
            : relationIds

        if ( isEmpty( idsToQuery ) ) return []

        // Batch $in query instead of N individual findOne calls
        const batchWhere = { ...where, id: { [Operator.in]: idsToQuery } }
        const filterQuery: Filter<unknown> = this.whereToFilterQuery( batchWhere as unknown as Where )
        const results = await this.db.collection( collection )
            .find( filterQuery )
            .project( { _id: 0 } )
            .toArray()
        return results
    }

    public whereToFilterQuery( where: Where | Array<Where>, operator: Operator | undefined = undefined ): Filter<Record<string, unknown>> {
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
                    const { operator, filters } = this.findRecursiveOperator( whereItem )
                    if ( operator ) {
                        filtersQuery.push( this.whereToFilterQuery( filters!, operator ) )
                    } else {
                        filtersQuery.push( this.whereToFilterQuery( whereItem ) )
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

    public findRecursiveOperator ( where: Where ): { operator?: Operator; filters?: Array<Where> } {
        if ( get( where, Operator.or ) ) {
            return { operator: Operator.or, filters: where[Operator.or] }
        } else if ( get( where, Operator.and ) ) {
            return { operator: Operator.and, filters: where[Operator.and] }
        }
        return {}
    }

    public transformMutation( mutation: Mutation, set: boolean = false ): Record<string, unknown> {
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

    public handleMongoDbError ( error: unknown ): void {
        if ( ( error as { code?: number } ).code === 11000 ) {
            const keyValues: string = keys( ( error as { keyValue?: Record<string, unknown> } ).keyValue ).join( ', ' )
            throw new Error(
                `Constraint unique value expected for "${ keyValues }" duplicate on ${ capitalize( this.collectionName ) } model`,
            )
        } else if ( ( error as { code?: number } ).code === 121 ) {
            throw new Error(
                `Document failed validation on ${ capitalize( this.collectionName ) } model, review types or required values in data`,
            )
        }
        throw new Error( `${ ( error as { message?: string } ).message }` )
    }
}
