<div align="center">

<a href="https://github.com/scalars/grapi"><img src="https://raw.githubusercontent.com/scalars/grapi/master/resources/logo-grapi.svg" width="50%"></a>

</div>

<br/>

## MongoDB Data-Source

```shell
yarn add @grapi/mongodb
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
import { MongodbDataSourceGroup } from '@grapi/mongodb'
import { Grapi } from '@grapi/server'
import { ApolloServer } from '@apollo/server'
import { startStandaloneServer } from '@apollo/server/standalone'


const getDataSource = async () => {
    const datasource = new MongodbDataSourceGroup(
        process.env.MONGO_URI as string,
        process.env.MONGO_DATA_BASE_NAME as string
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
    const { url } = await startStandaloneServer( server, {
        listen: { port: 4000 },
    } )
    console.info( `🚀 Server ready at ${url}` )
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


With remote love from Colombia
