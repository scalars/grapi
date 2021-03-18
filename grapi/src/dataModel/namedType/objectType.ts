import Field from '../field'
import { NamedType } from './interface'

export default class ObjectType implements NamedType {
    private name: string;
    private fields: Record<string, Field>;

    constructor( {
        name,
        fields,
    }: {
        name: string;
        fields: Record<string, Field>;
    } ) {
        this.name = name
        this.fields = fields
    }

    public getTypename(): string {
        return this.name
    }

    public getFields(): Record<string, Field> {
        return this.fields
    }
}
