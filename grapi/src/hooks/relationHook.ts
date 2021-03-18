import { ModelRelation, RelationType } from '../dataModel'
import { createHookMap as createBiOneToManyHook } from './biOneToMany'
import { createHookMap as createBiOneToOneHook } from './biOneToOne'
import { Hook } from './interface'
import { createHookMap as createManyToManyHook } from './manyToMany'
import { createHookMap as createUniOneToManyHook } from './uniOneToMany'
import { createHookMap as createUniToOneHook } from './uniToOne'

export const createRelationHooks = ( relations: ModelRelation[] ): Array<Record<string, Hook>> => {
    return relations.map( relation => {
        switch ( relation.type ) {
        case RelationType.uniManyToOne:
        case RelationType.uniOneToOne:
            return createUniToOneHook( relation )

        case RelationType.uniOneToMany:
            return createUniOneToManyHook( relation )

        case RelationType.biOneToOne:
            return createBiOneToOneHook( relation )

        case RelationType.biOneToMany:
            return createBiOneToManyHook( relation )

        case RelationType.biManyToMany:
            return createManyToManyHook( relation )

        default:
            throw new Error( `unknown relation type ${relation.type}` )
        }
    } )
}
