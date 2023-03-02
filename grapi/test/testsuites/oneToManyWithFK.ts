import chai from 'chai'
import faker from 'faker'
import { readFileSync } from 'fs'
import path from 'path'

import { wrapSetToArrayField } from './utils'

const expect = chai.expect
const userFields = `
  id
  username
  email
  status
  attributes
  location {
    lat
    lng
  }
  note {
    title
    text
  }
`

const bookWithEditorialFields = `
  id name
  editorial {
    id name
  }
`

const fakeUserData = ( data?: any ) => {
    return {
        username: faker.internet.userName(),
        email: faker.internet.email(),
        status: 'OK',
        attributes: { x: 1 },
        location: {
            lat: faker.address.latitude(),
            lng: faker.address.longitude(),
        },
        note: [ { title: faker.lorem.slug( 10 ), text: faker.lorem.sentence( 100 ) } ],
        ...data,
    }
}

const createBookQuery = `
    mutation createUser( $data: UserCreateInput! ) {
        createUser( data: $data ){ 
            ${userFields} 
            books{ 
                ${bookWithEditorialFields}
            }
        }
    }
`
// use same testsuite with one-to-one
export const sdl = readFileSync( path.resolve( __dirname, '../fixtures/oneToManyWithFK.graphql' ), { encoding: 'utf8' } )

export function testSuitsWithFK(): void {
    it( `Should create recursive items with bi-one-to-*`, async () => {
        const createUserVariables = {
            data: wrapSetToArrayField( fakeUserData(  {
                books: {
                    create: {
                        name: faker.name.findName(),
                        editorial: { create: { name: faker.name.findName() } }
                    }
                }
            } ) ),
        }
        const { createUser } = await ( this as any ).graphqlRequest( createBookQuery, createUserVariables )

        expect( createUser ).to.have.property( 'id' )
        expect( createUser.books ).with.length( 1 )
        expect( createUser.books[0] ).to.have.property( 'id' )
        expect( createUser.books[0].editorial ).to.have.property( 'id' )
    } )

    it( `should update recursive items with bi-one-to-*` )

    it( `should delete recursive items with bi-one-to-*`, async () => {
        const createUserVariables = {
            data: wrapSetToArrayField( fakeUserData(  {
                books: {
                    create: [
                        {
                            name: faker.name.findName(),
                            editorial: { create: { name: faker.name.findName() } }
                        },
                        {
                            name: faker.name.findName(),
                            editorial: { create: { name: faker.name.findName() } }
                        },
                        {
                            name: faker.name.findName(),
                            editorial: { create: { name: faker.name.findName() } }
                        }
                    ]
                }
            } ) ),
        }

        const { createUser } = await ( this as any ).graphqlRequest( createBookQuery, createUserVariables )

        expect( createUser.books ).with.length( 3 )

        const { updateUser } = await ( this as any ).graphqlRequest(
            `mutation ( 
                $where: UserWhereUniqueInput!
                $data: UserUpdateInput!
            ) {
                updateUser( where: $where, data: $data ) {
                    ${userFields}
                    books {
                        ${bookWithEditorialFields}
                    }
                }
            }`,
            {
                where: { id: createUser.id },
                data: {
                    books: {
                        delete: [ { id: createUser.books[1].id } ]
                    }
                }
            }
        )

        expect( updateUser.books ).with.length( 2 )

        const { errors } = await ( this as any ).graphqlRequest(
            `query {
                book ( where: { id: "${createUser.books[1].id}" } ) {
                    ${bookWithEditorialFields}
                }
            }`
            ,
            {}
        )

        expect( errors ).not.to.be.undefined
    } )
}

export { testSuits } from './oneToMany'
