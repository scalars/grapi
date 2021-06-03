import chai from 'chai'
// import faker from 'faker';
import { readFileSync } from 'fs'
import { some } from 'lodash'
import path from 'path'
// import { wrapSetToArrayField } from './utils';
const expect = chai.expect

const userFields = `
  name
  age
  weight
  married
  website
  email
  skills
`

export const sdl = readFileSync( path.resolve( __dirname, '../fixtures/filters.graphql' ), { encoding: 'utf8' } )

export function testSuits() {

    it( 'Boolean: should pass `eq` and `neq` filters', async ()  => {
        const getUsersMarriedEq = `
        query ($where: UserWhereInput!) {
          users( where: $where) { ${userFields} }
        }`
        const getUsersMarriedEqVariables = {
            where: { married: false  }
        }
        let res = await ( this as any ).graphqlRequest( getUsersMarriedEq, getUsersMarriedEqVariables )
        expect( res.users ).with.lengthOf( 1 )
        expect( res.users[0] ).to.deep.includes( { name: 'Ben Bohm' } )

        // neq filter
        const getUsersMarriedNeq = `
        query ($where: UserWhereInput!) {
          users( where: $where) { ${userFields} }
        }`
        const getUsersMarriedNeqVariables = {
            where: { married_neq: false  }
        }
        res = await ( this as any ).graphqlRequest( getUsersMarriedNeq, getUsersMarriedNeqVariables )
        expect( res.users ).with.lengthOf( 2 )
        expect( some( res.users, { name: 'Wout Beckers' } ) ).to.be.true
        expect( some( res.users, { name: 'Michela Battaglia' } ) ).to.be.true
    } )

    it( 'String: should pass `eq`, `neq`, `contains`, `nocontains` and `in` filters', async ()  => {
        const getUsers = `
        query ($where: UserWhereInput!) {
          users( where: $where) { ${userFields} }
        }`
        const getUsersNameEqVariables = {
            where: { name: 'Ben Bohm'  }
        }
        let res = await ( this as any ).graphqlRequest( getUsers, getUsersNameEqVariables )
        expect( res.users ).with.lengthOf( 1 )
        expect( some( res.users, { name: 'Ben Bohm' } ) ).to.be.true

        // neq filter
        const getUsersNameNeqVariables = {
            where: { name_neq: 'Ben Bohm'  }
        }
        res = await ( this as any ).graphqlRequest( getUsers, getUsersNameNeqVariables )
        expect( res.users ).with.lengthOf( 2 )
        expect( some( res.users, { name: 'Wout Beckers' } ) ).to.be.true
        expect( some( res.users, { name: 'Michela Battaglia' } ) ).to.be.true

        // contain filter
        const getUsersNameNotContainVariables = {
            where: { name_contains: 'Michela'  }
        }
        res = await ( this as any ).graphqlRequest( getUsers, getUsersNameNotContainVariables )
        expect( res.users ).with.lengthOf( 1 )
        expect( res.users[0] ).to.deep.includes( { name: 'Michela Battaglia' } )

        // notcontain filter
        const getUsersNameContainVariables = {
            where: { name_notcontains: 'Michela'  }
        }
        res = await ( this as any ).graphqlRequest( getUsers, getUsersNameContainVariables )
        expect( res.users ).with.lengthOf( 2 )
        expect( some( res.users, { name: 'Ben Bohm' } ) ).to.be.true
        expect( some( res.users, { name: 'Wout Beckers' } ) ).to.be.true

        // in filter
        const getUsersNameInVariables = {
            where: { name_in: [ 'Michela Battaglia', 'Ben Bohm' ] }
        }
        res = await ( this as any ).graphqlRequest( getUsers, getUsersNameInVariables )
        expect( res.users ).with.lengthOf( 2 )
        expect( some( res.users, { name: 'Ben Bohm' } ) ).to.be.true
        expect( some( res.users, { name: 'Michela Battaglia' } ) ).to.be.true

    } )

    it( 'Int: should pass `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `in` and `between` filters', async ()  => {
        // eq filter
        const getUsers = `
        query ($where: UserWhereInput!) {
          users( where: $where) { ${userFields} }
        }`
        let getUsersVariables: any = { where: { age:  67 } }
        let res = await ( this as any ).graphqlRequest( getUsers, getUsersVariables )
        expect( res.users ).with.lengthOf( 1 )
        expect( some( res.users, { name: 'Wout Beckers' } ) ).to.be.true

        // neq filter
        getUsersVariables = { where: { age_neq: 43 } }
        res = await ( this as any ).graphqlRequest( getUsers, getUsersVariables )
        expect( res.users ).with.lengthOf( 2 )
        expect( some( res.users, { name: 'Wout Beckers' } ) ).to.be.true
        expect( some( res.users, { name: 'Ben Bohm' } ) ).to.be.true

        // gt filter
        getUsersVariables = { where: { age_gt: 43 } }
        res = await ( this as any ).graphqlRequest( getUsers, getUsersVariables )
        expect( res.users ).with.lengthOf( 1 )
        expect( some( res.users, { name: 'Wout Beckers' } ) ).to.be.true

        // gte filter
        getUsersVariables = { where: { age_gte: 43 } }
        res = await ( this as any ).graphqlRequest( getUsers, getUsersVariables )
        expect( res.users ).with.lengthOf( 2 )
        expect( some( res.users, { name: 'Wout Beckers' } ) ).to.be.true
        expect( some( res.users, { name: 'Michela Battaglia' } ) ).to.be.true

        // lt filter
        getUsersVariables = { where: { age_lt: 43 } }
        res = await ( this as any ).graphqlRequest( getUsers, getUsersVariables )
        expect( res.users ).with.lengthOf( 1 )
        expect( some( res.users, { name: 'Ben Bohm' } ) ).to.be.true

        // lte filter
        getUsersVariables = { where: { age_lte: 43 } }
        res = await ( this as any ).graphqlRequest( getUsers, getUsersVariables )
        expect( res.users ).with.lengthOf( 2 )
        expect( some( res.users, { name: 'Ben Bohm' } ) ).to.be.true
        expect( some( res.users, { name: 'Michela Battaglia' } ) ).to.be.true

        // in filter
        getUsersVariables = { where: { age_in: [ 23, 57, 17 ] } }
        res = await ( this as any ).graphqlRequest( getUsers, getUsersVariables )
        expect( res.users ).with.lengthOf( 1 )
        expect( some( res.users, { name: 'Ben Bohm' } ) ).to.be.true

        // between filter
        getUsersVariables = { where: { age_between: { from: 20, to: 50 } } }
        res = await ( this as any ).graphqlRequest( getUsers, getUsersVariables )
        expect( res.users ).with.lengthOf( 2 )
        expect( some( res.users, { name: 'Michela Battaglia' } ) ).to.be.true
        expect( some( res.users, { name: 'Ben Bohm' } ) ).to.be.true

    } )

    it( 'Float: should pass `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `in` and `between` filters', async ()  => {

        // eq filter
        const getUsers = `
        query ($where: UserWhereInput!) {
          users( where: $where) { ${userFields} }
        }`
        let getUsersVariables: any = { where: { weight:  63.8 } }
        let res = await ( this as any ).graphqlRequest( getUsers, getUsersVariables )
        expect( res.users ).with.lengthOf( 1 )
        expect( some( res.users, { name: 'Michela Battaglia' } ) ).to.be.true

        // neq filter
        getUsersVariables = { where: { weight_neq: 74 } }
        res = await ( this as any ).graphqlRequest( getUsers, getUsersVariables )
        expect( res.users ).with.lengthOf( 3 )
        expect( some( res.users, { name: 'Ben Bohm' } ) ).to.be.true
        expect( some( res.users, { name: 'Wout Beckers' } ) ).to.be.true
        expect( some( res.users, { name: 'Michela Battaglia' } ) ).to.be.true

        // gt filter
        getUsersVariables = { where: { weight_gt: 70.0 } }
        res = await ( this as any ).graphqlRequest( getUsers, getUsersVariables )
        expect( res.users ).with.lengthOf( 2 )
        expect( some( res.users, { name: 'Ben Bohm' } ) ).to.be.true
        expect( some( res.users, { name: 'Wout Beckers' } ) ).to.be.true

        // gte filter
        getUsersVariables = { where: { weight_gte: 75.0 } }
        res = await ( this as any ).graphqlRequest( getUsers, getUsersVariables )
        expect( res.users ).with.lengthOf( 2 )
        expect( some( res.users, { name: 'Wout Beckers' } ) ).to.be.true
        expect( some( res.users, { name: 'Ben Bohm' } ) ).to.be.true

        // lt filter
        getUsersVariables = { where: { weight_lt: 75.0 } }
        res = await ( this as any ).graphqlRequest( getUsers, getUsersVariables )
        expect( res.users ).with.lengthOf( 1 )
        expect( some( res.users, { name: 'Michela Battaglia' } ) ).to.be.true

        // lte filter
        getUsersVariables = { where: { weight_lte: 75.0 } }
        res = await ( this as any ).graphqlRequest( getUsers, getUsersVariables )
        expect( res.users ).with.lengthOf( 2 )
        expect( some( res.users, { name: 'Michela Battaglia' } ) ).to.be.true
        expect( some( res.users, { name: 'Wout Beckers' } ) ).to.be.true

        // in filter
        getUsersVariables = { where: { weight_in: [ 75.0, 87.2, 92.5 ] } }
        res = await ( this as any ).graphqlRequest( getUsers, getUsersVariables )
        expect( res.users ).with.lengthOf( 2 )
        expect( some( res.users, { name: 'Ben Bohm' } ) ).to.be.true
        expect( some( res.users, { name: 'Wout Beckers' } ) ).to.be.true

        // between filter
        getUsersVariables = { where: { weight_between: { from: 70.0, to: 80.0 } } }
        res = await ( this as any ).graphqlRequest( getUsers, getUsersVariables )
        expect( res.users ).with.lengthOf( 1 )
        expect( some( res.users, { name: 'Wout Beckers' } ) ).to.be.true
    } )
    // --------------------------------------------------------------------------------------------------
    // Custom scalars test
    it( 'Url: should pass `eq`, `neq`, `contains` and `notcontains`', async() => {
        // eq filter
        const getUsers = `
        query ($where: UserWhereInput!) {
          users( where: $where) { ${userFields} }
        }`
        let getUsersVariables: any = { where: { website:  'http://woutnet.com' } }
        let res = await ( this as any ).graphqlRequest( getUsers, getUsersVariables )
        expect( res.users ).with.lengthOf( 1 )
        expect( some( res.users, { name: 'Wout Beckers' } ) ).to.be.true

        // neq filter
        getUsersVariables = { where: { website_neq: 'http://bennet.com' } }
        res = await ( this as any ).graphqlRequest( getUsers, getUsersVariables )
        expect( res.users ).with.lengthOf( 2 )
        expect( some( res.users, { name: 'Wout Beckers' } ) ).to.be.true
        expect( some( res.users, { name: 'Michela Battaglia' } ) ).to.be.true

        // contains filter
        getUsersVariables = { where: { website_contains: 'http://michelanet.com' } }
        res = await ( this as any ).graphqlRequest( getUsers, getUsersVariables )
        expect( res.users ).with.lengthOf( 1 )
        expect( some( res.users, { name: 'Michela Battaglia' } ) ).to.be.true

        //notcontains filter
        getUsersVariables = { where: { website_notcontains: 'http://michelanet.com' } }
        res = await ( this as any ).graphqlRequest( getUsers, getUsersVariables )
        expect( res.users ).with.lengthOf( 2 )
        expect( some( res.users, { name: 'Wout Beckers' } ) ).to.be.true
        expect( some( res.users, { name: 'Ben Bohm' } ) ).to.be.true

    } )

    it( 'Email: should pass `eq`, `neq`, `contains` and `notcontains`', async() => {
        const getUsers = `
        query ($where: UserWhereInput!) {
          users( where: $where) { ${userFields} }
        }`
        let getUsersVariables: any = { where: { email:  'test@correo.com' } }
        let res = await ( this as any ).graphqlRequest( getUsers, getUsersVariables )
        expect( res.users ).with.lengthOf( 0 )

        // neq filter
        getUsersVariables = { where: { email_neq: 'wout@correo.com' } }
        res = await ( this as any ).graphqlRequest( getUsers, getUsersVariables )
        expect( res.users ).with.lengthOf( 2 )
        expect( some( res.users, { name: 'Ben Bohm' } ) ).to.be.true
        expect( some( res.users, { name: 'Michela Battaglia' } ) ).to.be.true

        // contains filter
        getUsersVariables = { where: { email_contains: 'michela@correo.com' } }
        res = await ( this as any ).graphqlRequest( getUsers, getUsersVariables )
        expect( res.users ).with.lengthOf( 1 )
        expect( some( res.users, { name: 'Michela Battaglia' } ) ).to.be.true

        //notcontains filter
        getUsersVariables = { where: { email_notcontains: 'test@correo.com' } }
        res = await ( this as any ).graphqlRequest( getUsers, getUsersVariables )
        expect( res.users ).with.lengthOf( 3 )
        expect( some( res.users, { name: 'Michela Battaglia' } ) ).to.be.true
        expect( some( res.users, { name: 'Wout Beckers' } ) ).to.be.true
        expect( some( res.users, { name: 'Ben Bohm' } ) ).to.be.true
    } )

    it( `JSON: Should pass 'json' filter`, async (  ) => {
        const getUsersMarriedEq = `
        query ($where: UserWhereInput!) {
          users( where: $where) { ${userFields} }
        }`
        let getUsersMarriedEqVariables: any = {
            where: { skills_object: { $elemMatch:{ code: { $in:[ 'S03', 'S05' ] } } } }
        }
        let res = await ( this as any ).graphqlRequest( getUsersMarriedEq, getUsersMarriedEqVariables )
        expect( res.users ).with.lengthOf( 2 )
        expect( res.users[0] ).to.deep.includes( { name: 'Wout Beckers' } )

        getUsersMarriedEqVariables = {
            where: { skills_object: { $elemMatch: { name: { $regex: '.*Data.*' } } } }
        }
        res = await ( this as any ).graphqlRequest( getUsersMarriedEq, getUsersMarriedEqVariables )
        expect( res.users ).with.lengthOf( 1 )
        expect( res.users[0] ).to.deep.includes( { name: 'Ben Bohm' } )
    } )

    // TODO: DateTime filters tests
}
