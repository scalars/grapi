<div align="center">

<a href="https://github.com/scalars/grapi"><img src="https://raw.githubusercontent.com/scalars/grapi/master/resources/logo-grapi.svg" width="50%"></a>

</div>

<br/>

## MongoDB Data-Source

```shell
yarn add @scalars/grapi-mongodb
```
Or
```shell
npm install @scalars/grapi-mongodb
```

```graphql
# Add on file schema.graphql
type VehiclesFromActor implements Relation @config(
    name: "VehiclesFromActor"
    foreignKey: { key: "owner_car_id" }
)

type Actor @Model( dataSource: "datasource", key: "Actor" ) {
    id: ID ! @unique
    name: String !
    vehicles: [ Vehicle ! ] ! @relation( with: VehiclesFromActor )
}

type Vehicle @Model( dataSource: "datasource", key: "Vehicle" ) {
    id: ID ! @unique
    trademark: String !
    model: String
    name: String
    owner: Actor @relation( with: VehiclesFromActor )
}
```

```typescript
// server.ts
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { MongodbDataSourceGroup } from '@scalars/grapi-mongodb'
import { Grapi } from '@scalars/grapi'
import { ApolloServer } from 'apollo-server'

const getDataSource = async () => {
    const datasource = new MongodbDataSourceGroup(
        process.env.MONGO_URI,
        process.env.DATA_BASE_NAME
    )
    await datasource.initialize()
    return datasource
}

const startGraphQLServer = async () => {
    const datasource = await getDataSource()
    const sdl = readFileSync( resolve( __dirname, 'schema.graphql' ) ).toString()
    const grapi = new Grapi( {
        sdl,
        dataSources: {
            datasource: ( args ) => datasource.getDataSource( args.key ),
        }
    } )
    const server = new ApolloServer( grapi.createApolloConfig() )
    server.listen().then( ( { url } ) => { 
        console.info( `GraphQL Server On: ${ url }` )
        console.info( `Go To Browser And See PlayGround` )
    } )
}

startGraphQLServer()
```

## Extended Documentation

<div>
    <a href="https://github.com/scalars/grapi">
        Grapi
    </a>
</div>

## License

Apache-2.0

![footer banner](https://madrov.com/favicon.ico)


Madrov Team
