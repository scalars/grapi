import { IObjectTypeResolver } from '@graphql-tools/utils'

import Model from '../dataModel/model'
import { Context, Plugin } from './interface'
import { recursiveCreateType } from './utils'

export default class BaseTypePlugin implements Plugin {
    public visitModel( model: Model, context: Context ): void {
        const { root } = context
        const modelTypename = this.getTypename( model )
        const fields: string[] = recursiveCreateType( model.getFields(), context )
        root.addObjectType( `type ${modelTypename} { ${fields.join( ' ' )} }` )
    }

    public resolveInRoot( { model }: {model: Model} ): Record<string, IObjectTypeResolver> {
        const modelTypename = this.getTypename( model )
        const resolver = model.getResolver()
        if ( resolver ) {
            return {
                [modelTypename]: resolver,
            }
        }
    }

    public getTypename( model: Model ): string {
        return model.getTypename()
    }
}
