import { IResolvers } from 'graphql-tools'

import Model from '../dataModel/model'
import { assign } from '../lodash'
import { Plugin } from '../plugins'

export default ( plugins: Plugin[], models: Model[] ): IResolvers => {
    let resolvers: IResolvers = { }
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
        } )
    } )
    return resolvers
}
