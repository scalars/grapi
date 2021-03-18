import Field from './field'
import { DataModelType } from './type'

export default class CustomScalarField extends Field {
    private typename: string;

    constructor( {
        typename,
        nonNull,
        list,
        nonNullItem,
        unique,
        readOnly,
        autoGen,
        createdAt,
        updatedAt,
    }: {
        typename: string;
        nonNull?: boolean;
        list?: boolean;
        nonNullItem?: boolean;
        unique?: boolean;
        readOnly?: boolean;
        autoGen?: boolean;
        createdAt?: boolean;
        updatedAt?: boolean;
    } ) {
        super( {
            type: DataModelType.CUSTOM_SCALAR,
            nonNull,
            list,
            nonNullItem,
            unique,
            readOnly,
            autoGen,
            createdAt,
            updatedAt,
        } )
        this.typename = typename
    }

    public getTypename(): string {
        // override getTypename to custom scalar type
        return this.typename
    }
}
