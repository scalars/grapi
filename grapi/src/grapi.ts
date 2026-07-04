import { makeExecutableSchema } from '@graphql-tools/schema'
import { ApolloServerOptions, BaseContext } from '@apollo/server'
import { GraphQLEnumType, GraphQLScalarType } from 'graphql'

import { MODEL_DIRECTIVE, MODEL_DIRECTIVE_SOURCE_NAME } from './constants'
import { createRelation, Model } from './dataModel'
import { DataSource } from './dataSource/interface'
import Generator from './generator'
import mergeHooks from './hooks/mergeHooks'
import { createRelationHooks } from './hooks/relationHook'
import { assign, forEach, isEmpty, isUndefined, omit } from './lodash'
import { parse } from './parse'
import {
    BaseTypePlugin,
    CreatePlugin,
    DeletePlugin,
    OrderInputPlugin,
    Plugin,
    QueryPlugin,
    RelayPlugin,
    UpdatePlugin,
    WhereInputPlugin
} from './plugins'
import {
    inputDateTimeBetween,
    inputFloatBetween,
    inputIntBetween,
    orderByInputEnum,
    scalarSchema
} from './plugins/constants'
import { printModels, printRelations } from './printer'
import combine from './resolver/combine'
import RootNode from './rootNode'
import { customScalars } from './scalars'

export class Grapi {
    private readonly sdl: string;
    private readonly dataSources: Record<string, ( args: { key: string } ) => DataSource>;
    private readonly scalars: Record<string, GraphQLScalarType>;
    private readonly enums: Record<string, GraphQLEnumType>;
    private readonly schemaDirectives: Record<string, unknown>;
    private readonly context: BaseContext | ((...args: any[]) => Promise<any>);
    private readonly rootNode: RootNode;
    private readonly models: Model[];
    private readonly userDefinedPlugins: Plugin[];
    private config: ApolloServerOptions<BaseContext>;
    private readonly skipPrint: boolean;

    constructor( {
        sdl,
        dataSources,
        scalars,
        enums,
        context,
        skipPrint,
        rootNode,
        models,
        plugins,
        schemaDirectives,
    }: {
        sdl?: string;
        dataSources?: Record<string, ( args: { key: string } ) => DataSource>;
        scalars?: Record<string, GraphQLScalarType>;
        enums?: Record<string, GraphQLEnumType>;
        context?: BaseContext | ((...args: any[]) => Promise<any>);
        skipPrint?: boolean;
        rootNode?: RootNode;
        models?: Model[];
        plugins?: Plugin[];
        schemaDirectives?: Record<string, unknown>;
    } ) {
        this.sdl = sdl ? sdl.concat( ...[ scalarSchema ] ) : ``
        this.dataSources = dataSources
        this.scalars = assign( customScalars, scalars )
        this.enums = enums
        this.context = context
        this.skipPrint = skipPrint
        this.rootNode = rootNode
        this.models = models
        this.userDefinedPlugins = plugins
        this.schemaDirectives = schemaDirectives
        this.createServerConfig()
    }

    private bindDataSourceInModels( models: Array<Model>, modelMap ) {
        // bind dataSource
        models.forEach( model => {
            // make it easy to access later
            modelMap[model.getName()] = model

            if ( !model.getDataSource() ) {
                // construct data source
                // get dataSource arguments from Model
                const dataSourceArgs = model.getMetadata( MODEL_DIRECTIVE )
                const dataSourceIdentifier: string = dataSourceArgs[MODEL_DIRECTIVE_SOURCE_NAME]
                const createDataSource: ( args: unknown ) => DataSource = this.dataSources[dataSourceIdentifier]
                if ( !createDataSource ) {
                    throw new Error( `dataSource ${dataSourceIdentifier} does not exist` )
                }
                const args = omit( dataSourceArgs, MODEL_DIRECTIVE_SOURCE_NAME )
                const dataSource = createDataSource( args )

                // set to model
                model.setDataSource( dataSource )
            }
        } )
    }

    private createServerConfig() {
        const ifSkipPrint = this.skipPrint || false
        let rootNode: RootNode
        let models: Model[]
        if ( isUndefined( this.rootNode ) || isEmpty( this.models ) ) {
            const parseResult = parse( this.sdl )
            rootNode = parseResult.rootNode
            models = parseResult.models
        } else {
            rootNode = this.rootNode
            models = this.models
        }
        const modelMap: Record<string, Model> = {}
        this.bindDataSourceInModels( models, modelMap )
        // create relation hooks
        const relations = createRelation( models )
        const relationHooks = createRelationHooks( relations )

        // print
        if ( !ifSkipPrint ) {
            printModels( models )
            printRelations( relations )
        }

        // merge hooks
        const hookMap = mergeHooks( relationHooks )

        // initialize plugins
        const plugins = [
            new BaseTypePlugin(),
            new WhereInputPlugin(),
            new OrderInputPlugin(),
            new QueryPlugin(),
            new RelayPlugin(),
            new CreatePlugin( { hook: hookMap } ),
            new UpdatePlugin( { hook: hookMap } ),
            new DeletePlugin( { hook: hookMap } ),
            ...this.userDefinedPlugins || [],
        ]

        // merge resolver from hook
        forEach( hookMap, ( hook, key ) => {
            if ( !modelMap[key] ) {
                throw new Error( `model ${key} not found for hooks` )
            }
            modelMap[key].mergeResolver( hook.resolveFields )
        } )

        // merge resolver from dataSource
        models.forEach( model => {
            if ( model.getDataSource().resolveFields ) {
                model.mergeResolver( model.getDataSource().resolveFields() )
            }
        } )
        rootNode.addSdl( orderByInputEnum )
        rootNode.addInput( inputIntBetween )
        rootNode.addInput( inputFloatBetween )
        rootNode.addInput( inputDateTimeBetween )
        const generator = new Generator( { plugins, rootNode } )
        const resolvers = combine( plugins, models )
        const typeDefs = generator.generate( models )
        this.config = {
            schema: makeExecutableSchema( {
                resolvers: assign( resolvers, this.scalars ),
                typeDefs: typeDefs.concat( scalarSchema ),
            } ),
        }
    }

    public createApolloConfig(): ApolloServerOptions<BaseContext> {
        return this.config
    }

    /**
     * Returns the context function/object to be used with Apollo middleware.
     * In Apollo Server 5, context is provided to the integration middleware,
     * not to the server constructor.
     */
    public getContext(): BaseContext | ((...args: any[]) => Promise<any>) {
        return this.context
    }
}
