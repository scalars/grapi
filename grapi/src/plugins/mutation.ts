// tslint:disable:max-classes-per-file
import { Mutation } from '..'
import { forEach, get, isEmpty, omit, pick } from '../lodash'

const mutationWithoutArrayField = ( originPayload: any ): Mutation => {
    const payload = { ...originPayload }
    return {
        getData: (): any => payload,
        addField: ( name: string, value: any ): any => { payload[name] = value },
        getArrayOperations: (): any[] => [],
    }
}

export class PluginMutation implements Mutation {
    private payload: any;
    private arrayFields: string[];

    constructor( payload: any, arrayFields: string[] ) {
        // copy payload to avoid mutation to referenced object
        this.payload = { ...payload }
        this.arrayFields = arrayFields
    }

    public getData = (): any => {
        return omit( this.payload, this.arrayFields )
    };

    public addField = ( name: string, value: any ): void => {
        this.payload[name] = value
    };

    public getArrayOperations = (): any[] => {
        const arrayFieldData = pick( this.payload, this.arrayFields )
        const operations = []
        forEach( arrayFieldData, ( operationValue, fieldName ) => {
            const value = get( operationValue, 'set' )
            if ( !value ) {
                return
            }
            operations.push( {
                fieldName,
                operator: 'set',
                value,
            } )
        } )

        return operations
    };
}

export class MutationFactory {
    private arrayFieldMarks: Record<string, true> = {};

    public markArrayField = ( field: string ): void => {
        this.arrayFieldMarks[field] = true
    };

    public createMutation = ( payload: any ): Mutation => {
        if ( isEmpty( this.arrayFieldMarks ) ) {
            return mutationWithoutArrayField( payload )
        }

        const arrayFields = Object.keys( this.arrayFieldMarks )
        return new PluginMutation( payload, arrayFields )
    };
}
