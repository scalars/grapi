import { Operator, Where } from '..'
import { ModelRelation } from '../dataModel'
import { get, isEmpty, mapValues, omit } from '../lodash'
import { OneToManyRelation } from '../relation'
import { findUniqueObjectsOnModel, relationForeignKey } from './index'
import { Hook } from './interface'

export const createHookMap = ( relation: ModelRelation ): Record<string, Hook> => {
    const relationImpl: OneToManyRelation = new OneToManyRelation( {
        oneSideModel: relation.source,
        manySideModel: relation.target,
        oneSideField: relation.sourceField,
        manySideField: relation.targetField,
        foreignKey: relationForeignKey( relation.metadata ),
    } )

    const oneSideField = relationImpl.getOneSideField()

    const create = ( sourceId: string, records: any[], context: any ): Promise<void[]> => {
        return Promise.all(
            records.map(
                async ( record ) => {
                    await relationImpl.createAndAddFromOneSide( sourceId, record, context )
                }
            )
        )
    }

    const connect = ( sourceId: string, ids: string[], context: any ): Promise<void[]> => {
        return Promise.all( ids.map( id => relationImpl.addIdFromOneSide( sourceId, id, context ) ) )
    }

    const disconnect = ( sourceId: string, ids: string[], context: any ): Promise<void[]> => {
        return Promise.all( ids.map( id => relationImpl.removeIdFromOneSide( sourceId, id, context ) ) )
    }

    const destroy = ( sourceId: string, ids: string[], context: any ): Promise<void[]> => {
        // TODO Add method destroy objects on manySide
        return Promise.all( ids.map( id => relationImpl.addIdFromOneSide( sourceId, id, context ) ) )
    }

    // todo: add cascade delete
    return {
        // one side
        [relation.source.getName()]: {
            wrapCreate: async ( context, createOperation ): Promise<void> => {
                const { data, graphqlContext } = context
                const relationData = get( data, oneSideField )
                if ( ! relationData ) {
                    return createOperation()
                }

                // create data
                context.data = omit( data, oneSideField )
                await createOperation()
                const created = context.response

                // bind relation
                const { connect: connectRecords, create: createRecords } = relationData
                const connectWhere: Array<Record<string, any>> = await findUniqueObjectsOnModel(
                    connectRecords, relation.target
                )

                if ( isEmpty( connectWhere ) === false ) {
                    const connectIds = connectWhere.map( v => v.id )
                    await connect( created.id, connectIds, graphqlContext )
                }

                if ( createRecords ) {
                    await create( created.id, createRecords, graphqlContext )
                }
            },

            // require id in where
            wrapUpdate: async ( context, updateOperation ): Promise<void> => {
                const { where, data, graphqlContext } = context
                const sourceObject = await relation.source.getDataSource().findOne(
                    { where: mapValues( where, value => { return { [Operator.eq]: value } } ) as Where }
                )
                const relationData = get( data, oneSideField )
                if ( ! relationData ) {
                    return updateOperation()
                }

                // update first
                context.data = omit( data, oneSideField )
                await updateOperation()
                const updated = context.response

                // bind relation

                const connectWhere: Array<Record<string, any>> = await findUniqueObjectsOnModel( get( relationData, 'connect' ), relation.target )
                const createRecords: any[] = get( relationData, 'create' )
                const disconnectWhere: Array<Record<string, any>> = await findUniqueObjectsOnModel( get( relationData, 'disconnect' ), relation.target )
                const deleteWhere: Array<Record<string, any>> = await findUniqueObjectsOnModel( get( relationData, 'delete' ), relation.target )

                if ( isEmpty( connectWhere ) === false ) {
                    const connectIds = connectWhere.map( v => v.id )
                    await connect( sourceObject.id, connectIds, graphqlContext )
                }

                if ( createRecords ) {
                    await create( sourceObject.id, createRecords, graphqlContext )
                }

                if ( isEmpty( disconnectWhere ) === false ) {
                    const disconnectIds = disconnectWhere.map( v => v.id )
                    await disconnect( sourceObject.id, disconnectIds, graphqlContext )
                }

                if ( isEmpty( deleteWhere ) === false ) {
                    const deleteIds = deleteWhere.map( v => v.id )
                    await destroy( sourceObject.id, deleteIds, graphqlContext )
                }

                return updated
            },

            resolveFields: {
                [relation.sourceField]: ( data, _, graphqlContext ): Promise<any[]> => relationImpl.joinManyOnOneSide( data, graphqlContext ),
            },
        },
    }
}
