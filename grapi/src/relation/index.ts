import { Field, Model, RelationField, RelationType } from '../dataModel'
import { DataModelType } from '../dataModel/type'
import { Operator } from '../dataSource/interface'
import { findUniqueObjectOnModel, findUniqueObjectsOnModel } from '../hooks'
import { forEach, intersection, isEmpty, keys, map, omit } from '../lodash'

export { default as BiOneToOneRelation } from './biOneToOne'
export { default as ManyToManyRelation } from './manyToMany'
export { default as OneToManyRelation } from './oneToMany'
export { default as UniToOneRelation } from './uniToOne'

export const InputMultipleFields = ( fieldOne, fieldTo, fieldName ) => {
    if ( ! isEmpty( fieldOne ) && ! isEmpty( fieldTo ) ) {
        throw new Error( `There can be only one input field named ${ fieldName }` )
    }
}

export const InputRecursiveRelation = async (
    rootData,
    nextRelation: Model,
    context,
    execution: ( data: any ) => Promise<any> | undefined = undefined
): Promise< {
    rootData: Record<string, any>,
    createdData: Record<string, any>,
    executed: Record<string, any> | undefined
} > => {
    let executed = undefined

    const createdData = {}
    const keysData = keys( rootData )
    const keysFields = []
    const modelFields: Record<string, Field> = nextRelation.getFields()
    forEach( modelFields, ( field: RelationField, key: string ) => {
        if ( ! field.isScalar() && field.getType() !== DataModelType.OBJECT ) {
            keysFields.push( key )
        }
    } )
    const keysRelation = intersection( keysData, keysFields )
    await Promise.all(
        map( keysRelation, async ( key ) => {
            const relationData = rootData[ key ] || {}
            const relationField: RelationField = modelFields[ key ] as RelationField
            const relationConfig = relationField.getRelationConfig ? relationField.getRelationConfig() : {}
            const relationTo: Model = relationField.getRelationTo()
            const { create, connect } = relationData

            const relationForeignKey = relationConfig.foreignKey ? relationConfig.foreignKey.key || relationConfig.foreignKey : undefined
            rootData = omit( rootData, key )
            // TODO What happen on third level input
            if ( relationField.getRelationType() === RelationType.biOneToOne ) {
                InputMultipleFields( create, connect, key )
                const relationSide = relationConfig.foreignKey.side
                const relationSameSide = relationTo.getTypename() === relationSide
                if ( ! isEmpty( create ) ) {
                    await InputRecursiveRelation( create, relationTo, context )
                    if ( relationSameSide && execution ) {
                        // TODO Clean on execution any data relation
                        executed = await execution( rootData )
                        create[ relationForeignKey ] = executed.object.id
                    }
                    const mutation = relationTo.getCreateMutationFactory().createMutation( create )
                    const created = await relationTo.getDataSource().create( mutation, context )
                    if ( ! relationSameSide ) {
                        createdData[ relationForeignKey ] = created.id
                    }
                } else if ( ! isEmpty( connect ) ) {
                    const { id }: Record<string, any> = await findUniqueObjectOnModel( connect, relationTo )
                    if ( ! relationSameSide ) {
                        createdData[ relationForeignKey ] = id
                    } else if ( execution ) {
                        // TODO Clean on execution any data relation
                        executed = await execution( rootData )
                        await relationTo.getDataSource().updateOneRelation(
                            id, relationForeignKey, executed.object.id, context
                        )
                    }
                }
            } else if ( relationField.getRelationType() === RelationType.uniOneToOne ) {
                InputMultipleFields( create, connect, key )
                if ( ! isEmpty( create ) ) {
                    await InputRecursiveRelation( create, relationTo, context )
                    const mutation = relationTo.getCreateMutationFactory().createMutation( create )
                    const created = await relationTo.getDataSource().create( mutation, context )
                    createdData[ relationForeignKey ] = created.id
                }
                if ( ! isEmpty( connect ) ) {
                    const { id }: Record<string, any> = await findUniqueObjectOnModel( connect, relationTo )
                    createdData[ relationForeignKey ] = id
                }
            }  else if (
                relationField.getRelationType() === RelationType.biOneToMany ||
                relationField.getRelationType() === RelationType.uniOneToMany
            ) {
                if ( ! relationField.isList() ) InputMultipleFields( create, connect, key )
                if ( ! isEmpty( create ) ) {
                    if ( relationField.isList() ) {
                        await InputRecursiveRelation( create, relationTo, context )
                        executed = await execution( rootData )
                        await Promise.all(
                            map( create, async ( dataToCreate: Record<string, any> ) => {
                                const mutation = await relationTo
                                    .getCreateMutationFactory()
                                    .createMutation( { ...dataToCreate, [ relationForeignKey ]: executed.object.id } )
                                await relationTo
                                    .getDataSource()
                                    .create( mutation, context )
                            } )
                        )
                    } else {
                        const mutation = relationTo.getCreateMutationFactory().createMutation( create )
                        const created = await relationTo.getDataSource().create( mutation, context )
                        createdData[ relationForeignKey ] = created.id
                    }
                }
                if ( ! isEmpty( connect ) ) {
                    if ( relationField.isList() ) {
                        const connectData: Array<Record<string, any>> = await findUniqueObjectsOnModel( connect, relationTo )
                        executed = await execution( rootData )
                        await Promise.all(
                            map( connectData, async ( { id }: Record<string, any> ) => {
                                const mutation = await relationTo
                                    .getCreateMutationFactory()
                                    .createMutation( { [relationForeignKey]: executed.object.id } )
                                await relationTo
                                    .getDataSource()
                                    .update( { id: { [Operator.eq]: id } }, mutation, context )
                            } )
                        )
                    } else {
                        const connectData: Record<string, any> = await findUniqueObjectOnModel(  connect, relationTo )
                        createdData[ relationForeignKey ] = connectData.id
                    }
                }
            }  else if ( relationField.getRelationType() === RelationType.biManyToMany ) {
                executed = await execution( rootData )
                const addId = async ( id: string ) => {
                    await relationTo.getDataSource().addIdToManyRelation(
                        nextRelation.getNamings().singular,
                        relationTo.getNamings().singular,
                        executed.object.id,
                        id,
                        context
                    )
                    await nextRelation.getDataSource().addIdToManyRelation(
                        relationTo.getNamings().singular,
                        nextRelation.getNamings().singular,
                        id,
                        executed.object.id,
                        context
                    )
                }
                if ( ! isEmpty( create ) ) {
                    await Promise.all(
                        map( create, async ( data: Record<string, any> ) => {
                            const mutation = relationTo.getCreateMutationFactory().createMutation( data )
                            const { id } = await relationTo.getDataSource().create( mutation )
                            await addId( id )
                        } )
                    )
                }
                if ( ! isEmpty( connect ) ) {
                    const connectData: Array<Record<string, any>> = await findUniqueObjectsOnModel( connect, relationTo )
                    await Promise.all(
                        map( connectData, async ( { id }: Record<string, any> ) => {
                            await addId( id )
                        } )
                    )
                }
            }
        } )
    )
    return { createdData, rootData, executed }
}
