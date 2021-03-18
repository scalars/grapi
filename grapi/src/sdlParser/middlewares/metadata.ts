import Field from '../../dataModel/field'
import Model from '../../dataModel/model'
import { forEach, mapValues } from '../../lodash'
import { SdlField } from '../field/interface'
import SdlObjectType from '../namedType/objectType'
import { SdlMiddleware } from './interface'

// put all directives into model & field metadata
export default class MetadataMiddleware implements SdlMiddleware {
    public visitGrapiDataModel( {
        model,
        sdlObjectType,
    }: {
        model: Model;
        sdlObjectType: SdlObjectType;
    } ): void {
        forEach( sdlObjectType.getDirectives(), ( directive, key ) => {
            model.setMetadata( key, mapValues( directive.args, arg => arg.getValue() ) )
        } )
    }

    public visitField( {
        model,
        field,
        sdlObjectType,
        sdlField,
    }: {
        model: Model;
        field: Field;
        sdlObjectType: SdlObjectType;
        sdlField: SdlField;
    } ): void {
        forEach( sdlField.getDirectives(), ( directive, key ) => {
            field.setMetadata( key, mapValues( directive.args, arg => arg.getValue() ) )
        } )
    }
}
