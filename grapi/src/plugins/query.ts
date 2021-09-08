import { ListReadable, MapReadable, PaginatedResponse } from '..'
import { DirectiveModelAction } from '../dataModel'
import Model from '../dataModel/model'
import { capitalize, isEmpty, isUndefined, pick } from '../lodash'
import BaseTypePlugin from './baseType'
import { Context, Plugin } from './interface'
import OrderInputPlugin from './orderInput'
import WhereInputPlugin from './whereInput'

const parsePaginationFromArgs = ( args: Record<string, any> ): any => {
    if ( !args ) {
        return null
    }

    return pick( args, [ 'first', 'last', 'skip', 'take', 'before', 'after' ] )
}

export default class QueryPlugin implements Plugin {
    private whereInputPlugin: WhereInputPlugin;
    private orderInputPlugin: OrderInputPlugin;
    private baseTypePlugin: BaseTypePlugin;

    public setPlugins( plugins: Plugin[] ): void {
        this.whereInputPlugin = plugins.find(
            plugin => plugin instanceof WhereInputPlugin ) as WhereInputPlugin
        this.orderInputPlugin = plugins.find(
            plugin => plugin instanceof OrderInputPlugin ) as OrderInputPlugin
        this.baseTypePlugin = plugins.find(
            plugin => plugin instanceof BaseTypePlugin ) as BaseTypePlugin
    }

    public visitModel( model: Model, context: Context ): void {
        const { root } = context
        const modelType = this.baseTypePlugin.getTypename( model )

        // object query
        if ( model.isObjectType() ) {
            const queryName = QueryPlugin.createObjectQueryName( model )
            root.addQuery( `${queryName}: ${modelType}` )
            return
        }
        // Find if authDirective is enable
        const directives = model.getDirectives( DirectiveModelAction.Read )

        // find one query
        const findOneQueryName = QueryPlugin.createFindOneQueryName( model )
        const whereUniqueInputName = this.whereInputPlugin.getWhereUniqueInputName( model )
        root.addQuery(
            `${findOneQueryName}( where: ${whereUniqueInputName}! ): ${modelType}!${ directives }`
        )

        // find many query
        const findManyQueryName = QueryPlugin.createFindQueryName( model )
        const whereInputName = this.whereInputPlugin.getWhereInputName( model )
        const orderInputName = this.orderInputPlugin.getOrderInputName( model )
        const argsOnFindMany: string[] = [
            `where: ${whereInputName}`,
            `first: Int`,
            `last: Int`,
            `skip: Int`,
            `take: Int`,
            `before: String`,
            `after: String`,
            `orderBy: ${orderInputName}`
        ]
        root.addQuery(
            `${findManyQueryName} ( ${ argsOnFindMany.join( `,` ) } ): [ ${modelType} ! ] !${ directives }`
        )
    }

    public resolveInQuery( {
        model,
        dataSource,
    }: {
        model: Model;
        dataSource: ListReadable & MapReadable;
    } ): any {
        // object query
        if ( model.isObjectType() ) {
            const queryName = QueryPlugin.createObjectQueryName( model )
            return {
                [queryName]: async (): Promise<any> => {
                    const response = await dataSource.getMap()
                    // make sure graphql query get empty object
                    return isEmpty( response ) ? {} : response
                },
            }
        }

        // list query
        const findOneQueryName = QueryPlugin.createFindOneQueryName( model )
        const findManyQueryName = QueryPlugin.createFindQueryName( model )
        return {
            [findOneQueryName]: async ( root, args, context ): Promise<any> => {
                const where = this.whereInputPlugin.parseUniqueWhere( args.where )
                if ( isUndefined( where ) === false && isEmpty( where ) ) {
                    throw new Error( `You provided an invalid argument for the where selector on ${ capitalize( model.getName() ) }. Please provide exactly one unique field and value.` )
                }
                const data = await dataSource.findOne( { where }, context )
                if ( data ) { return data }
                throw new Error( `No Node for the model ${ capitalize( model.getName() ) } with unique field.` )
            },
            [findManyQueryName]: async ( root, args, context ): Promise<any[]> => {
                const where = this.whereInputPlugin.parseWhere( args.where, model )
                const pagination = parsePaginationFromArgs( args )
                const orderBy = this.orderInputPlugin.parseOrder( args.orderBy )
                const response: PaginatedResponse = await dataSource.find( { where, pagination, orderBy }, context )
                return response.data
            },
        }
    }

    private static createObjectQueryName( model: Model ): string {
        return model.getNamings().singular
    }

    private static createFindQueryName( model: Model ): string {
        return model.getNamings().plural
    }

    private static createFindOneQueryName( model: Model ): string {
        return model.getNamings().singular
    }
}
