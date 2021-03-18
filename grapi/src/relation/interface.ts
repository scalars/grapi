import { Model, RelationType } from '../dataModel'

export interface Relation {
    getType(): RelationType;
}

export interface WithForeignKey {
    getForeignKeyConfig(): Array<{model: Model; foreignKey: string}>;
}
