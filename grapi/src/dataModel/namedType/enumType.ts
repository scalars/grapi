import { NamedType } from './interface'

export default class EnumType implements NamedType {
    private description: string;
    private name: string;
    private values: string[];

    constructor( { name, values, description }: { name: string; values: string[]; description: string } ) {
        this.name = name
        this.values = values
        this.description = description
    }

    public getTypename(): string {
        return this.name
    }

    public getValues(): string[] {
        return this.values
    }

    public getDescription(): string {
        return this.description
    }
}
