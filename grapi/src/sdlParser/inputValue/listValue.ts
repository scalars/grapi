import { Kind } from 'graphql'

import { InputValue } from './interface'

export default class ListValue implements InputValue<InputValue[]> {
    private values: Array<InputValue<any>>;
    constructor( { values }: {values: Array<InputValue<any>>} ) {
        this.values = values
    }

    public isScalar(): boolean {
        return false
    }

    public getType(): any {
        return Kind.LIST
    }

    public getValue(): Array<InputValue<any>> {
        return this.values
    }
}
