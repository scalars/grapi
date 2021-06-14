import { ModelRelation } from '../dataModel'
import { get, omit } from '../lodash'
import { BiOneToOneRelation } from '../relation'
import { findUniqueObjectOnModel } from './index'
import { Hook } from './interface'

export const createHookMap = ( relation: ModelRelation ): Record<string, Hook> => {
    const relationImpl = new BiOneToOneRelation( {
        modelA: relation.source,
        modelB: relation.target,
        modelAField: relation.sourceField,
        modelBField: relation.targetField,
        foreignKey: get( relation.metadata, 'foreignKey.key' ),
        owningSideModelName: get( relation.metadata, 'foreignKey.side' ),
    } )

    // fields
    const owningSideField = relationImpl.getOwningSideField()
    const refSideField = relationImpl.getRefSideField()

    return {
        // todo: add cascade delete support
        [relationImpl.getOwningSide().getName()]: {
            // connect or create relation
            wrapCreate: async ( context, createOperation ): Promise<any> => {
                const { data, graphqlContext } = context
                const relationData = get( data, owningSideField )
                if ( ! relationData ) {
                    return createOperation()
                }
                const connectId: Record<string, any> = await findUniqueObjectOnModel( get( relationData, 'connect' ), relationImpl.getRefSide() )
                const createData = get( relationData, 'create' )

                // put id to data
                const dataWithoutRelation = omit( data, owningSideField )
                if ( connectId ) {
                    const dataWithConnectId = await relationImpl.setForeignKeyOnOwningSide( connectId.id )
                    context.data = { ...dataWithoutRelation, ...dataWithConnectId }
                    return createOperation()
                }

                if ( createData ) {
                    const dataWithCreateId = await relationImpl.createAndSetForeignKeyOnOwningSide( createData, graphqlContext )
                    context.data = { ...dataWithoutRelation, ...dataWithCreateId }
                    return createOperation()
                }
            },

            wrapUpdate: async ( context, updateOperation ): Promise<any> => {
                const { data, graphqlContext } = context
                const relationData = get( data, owningSideField )
                if ( ! relationData ) {
                    return updateOperation()
                }

                // connect -> create -> disconnect -> delete
                const connectId: Record<string, any> = await findUniqueObjectOnModel( get( relationData, 'connect' ), relationImpl.getRefSide() )
                const ifDisconnect: boolean = get( relationData, 'disconnect' )
                const createData = get( relationData, 'create' )
                const ifDelete = get( relationData, 'delete' )

                // return to update operation with relation field
                const dataWithoutRelation = omit( data, owningSideField )
                let dataWithRelationField: any
                if ( connectId ) {
                    dataWithRelationField = await relationImpl.setForeignKeyOnOwningSide( connectId.id )
                } else if ( createData ) {
                    dataWithRelationField = await relationImpl.createAndSetForeignKeyOnOwningSide( createData, graphqlContext )
                } else if ( ifDisconnect ) {
                    dataWithRelationField = await relationImpl.unsetForeignKeyOnOwningSide()
                } else if ( ifDelete ) {
                    dataWithRelationField = await relationImpl.deleteAndUnsetForeignKeyOnOwningSide( data, graphqlContext )
                }

                context.data = { ...dataWithoutRelation, ...dataWithRelationField }
                return updateOperation()
            },

            resolveFields: {
                [relationImpl.getOwningSideField()]:
                    ( parent, _, graphqlContext ): Promise<any> => relationImpl.joinOnOwningSide( parent, graphqlContext ),
            },
        },

        // ref side
        [relationImpl.getRefSide().getName()]: {
            wrapCreate: async ( context, createOperation ): Promise<any> => {
                const { data, graphqlContext } = context
                const relationData = get( data, refSideField )
                if ( ! relationData ) {
                    return createOperation()
                }

                const connectId: Record<string, any> = await findUniqueObjectOnModel( get( relationData, 'connect' ), relationImpl.getOwningSide() )
                const createData = get( relationData, 'create' )

                // after create
                context.data = omit( data, refSideField )
                await createOperation()
                const created = context.response

                // bind relation
                if ( connectId ) {
                    return relationImpl.connectOnRefSide( created.id, connectId.id, graphqlContext )
                }

                if ( createData ) {
                    return relationImpl.createAndConnectOnRefSide( created.id, createData, graphqlContext )
                }
            },

            wrapUpdate: async ( context, updateOperation ): Promise<any> => {
                const { where, data, graphqlContext } = context
                const relationData = get( data, refSideField )
                if ( ! relationData ) {
                    return updateOperation()
                }

                // update first
                context.data = omit( data, refSideField )
                await updateOperation()

                // connect -> create -> disconnect -> delete
                const connectId: Record<string, any> = await findUniqueObjectOnModel( get( relationData, 'connect' ), relationImpl.getOwningSide() )
                const ifDisconnect: boolean = get( relationData, 'disconnect' )
                const createData = get( relationData, 'create' )
                const ifDelete = get( relationData, 'delete' )

                if ( connectId ) {
                    return relationImpl.connectOnRefSide( where.id, connectId.id, graphqlContext )
                }

                if ( createData ) {
                    return relationImpl.createAndConnectOnRefSide( where.id, createData, graphqlContext )
                }

                if ( ifDisconnect ) {
                    return relationImpl.disconnectOnRefSide( where.id, graphqlContext )
                }

                if ( ifDelete ) {
                    return relationImpl.deleteAndDisconnectOnRefSide( where.id, graphqlContext )
                }
            },

            resolveFields: {
                [relationImpl.getRefSideField()]: ( data, _, graphqlContext ): Promise<any> => relationImpl.joinOnRefSide( data, graphqlContext ),
            },
        },
    }
}
