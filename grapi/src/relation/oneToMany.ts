import { ListFindQuery, Operator, OrderInputPlugin, WhereInputPlugin } from '..'
import { Model, RelationType } from '../dataModel'
import { get, isEmpty } from '../lodash'
import { InputRecursiveRelation } from './index'
import { Relation, WithForeignKey } from './interface'

const createForeignKey = ( model: Model ): string => `${model.getNamings().singular}Id`

// one-to-many, can be used for unidirectional and bidirectional
// put a foreign key on many side
export default class OneToMany implements Relation, WithForeignKey {
    private oneSideModel: Model;
    private manySideModel: Model;
    private oneSideField: string;
    // exists if it's bidirectional
    private manySideField?: string;
    // foreignKey will be on many side
    private foreignKey: string;

    constructor( {
        oneSideModel,
        manySideModel,
        oneSideField,
        manySideField,
        foreignKey,
    }: {
        oneSideModel: Model;
        manySideModel: Model;
        oneSideField: string;
        manySideField?: string;
        foreignKey?: string;
    } ) {
        this.oneSideModel = oneSideModel
        this.manySideModel = manySideModel
        this.oneSideField = oneSideField
        this.manySideField = manySideField
        // foreignKey will be put on many-side record
        this.foreignKey = foreignKey || createForeignKey( this.oneSideModel )
    }

    public getType(): RelationType {
        return this.manySideField ? RelationType.biOneToMany : RelationType.uniOneToMany
    }

    public getForeignKey(): string {
        return this.foreignKey
    }

    public getForeignKeyConfig(): any  {
        return [ {
            model: this.manySideModel,
            foreignKey: this.getForeignKey(),
        } ]
    }

    public getOneSideField(): string {
        return this.oneSideField
    }

    public getManySideField(): string {
        return this.manySideField
    }

    public setForeignKeyOnManySide( targetId: string ): { [x: string]: string } {
        return { [this.foreignKey]: targetId }
    }

    public async createAndSetForeignKeyOnManySide( targetData: Record<string, any>, context: unknown ): Promise<{ [x: string]: string }> {
        const execution = async ( data: Record<string, any> ): Promise< { data: Record<string, any>, object: Record<string, any> } > => {
            const mutation = this.oneSideModel.getCreateMutationFactory().createMutation( data )
            const created = await this.oneSideModel.getDataSource().create( mutation, context )
            return { data: this.setForeignKeyOnManySide( created.id ), object: created }
        }
        const { rootData, createdData, executed } = await InputRecursiveRelation(
            targetData, this.oneSideModel, context, execution
        )
        if ( ! executed ) return ( await execution( { ...rootData, ...createdData } ) ).data
        return ( executed.data )
    }

    public unsetForeignKeyOnManySide(): { [x: string]: string } {
        return { [this.foreignKey]: null }
    }

    public async destroyAndUnsetForeignKeyOnManySide( data: Record<string, any>, context: any ): Promise<{ [x: string]: string }> {
        const foreignId = data[this.foreignKey]
        if ( !foreignId ) {
            return
        }
        await this.oneSideModel.getDataSource().delete( { id: { [Operator.eq]: foreignId } }, context )
        return this.unsetForeignKeyOnManySide()
    }

    public async addIdFromOneSide( oneSideId: string, manySideId: string, context: any ): Promise<void> {
        const mutation = this.manySideModel.getUpdateMutationFactory().createMutation( { [this.foreignKey]: oneSideId } )
        await this.manySideModel.getDataSource().update( { id: { [Operator.eq]: manySideId } }, mutation, context )
    }

    public async createAndAddFromOneSide( oneSideId: string, manySideData: any, context: any ): Promise<void> {
        const { rootData, createdData } = await InputRecursiveRelation(
            { ...manySideData, [ this.foreignKey ]: oneSideId },
            this.manySideModel,
            context
        )
        const mutation = await this.manySideModel
            .getCreateMutationFactory()
            .createMutation( { ...rootData, ...createdData } )
        await this.manySideModel
            .getDataSource()
            .create( mutation, context )
    }

    public async removeIdFromOneSide( oneSideId: string, manySideId: string, context: any ): Promise<void> {
        const mutation = this.manySideModel.getUpdateMutationFactory().createMutation( { [this.foreignKey]: null } )
        await this.manySideModel.getDataSource().update( { id: { [Operator.eq]: manySideId } }, mutation, context )
    }

    public async deleteRecordFromOneSide( manySideId: string, context: any ): Promise<void> {
        await this.manySideModel.getDataSource().delete( { id: { [Operator.eq]: manySideId } }, context )
    }

    public async joinManyOnOneSide( data: Record<string, any>, argument: Record<string, any>, context: any ): Promise<any[]> {
        let where = get( argument, `where`, {} )
        let orderBy = get( argument, `orderBy`, {} )
        where = WhereInputPlugin.parseWhereIterate( where, this.manySideModel )
        orderBy = OrderInputPlugin.parseOrder( orderBy )
        const listFindQuery: ListFindQuery = { orderBy, where: { ...where, [this.foreignKey]: { [Operator.eq]: data.id } } }
        return await this.manySideModel.getDataSource().findManyFromOneRelation( listFindQuery, context )
    }

    public async joinOneOnManySide( data: Record<string, any>, context: any ): Promise<any> {
        const targetId = data[this.foreignKey]
        if ( !targetId ) {
            return null
        }
        const toOneData = await this.oneSideModel.getDataSource().findOneById( targetId, context )
        return isEmpty( toOneData ) ? null : toOneData
    }
}
