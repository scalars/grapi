import Field from '../../dataModel/field'
import Model from '../../dataModel/model'
import { SdlField } from '../field/interface'
import SdlObjectType from '../namedType/objectType'

export interface SdlMiddleware {
    visitGrapiDataModel?( {
        model,
        sdlObjectType,
    }: {
        model: Model;
        sdlObjectType: SdlObjectType;
    } );

    visitField?( {
        model,
        field,
        sdlObjectType,
        sdlField,
    }: {
        model: Model;
        field: Field;
        sdlObjectType: SdlObjectType;
        sdlField: SdlField;
    } );

    visitObjectType?( objectType: SdlObjectType );
}
