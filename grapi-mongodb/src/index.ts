import { DataSource } from '@scalars/grapi'
import { Db, MongoClient } from 'mongodb'

import { MongodbDataSource } from './mongodbDataSource'

export interface DataSourceGroup {
    initialize(): Promise<void>;
    getDataSource( collectionName: string ): DataSource;
    getDataBase(): Db;
    close(): void;
}

export class MongodbDataSourceGroup implements DataSourceGroup {
    private readonly uri: string;
    private readonly dbName: string;
    private mongoClient: MongoClient;
    private db: Db;

    constructor( uri: string, dbName: string ) {
        this.uri = uri
        this.dbName = dbName
    }

    public async initialize(): Promise<void> {
        this.mongoClient = await MongoClient.connect( this.uri, { useUnifiedTopology: true } )
        this.db = this.mongoClient.db( this.dbName )
    }

    public getDataSource( collectionName: string ): MongodbDataSource {
        if ( !this.db ) {
            throw Error( 'Please initialize mongoDB data source group first.' )
        }
        return new MongodbDataSource( this.db, collectionName )
    }

    public getDataBase(): Db {
        if ( !this.db ) {
            throw Error( 'Please initialize mongoDB data source group first.' )
        }
        return this.db
    }

    public async close(): Promise<void> {
        if ( this.mongoClient ) {
            await this.mongoClient.close( true )
        }
    }
}
