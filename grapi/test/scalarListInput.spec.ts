import chai from 'chai'
import chaiHttp = require( 'chai-http' );
chai.use( chaiHttp )

import { sdl, testSuits } from './testsuites/scalarListInput'
import { createGrapiApp, MongodbDataSourceGroup, prepareConfig } from './testsuites/utils'

const { mongoUri } = prepareConfig()
const DB_NAME = 'grapi'

const data = [
    {
        'name': 'Ben Bohm',
        hobbies: { set: [ 'Video Games', 'Guitar', 'Bicycle' ] },
        phones: { set: [ 1, 2, 3 ] },
        friends: { set: [ { name: 'Jhon Doe' } ] }
    },
    {
        'name': 'Wout Beckers',
        hobbies: { set: [ 'Video Games', 'Guitar', 'Bicycle', 'Movies', 'Programming' ] },
        phones: { set: [ 1, 2, 3, 45, 50, 100 ] },
        friends: { set: [ { name: 'Maria Doe' }, { name: 'Jhon Doe' } ] }
    },
    {
        'name': 'Michela Battaglia',
        hobbies: { set: [ 'Video Games', 'Guitar', 'Bicycle' ] },
        phones: { set: [ 1, 2, 3 ] },
        friends: { set: [ { name: 'Fake Doe' } ] }
    }
]

describe( 'Tests on fixtures/scalarListInput.graphql mongodatasource', function() {
    this.timeout( 20000 )

    before( async () => {
        const mongodbDataSourceGroup = new MongodbDataSourceGroup( mongoUri, DB_NAME )
        await mongodbDataSourceGroup.initialize()
        const { graphqlRequest, close } = createGrapiApp( sdl, {
            memory: args => mongodbDataSourceGroup.getDataSource( args.key ),
        } )
        const query: string = `mutation ( $data: UserCreateInput! ) {
            createUser(
                data: $data
            ) { id }
        }`
        await graphqlRequest( query, { data: data[0] } )
        await graphqlRequest( query, { data: data[1] } );
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
