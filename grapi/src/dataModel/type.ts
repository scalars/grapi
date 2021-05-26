export const enum FilterListObject {
    SOME= 'some',
    NONE = 'none',
    EVERY = 'every'
}

export enum DirectiveModelAction {
    Create = `Create`,
    Read = `Read`,
    Update = `Update`,
    Delete = `Delete`
}

export enum DataModelType {
    STRING = 'String',
    BOOLEAN = 'Boolean',
    INT = 'Int',
    FLOAT = 'Float',
    ID = 'ID',
    // Enum
    ENUM = 'ENUM',

    // Object type: http://facebook.github.io/graphql/June2018/#sec-Objects
    OBJECT = 'OBJECT',

    // Relation field
    RELATION = 'RELATION',

    // Custom type
    CUSTOM_SCALAR = 'CUSTOM_SCALAR',
    JSON = 'JSON',
    EMAIL = 'Email',
    URL = 'Url',
    DATE_TIME = 'DateTime',
}

const scalarList: DataModelType[] = [
    DataModelType.STRING,
    DataModelType.BOOLEAN,
    DataModelType.INT,
    DataModelType.FLOAT,
    DataModelType.ID,
    DataModelType.ENUM,
    DataModelType.CUSTOM_SCALAR,
]

const customScalarList: DataModelType[] = [
    DataModelType.DATE_TIME,
    DataModelType.EMAIL,
    DataModelType.URL,
]

export const isScalarType = ( type: DataModelType ): boolean => {
    return scalarList.indexOf( type ) >= 0
}

export const isValidScalarFilter = ( type: DataModelType ): boolean => {
    return customScalarList.indexOf( type ) >= 0 || isScalarType( type )
}
