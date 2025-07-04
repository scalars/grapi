import {
    DataSource,
    ListFindQuery,
    Mutation,
    Operator,
    PaginatedResponse,
    Where
} from '@grapi/server'
import { Db, ObjectId } from 'mongodb'

import { get, isEmpty } from './lodash'
import { MongodbData } from './mongodbData'

export class MongodbDataSource extends MongodbData implements DataSource {

    constructor( db: Db, collectionName: string ) {
        super( db, collectionName )
    }

    public async find( args?: ListFindQuery ): Promise<PaginatedResponse> {
        const { pagination, where, orderBy = {} } = args || {}
        return {
            data: await this.findRecursive( where, orderBy, pagination ),
            total: null,
            hasNextPage: false,
            hasPreviousPage: false
        }
    }

    public async findOne( { where }: { where: Where } ): Promise<unknown> {
        return await this.findOneInCollection( this.whereToFilterQuery( where ) )
    }

    public async findOneById( id: string ): Promise<unknown> {
        return await this.findOneInCollection( { _id: new ObjectId( id ) } )
    }

    public async create( mutation: Mutation ): Promise<unknown> {
        const payload = this.transformMutation( mutation )
        try {
            const insertId = new ObjectId()
            const insertResult = await this.db
                .collection( this.collectionName )
                .insertOne( { ...payload,  _id: insertId, id: insertId.toString()  } )
            if ( insertResult ) {
                return this.db
                    .collection( this.collectionName )
                    .findOne( { _id: insertId } )
            }
        } catch ( error ) {
            this.handleMongoDbError( error )
        }
    }

    public async update( where: Where, mutation: Mutation ): Promise<unknown> {
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

    public async delete( where: Where ): Promise<void> {
        const filterQuery = this.whereToFilterQuery( where )
        await this.db.collection( this.collectionName ).deleteOne( filterQuery )
    }

    // ToOneRelation
    public async findOneByRelation( foreignKey: string, foreignId: string ): Promise<unknown> {
        return await this.findOneInCollection( { [foreignKey]: foreignId } )
    }

    // ToOneRelation
    public async updateOneRelation(
        id: string,
        foreignKey: string,
        foreignId: string
    ): Promise<void> {
        await Promise.all( [
            this.db.collection( this.collectionName ).updateOne(
                { [foreignKey]: foreignId },
                { $unset: { [foreignKey]: '' } },
            ),
            this.db.collection( this.collectionName ).updateOne(
                { id },
                { $set: { [foreignKey]: foreignId } },
            )
        ] )
    }

    // OneToManyRelation
    public async findManyFromOneRelation( { where, orderBy }: ListFindQuery ): Promise<unknown[]> {
        return await this.findRecursive( where, orderBy, {} )
    }

    // ManyToManyRelation
    public async findManyFromManyRelation(
        sourceSideName: string,
        targetSideName: string,
        sourceSideId: string,
        { where, orderBy }: ListFindQuery
    ): Promise<unknown[]> {
        const relationTableName = `_${sourceSideName}_${targetSideName}`
        const relationData = await this.db.collection( relationTableName ).findOne( { sourceSideId } )
        const relationIds = get( relationData, `targetSideIds`, [] )
        return await this.findRecursive( { ...where, id: { [Operator.in]: relationIds } }, orderBy, {} )
    }

    public async addIdToManyRelation(
        sourceSideName: string,
        targetSideName: string,
        sourceSideId: string,
        targetSideId: string
    ): Promise<void> {
        const relationTableName = `_${sourceSideName}_${targetSideName}`
        await this.db.collection<{ sourceSideId: string, targetSideIds: Array<string> }>( relationTableName ).updateOne(
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
        await this.db.collection<{ sourceSideId: string, targetSideIds: Array<string> }>( relationTableName ).updateOne(
            { 
                sourceSideId
            },
            {
                $pull: {
                    targetSideIds: targetSideId,
                },
            },
        )
    }
}
