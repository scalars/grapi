import { Kind } from 'graphql'

import SimpleValue from './simpleValue'

export class IntValue extends SimpleValue<number> {
    public getType(): any {
        return Kind.INT
    }
}

export class FloatValue extends SimpleValue<number> {
    public getType(): any {
        return Kind.FLOAT
    }
}

export class StringValue extends SimpleValue<string> {
    public getType(): any {
        return Kind.STRING
    }
}

export class BooleanValue extends SimpleValue<boolean> {
    public getType(): any {
        return Kind.BOOLEAN
    }
}

export class NullValue extends SimpleValue<null> {
    constructor() {
        super( {
            value: null,
        } )
    }

    public getType(): any {
        return Kind.NULL
    }

    public getValue(): any {
        return null
    }
}

export class EnumValue extends SimpleValue<any> {
    public getType(): any {
        return Kind.ENUM
    }
}

// export class EmptyValue extends SimpleValue<null> {
//     public getType(): any {
//         return null;
//     }
// }

export { default as ListValue } from './listValue'
export { default as ObjectValue } from './objectValue'
