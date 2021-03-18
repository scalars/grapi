/**
 * OneToOne tests
 */
import chai from 'chai'
import chaiHttp = require( 'chai-http' );
chai.use( chaiHttp )
import { MongodbDataSourceGroup } from '@scalars/grapi-mongodb'

import { sdl, testSuits } from './testsuites/oneToOne'
import { createGrapiApp, prepareConfig } from './testsuites/utils'

const { mongoUri } = prepareConfig()

describe( 'Tests on fixtures/oneToOne.graphql with MongoDB Data Source', function() {
    this.timeout( 20000 )

    before( async () => {
        const mongodbDataSourceGroup = new MongodbDataSourceGroup( mongoUri, 'grapi' )
        await mongodbDataSourceGroup.initialize()

        const { graphqlRequest, close } = createGrapiApp( sdl, {
            memory: args => mongodbDataSourceGroup.getDataSource( args.key ),
        } );
        ( this as any ).graphqlRequest = graphqlRequest;
        ( this as any ).close = close;
        ( this as any ).mongodb = ( mongodbDataSourceGroup as any ).db
    } )

    afterEach( async () => {
        const listCollectionsQuery = await ( this as any ).mongodb.listCollections()
        const collections = await listCollectionsQuery.toArray()
        await Promise.all( collections.map( async collection => {
            await ( this as any ).mongodb.collection( collection.name ).deleteMany( {} )
        } ) )
    } )

    after( async () => {
        await ( this as any ).close()
    } )

    testSuits.call( this )
} )
