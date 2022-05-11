import { GraphQLBoolean, GraphQLFloat, GraphQLID, GraphQLInt, GraphQLString } from 'graphql'

import {
    MODEL_DIRECTIVE,
    OBJECT_DIRECTIVE,
    RELATION_ARGS,
    RELATION_DIRECTIVE_NAME,
    RELATION_INTERFACE_NAME, RELATION_VALUE, RELATION_WITH,
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
    return Boolean( sdlNamedType.getDirectives()[MODEL_DIRECTIVE] )
}

const isGrapiDataObject = ( sdlNamedType: SdlNamedType ): boolean => {
    return Boolean( sdlNamedType.getDirectives()[OBJECT_DIRECTIVE] )
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
    getRelationConfig: ( name: string ) => Record<string, any>,
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
                const relationConfig: Record<string, any> = mapValues( getRelationConfig( relationWith ), ( value ) => {
                    if ( value instanceof Object ) {
                        return mapValues( value, ( data ) => {
                            return get( data, `value`, data )
                        } )
                    }
                    return value
                } )
                return new DataRelationField( {
                    relationTo: (): Model => getModel( objectField.getTypeName() ),
                    relationConfig: relationWith === undefined ? null : (): Record<string, any> => relationConfig,
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

const parseRelationConfig = ( sdlObjectType: SdlObjectType ): Record<string, any> => {
    // parse `type AdminRelation implements Relation @config(name: "name" foreignKey: "key")`
    return mapValues( get( sdlObjectType.getDirectives(), 'config.args' ),
        ( inputValue: InputValue ) => inputValue.getValue() )
}

export const createDataModelFromSdlObjectType = (
    sdlObjectType: SdlObjectType,
    getModel: ( name: string ) => Model,
    getNamedType: ( name: string ) => NamedType,
    getRelationConfig: ( name: string ) => Record<string, any>,
    isObject: boolean,
): Model => {
    const model = new Model( {
        name: sdlObjectType.getName(),
        isObject,
    } )

    // append fields
    forEach( sdlObjectType.getFields(), ( sdlField, key ) => {
        model.appendField( key, createDataFieldFromSdlField( sdlField, getModel, getNamedType, getRelationConfig ) )
    } )
    return model
}

// use sdlParser to parse sdl to Model & RootNode
export const parse = ( sdl: string ): { rootNode: RootNode; models: Model[] } => {
    const parser = new SdlParser()
    const sdlNamedTypes: SdlNamedType[] = parser.parse( sdl )
    const rootNode = new RootNode()
    const namedTypes: Record<string, NamedType> = {}
    const models: Record<string, Model> = {}
    const relationConfigMap: Record<string, Record<string, any>> = {}
    const getModel = ( name: string ): Model => {
        return models[name]
    }
    const getNamedType = ( name: string ): NamedType => {
        return namedTypes[name]
    }

    const getRelationConfig = ( name: string ): Record<string, Record<string, any>> => relationConfigMap[name]

    sdlNamedTypes.forEach( ( sdlNamedType: SdlNamedType ) => {
        const name = sdlNamedType.getName()

        // directive definition
        if ( sdlNamedType instanceof SdlDirectiveType ) {
            rootNode.addSdl( parseDefinitionNodeToSdl( sdlNamedType.getTypeDef() as any ), false )
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
        if ( sdlNamedType instanceof SdlObjectType && !isGrapiDataModel( sdlNamedType ) && !isRelationType( sdlNamedType ) ) {
            const objectType = new ObjectType( {
                name,
                fields: mapValues( sdlNamedType.getFields(), sdlField => {
                    return createDataFieldFromSdlField( sdlField, getModel, getNamedType, getRelationConfig )
                } ),
            } )
            namedTypes[name] = objectType
            rootNode.addObjectType( objectType )
        }

        // Model || Object
        if ( sdlNamedType instanceof SdlObjectType && ( isGrapiDataModel( sdlNamedType ) || isGrapiDataObject( sdlNamedType ) ) ) {
            const isObject = isGrapiDataObject( sdlNamedType )
            models[name] = createDataModelFromSdlObjectType( sdlNamedType, getModel, getNamedType, getRelationConfig, isObject )
        }

        // RelationType
        if ( sdlNamedType instanceof SdlObjectType && isRelationType( sdlNamedType ) ) {
            // parse arguments to relation config
            relationConfigMap[name] = parseRelationConfig( sdlNamedType )
        }
    } )

    // go through middlewares
    const middlewares: SdlMiddleware[] = [
        new BasicFieldMiddware(),
        new MetadataMiddleware(),
    ]

    // visit objectType
    forEach( namedTypes, namedType => {
        if ( namedType instanceof SdlObjectType ) {
            middlewares.forEach( mid => mid.visitObjectType && mid.visitObjectType( namedType ) )
        }
    } )

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
