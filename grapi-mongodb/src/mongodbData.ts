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
    WhereOperator
} from '@grapi/server'
import { FilterListObject } from '@grapi/server/lib/dataModel/type'
import { Db, Filter, ObjectId } from 'mongodb'

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
    readonly db: Db;
    readonly collectionName: string;

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
            .limit( pagination.first || 0 )
            .project( { _id: 0 } )
            .toArray()
    }

    public async findRecursive ( where: Record<string, any>, orderBy: OrderBy, pagination: Pagination, data: unknown[] = [] ): Promise<unknown[]> {
        let iteration: number = 0
        await iterateWhereFilter( where, async ( whereFilter: ( Record<string, RelationWhere> | Array<Record<string, RelationWhere>> ), operator: ( Operator | WhereOperator ) ) => {
            if ( operator as WhereOperator === WhereOperator.relation ) {
                data = isEmpty( data ) && iteration === 0 ? await this.findInCollection( {}, orderBy, pagination ) : data
                data = await this.executeRelationFilters( whereFilter as Record<string, RelationWhere>, data )
            } else {
                const baseFilters: unknown[] = []
                const relationFilters: any[] = []
                if ( operator === Operator.and || operator === Operator.or ) {
                    forEach( whereFilter, ( item: RelationWhere ) => {
                        if ( findKey( item, 'relation' ) ) {
                            relationFilters.push( item )
                        } else {
                            baseFilters.push( item )
                        }
                    } )
                }
                if ( isEmpty( baseFilters ) === false || operator as any === WhereOperator.base || isEmpty( whereFilter ) ) {
                    const filters: any = isEmpty( baseFilters ) ? whereFilter : baseFilters
                    const filterQuery: Filter<unknown> =  this.whereToFilterQuery( filters, operator as Operator )
                    data = await this.findInCollection( filterQuery, orderBy, isEmpty( relationFilters ) ? pagination : {} )
                    iteration = iteration + 1
                }
                if ( isEmpty( relationFilters ) === false ) {
                    let baseFiltersOrAnd = []
                    forEach( relationFilters, ( item: RelationWhere ) => {
                        forEach( item, ( value: Record<string, unknown>, key: string ) => {
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
                            data = concat( data, await this.executeRelationFilters( itemWhere, dataCollection ) )
                        }
                        data = uniqWith( compact( data ), isEqual )
                    } else { // and filters
                        data = isEmpty( data ) && iteration === 0 ? dataCollection : data
                        for ( const itemWhere of relationFilters ) {
                            data = await this.executeRelationFilters( itemWhere, data )
                        }
                    }
                }
            }
        } )
        return data
    }

    // eslint-disable-next-line max-lines-per-function
    public async executeRelationFilters( where: Record<string, RelationWhere>, data: unknown[], filtered: unknown[] = [] ): Promise<unknown[]> {
        for ( const item of data as Array<{ id: string }> ) {
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
                        const recursive: Array<unknown> = await  this.executeRelationFilters( relations, relationData )
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
                            let status: boolean = false
                            iterateWhere( { id: filterId }, ( field, op, value ) => {
                                switch ( op ) {
                                case Operator.eq:
                                    status = itemId === value
                                    break
                                case Operator.neq:
                                    status = itemId !== value
                                    break
                                }
                            } )
                            return status
                        }
                        const filters = assign( { [ key ]: { eq: itemId } }, relationWhere.filters )
                        relationData = await this.findOneRelation( relationWhere.targetKey, iterateBaseFilter( filters ) )
                    }
                    if ( relationData && isEmpty( relations ) === false ) {
                        const recursiveFilter = await this.executeRelationFilters( relations, [ relationData ] )
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

    /** -----------------------------------------------------------------------------------------
     * Método consultar OneToOne Relation Object, usado para aplicar filtros
     * @param colectionName: Nombre de la collección a donde ha referenciado el objeto
     * @param where: Filtro con el Id Del Objeto Referenciado, ademas de los filtros aplicados sobre el objeto
     */
    public async findOneRelation( colectionName: string, where: Where ): Promise<unknown> {
        return await this.db.collection( colectionName ).findOne( this.whereToFilterQuery( where ) )
    }

    /** -----------------------------------------------------------------------------------------
     * Método filtrar OneToMany se consulta si hay objectos que ha referenciado a un Parent
     * @param foreignKey Nombre del attributo que referencia la relación
     * @param foreignId Identificador del objecto parent referenciado por muchos objetos en los childs
     * @param collectionName Nombre de la colección donde se hace referencia al objeto Parent
     * @param where Filtro a aplicar en los muchos objetos
     */
    public async findManyRelation( foreignKey: string, foreignId: string, collectionName: string, where: Where ): Promise<unknown[]> {
        const filterQuery: Filter<unknown> = this.whereToFilterQuery( { ...where, [foreignKey]: { [Operator.eq]: foreignId } } )
        return await this.db.collection( collectionName )
            .find( filterQuery )
            .project( { _id: 0 } )
            .toArray()
    }

    /**
     * Método filtrar ManyToMay
     * @param sourceSideName
     * @param targetSideName
     * @param sourceSideId
     * @param collection
     * @param where
     */
    public async filterManyFromManyRelation( sourceSideName: string, targetSideName: string, sourceSideId: string, collection: string, where: Record<string, any> ): Promise<any[]> {
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

    public whereToFilterQuery( where: Where, operator: Operator = undefined ): Filter<Record<string, unknown>> {
        const filterQuery: Record<string, unknown> = {}
        const whereCallback = ( field: string, operator: Operator, value: unknown & { to: unknown, from: unknown } ): void => {
            switch ( operator ) {
            case Operator.eq:
                filterQuery[field] = value
                break
            case Operator.contains:
                filterQuery[field] = new RegExp( `.*${value}.*`, `i` )
                break
            case Operator.notcontains:
                filterQuery[field] = new RegExp( `^((?!${value}).)*$`, `i` )
                break
            case Operator.neq:
                filterQuery[field] = { $ne: value }
                break
            case Operator.gt:
                filterQuery[field] = { $gt: value }
                break
            case Operator.gte:
                filterQuery[field] = { $gte: value }
                break
            case Operator.lt:
                filterQuery[field] = { $lt: value }
                break
            case Operator.lte:
                filterQuery[field] = { $lte: value }
                break
            case Operator.in:
                filterQuery[field] = { $in: value }
                break
            case Operator.all:
                filterQuery[field] = { $all: value }
                break
            case Operator.notIn:
                filterQuery[field] = { $nin: value }
                break
            case Operator.between:
                filterQuery[field] = { $gte: value.from, $lte: value.to }
                break
            case Operator.object:
                assign( filterQuery, value )
                break
            }
        }
        if ( isEmpty( where ) === false && ( operator === Operator.or || operator === Operator.and ) ) {
            const filtersQuery: Array<Filter<unknown>> = []
            forEach( where, ( whereItem: Where ) => {
                if ( isEmpty( whereItem ) === false ) {
                    const { operator, filters } = this.findRecursiveOperator( whereItem )
                    if ( operator ) {
                        filtersQuery.push( this.whereToFilterQuery( filters, operator ) )
                    } else {
                        filtersQuery.push( this.whereToFilterQuery( whereItem ) )
                    }
                }
            } )
            filterQuery[ `$${toLower( operator )}` ] = filtersQuery
        } else { iterateWhere( where, whereCallback ) }
        return filterQuery
    }

    public findRecursiveOperator ( where: Where ): { operator?: Operator; filters?: any} {
        if ( get( where, Operator.or ) ) {
            return { operator: Operator.or, filters: get( where, Operator.or ) }
        } else if ( get( where, Operator.and ) ) {
            return { operator: Operator.and, filters: get( where, Operator.and ) }
        }
        return {}
    }

    public transformMutation = ( mutation: Mutation, set: boolean = false ): Record<string, unknown> => {
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
    };

    public handleMongoDbError ( error ): void {
        if ( error.code === 11000 ) {
            const keyValues: string = keys( error.keyValue ).join( ', ' )
            throw new Error(
                `Constraint unique value expected for "${ keyValues }" duplicate on ${ capitalize( this.collectionName ) } model`,
            )
        } else if ( error.code === 121 ) {
            throw new Error(
                `Document failed validation on ${ capitalize( this.collectionName ) } model, review types or required values in data`,
            )
        }
        throw new Error( `${ error.message }` )
    }
}
