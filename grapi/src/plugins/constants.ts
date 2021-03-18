const scalarDateTime = `scalar DateTime\n`
const scalarEmail = `scalar Email\n`
const scalarUrl = `scalar Url\n`
const scalarJson = `scalar JSON\n`
const scalarJsonObject = `scalar Json\n`
const scalarPhone = `scalar Phone\n`

const scalarSchema = ``.concat( ...[
    scalarDateTime,
    scalarEmail,
    scalarUrl,
    scalarJson,
    scalarJsonObject,
    scalarPhone,
] )

const orderByInputName: string = `OrderByEnum`
const orderByInputEnum: string = `enum ${ orderByInputName } { ASC DESC }`

const inputIntBetweenName: string = `BetweenFilterInt`
const inputFloatBetweenName: string = `BetweenFilterFloat`
const inputDateTimeBetweenName: string = `BetweenFilterDateTime`
const inputIntBetween: string = `input ${ inputIntBetweenName } { from: Int to: Int }`
const inputFloatBetween: string = `input ${ inputFloatBetweenName } { from: Float  to: Float }`
const inputDateTimeBetween: string = `input ${ inputDateTimeBetweenName } { from: DateTime  to: DateTime }`

export { inputDateTimeBetween, inputDateTimeBetweenName }
export { inputFloatBetween, inputFloatBetweenName }
export { inputIntBetween, inputIntBetweenName }
export { orderByInputEnum, orderByInputName }
export { scalarSchema }
