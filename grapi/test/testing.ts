import { ApolloServer } from '@apollo/server'

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

    const params = { 'variables':{ 'first':2 }, 'query':'query ($first: Int $where: ExpenseWhereInput) {\n  expenses(first: $first, skip: 2, orderBy: {date: DESC}, where: $where) {\n    id\n    date\n    value\n    description\n    subcategory {\n      name\n      id\n    }\n  }\n}' }
    const result = await server.executeOperation( params, {
        contextValue: { user: { id: '1', role: 'admin' } },
    } )
    const { data, errors } = result.body.kind === 'single' ? result.body.singleResult : { data: null, errors: null }
    console.error( data, errors ? errors[0] : null )
}


testingGrapi().then( () => process.exit( 0 ) )