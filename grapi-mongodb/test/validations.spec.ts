import { Mutation } from '@grapi/server/src'
import { expect } from 'chai'
import { Collection } from 'mongodb'

import { MongodbDataSourceGroup } from '../src'
import { MongodbDataSource } from '../src/mongodbDataSource'

const DB_NAME = 'grapi-mongodb'
const mongoUri = 'mongodb://localhost:27017'
const mongodbDataSourceGroup = new MongodbDataSourceGroup( mongoUri, DB_NAME )
const collectionName: string = 'validation'
let collection: Collection = null
let dataSource: MongodbDataSource = null

const throwTesting = async (
    promise: Promise<unknown>,
    message: string
) => {
    try {
        await Promise.resolve( promise )
    } catch ( error ) {
        expect( error.message ).to.be.eq( message )
    }
}

describe( 'validations unique and required', () => {
    before( async () => {
        await mongodbDataSourceGroup.initialize()
        collection = await mongodbDataSourceGroup.getDataBase().createCollection( collectionName )
        await collection.createIndex( { name: 1 }, { unique: true } )
        await mongodbDataSourceGroup.getDataBase().command( {
            collMod: collectionName,
            validator: {
                $jsonSchema: {
                    bsonType: 'object',
                    required: [ 'date' ],
                    properties: {
                        'date': {
                            bsonType: [ 'date' ],
                            pattern: '.+',
                            description: `The attribute date is required`,
                        }
                    }
                }
            },
            validationLevel: 'moderate',
            validationAction: 'error'
        } )
        dataSource = new MongodbDataSource( mongodbDataSourceGroup.getDataBase(), collectionName )
    } )

    after( async () => {
        await mongodbDataSourceGroup.getDataBase().dropCollection( collectionName )
        await mongodbDataSourceGroup.close()
    } )

    it( 'should create object success', async () => {
        const data: Mutation = {
            getData: () => ( {
                date: new Date(), name: 'Unique name'
            } ),
            getArrayOperations: () => [],
            addField: () => true
        }
        expect( await dataSource.create( data ) ).to.be.any
        await throwTesting(
            dataSource.create( data ),
            'Constraint unique value expected for "name" duplicate on Validation model'
        )
        await throwTesting(
            dataSource.create( {
                ...data,
                getData: () => ( {
                    name: 'My name'
                } )
            } ),
            'Document failed validation on Validation model, review types or required values in data'
        )
    } )
} )