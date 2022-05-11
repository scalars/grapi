import Field from '../../dataModel/field'
import Model from '../../dataModel/model'
import { SdlField } from '../field/interface'
import SdlObjectType from '../namedType/objectType'
import { SdlMiddleware } from './interface'

enum RESERVED_DIRECTIVES {
    unique = 'unique',
    readOnly = 'readOnly',
    autoGen = 'autoGen',
    createdAt = 'createdAt',
    updatedAt = 'updatedAt',
}

export default class BasicFieldMiddleware implements SdlMiddleware {
    public visitField( {
        // model,
        field,
        // sdlObjectType,
        sdlField,
    }: {
        model: Model;
        field: Field;
        sdlObjectType: SdlObjectType;
        sdlField: SdlField;
    } ): void {
        // detect unique
        const uniqueDirective = sdlField.getDirective( RESERVED_DIRECTIVES.unique )
        if ( uniqueDirective ) {
            field.setUnique( true )
        }

        // detect readOnly
        const readOnlyDirective = sdlField.getDirective( RESERVED_DIRECTIVES.readOnly )
        if ( readOnlyDirective ) {
            field.setReadOnly( true )
        }

        // detect autoGen
        const autoGenDirective = sdlField.getDirective( RESERVED_DIRECTIVES.autoGen )
        if ( autoGenDirective ) {
            field.setAutoGen( true )
        }

        // detect autoDate
        const createAtDirective = sdlField.getDirective( RESERVED_DIRECTIVES.createdAt )
        if ( createAtDirective ) {
            field.setCreatedAt( true )
        }

        const updateAtDirective = sdlField.getDirective( RESERVED_DIRECTIVES.updatedAt )
        if ( updateAtDirective ) {
            field.setUpdatedAt( true )
        }
    }
}
