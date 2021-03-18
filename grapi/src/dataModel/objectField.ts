import { isFunction } from '../lodash'
import Field from './field'
import ObjectType from './namedType/objectType'
import { DataModelType } from './type'

export type ObjectTypeOrThunk = ObjectType | ( () => ObjectType ) ;

export default class ObjectField extends Field {
    private objectType: ObjectTypeOrThunk;

    constructor( {
        nonNull,
        list,
        nonNullItem,
        readOnly,
        objectType,
    }: {
        nonNull?: boolean;
        list?: boolean;
        nonNullItem?: boolean;
        readOnly?: boolean;
        objectType: ObjectTypeOrThunk;
    } ) {
        super( {
            type: DataModelType.OBJECT,
            nonNull,
            list,
            nonNullItem,
            readOnly,
        } )

        this.objectType = objectType
    }

    public getFields(): Record<string, Field> {
        return this.resolveObjectType().getFields()
    }

    public getTypename(): string {
        return this.resolveObjectType().getTypename()
    }

    private resolveObjectType(): ObjectType {
        return isFunction( this.objectType ) ? this.objectType() : this.objectType
    }
}
