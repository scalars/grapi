import { IResolvers } from 'graphql-tools'

import Model from '../dataModel/model'
import { assign, forEach } from '../lodash'
import { Plugin } from '../plugins'

export default ( plugins: Plugin[], models: Model[] ): IResolvers => {
    let resolvers: IResolvers = { }
    let extendType: Record<string, any> = {}
    models.forEach( model => {
        plugins.forEach( plugin => {
            resolvers = {
                ...plugin.resolveInRoot && plugin.resolveInRoot( { model, dataSource: model.getDataSource() } ),
                ...resolvers,
                Query: assign(
                    plugin.resolveInQuery && plugin.resolveInQuery( { model, dataSource: model.getDataSource() } ),
                    resolvers.Query
                ),
                Mutation: assign(
                    plugin.resolveInMutation && plugin.resolveInMutation( { model, dataSource: model.getDataSource() } ),
                    resolvers.Mutation
                )
            }
            if ( plugin.extendTypes ) {
                extendType = { ...extendType, ...plugin.extendTypes( model ) }
            }
        } )
    } )
    forEach( extendType, ( value: string, key: string ) => {
        extendType[ key ] = resolvers[value]
    } )
    return { ...resolvers, ...extendType }
}
