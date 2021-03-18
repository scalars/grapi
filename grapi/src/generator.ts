import Model from './dataModel/model'
import { Context, Plugin } from './plugins/interface'
import RootNode from './rootNode'

export default class Generator {
    private plugins: Plugin[];
    private context: Context;

    constructor( {
        plugins,
        rootNode,
    }: {
        plugins: Plugin[];
        rootNode?: RootNode;
    } ) {
        this.plugins = plugins
        this.context = {
            root: rootNode || new RootNode(),
        }
    }

    public generate( models: Model[] ): any {
        this.plugins.forEach( plugin => {
            if ( plugin.setPlugins ) {
                plugin.setPlugins( this.plugins )
            }

            if ( plugin.init ) {
                plugin.init( this.context )
            }
        } )

        // visit models
        models.forEach(
            model => this.plugins.forEach( plugin => plugin.visitModel( model, this.context ) ),
        )

        // build graphql
        return this.context.root.print()
    }
}
