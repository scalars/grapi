import { ModelRelation } from '../dataModel'
import { get, omit } from '../lodash'
import { UniToOneRelation } from '../relation'
import { findUniqueObjectOnModel } from './index'
import { Hook } from './interface'

// eslint-disable-next-line max-lines-per-function
export const createHookMap = ( relation: ModelRelation ): Record<string, Hook> => {
    const relationImpl = new UniToOneRelation( {
        sourceModel: relation.source,
        targetModel: relation.target,
        relationField: relation.sourceField,
        foreignKey: get( relation.metadata, 'foreignKey' ),
    } )

    const relationField = relationImpl.getRelationField()

    // id required to be in model fields
    // todo: it there anyway to get the unique fields of model to filter data?
    return {
        // todo: add cascade delete support
        [ relation.source.getName() ]: {
            // connect or create relation
            wrapCreate: async ( context, createOperation ): Promise<any> => {
                const { data, graphqlContext } = context
                const relationData = get( data, relationField )
                if ( !relationData ) {
                    return createOperation()
                }
                const connectId: Record<string, any> = await findUniqueObjectOnModel( get( relationData, 'connect' ), relation.target )
                const createData = get( relationData, 'create' )

                // put id to data
                const dataWithoutRelation = omit( data, relationField )
                if ( connectId ) {
                    const dataWithConnectId = await relationImpl.setForeignKey( connectId.id )
                    context.data = { ...dataWithoutRelation, ...dataWithConnectId }
                    return createOperation()
                }

                if ( createData ) {
                    const dataWithCreateId = await relationImpl.createAndSetForeignKey( createData, graphqlContext )
                    context.data = { ...dataWithoutRelation, ...dataWithCreateId }
                    return createOperation()
                }
            },

            wrapUpdate: async ( context, updateOperation ): Promise<any> => {
                const { data, graphqlContext } = context
                const relationData = get( data, relationField )
                if ( !relationData ) {
                    return updateOperation()
                }

                // connect -> create -> disconnect -> delete
                const connectId: Record<string, any> = await findUniqueObjectOnModel( get( relationData, 'connect' ), relation.target )
                const ifDisconnect: boolean = get( relationData, 'disconnect' )
                const createData = get( relationData, 'create' )
                const ifDelete = get( relationData, 'delete' )

                // return to update operation with relation field
                const dataWithoutRelation = omit( data, relationField )
                let dataWithRelationField: any
                if ( connectId ) {
                    dataWithRelationField = await relationImpl.setForeignKey( connectId.id )
                } else if ( createData ) {
                    dataWithRelationField = await relationImpl.createAndSetForeignKey( createData, graphqlContext )
                } else if ( ifDisconnect ) {
                    dataWithRelationField = await relationImpl.unsetForeignKey()
                } else if ( ifDelete ) {
                    dataWithRelationField = await relationImpl.destroyAndUnsetForeignKey( data, graphqlContext )
                }

                context.data = { ...dataWithoutRelation, ...dataWithRelationField }
                return updateOperation()
            },

            resolveFields: {
                [relation.sourceField]: ( parent, _, graphqlContext ): Promise<any> => relationImpl.join( parent, graphqlContext ),
            },
        },
    }
}
