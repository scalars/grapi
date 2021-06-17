import { Operator, WhereInputPlugin } from '..'
import { Model, RelationType } from '../dataModel'
import { get } from '../lodash'
import { InputRecursiveRelation } from './index'
import { Relation } from './interface'

// many-to-many
export default class ManyToMany implements Relation {
    private readonly modelA: Model;
    private readonly modelB: Model;
    private readonly modelAField: string;
    private readonly modelBField: string;

    constructor( {
        modelA,
        modelB,
        modelAField,
        modelBField,
    }: {
        modelA: Model;
        modelB: Model;
        modelAField: string;
        modelBField?: string;
    } ) {
        this.modelA = modelA
        this.modelB = modelB
        this.modelAField = modelAField
        this.modelBField = modelBField
    }

    public getType(): RelationType {
        return RelationType.biManyToMany
    }

    public getModelA(): Model {
        return this.modelA
    }

    public getModelAField(): string {
        return this.modelAField
    }

    public getModelB(): Model {
        return this.modelB
    }

    public getModelBField(): string {
        return this.modelBField
    }

    public async addId( { modelAId, modelBId }: {modelAId: string; modelBId: string}, context: any ): Promise<void> {
        await this.modelB.getDataSource().addIdToManyRelation(
            this.modelA.getNamings().singular,
            this.modelB.getNamings().singular,
            modelAId,
            modelBId,
            context,
        )

        await this.modelA.getDataSource().addIdToManyRelation(
            this.modelB.getNamings().singular,
            this.modelA.getNamings().singular,
            modelBId,
            modelAId,
            context,
        )
    }

    private async createAndAddIdFromRefSide (
        model: Model,
        modelData: any,
        refData: { modelAId?: string, modelBId?: string },
        context: any
    ) {
        let record: Record<string, any>
        const { modelAId, modelBId } = refData
        const execution = async ( data: Record<string, unknown> ) => {
            const mutation = model.getCreateMutationFactory().createMutation( data )
            return { object: await model.getDataSource().create( mutation ) }
        }
        const { rootData, createdData, executed } = await InputRecursiveRelation( modelData, model, context, execution )
        if ( executed ) record = executed.object
        else record = ( await execution( { ...rootData, ...createdData } ) ).object
        return await this.addId(
            { modelAId: modelAId || record.id, modelBId: modelBId || record.id }, context
        )
    }

    public async createAndAddIdForModelA(
        { modelAId, modelBData }: { modelAId: string; modelBData: Record<string, any> }, context: any
    ): Promise<void> {
        return await this.createAndAddIdFromRefSide( this.modelB, modelBData, { modelAId }, context )
    }

    public async createAndAddIdForModelB(
        { modelBId, modelAData }: {modelBId: string; modelAData: Record<string, any>}, context: any
    ): Promise<any> {
        return await this.createAndAddIdFromRefSide( this.modelA, modelAData, { modelBId }, context )
    }

    public async removeId( { modelAId, modelBId }: {modelAId: string; modelBId: string}, context: any ) {
        await this.modelB.getDataSource().removeIdFromManyRelation(
            this.modelA.getNamings().singular,
            this.modelB.getNamings().singular,
            modelAId,
            modelBId,
            context,
        )

        await this.modelA.getDataSource().removeIdFromManyRelation(
            this.modelB.getNamings().singular,
            this.modelA.getNamings().singular,
            modelBId,
            modelAId,
            context,
        )
    }

    public async deleteAndRemoveIdFromModelA( { modelAId, modelBId }: {modelAId: string; modelBId: string}, context: any ) {
        await this.modelA.getDataSource().delete( { id: { [Operator.eq]: modelAId } } )
        return this.removeId( { modelAId, modelBId }, context )
    }

    public async deleteAndRemoveIdFromModelB( { modelAId, modelBId }: {modelAId: string; modelBId: string}, context: any ) {
        await this.modelB.getDataSource().delete( { id: { [Operator.eq]: modelBId } } )
        return this.removeId( { modelAId, modelBId }, context )
    }

    // when joining data from modelB to modelA, the relationship is save at modelA datasource
    public async joinModelA( modelBId: string, argument: Record< string, any >, context: any, where: Record<string, any> = undefined ) {
        where = get( argument, `where`, {} )
        where = WhereInputPlugin.parseWhereIterate( where, this.modelB )
        return await this.modelA.getDataSource().findManyFromManyRelation(
            this.modelB.getNamings().singular,
            this.modelA.getNamings().singular,
            modelBId,
            where,
            context,
        )
    }

    // when joining data from modelA to modelB, the relationship is save at modelB datasource
    public async joinModelB( modelAId: string, argument: Record< string, any >, context: any, where: Record<string, any> = undefined ) {
        where = get( argument, `where`, {} )
        where = WhereInputPlugin.parseWhereIterate( where, this.modelB )
        return await this.modelB.getDataSource().findManyFromManyRelation(
            this.modelA.getNamings().singular,
            this.modelB.getNamings().singular,
            modelAId,
            where,
            context,
        )
    }
}
