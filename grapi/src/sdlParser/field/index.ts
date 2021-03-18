// tslint:disable:max-classes-per-file
import SdlEnumType from '../namedType/enumType'
import SdlObjectType from '../namedType/objectType'
import { SdlFieldType } from './interface'
import AbstractSdlField from './sdlField'

export { SdlFieldType }

export class ScalarField extends AbstractSdlField {
    public getFieldType(): SdlFieldType {
        return SdlFieldType.SCALAR
    }
}

export class CustomScalarField extends AbstractSdlField {
    public getFieldType(): SdlFieldType {
        return SdlFieldType.CUSTOM_SCALAR
    }
}

export class EnumField extends AbstractSdlField {
    private enumTypeThunk: () => SdlEnumType;
    public getFieldType(): SdlFieldType {
        return SdlFieldType.ENUM
    }

    public setEnumType( enumTypeThunk: () => SdlEnumType ): void {
        this.enumTypeThunk = enumTypeThunk
    }

    public getEnumType(): SdlEnumType {
        return this.enumTypeThunk()
    }
}

export class ObjectField extends AbstractSdlField {
    private objectTypeThunk: () => SdlObjectType;
    public getFieldType(): SdlFieldType {
        return SdlFieldType.OBJECT
    }

    public setObjectType( objectTypeThunk: () => SdlObjectType ): void {
        this.objectTypeThunk = objectTypeThunk
    }

    public getObjectType(): SdlObjectType {
        return this.objectTypeThunk()
    }
}
