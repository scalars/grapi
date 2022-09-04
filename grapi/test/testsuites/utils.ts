import { ApolloServer } from 'apollo-server'
import { GraphQLScalarType } from 'graphql'
import { isArray, mapValues } from 'lodash'

import { MongodbDataSourceGroup } from '../../../grapi-mongodb/src/index'
import { DataSource, Grapi } from '../../src'

interface GraphQLMockApp {
    graphqlRequest: ( query: string, variables: Record<string, unknown> ) => Promise<any>
    close: () => void
}
export { MongodbDataSourceGroup }

export const createApp = ( { sdl, dataSources, scalars, }: {
    sdl: string;
    dataSources: Record<string, ( args: any ) => DataSource>;
    scalars?: Record<string, GraphQLScalarType>;
} ): GraphQLMockApp => {
    const grapi = new Grapi( { sdl, dataSources, scalars } )
    const server = new ApolloServer( grapi.createApolloConfig() )
    const graphqlRequest = async ( query: string, variables: Record<string, unknown> ): Promise<any> => {
        const { data = {}, errors } = await server.executeOperation( { query, variables } )
        return {
            ...data,
            errors
        }
    }
    return {
        graphqlRequest,
        close: (): void => console.error( 'Closing' )
    }
}

export const createGrapiApp = ( sdl: string, dataSources: Record<string, any> ): GraphQLMockApp => {
    return createApp( {
        sdl,
        dataSources,
        scalars: {},
    } )
}

export const prepareConfig = (): any => {
    let mongoUri: string
    let serviceAccount: Record<string, any>

    if ( process.env.CI ) {
        mongoUri = process.env.TEST_MONGODB_URI
        serviceAccount = JSON.parse( process.env.TEST_SERVICE_ACCOUNT )
    } else {
        // local dev
        mongoUri = 'mongodb://localhost:27017'
        serviceAccount = {}
    }

    return { mongoUri, serviceAccount }
}

export const wrapSetToArrayField = ( data: Record<string, any> ): any => {
    return mapValues( data, value => {
        if ( isArray( value ) ) {
            return { set: value }
        }

        return value
    } )
}
