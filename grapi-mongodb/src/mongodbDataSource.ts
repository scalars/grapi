import {
    DataSource,
    filter,
    ListFindQuery,
    Mutation,
    Operator,
    paginate,
    PaginatedResponse,
    Where
} from '@scalars/grapi'
import { Db, ObjectId } from 'mongodb'

import { first, get, isEmpty } from './lodash'
import { MongodbData } from './mongodbData'

export class MongodbDataSource extends MongodbData implements DataSource {

    constructor( db: Db, collectionName: string ) {
        super( db, collectionName )
    }

    public async find( args?: ListFindQuery ): Promise<PaginatedResponse> {
        // TODO Make orderBy better, admit multiple order
        const { pagination, where, orderBy = {} } = args || {} as any
        const data: any[] = await this.findRecursive( where, orderBy )
        return paginate( data, pagination )
    }

    public async findOne( { where }: { where: Where } ): Promise<any> {
        const filterQuery = this.whereToFilterQuery( where )
        // TODO Review if findOne is better
        const filteredData = await this.findInCollection( filterQuery )
        return first( filteredData )
    }

    public async findOneById( id: string ): Promise<any> {
        const filteredData = await this.findInCollection( { id } )

        return first( filteredData )
    }

    public async create( mutation: Mutation ): Promise<any> {
        const payload = this.transformMutation( mutation )
        try {
            const insertResult = await this.db.collection( this.collectionName ).insertOne( payload )
            const insertedItem: { _id: ObjectId, id: string } = ( insertResult.ops || [] ).shift()
            if ( insertedItem ) {
                await this.db.collection( this.collectionName ).updateOne(
                    { _id: insertedItem._id },
                    { $set: { id: insertedItem._id.toString() } }
                )
                return { ...insertedItem, id: insertedItem._id.toString() }
            }
        } catch ( error ) {
            this.handleMongoDbError( error )
        }
    }

    public async update( where: Where, mutation: Mutation ): Promise<any> {
        const payload = this.transformMutation( mutation, true )
        const filterQuery = this.whereToFilterQuery( where )
        if ( isEmpty( payload ) === false ) {
            try {
                await this.db.collection( this.collectionName ).updateOne( filterQuery, payload )
            } catch ( error ) {
                this.handleMongoDbError( error )
            }
        }
        return await this.findOne( { where } )
    }

    public async delete( where: Where ): Promise<any> {
        const filterQuery = this.whereToFilterQuery( where )
        await this.db.collection( this.collectionName ).deleteOne( filterQuery )
    }

    // ToOneRelation
    public async findOneByRelation( foreignKey: string, foreignId: string ): Promise<any> {
        // TODO Review if filter direct in mongo is Better
        const data =  await this.findInCollection( { } )
        return first( filter( data, { [foreignKey]: { [Operator.eq]: foreignId } } ) )
    }

    // ToOneRelation
    public async updateOneRelation( id: string, foreignKey: string, foreignId: string ): Promise<any> {
        // remove oldOwner foreignKey
        await this.db.collection( this.collectionName ).updateOne(
            { [foreignKey]: foreignId },
            { $unset: { [foreignKey]: '' } },
        )
        // add foreignKey to  newOwner
        await this.db.collection( this.collectionName ).updateOne(
            { id },
            { $set: { [foreignKey]: foreignId } },
        )
    }

    // OneToManyRelation
    public async findManyFromOneRelation( { where, orderBy }: ListFindQuery ): Promise<any[]> {
        return await this.findRecursive( where, orderBy )
    }

    // ManyToManyRelation
    public async findManyFromManyRelation(
        sourceSideName: string,
        targetSideName: string,
        sourceSideId: string,
        { where, orderBy }: ListFindQuery
    ): Promise<any[]> {
        const relationTableName = `_${sourceSideName}_${targetSideName}`
        const relationData = await this.db.collection( relationTableName ).findOne( { sourceSideId } )
        const relationIds = get( relationData, `targetSideIds`, [] )
        return await this.findRecursive( { ...where, id: { [Operator.in]: relationIds } }, orderBy )
    }

    public async addIdToManyRelation(
        sourceSideName: string,
        targetSideName: string,
        sourceSideId: string,
        targetSideId: string ): Promise<void> {
        const relationTableName = `_${sourceSideName}_${targetSideName}`
        await this.db.collection( relationTableName ).updateOne(
            { sourceSideId },
            {
                $set: {
                    sourceSideId,
                },
                $push: {
                    targetSideIds: targetSideId,
                },
            },
            { upsert: true },
        )
    }

    public async removeIdFromManyRelation(
        sourceSideName: string,
        targetSideName: string,
        sourceSideId: string,
        targetSideId: string ): Promise<void> {
        const relationTableName = `_${sourceSideName}_${targetSideName}`
        await this.db.collection( relationTableName ).updateOne(
            { sourceSideId },
            {
                $pull: {
                    targetSideIds: targetSideId,
                },
            },
        )
    }
}
