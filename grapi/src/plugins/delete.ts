import { ListMutable } from '..'
import { DirectiveModelAction } from '../dataModel'
import Model from '../dataModel/model'
import { findUniqueObjectOnModel } from '../hooks'
import { DeleteContext, Hook } from '../hooks/interface'
import { get } from '../lodash'
import BaseTypePlugin from './baseType'
import { Context, Plugin } from './interface'
import WhereInputPlugin from './whereInput'

export default class DeletePlugin implements Plugin {
    private whereInputPlugin: WhereInputPlugin;
    private baseTypePlugin: BaseTypePlugin;
    private readonly hook: Hook;

    constructor( { hook }: { hook: Hook } ) {
        this.hook = hook
    }

    public setPlugins( plugins: Plugin[] ): void {
        this.whereInputPlugin = plugins.find(
            plugin => plugin instanceof WhereInputPlugin ) as WhereInputPlugin
        this.baseTypePlugin = plugins.find(
            plugin => plugin instanceof BaseTypePlugin ) as BaseTypePlugin
    }

    public visitModel( model: Model, context: Context ): void {
        // object type model dont need delete mutation
        if ( model.isObjectType() ) {
            return
        }
        const { root } = context
        // Find if authDirective is enable
        const directives = model.getDirectives( DirectiveModelAction.Delete )
        // create
        const mutationName = DeletePlugin.getInputName( model )
        const where = this.whereInputPlugin.getWhereUniqueInputName( model )
        const returnType = `${model.getNamings().capitalSingular}`
        root.addMutation( `${mutationName}(where: ${where}!): ${returnType}!${ directives }` )
    }

    public resolveInMutation( { model, dataSource }: {model: Model; dataSource: ListMutable} ): any {
        // object type model dont need delete mutation
        if ( model.isObjectType() ) { return }
        const inputName = DeletePlugin.getInputName( model )
        const wrapDelete = get( this.hook, [ model.getName(), 'wrapDelete' ] )

        return {
            [inputName]: async ( root, args, context ): Promise<any> => {
                const whereUnique = this.whereInputPlugin.parseUniqueWhere( args.where )
                const object = await findUniqueObjectOnModel( args.where, model )
                if ( !wrapDelete ) {
                    await dataSource.delete( whereUnique, context )
                    return object
                }

                // wrap
                const deleteContext: DeleteContext = { where: args.where, response: {}, graphqlContext: context }
                // _ context find a usage
                await wrapDelete( deleteContext, async _ => {
                    await dataSource.delete( whereUnique, context )
                } )
                return object
            },
        }
    }

    private static getInputName( model: Model ): string {
        return `delete${model.getNamings().capitalSingular}`
    }
}
