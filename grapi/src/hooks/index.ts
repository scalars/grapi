import { Operator, Where } from '..'
import { Model } from '../dataModel'
import { capitalize, get, isEmpty, isUndefined, mapValues } from '../lodash'

const findUniqueObjectOnModel = async ( connectData: Record<string, any>, model: Model ): Promise<Record<string, any>> => {
    if ( isEmpty( connectData ) === false ) {
        const where: Where = mapValues( connectData, value => { return { [Operator.eq]: value } } ) as Where
        const targetItem = await model.getDataSource().findOne( { where } )
        if ( get ( targetItem, `id` ) ) {
            return targetItem
        } else {
            throw new Error( `No Node for the model ${ capitalize( model.getName() ) } with unique field.` )
        }
    } else if ( isUndefined( connectData ) === false ) {
        throw new Error( `You provided an invalid argument for the where selector on ${ capitalize( model.getName() ) }. Please provide exactly one unique field and value.` )
    }
    return undefined
}

const findUniqueObjectsOnModel = async ( connectData: any[], model: Model ): Promise<Array<Record<string, any>>> => {
    const connectWhere: Array<Record<string, any>> = []
    if ( isEmpty( connectData ) === false ) {
        for ( const filter of connectData ) {
            const object = await findUniqueObjectOnModel( filter, model )
            if ( object ) {
                connectWhere.push( object )
            }
        }
    }
    return connectWhere
}

export {
    findUniqueObjectOnModel,
    findUniqueObjectsOnModel
}
