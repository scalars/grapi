import chai from 'chai'
import { readFileSync } from 'fs'
import path from 'path'
const expect = chai.expect

const userFields = `
  name
  hobbies
  phones
  friends
`

const userName = 'Ben Bohm'
const updateBen = `mutation (
    $where: UserWhereUniqueInput!
    $data: UserUpdateInput!
) {
    updateUser( 
        where: $where 
        data: $data 
    ) { ${userFields} }
}`

export const sdl = readFileSync( path.resolve( __dirname, '../fixtures/scalarListInput.graphql' ), { encoding: 'utf8' } )

export function testSuits() {

    it( 'Should pass "add" int, string and json list', async ()  => {
        const updateBenVariables = {
            where: { name: userName  },
            data: {
                phones: { add: [ 45, 50, 100 ] },
                hobbies: { add: [ 'Movies', 'Programming' ] },
                friends: { add: [ { name: 'Maria Doe' }  ] }
            }
        }
        const res = await ( this as any ).graphqlRequest( updateBen, updateBenVariables )
        expect( res.updateUser ).to.deep.include( {
            name: userName,
            phones: [ 1, 2, 3, 45, 50, 100 ],
            hobbies: [ 'Video Games', 'Guitar', 'Bicycle', 'Movies', 'Programming' ],
            friends: [ { name: 'Jhon Doe' }, { name: 'Maria Doe' } ]
        } )
    } )

    it( 'Should pass "remove" int, string and json list', async ()  => {
        const updateBenVariables = {
            where: { name: 'Wout Beckers'  },
            data: {
                phones: { remove: [ 1, 2, 3 ] },
                hobbies: { remove: [ 'Video Games', 'Guitar', 'Bicycle' ] },
                friends: { remove: [ { name: 'Jhon Doe' } ] }
            }
        }
        const res = await ( this as any ).graphqlRequest( updateBen, updateBenVariables )
        expect( res.updateUser ).to.deep.include( {
            name: 'Wout Beckers',
            phones: [ 45, 50, 100 ],
            hobbies: [ 'Movies', 'Programming' ],
            friends: [ { name: 'Maria Doe' } ]
        } )
    } )
}
