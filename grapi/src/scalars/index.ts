import { GraphQLScalarType } from 'graphql'

import { DateTime } from './DateTimeScalar'
import { Email } from './EmailScalar'
import { Json, JsonObject } from './JsonObject'
import { Phone } from './Phone'
import { Url } from './UrlScalar'

const customScalars: Record<string, GraphQLScalarType> = {
    DateTime,
    Email,
    Url,
    Phone,
    JSON: Json,
    Json: JsonObject
}

export { customScalars }
