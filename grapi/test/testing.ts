import { ApolloServer, } from '@apollo/server'
import { startStandaloneServer } from '@apollo/server/standalone'

import { MongodbDataSourceGroup } from '../../grapi-mongodb/src'
import { Grapi } from '../src'

const schema = `
directive @content on FIELD_DEFINITION | QUERY | MUTATION | FIELD
    directive @auth on FIELD_DEFINITION | QUERY | MUTATION | FIELD
    directive @event on FIELD_DEFINITION | QUERY | MUTATION | FIELD
    directive @asset on FIELD_DEFINITION | QUERY | MUTATION | FIELD
    directive @users on FIELD_DEFINITION | QUERY | MUTATION | FIELD
type ExpenseFromSubcategory implements Relation @config( 
    name: "ExpenseFromSubcategory"
    foreignKey: { key: "subcategory_ExpenseToSubcategoryFk", side: Expense } 
)

type CategoryFromSubcategory implements Relation @config( 
    name: "CategoryFromSubcategory"
    foreignKey: { key: "subcategory_SubcategoriesFromCategoryFk", side: Subcategory } 
)

type Category @Model( dataSource: "mongodb", key: "category" ) @Directives ( content: [ Create, Read, Update, Delete ] event: [ Create, Update, Delete ] ) {
    id: ID! @unique @autoGen
    updatedAt: DateTime @updatedAt
    createdAt: DateTime @createdAt
    name: String! @unique
    subcategories: [Subcategory!]  @relation( with: CategoryFromSubcategory )
}

type Subcategory @Model( dataSource: "mongodb", key: "subcategory" ) @Directives ( content: [ Create, Read, Update, Delete ] event: [ Create, Update, Delete ] ) {
    id: ID! @unique @autoGen
    updatedAt: DateTime @updatedAt
    createdAt: DateTime @createdAt
    name: String! @unique
    category: Category @relation( with: CategoryFromSubcategory )
}

type Expense @Model( dataSource: "mongodb", key: "expense" ) @Directives ( content: [ Create, Read, Update, Delete ] event: [ Create, Update, Delete ] ) {
    id: ID! @unique @autoGen
    updatedAt: DateTime @updatedAt
    createdAt: DateTime @createdAt
    description: String
    date: DateTime!
    value: Float!
    subcategory: Subcategory @relation( with: ExpenseFromSubcategory )
}`

const mongouri = 'mongodb://localhost:27017'
const db_name = 'local-db'
export const testingGrapi = async ( ): Promise<void> => {
    const mongodbDataSourceGroup = new MongodbDataSourceGroup( mongouri, db_name )
    await mongodbDataSourceGroup.initialize()
    
    const grapi = new Grapi( { skipPrint: true, sdl: schema, dataSources: {
        mongodb: ( args ) => mongodbDataSourceGroup.getDataSource( args.key )
    } } )
    const server = new ApolloServer( grapi.createApolloConfig() )

    const { url } = await startStandaloneServer( server, {
        listen: { port: 4000 },
    } )

    // eslint-disable-next-line no-console
    console.info( `🚀 Server ready at ${url}` )
}


testingGrapi().then()