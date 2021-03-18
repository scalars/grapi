import chai from 'chai'
import chaiHttp = require( 'chai-http' );
chai.use( chaiHttp )
import { MongodbDataSourceGroup } from '@scalars/grapi-mongodb'
import { MongoClient } from 'mongodb'

import { sdl, testSuits } from './testsuites/filters'
import { createGrapiApp, prepareConfig } from './testsuites/utils'

const { mongoUri } = prepareConfig()
const DB_NAME = 'grapi'
const COLLECTION_NAME = 'users_filters'

const data = [
    {
        'name': 'Ben Bohm',
        'age': 23,
        'weight': 87.2,
        'married': false,
        'website': 'http://bennet.com',
        'email': 'ben@correo.com'
    },
    {
        'name': 'Wout Beckers',
        'age': 67,
        'weight': 75.0,
        'married': true,
        'website': 'http://woutnet.com',
        'email': 'wout@correo.com'
    },
    {
        'name': 'Michela Battaglia',
        'age': 43,
        'weight': 63.8,
        'married': true,
        'website': 'http://michelanet.com.co/index.html',
        'email': 'michela@correo.com.co'
    }
]

const importData = async () => {
    const client = await MongoClient.connect( mongoUri, { useUnifiedTopology: true } )
    const db = await client.db( DB_NAME )
    const collection = await db.collection( COLLECTION_NAME )
    await collection.insertMany( data )
}

describe( 'Tests on fixtures/filters.graphql with MongoDB Data Source', function() {
    this.timeout( 20000 )

    before( async () => {
        const mongodbDataSourceGroup = new MongodbDataSourceGroup( mongoUri, DB_NAME )
        await mongodbDataSourceGroup.initialize()

        await importData()

        const { graphqlRequest, close } = createGrapiApp( sdl, {
            memory: args => mongodbDataSourceGroup.getDataSource( args.key ),
        } );
        ( this as any ).graphqlRequest = graphqlRequest;
        ( this as any ).close = close;
        ( this as any ).mongodb = ( mongodbDataSourceGroup as any ).db
    } )

    after( async () => {
        const listCollectionsQuery = await ( this as any ).mongodb.listCollections()
        const collections = await listCollectionsQuery.toArray()
        await Promise.all( collections.map( async collection => {
            await ( this as any ).mongodb.collection( collection.name ).deleteMany( {} )
        } ) )

        await ( this as any ).close()
    } )

    testSuits.call( this )
} )
