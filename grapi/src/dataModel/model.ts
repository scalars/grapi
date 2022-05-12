import { IObjectTypeResolver } from '@graphql-tools/utils'
import * as pluralize from 'pluralize'

import { DataSource } from '..'
import { MODEL_DIRECTIVES } from '../constants'
import { capitalize, defaultTo, find, forOwn, isEmpty, pickBy } from '../lodash'
import { MutationFactory } from '../plugins/mutation'
import Field from './field'
import { DirectiveModelAction } from './type'

export default class Model {
    private readonly name: string;
    private readonly fields: Record<string, Field>;
    private readonly namings: {
        plural: string;
        singular: string;
        capitalSingular: string;
    };

    // data
    private dataSource: DataSource;

    // resolver
    private resolver: IObjectTypeResolver = {};

    // other metadata
    private metadata: Record<string, any> = {};

    // mutation Factory
    private createMutationFactory: MutationFactory = new MutationFactory();
    private updateMutationFactory: MutationFactory = new MutationFactory();

    // for object type api
    private readonly isObject: boolean;

    constructor( {
        name,
        fields,
        isObject,
    }: {
        name: string;
        fields?: Record<string, Field>;
        isObject?: boolean;
    } ) {
        this.name = name
        // lowercase and singular it first
        const key = pluralize.singular( name.toLowerCase() )
        this.namings = {
            plural: pluralize.plural( key ),
            singular: key,
            capitalSingular: capitalize( key ),
        }
        this.fields = fields || {}
        this.isObject = defaultTo( isObject, false )
    }

    public appendField( name: string, field: Field ): void {
        this.fields[name] = field
    }

    public getField( name: string ): Field {
        return this.fields[name]
    }

    public getFields(): Record<string, Field> {
        return this.fields
    }

    public getName(): string {
        return this.name
    }

    public getNamings(): { plural: string; singular: string; capitalSingular: string } {
        return this.namings
    }

    public getTypename(): string {
        // use capitalSingular as typename
        return this.namings.capitalSingular
    }

    public getUniqueFields(): Record<string, Field> {
        return pickBy( this.getFields(), field => field.isUnique() )
    }

    public getMetadata( key: string ): Record<string, any> {
        return this.metadata[key]
    }

    public setMetadata( key: string, value: any ): Record<string, any> {
        return this.metadata[key] = value
    }

    public setFieldResolver( field: string, resolver: any ): void {
        this.resolver[field] = resolver
    }

    public overrideResolver( resolver: any ): void {
        this.resolver = resolver
    }

    public mergeResolver( resolver: any ): void {
        this.resolver = {
            ...this.resolver,
            ...resolver,
        }
    }

    public getResolver(): IObjectTypeResolver {
        return isEmpty( this.resolver ) ? null : this.resolver
    }

    public setDataSource( dataSource: DataSource ): void {
        this.dataSource = dataSource
    }

    public getDataSource(): DataSource {
        return this.dataSource
    }

    public getDirectives( action: DirectiveModelAction, directivesOnAction: string = '' ): string {
        forOwn(
            this.getMetadata( MODEL_DIRECTIVES ) || {},
            ( actions: Array<{ value: DirectiveModelAction }>, directive: string ) => {
                if ( find( actions, { value: action } ) ) {
                    directivesOnAction = directivesOnAction.concat( ` @${directive}` )
                }
            }
        )
        return directivesOnAction
    }

    // since mutationFactory is tightly bind with model schema
    // and is shared between plugins & relation hooks,
    // we put it in model.
    // todo: find a better way to share this variable
    public getCreateMutationFactory = (): MutationFactory => {
        return this.createMutationFactory
    };

    public getUpdateMutationFactory = (): MutationFactory => {
        return this.updateMutationFactory
    };

    // for object api
    public isObjectType = (): boolean => {
        return this.isObject
    };
}
