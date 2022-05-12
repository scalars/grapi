import { Kind } from 'graphql'

import { InputValue } from './interface'

export default class ObjectValue implements InputValue<Record<string, InputValue>> {
    private readonly fields: Record<string, InputValue>;
    constructor( { fields }: {fields: Record<string, InputValue>} ) {
        this.fields = fields
    }

    public isScalar(): boolean {
        return false
    }

    public getType(): Kind {
        return Kind.OBJECT
    }

    public getValue(): Record<string, InputValue> {
        return this.fields
    }
}
