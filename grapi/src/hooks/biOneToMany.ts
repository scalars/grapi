import { ModelRelation } from '../dataModel'
import { get, omit } from '../lodash'
import { OneToManyRelation } from '../relation'
import { findUniqueObjectOnModel, findUniqueObjectsOnModel, relationForeignKey } from './index'
import { Hook } from './interface'

// eslint-disable-next-line max-lines-per-function
export const createHookMap = ( relation: ModelRelation ): Record<string, Hook> => {
    const relationImpl = new OneToManyRelation( {
        oneSideModel: relation.source,
        manySideModel: relation.target,
        oneSideField: relation.sourceField,
        manySideField: relation.targetField,
        foreignKey: relationForeignKey( relation.metadata ),
    } )

    // fields
    const oneSideField = relationImpl.getOneSideField()
    const manySideField = relationImpl.getManySideField()

    // operations
    const create = ( sourceId: string, records: any[], context: any ): Promise<void[]> => {
        return Promise.all( records.map( async record =>
            await relationImpl.createAndAddFromOneSide( sourceId, record, context ) )
        )
    }

    const connect = ( sourceId: string, ids: string[], context: any ): Promise<void[]> => {
        return Promise.all( ids.map( id => relationImpl.addIdFromOneSide( sourceId, id, context ) ) )
    }

    const disconnect = ( sourceId: string, ids: string[], context: any ): Promise<void[]> => {
        return Promise.all( ids.map( id => relationImpl.removeIdFromOneSide( sourceId, id, context ) ) )
    }

    const destroy = ( sourceId: string, ids: string[], context: any ): Promise<void[]> => {
        return Promise.all( ids.map( id => relationImpl.addIdFromOneSide( sourceId, id, context ) ) )
    }

    // many side
    const connectOne = ( connectId: string ): { [x: string]: string } => {
        return relationImpl.setForeignKeyOnManySide( connectId )
    }

    const createOne = ( targetData: any, context: any ): Promise<{ [x: string]: string }> => {
        return relationImpl.createAndSetForeignKeyOnManySide( targetData, context )
    }

    const disconnectOne = (): { [x: string]: string } => {
        return relationImpl.unsetForeignKeyOnManySide()
    }

    const destroyOne = async ( data: any, context: any ): Promise<any> => {
        data = await relationImpl.destroyAndUnsetForeignKeyOnManySide( data, context )
        return data
    }

    // todo: add cascade delete
    return {
        // one side
        [relation.source.getName()]: {
            wrapCreate: async ( context, createOperation ): Promise<void> => {
                const { data, graphqlContext } = context
                const relationData = get( data, oneSideField )
                if ( !relationData ) {
                    return createOperation()
                }

                const connectWhere: Array<Record<string, any>> = await findUniqueObjectsOnModel( get( relationData, 'connect' ), relation.target )
                const createRecords: any[] = get( relationData, 'create' )

                // create with filtered data
                context.data = omit( data, oneSideField )
                await createOperation()
                const created = context.response

                // execute relations
                if ( connectWhere ) {
                    const connectIds = connectWhere.map( where => where.id )
                    await connect( created.id, connectIds, graphqlContext )
                }

                if ( createRecords ) {
                    await create( created.id, createRecords, graphqlContext )
                }

                return created
            },

            // require id in where
            wrapUpdate: async ( context, updateOperation ): Promise<void> => {
                const { where, data, graphqlContext } = context
                const relationData = get( data, oneSideField )
                if ( !relationData ) {
                    return updateOperation()
                }

                // update with filtered data
                context.data = omit( data, oneSideField )
                await updateOperation()
                const updated = context.response

                // execute relation
                const connectWhere: Array<Record<string, any>> = await findUniqueObjectsOnModel( get( relationData, 'connect' ), relation.target )
                const createRecords: any[] = get( relationData, 'create' )
                const disconnectWhere: Array<{ id: string }> = get( relationData, 'disconnect' )
                const deleteWhere: Array<{ id: string }> = get( relationData, 'delete' )

                if ( connectWhere ) {
                    const connectIds = connectWhere.map( v => v.id )
                    await connect( where.id, connectIds, graphqlContext )
                }

                if ( createRecords ) {
                    await create( where.id, createRecords, graphqlContext )
                }

                if ( disconnectWhere ) {
                    const disconnectIds = disconnectWhere.map( v => v.id )
                    await disconnect( where.id, disconnectIds, graphqlContext )
                }

                if ( deleteWhere ) {
                    const deleteIds = deleteWhere.map( v => v.id )
                    await destroy( where.id, deleteIds, graphqlContext )
                }

                return updated
            },

            resolveFields: {
                [oneSideField]: ( data, argument, graphqlContext ): Promise<any[]> => {
                    return relationImpl.joinManyOnOneSide( data, argument, graphqlContext )
                },
            },
        },

        // many side
        [relation.target.getName()]: {
            // connect or create relation
            wrapCreate: async ( context, createOperation ): Promise<void> => {
                const { data, graphqlContext } = context
                const relationData = get( data, manySideField )
                if ( !relationData ) {
                    return createOperation()
                }

                const connectObject: Record<string, any> = await findUniqueObjectOnModel( get( relationData, 'connect' ), relation.source )
                const createData = get( relationData, 'create' )

                // put id to data
                const dataWithoutRelation = omit( data, manySideField )
                if ( connectObject ) {
                    const dataWithConnectId = await connectOne( connectObject.id )
                    context.data = { ...dataWithoutRelation, ...dataWithConnectId }
                    return createOperation()
                }

                if ( createData ) {
                    const dataWithCreateId = await createOne( createData, graphqlContext )
                    context.data = { ...dataWithoutRelation, ...dataWithCreateId }
                    return createOperation()
                }
            },

            wrapUpdate: async ( context, updateOperation ): Promise<void> => {
                // TODO Validate object exist where
                const { data, graphqlContext } = context
                const relationData = get( data, manySideField )
                if ( !relationData ) {
                    return updateOperation()
                }

                // connect -> create -> disconnect -> delete
                const connectId = await findUniqueObjectOnModel( get( relationData, 'connect' ), relation.source )
                const ifDisconnect: boolean = get( relationData, 'disconnect' )
                const createData = get( relationData, 'create' )
                const ifDelete = get( relationData, 'delete' )

                // return to update operation with relation field
                const dataWithoutRelation = omit( data, manySideField )
                let dataWithRelationField: any
                if ( connectId ) {
                    dataWithRelationField = await connectOne( connectId.id )
                } else if ( createData ) {
                    dataWithRelationField = await createOne( createData, graphqlContext )
                } else if ( ifDisconnect ) {
                    dataWithRelationField = await disconnectOne()
                } else if ( ifDelete ) {
                    dataWithRelationField = await destroyOne( data, graphqlContext )
                }

                context.data = { ...dataWithoutRelation, ...dataWithRelationField }
                return updateOperation()
            },

            resolveFields: {
                [relationImpl.getManySideField()]:
                    ( parent, _, graphqlContext ): Promise<any> => relationImpl.joinOneOnManySide( parent, graphqlContext ),
            },
        },
    }
}
