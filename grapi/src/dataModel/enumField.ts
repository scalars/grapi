import { isFunction } from '../lodash'
import Field from './field'
import EnumType from './namedType/enumType'
import { DataModelType } from './type'

export type EnumTypeOrThunk = EnumType | ( () => EnumType );

export default class EnumField extends Field {
    private enumType: EnumTypeOrThunk;

    constructor( {
        nonNull,
        list,
        nonNullItem,
        unique,
        readOnly,
        enumType,
    }: {
        nonNull?: boolean;
        list?: boolean;
        nonNullItem?: boolean;
        unique?: boolean;
        readOnly?: boolean;
        enumType: EnumTypeOrThunk;
    } ) {
        super( {
            type: DataModelType.ENUM,
            nonNull,
            list,
            nonNullItem,
            unique,
            readOnly,
        } )

        this.enumType = enumType
    }

    public getTypename(): string {
        // override getTypename to enum typename
        return this.resolveEnumType().getTypename()
    }

    public getValues(): string[] {
        return this.resolveEnumType().getValues()
    }

    public getDescription(): string {
        return this.resolveEnumType().getDescription() || ``
    }

    private resolveEnumType(): EnumType {
        return isFunction( this.enumType ) ? this.enumType() : this.enumType
    }
}
