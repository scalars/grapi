import { IObjectTypeResolver, IResolvers } from '@graphql-tools/utils'

import Model from '../dataModel/model'
import RootNode from '../rootNode'

// Plugins is responsible for graphql generation and resolvers
export interface Plugin {
    init?( context: Context ): void;
    setPlugins?( plugins: Plugin[] ): void;
    visitModel( model: Model, context: Context ): void;
    extendTypes?( Model: Model ): Record<string, string>;
    resolveInQuery?( { model, dataSource }: {model: Model; dataSource: any} ): IObjectTypeResolver;
    resolveInMutation?( { model, dataSource }: {model: Model; dataSource: any} ): IObjectTypeResolver;
    resolveInRoot?( { model, dataSource }: {model: Model; dataSource: any} ): IResolvers;
}

export interface Context {
    root: RootNode;
}
