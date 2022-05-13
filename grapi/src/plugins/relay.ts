/**
 * Relay Cursor Connections API
 * https://facebook.github.io/relay/graphql/connections.htm
 */

import { ListReadable } from '..'
import Model from '../dataModel/model'
import { pick } from '../lodash'
import BaseTypePlugin from './baseType'
import { Context, Plugin } from './interface'
import WhereInputPlugin from './whereInput'

const parsePaginationFromArgs = ( args: Record<string, any> ): any => {
    if ( !args ) {
        return null
    }
    return pick( args, [ 'first', 'last', 'before', 'after' ] )
}

// const resolvePromiseOrScalar = <T>( promiseOrScalar: T | ( () => Promise<T> ) ): T | Promise<T> => {
//     return isFunction( promiseOrScalar ) ? promiseOrScalar() : promiseOrScalar;
// };

export default class RelayPlugin implements Plugin {
    private whereInputPlugin: WhereInputPlugin;
    private baseTypePlugin: BaseTypePlugin;

    // public init( context: Context ): void {
    // const { root } = context;
    // add PageInfo type
    // root.addObjectType( ` type PageInfo {
    //     hasNextPage: Boolean!
    //     hasPreviousPage: Boolean!
    //     startCursor: String
    //     endCursor: String
    // }` );
    // root.addResolver( {
    //     PageInfo: {
    //         hasNextPage: ( pageInfo: any ): boolean | Promise<boolean> => resolvePromiseOrScalar<boolean>( pageInfo.hasNextPage ),
    //         hasPreviousPage: ( pageInfo: any ): boolean | Promise<boolean> => resolvePromiseOrScalar<boolean>( pageInfo.hasPreviousPage ),
    //     }
    // } );
    // }

    public setPlugins( plugins: Plugin[] ): void {
        this.whereInputPlugin = plugins.find(
            plugin => plugin instanceof WhereInputPlugin ) as WhereInputPlugin
        this.baseTypePlugin = plugins.find(
            plugin => plugin instanceof BaseTypePlugin ) as BaseTypePlugin
    }

    public visitModel( model: Model, context: Context ): void {
        const { root } = context
        // const modelType = this.baseTypePlugin.getTypename( model );

        // add edge type
        // const edgeType = RelayPlugin.createEdgeType( model );
        // root.addObjectType( ` type ${edgeType} {
        //     node: ${modelType}!
        //     cursor: String
        // }` );

        // add connection type
        const connectionType = RelayPlugin.createConnectionType( model )
        root.addObjectType( `type ${connectionType} { totalCount: Int! }` )

        // connection query
        const queryName = RelayPlugin.createConnectionQueryName( model )
        const whereInputName = this.whereInputPlugin.getWhereInputName( model )
        root.addQuery( `${queryName}( where: ${whereInputName} ): ${connectionType}!` )
    }

    public resolveInQuery( {
        model,
        dataSource,
    }: {
        model: Model;
        dataSource: ListReadable;
    } ): any {

        // list api
        const queryName = RelayPlugin.createConnectionQueryName( model )
        return {
            [queryName]: async ( root, args, context ): Promise<any> => {
                const where = this.whereInputPlugin.parseWhere( args.where, model )
                const pagination = parsePaginationFromArgs( args )
                const response = await dataSource.find( { where, pagination }, context )
                return {
                    totalCount: response.total,
                    // pageInfo: {
                    //     hasNextPage: response.hasNextPage,
                    //     hasPreviousPage: response.hasPreviousPage,
                    //     // might change to a new design without id later
                    //     startCursor: get( first( response.data ), 'id' ),
                    //     endCursor: get( last( response.data ), 'id' ),
                    // },
                    // edges: response.data.map( node => {
                    //     return {
                    //         cursor: node.id,
                    //         node,
                    //     };
                    // } ),
                }
            },
        }
    }

    private static createConnectionQueryName( model: Model ): string {
        return `${model.getNamings().plural}Connection`
    }

    private static createConnectionType( model: Model ): string {
        return `${model.getNamings().capitalSingular}Connection`
    }

    // private static createEdgeType( model: Model ): string {
    //     return `${model.getNamings().capitalSingular}Edge`;
    // }
}
