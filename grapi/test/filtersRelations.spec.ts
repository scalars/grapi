import chai from 'chai'
import chaiHttp from 'chai-http'
chai.use( chaiHttp )

import { sdl, testSuits } from './testsuites/filtersRelations'
import { createGrapiApp, MongodbDataSourceGroup, prepareConfig } from './testsuites/utils'

const { mongoUri } = prepareConfig()
const DB_NAME = 'grapi'
const dataTwo: string = `mutation {
    groupA: createGroup(data: { name: "Group B From Jhon Doe" }) {
        name
    }
    groupB: createGroup(data: { name: "Group A From Maria Doe" }) {
        name
    }
    teamMariaDoe: createTeam(data: { name: "Team Maria Doe" }) {
        name
    }
    bookMariaDoe: createBook(data: { name: "Book A Maria Doe" }) {
        name
    }
    mariaDoe: createUser(
        data: {
            username: "Maria Doe"
            email: "maria@doe.com"
            groups: { connect: [{ name: "Group A From Maria Doe" }] }
            team: { connect: { name: "Team Maria Doe" } }
            book: { connect: { name: "Book A Maria Doe" } }
        }
    ) {
        username
        email
        groups {
            name
        }
        team {
            name
        }
        book {
            name
        }
    }
    jhonDoe: createUser(
        data: {
            username: "Jhon Doe"
            email: "jhon@doe.com"
            groups: { connect: [{ name: "Group B From Jhon Doe" }] }
        }
    ) {
        username
        email
        groups {
            name
        }
        team {
            name
        }
    }
    createBook(
        data: {
            name: "Book B Jhon Doe"
            author: { connect: { username: "Jhon Doe" } }
        }
    ) {
        name
        author {
            username
            email
            team {
                name
            }
            groups {
                name
            }
        }
    }

    createGroup(
        data: {
            name: "Group Test"
            members: {
                create: [
                    { username: "User Group Test A", email: "email@testa.com" }
                    { username: "User Group Test B", email: "email@testb.com" }
                ]
                connect: [{ username: "Jhon Doe" }, { username: "Maria Doe" }]
            }
        }
    ) {
        name
        members {
            username
            email
            team {
                name
            }
            groups {
                name
            }
            book {
                name
            }
        }
    }

    createTeam(
        data: {
            name: "Team Test"
            players: {
                create: { username: "Test User", email: "test@doe.com" }
                connect: [{ username: "Jhon Doe" }]
            }
        }
    ) {
        name
        players {
            username
            email
            groups {
                name
            }
            team {
                name
            }
            book {
                name
            }
        }
    }

    createUser(
        data: {
            username: "Carlos Doe"
            email: "carlos@email.com"
            groups: {
                create: [
                    { name: "Group Carlos Doe A" }
                    { name: "Group Carlos Doe B" }
                    { name: "Group Carlos Doe C" }
                ]
            }
            team: { create: { name: "Team Carlos Doe" } }
            book: { create: { name: "Book From Carlos Doe" } }
        }
    ) {
        id
        username
        email
        groups {
            name
        }
        team {
            name
        }
        book {
            name
        }
    }
}`

describe( 'Tests on fixtures/filtersRelations.graphql with MongoDB Data Source', function() {
    this.timeout( 20000 )

    before( async () => {
        const mongodbDataSourceGroup = new MongodbDataSourceGroup( mongoUri, DB_NAME )
        await mongodbDataSourceGroup.initialize()
        const { graphqlRequest, close } = createGrapiApp( sdl, {
            memory: args => mongodbDataSourceGroup.getDataSource( args.key ),
        } )
        await graphqlRequest( dataTwo, {} );
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
