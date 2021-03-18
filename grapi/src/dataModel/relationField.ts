import { isFunction } from '../lodash'
import Field from './field'
import Model from './model'
import { RelationShip, RelationType } from './relation/types'
import { DataModelType } from './type'

export type ModelOrThunk = Model | ( () => Model );
export type RelationConfigOrThunk = Record<string, any> | ( () => Record<string, any> );

export default class RelationField extends Field {
    private relationTo: ModelOrThunk;
    private relationConfig?: RelationConfigOrThunk;
    private relationName?: string;
    private relationType?: RelationType;
    private relation?: RelationShip;

    constructor( {
        relationTo,
        relationConfig,
        nonNull,
        list,
        nonNullItem,
        readOnly,
    }: {
        relationTo: ModelOrThunk;
        relationConfig?: RelationConfigOrThunk;
        nonNull?: boolean;
        list?: boolean;
        nonNullItem?: boolean;
        readOnly?: boolean;
    } ) {
        super( {
            type: DataModelType.RELATION,
            nonNull,
            list,
            nonNullItem,
            readOnly,
        } )

        this.relationTo = relationTo
        this.relationConfig = relationConfig
    }

    public getTypename(): string {
        // typename of relationField should refer to the model relation to
        return this.getRelationTo().getTypename()
    }

    public getRelationTo(): Model {
        return isFunction( this.relationTo ) ? this.relationTo() : this.relationTo
    }

    public getRelationConfig(): Record<string, any> {
        if ( !this.relationConfig ) {
            return {}
        }
        return isFunction( this.relationConfig ) ? this.relationConfig() : this.relationConfig
    }

    public getFields(): Record<string, Field> {
        return this.getRelationTo().getFields()
    }

    public getRelationName(): string {
        return this.relationName
    }

    public setRelationName( name: string ): void {
        this.relationName = name
    }

    public getRelationType(): RelationType {
        return  this.relationType
    }

    public setRelationType( relationType: RelationType ): void {
        this.relationType = relationType
    }

    public getRelation(): RelationShip {
        return  this.relation
    }

    public setRelation( relationShip: RelationShip ): void {
        this.relation = relationShip
    }
}
