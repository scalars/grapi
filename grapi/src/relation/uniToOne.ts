import { Operator } from '..'
import { Model, RelationType } from '../dataModel'
import { isEmpty } from '../lodash'
import { InputRecursiveRelation } from './index'
import { Relation, WithForeignKey } from './interface'

// utils
const createForeignKey = ( field: string ): string => `${field.toLowerCase()}Id`

// Unidirectional One-to-One
export default class UniToOne implements Relation, WithForeignKey {
    private sourceModel: Model;
    private targetModel: Model;
    private relationField: string;
    private foreignKey: string;

    constructor( {
        sourceModel,
        targetModel,
        relationField,
        foreignKey,
    }: {
        sourceModel: Model;
        targetModel: Model;
        relationField: string;
        foreignKey?: string;
    } ) {
        this.sourceModel = sourceModel
        this.targetModel = targetModel
        this.relationField = relationField
        this.foreignKey = foreignKey || createForeignKey( this.relationField )
    }

    public getType(): RelationType {
        return RelationType.uniOneToOne
    }

    public getForeignKey(): string {
        return this.foreignKey
    }

    public getForeignKeyConfig(): Array<any> {
        return [ {
            model: this.sourceModel,
            foreignKey: this.getForeignKey(),
        } ]
    }

    public getRelationField(): string {
        return this.relationField
    }

    public setForeignKey( targetId: string ): { [x: string]: any }  {
        return { [this.foreignKey]: targetId }
    }

    public async createAndSetForeignKey( targetData: Record<string, any>, context: any ): Promise<{ [x: string]: any }> {
        const execution = async ( data: Record<string, any> ) => {
            const mutation = this.targetModel.getCreateMutationFactory().createMutation( data )
            const created = await this.targetModel.getDataSource().create( mutation, context )
            return { object: created, data: this.setForeignKey( created.id ) }
        }
        const { rootData, createdData, executed } = await InputRecursiveRelation( targetData, this.targetModel, context, execution )
        if ( executed ) return executed.data
        return ( await execution( { ...rootData, ...createdData } ) ).data
    }

    public async destroyAndUnsetForeignKey( data: Record<string, any>, context: any ): Promise<{ [x: string]: any } > {
        const foreignId = data[this.foreignKey]
        if ( !foreignId ) {
            return
        }
        await this.targetModel.getDataSource().delete( { id: { [Operator.eq]: foreignId } }, context )
        return this.unsetForeignKey()
    }

    public unsetForeignKey(): { [x: string]: any } {
        return { [this.foreignKey]: null }
    }

    public async join( data: Record<string, any>, _: any ): Promise<any> {
        const targetId = data[ this.foreignKey ]
        if ( ! targetId ) {
            return null
        }
        const toOneData = await this.targetModel.getDataSource().findOneById( targetId )
        return isEmpty( toOneData ) ? null : toOneData
    }
}
