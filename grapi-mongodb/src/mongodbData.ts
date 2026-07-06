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
    RelationWhereConfig,
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
    has,
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
        let iteration: number = 0
        await iterateWhereFilter( where, async ( whereFilter: ( Record<string, RelationWhere> | Array<Record<string, RelationWhere>> ), operator: ( Operator | WhereOperator ) ) => {
            if ( operator as WhereOperator === WhereOperator.relation ) {
                data = isEmpty( data ) && iteration === 0 ? await this.findInCollection( {}, orderBy, pagination ) : data
                data = await this.executeRelationFilters( whereFilter as Record<string, RelationWhere>, data as Array<{ id: string }> )
            } else {
                const baseFilters: any[] = []
                const relationFilters: RelationWhere[] = []
                if ( operator === Operator.and || operator === Operator.or ) {
                    forEach( whereFilter, ( item: RelationWhere ) => {
                        if ( findKey( item, 'relation' ) ) {
                            relationFilters.push( item )
                        } else {
                            baseFilters.push( item )
                        }
                    } )
                }
                if ( isEmpty( baseFilters ) === false || ( operator as any ) === WhereOperator.base || isEmpty( whereFilter ) ) {
                    const filters: any = isEmpty( baseFilters ) ? whereFilter : baseFilters
                    const filterQuery: Filter<unknown> = this.whereToFilterQuery( filters, operator as Operator )
                    data = await this.findInCollection( filterQuery, orderBy, isEmpty( relationFilters ) ? pagination : {} )
                    iteration = iteration + 1
                }
                if ( isEmpty( relationFilters ) === false ) {
                    let baseFiltersOrAnd: Where[] = []
                    forEach( relationFilters, ( item: RelationWhere ) => {
                        forEach( item, ( value: Where, key: string ) => {
                            if ( ! get( value, 'relation' ) ) {
                                delete item[key]
                                baseFiltersOrAnd.push( { [key]: value } )
                            }
                        } )
                    } )
                    baseFiltersOrAnd = uniqWith( baseFiltersOrAnd, isEqual )
                    const whereFiltersOrAnd = this.whereToFilterQuery(
                        baseFiltersOrAnd as any, operator as any
                    )
                    const dataCollection: Array<unknown> = await this.findInCollection( whereFiltersOrAnd )
                    if ( operator === Operator.or ) {
                        for ( const itemWhere of relationFilters ) {
                            data = concat( data, await this.executeRelationFilters( itemWhere as unknown as Record<string, RelationWhere>, dataCollection as Array<{ id: string }> ) )
                        }
                        data = uniqWith( compact( data ), isEqual )
                    } else { // and filters
                        data = isEmpty( data ) && iteration === 0 ? dataCollection : data
                        for ( const itemWhere of relationFilters ) {
                            data = await this.executeRelationFilters( itemWhere as unknown as Record<string, RelationWhere>, data as Array<{ id: string }> )
                        }
                    }
                }
            }
        } )
        return data
    }

    // eslint-disable-next-line max-lines-per-function
    public async executeRelationFilters( where: Record<string, RelationWhere>, data: Array<{ id: string }>, filtered: Array<{ id: string }> = [] ): Promise<Array<{ id: string }>> {
        for ( const item of data ) {
            // eslint-disable-next-line max-lines-per-function
            const filter: boolean = await iterateRelationsWhere( where,  async ( relationWhere: RelationWhere ): Promise<boolean> => {
                const relation: RelationWhereConfig = relationWhere.relation
                const relations: Record<string, RelationWhere> = {}
                forEach( relationWhere.filters || {}, ( value: RelationWhere, key: string ) => {
                    if ( value.relation ) { relations[ key ] = value }
                } )
                const { filters, targetKey } = relationWhere
                const { list, ship, source, target, filter, foreignKey } = relation || {}
                if ( list ) {
                    let relationData: unknown[]
                    const isManyToMany = ship === RelationShip.ManyToMany
                    const foreignKeyValue = foreignKey || `${toLower( source )}Id`
                    if ( isManyToMany ) {
                        relationData = await this.filterManyFromManyRelation(
                            toLower( source ),
                            toLower( target ),
                            item.id,
                            targetKey,
                            iterateBaseFilter( filters )
                        )
                        relationData = compact( relationData )
                    } else {
                        relationData = await this.findManyRelation(
                            foreignKeyValue,
                            item.id,
                            targetKey,
                            filters
                        )
                    }
                    let filterWhere: boolean
                    if ( filter === FilterListObject.SOME ) {
                        filterWhere = ! isEmpty( relationData )
                    } else if ( filter === FilterListObject.NONE ) {
                        filterWhere = isEmpty( relationData )
                    } else {
                        let totalRelationData = []
                        if ( isManyToMany ) {
                            totalRelationData = await this.filterManyFromManyRelation(
                                toLower( source ),
                                toLower( target ),
                                item.id,
                                targetKey,
                                {}
                            )
                        } else {
                            totalRelationData = await this.findManyRelation(
                                foreignKeyValue,
                                item.id,
                                targetKey,
                                filters
                            )
                        }
                        filterWhere = totalRelationData.length === relationData.length
                    }

                    if ( filterWhere && isEmpty( relations ) === false ) {
                        const recursive = await this.executeRelationFilters( relations, relationData as Array<{ id: string }> )
                        return isEmpty( recursive ) === false
                    }
                    return filterWhere
                } else {
                    // const relationParentId = `${relationWhere.localForeignKey}Id`;
                    // const relationParentKey = `${relationWhere.localForeignKey}${relationWhere.relationTo}Id`;
                    // const relationBackLink = `${toLower( relationWhere.relationTo )}_${toLower( relationWhere.relationTo )}Fk`;
                    const { itemId, key } = getRelationItemKeyId( item, relation )
                    let relationData: any
                    if ( itemId ) {
                        const filterId = get( relationWhere, 'filters.id' )
                        if ( filterId ) {
                            const { eq: eqValue, neq: neqValue } = filterId as { eq?: string; neq?: string }
                            if ( eqValue !== undefined ) return itemId === eqValue
                            if ( neqValue !== undefined ) return itemId !== neqValue
                            return false
                        }
                        const filters = assign( { [ key ]: { eq: itemId } }, relationWhere.filters )
                        relationData = await this.findOneRelation( relationWhere.targetKey, iterateBaseFilter( filters ) )
                    }
                    if ( relationData && isEmpty( relations ) === false ) {
                        const recursiveFilter = await this.executeRelationFilters( relations, [ relationData as { id: string } ] )
                        return isEmpty( recursiveFilter ) === false
                    }
                    return relationData !== null
                }
            } )
            if ( filter === undefined ) { return data }
            if ( filter ) {
                filtered.push( item )
            }
        }
        return filtered
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
        return await Promise.all(
            relationIds.map( id => {
                const currentWhere = { ...where }
                if ( ! has( currentWhere, `id.eq` ) ) {
                    currentWhere.id = { eq: id }
                } else if ( ! includes( relationIds, get( currentWhere, `id.eq` ) ) ) {
                    return null
                }
                return this.findOneRelation( collection, currentWhere )
            } )
        )
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
