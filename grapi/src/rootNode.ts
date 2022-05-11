import {
    GraphQLFieldConfig,
    InputObjectTypeDefinitionNode,
} from 'graphql'

import { EnumType, ObjectType } from './dataModel'
import { isString } from './lodash'

export default class RootNode {
    private typeDef: string = ``;
    private typeDefQuery: string = ``;
    private typeDefMutation: string = ``;

    // query could be queryName(args): type, or a GraphQLFieldConfig
    public addQuery( query: string ): void {
        if ( isString( query ) ) {
            if ( !RootNode.findInSdl( query, this.typeDefQuery ) ) {
                this.typeDefQuery = this.typeDefQuery.concat( ...[ `\n`, query ] )
            }
        }
    }

    // mutation could be mutationName(args): type, or a GraphQLFieldConfig
    public addMutation( mutation: string | { name: string; field: () => GraphQLFieldConfig<any, any> } ): void {
        if ( isString( mutation ) ) {
            if ( !RootNode.findInSdl( mutation, this.typeDefMutation ) ) {
                this.typeDefMutation = this.typeDefMutation.concat( ...[ `\n`, mutation ] )
            }
        }
    }

    public addObjectType( type: string | ObjectType ): void {
        // TODO What if ObjectType is duplicated on schema
        this.addSdl( type as string, false )
    }

    public addInput( input: string | InputObjectTypeDefinitionNode ): void {
        this.addSdl( input as string )
    }

    public addEnum( enumDef: string | EnumType, description: string = undefined ): void {
        this.addSdl( enumDef as string, true, description )
    }

    public addSdl( sdl: string, validate: boolean = true, description: string = undefined ): void {
        if ( isString( sdl ) ) {
            if ( ! validate || ! RootNode.findInSdl( sdl, this.typeDef ) ) {
                this.typeDef = this.typeDef.concat(
                    ...[ `\n`, description ? `"""${description}""" ` : ``, sdl ]
                )
            }
        }
    }

    public print(): string {
        return this.typeDef.concat( this.addQueriesAndMutations() )
    }

    private addQueriesAndMutations(): string {
        return ``
            .concat( this.typeDefQuery ? `type Query { ${ this.typeDefQuery } } ` : `` )
            .concat( this.typeDefMutation ? `type Mutation { ${ this.typeDefMutation } } ` : `` )
    }

    private static findInSdl ( sdlToAdd: string, sdlActual: string ): boolean {
        return ( new RegExp( sdlToAdd.split( `\n` ).shift(), 'gm' ) ).test( sdlActual )
    }
}
