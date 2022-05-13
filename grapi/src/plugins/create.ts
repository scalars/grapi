import { IObjectTypeResolver } from '@graphql-tools/utils'

import { ListMutable, Mutation } from '..'
import { DirectiveModelAction, Field, RelationField, RelationType } from '../dataModel'
import Model from '../dataModel/model'
import ObjectField from '../dataModel/objectField'
import { DataModelType } from '../dataModel/type'
import { CreateContext, Hook } from '../hooks/interface'
import { capitalize, forEach, get, upperFirst } from '../lodash'
import BaseTypePlugin from './baseType'
import { Context, Plugin } from './interface'
import { MutationFactory } from './mutation'
import WhereInputPlugin from './whereInput'

const createObjectInputField = ( prefix: string, field: ObjectField, context: Context ): string[] => {
    const { root } = context
    const content: string[] = []
    forEach( field.getFields(), ( nestedField, name ) => {
        if ( nestedField.isScalar() ) {
            content.push( `${name}: ${nestedField.getTypename()}` )
            return
        }

        if ( nestedField instanceof ObjectField ) {
            const fieldWithPrefix = `${prefix}${upperFirst( name )}`
            const typeFields = createObjectInputField( fieldWithPrefix, nestedField, context )
            const objectInputName = `${fieldWithPrefix}CreateInput`
            root.addInput(
                `input ${objectInputName} {
                    ${typeFields.join( ' ' )}
                }`
            )
            content.push( `${name}: ${objectInputName}` )
            return
        }
        // skip relation, dont support relation in nested object for now
    } )
    return content
}

// eslint-disable-next-line max-lines-per-function
const createInputField = (
    model: Model,
    context: Context,
    getCreateInputName: ( model: Model ) => string,
    getWhereInputName: ( model: Model ) => string,
    getWhereUniqueInputName: ( model: Model ) => string,
    getMutationFactoryFromModel: ( model: Model ) => MutationFactory,
    withoutField: string = undefined,
    recursive: boolean = true
): string[] => {
    const { root } = context
    const capName = model.getNamings().capitalSingular
    const fields = model.getFields()
    const content: string[] = []
    const mutationFactory = getMutationFactoryFromModel( model )
    const relationInputs = (
        relationNamings: string,
        relationName: string,
        relationTo: Model,
        fieldName: string,
        isList: boolean,
        exceptionField: string = undefined
    ) => {
        forEach( relationTo.getFields(), ( modelField: Field, keyField: string,  ) => {
            if ( ( modelField instanceof RelationField && modelField.getRelationName() === relationName ) ) {
                exceptionField = keyField
                return false
            }
        } )
        const relationField = capitalize( exceptionField )
        const relationInput = `${relationNamings}CreateWithout${relationField}Input`
        const inputField = createInputField(
            relationTo,
            context,
            getCreateInputName,
            getWhereInputName,
            getWhereUniqueInputName,
            relationTo.getCreateMutationFactory,
            exceptionField,
            false
        )
        const relationCreateInput = `${relationNamings}Create${isList ? `Many` : `One` }Without${ relationField }Input`
        const whereUnique = `${getWhereUniqueInputName( relationTo )}`
        root.addInput(
            `input ${relationInput} { 
                ${ inputField }
            }`
        )
        root.addInput( `input ${relationCreateInput} {
            create: ${ isList ? `[${relationInput}]` : `${relationInput}` }
            connect: ${ isList ? `[${whereUnique}]` : `${whereUnique}` }
        }` )
        content.push( `${fieldName}: ${relationCreateInput}` )
    }
    // eslint-disable-next-line max-lines-per-function
    forEach( fields, ( field, name ) => {
        if ( field.isAutoGenerated() ) {
            return
        }

        if ( withoutField && withoutField === name ) {
            return
        }

        if ( field.isScalar() ) {
            let fieldType: string
            if ( field.isList() ) {
                // wrap with set field
                const listOperationInput = `${field.getTypename()}ListFieldCreateInput`
                root.addInput(
                    `input ${listOperationInput} {
                        set: [${field.getTypename()}]
                    }`
                )
                fieldType = listOperationInput
                mutationFactory.markArrayField( name )
            } else {
                fieldType = field.getTypename()
            }
            content.push( `${name}: ${fieldType}` )
            return
        }

        // object field
        if ( field instanceof ObjectField ) {
            // create input for nested object
            const fieldWithPrefix = `${capName}${upperFirst( name )}`
            const typeFields = createObjectInputField( fieldWithPrefix, field, context )
            const objectInputName = `${fieldWithPrefix}CreateInput`
            root.addInput(
                `input ${objectInputName} {
                    ${typeFields.join( ' ' )}
                }`
            )

            let fieldType: string
            if ( field.isList() ) {
                // wrap with set field
                const listOperationInput = `${fieldWithPrefix}CreateListInput`
                root.addInput( `input ${listOperationInput} {
                    set: [ ${objectInputName} ]
                }` )
                fieldType = listOperationInput
                mutationFactory.markArrayField( name )
            } else {
                fieldType = objectInputName
            }
            content.push( `${name}: ${fieldType}` )
            return
        }

        // relation
        // add create and connect for relation
        const isRelation = field instanceof RelationField
        const isList = field.isList()
        if ( isRelation && ! isList ) {
            // to-one
            const relationTo = ( field as RelationField ).getRelationTo()
            const relationType = ( field as RelationField ).getRelationType()
            const relationName = ( field as RelationField ).getRelationName()
            const relationNamings = relationTo.getNamings().capitalSingular
            if ( recursive && relationType === RelationType.biOneToOne ) {
                relationInputs( relationNamings, relationName, relationTo, name, false )
            } else {
                const relationInputName = `${relationTo.getTypename()}CreateOneInput`
                root.addInput( `input ${relationInputName} {
                    create: ${getCreateInputName( relationTo )}
                    connect: ${getWhereUniqueInputName( relationTo )}
                }` )
                content.push( `${name}: ${relationInputName}` )
            }
            return
        }

        if ( isRelation && isList ) {
            // to-many
            const relationTo = ( field as RelationField ).getRelationTo()
            const relationType = ( field as RelationField ).getRelationType()
            const relationName = ( field as RelationField ).getRelationName()
            const relationNamings = relationTo.getNamings().capitalSingular
            if ( recursive && relationType === RelationType.biOneToMany || relationType === RelationType.biManyToMany ) {
                relationInputs( relationNamings, relationName, relationTo, name, true )
            } else {
                const relationInputName = `${relationTo.getTypename()}CreateManyInput`
                root.addInput( `input ${relationInputName} {
                    create: [${getCreateInputName( relationTo )}]
                    connect: [${getWhereUniqueInputName( relationTo )}]
                }` )
                content.push( `${name}: ${relationInputName}` )
            }
            return
        }
    } )

    return content
}

export default class CreatePlugin implements Plugin {
    private whereInputPlugin: WhereInputPlugin;
    private baseTypePlugin: BaseTypePlugin;
    private readonly hook: Hook;

    constructor( {
        hook,
    }: {
        hook: Hook;
    } ) {
        this.hook = hook
    }

    public setPlugins( plugins: Plugin[] ): void {
        this.whereInputPlugin = plugins.find(
            plugin => plugin instanceof WhereInputPlugin ) as WhereInputPlugin
        this.baseTypePlugin = plugins.find(
            plugin => plugin instanceof BaseTypePlugin ) as BaseTypePlugin
    }

    public visitModel( model: Model, context: Context ): void {
        const { root } = context
        const modelType = this.baseTypePlugin.getTypename( model )

        // Find if authDirective is enable
        const directives = model.getDirectives( DirectiveModelAction.Create )

        // create
        const mutationName = CreatePlugin.getMutationName( model )
        const inputName = this.generateCreateInput( model, context )
        root.addMutation( `${mutationName}( data: ${inputName}! ): ${modelType}!${ directives }` )
    }

    public resolveInMutation( { model, dataSource }: {model: Model; dataSource: ListMutable} ): IObjectTypeResolver {
        const mutationName = CreatePlugin.getMutationName( model )
        const wrapCreate = get( this.hook, [ model.getName(), 'wrapCreate' ] )

        return {
            [mutationName]: async ( root, args, context ): Promise<any> => {
                // args may not have `hasOwnProperty`.
                const data = this.setDateDirective( model, args.data )

                // no relationship or other hooks
                if ( !wrapCreate ) {
                    return dataSource.create( this.createMutation( model, data ), context )
                }

                // wrap
                // put mutationFactory to context
                // so hooks can access it
                // todo: find a better way to share the mutationFactory
                const createContext: CreateContext = {
                    data,
                    response: {},
                    graphqlContext: context,
                }
                await wrapCreate( createContext, async ctx => {
                    ctx.response = await dataSource.create( this.createMutation( model, ctx.data ), context )
                } )
                return createContext.response
            },
        }
    }

    public getCreateInputName( model: Model ): string {
        return `${model.getNamings().capitalSingular}CreateInput`
    }

    private generateCreateInput( model: Model, context: Context ): string {
        const inputName = this.getCreateInputName( model )
        const inputField: string[] = createInputField(
            model,
            context,
            this.getCreateInputName,
            this.whereInputPlugin.getWhereInputName,
            this.whereInputPlugin.getWhereUniqueInputName,
            model.getCreateMutationFactory,
        )
        const input = `input ${inputName} { ${ inputField } }`
        context.root.addInput( input )
        return inputName
    }

    private static getMutationName( model: Model ): string {
        return `create${model.getNamings().capitalSingular}`
    }

    private createMutation = ( model: Model, payload: any ): Mutation => {
        const mutationFactory = model.getCreateMutationFactory()
        return mutationFactory.createMutation( payload )
    };

    private setDateDirective = ( model: Model, data ): any => {
        const fields = model.getFields()
        const now = new Date()
        forEach( fields, ( field: Field, name: string ) => {
            if ( ( field.isCreatedAt() || field.isUpdatedAt() ) && field.getTypename() === DataModelType.DATE_TIME ) {
                data[name] = now
            }
        } )
        return data
    }
}
