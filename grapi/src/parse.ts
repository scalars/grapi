import { GraphQLBoolean, GraphQLFloat, GraphQLID, GraphQLInt, GraphQLString } from 'graphql'

import {
    MODEL_DIRECTIVE,
    RELATION_ARGS,
    RELATION_DIRECTIVE_NAME,
    RELATION_INTERFACE_NAME,
    RELATION_VALUE,
    RELATION_WITH,
} from './constants'
import {
    CustomScalarField as DataCustomScalarField,
    EnumField as DataEnumField,
    EnumType,
    Model,
    NamedType,
    ObjectField as DataObjectField,
    ObjectType,
    RelationField as DataRelationField,
    ScalarField as DataScalarField
} from './dataModel'
import { DataModelType } from './dataModel/type'
import { forEach, get, mapValues, values } from './lodash'
import RootNode from './rootNode'
import { ObjectField as SdlObjectField, } from './sdlParser/field'
import { SdlField, SdlFieldType } from './sdlParser/field/interface'
import { InputValue } from './sdlParser/inputValue/interface'
import { BasicFieldMiddware, MetadataMiddleware, SdlMiddleware } from './sdlParser/middlewares'
import { SdlDirectiveType, SdlEnumType, SdlObjectType } from './sdlParser/namedType'
import { SdlNamedType } from './sdlParser/namedType/interface'
import { parseDefinitionNodeToSdl, SdlParser } from './sdlParser/parser'

const isGrapiDataModel = ( sdlNamedType: SdlNamedType ): boolean => {
    return Boolean( ( sdlNamedType.getDirectives() || {} ) [MODEL_DIRECTIVE] )
}

const isRelationType = ( sdlObjectType: SdlObjectType ): boolean => {
    return Boolean( sdlObjectType.getInterfaces().find( interfaceName => interfaceName === RELATION_INTERFACE_NAME ) )
}

export const parseDataModelScalarType = ( field: SdlField ): DataModelType => {
    const scalarTypes = {
        [GraphQLString.name]: DataModelType.STRING,
        [GraphQLInt.name]: DataModelType.INT,
        [GraphQLFloat.name]: DataModelType.FLOAT,
        [GraphQLBoolean.name]: DataModelType.BOOLEAN,
        [GraphQLID.name]: DataModelType.ID
    }
    const scalarType: DataModelType = scalarTypes[field.getTypeName()]
    if ( !scalarTypes ) {
        throw new Error( `cant parse dataModel type for field type: ${field.getTypeName()}` )
    }
    return scalarType
}

export const createDataFieldFromSdlField = (
    field: SdlField,
    getModel: ( name: string ) => Model,
    getNamedType: ( name: string ) => NamedType,
    getRelationConfig: ( name: string ) => Record<string, unknown>,
): DataScalarField | DataCustomScalarField | DataEnumField | DataRelationField | DataObjectField => {
    const fieldMeta = {
        nonNull: field.isNonNull(),
        list: field.isList(),
        nonNullItem: field.isItemNonNull(),
    }
    const sdlFieldTypes = {
        [SdlFieldType.SCALAR]: () => {
            return new DataScalarField( {
                type: parseDataModelScalarType( field ),
                ...fieldMeta,
            } )
        },
        [SdlFieldType.CUSTOM_SCALAR]: () => {
            return new DataCustomScalarField( {
                typename: field.getTypeName(),
                ...fieldMeta,
            } )
        },
        [SdlFieldType.ENUM]: () => {
            return new DataEnumField( {
                enumType: (): EnumType => getNamedType( field.getTypeName() ) as EnumType,
                ...fieldMeta,
            } )
        },
        [SdlFieldType.OBJECT]: () => {
            const objectField = field as SdlObjectField
            if ( isGrapiDataModel( objectField.getObjectType() ) ) {
                const relationWith: string = get( objectField.getDirective( RELATION_DIRECTIVE_NAME ), `${ RELATION_ARGS }.${RELATION_WITH}.${ RELATION_VALUE }` )
                const relationConfig: Record<string, unknown> = mapValues( getRelationConfig( relationWith ), ( value ) => {
                    if ( value instanceof Object ) {
                        return mapValues( value, ( data ) => {
                            return get( data, `value`, data )
                        } )
                    }
                    return value
                } )
                return new DataRelationField( {
                    relationTo: (): Model => getModel( objectField.getTypeName() ),
                    relationConfig: relationWith === undefined ? null : (): Record<string, unknown> => relationConfig,
                    ...fieldMeta,
                } )
            } else {
                return new DataObjectField( {
                    objectType: (): ObjectType => getNamedType( field.getTypeName() ) as ObjectType,
                    ...fieldMeta,
                } )
            }
        }
    }
    return sdlFieldTypes[field.getFieldType()]()
}

const parseRelationConfig = ( sdlObjectType: SdlObjectType ): Record<string, unknown> => {
    // parse `type AdminRelation implements Relation @config(name: "name" foreignKey: "key")`
    return mapValues(
        get( sdlObjectType.getDirectives(), 'config.args' ),
        ( inputValue: InputValue ) => inputValue.getValue()
    )
}

export const createDataModelFromSdlObjectType = (
    sdlObjectType: SdlObjectType,
    getModel: ( name: string ) => Model,
    getNamedType: ( name: string ) => NamedType,
    getRelationConfig: ( name: string ) => Record<string, unknown>,
): Model => {
    const model = new Model( {
        name: sdlObjectType.getName(),
    } )

    // append fields
    forEach( sdlObjectType.getFields(), ( sdlField, key ) => {
        model.appendField( key, createDataFieldFromSdlField( sdlField, getModel, getNamedType, getRelationConfig ) )
    } )
    return model
}

const parseSdlNameTypes = (
    sdlNamedTypes: SdlNamedType[],
    models: Record<string, Model>,
    rootNode: RootNode
) => {

    const relationConfigMap: Record<string, Record<string, unknown>> = {}
    const namedTypes: Record<string, NamedType> = {}
    const getModel = ( name: string ): Model => {
        return models[name]
    }
    const getNamedType = ( name: string ): NamedType => {
        return namedTypes[name]
    }
    const getRelationConfig = ( name: string ): Record<string, unknown> => relationConfigMap[name]
    sdlNamedTypes.forEach( ( sdlNamedType: SdlNamedType ) => {
        const name = sdlNamedType.getName()

        // directive definition
        if ( sdlNamedType instanceof SdlDirectiveType ) {
            rootNode.addSdl( parseDefinitionNodeToSdl( sdlNamedType.getTypeDef() ), false )
        }

        // enum type
        if ( sdlNamedType instanceof SdlEnumType ) {
            // construct EnumType
            const enumType = new EnumType( {
                name,
                values: sdlNamedType.getValues(),
                description: sdlNamedType.getDescription()
            } )
            namedTypes[name] = enumType
            rootNode.addEnum( enumType )
        }

        // object type
        // not Model & RelationType
        const isSdlObjectType = sdlNamedType instanceof SdlObjectType
        const isModel = isGrapiDataModel( sdlNamedType )
        const isRelation = isSdlObjectType && isRelationType( sdlNamedType as SdlObjectType )
        if ( isSdlObjectType && !isModel && !isRelation ) {
            namedTypes[name] = new ObjectType( {
                name,
                fields: mapValues( sdlNamedType.getFields(), sdlField => {
                    return createDataFieldFromSdlField( sdlField, getModel, getNamedType, getRelationConfig )
                } ),
            } )
        }

        // Model
        if ( isSdlObjectType && isModel ) {
            models[name] = createDataModelFromSdlObjectType( sdlNamedType, getModel, getNamedType, getRelationConfig )
        }

        // RelationType
        if ( isSdlObjectType && isRelation ) {
            // parse arguments to relation config
            relationConfigMap[name] = parseRelationConfig( sdlNamedType )
        }
    } )
}

// use sdlParser to parse sdl to Model & RootNode
// eslint-disable-next-line max-lines-per-function
export const parse = ( sdl: string ): { rootNode: RootNode; models: Model[] } => {
    const parser = new SdlParser()
    const sdlNamedTypes: SdlNamedType[] = parser.parse( sdl )
    const rootNode = new RootNode()
    const models: Record<string, Model> = {}

    parseSdlNameTypes( sdlNamedTypes, models, rootNode )

    // go through middlewares
    const middlewares: SdlMiddleware[] = [
        new BasicFieldMiddware(),
        new MetadataMiddleware(),
    ]

    // visit model & fields
    forEach( models, ( model, key ) => {
        const sdlObjectType = parser.getSdlNamedType( key ) as SdlObjectType
        middlewares.forEach( middleware =>  middleware.visitGrapiDataModel && middleware.visitGrapiDataModel( {
            model,
            sdlObjectType,
        } ) )

        // visit fields
        forEach( model.getFields(), ( dataModelField, name ) => {
            const sdlField = sdlObjectType.getField( name )
            middlewares.forEach( mid => mid.visitField && mid.visitField( {
                model,
                field: dataModelField,
                sdlObjectType,
                sdlField,
            } ) )
        } )
    } )

    return { rootNode, models: values( models ) }
}
