import chai from 'chai'
import { readFileSync } from 'fs'
import { differenceWith, forEach, isMatch, some } from 'lodash'
import path from 'path'
const expect = chai.expect
const userFields: string = `id username email`
const bookFields: string = `id name`
const userData: string = `{
    ${ userFields }
    groups {
        name
    }
    team {
        name
    }
    book { ${ bookFields } }
}`

export const sdl = readFileSync( path.resolve( __dirname, '../fixtures/filtersRelations.graphql' ), { encoding: 'utf8' } )

export function testSuits(): void {

    it( 'Should filter AND Users username plus biOneToOne Book name', async () => {
        const query: string = `query {
            users( where: { username_contains: "Doe", book: { name: "Book B Jhon Doe" } } ) ${ userData }
        }`
        const { users } = await ( this as any ).graphqlRequest( query, {} )
        expect( users ).to.have.lengthOf( 1 )
        expect( users[0] ).to.include( {
            'username': 'Jhon Doe',
            'email': 'jhon@doe.com'
        } )
        expect( users[0] ).to.not.have.property( 'book', { 'name': 'Book B Jhon Doe' } )
    } )
    it( 'Should filter AND Users username plus biOneToMany Team name', async () => {
        const query: string = `query { users( where: { username_contains: "User" team: { name: "Team Test" } }) ${userData} }`
        const { users } = await ( this as any ).graphqlRequest( query, {} )
        expect( users ).to.have.lengthOf( 1 )
        expect( some( users, {
            'username': 'Test User', 'email': 'test@doe.com',
            'team': { 'name': 'Team Test' }
        } ) ).to.be.true
    } )
    it( 'Should filter AND Users username plus biOneToMany Team name - biOneToOne Book name', async () => {
        const query: string = `query { users( where: { username_contains: "Doe" book: { name_contains: "Doe" } team: { name_contains: "Doe" } } ) ${userData} }`
        const { users } = await ( this as any ).graphqlRequest( query, {} )
        expect( users ).to.have.lengthOf( 2 )
        expect( some( users, { 'username': 'Maria Doe',
            'email': 'maria@doe.com',
            'team': { 'name': 'Team Maria Doe' },
            'book': { 'name': 'Book A Maria Doe' } } ) ).to.be.true
        expect( some( users, { 'username': 'Carlos Doe',
            'email': 'carlos@email.com',
            'team': { 'name': 'Team Carlos Doe' },
            'book': { 'name': 'Book From Carlos Doe' } } ) ).to.be.true
    } )
    it( 'Should filter AND Users username plus ManyToMany Group name', async () => {
        const query: string = `query ( $groups: FilterGroup ) {
            users(
                where: {
                    username_contains: "Doe"
                    groups: $groups
                }
            ) ${ userData }
        }`
        let { users } = await ( this as any ).graphqlRequest( query, {
            groups: { some: { name_contains: 'Group Carlos Doe B' } }
        } )
        expect( users ).to.be.an( 'array' ).to.have.lengthOf( 1 )
        expect( users[0] ).to.include( {
            'username': 'Carlos Doe',
            'email': 'carlos@email.com'
        } )
        expect( users[0].groups )
            .to.be.an( 'array' )
            .to.have.lengthOf( 3 )
            .to.include.deep.members( [ {
                'name': 'Group Carlos Doe B'
            } ] )

        const responseEvery = await ( this as any ).graphqlRequest( query, {
            groups: { every: { name_in: [ 'Group Test', 'Group B From Jhon Doe' ] } }
        } )
        users = responseEvery.users
        expect( users ).to.be.an( 'array' ).to.have.lengthOf( 1 )
        expect( users[0] ).to.include( {
            'username': 'Jhon Doe'
        } )
        expect( users[0].groups )
            .to.be.an( 'array' )
            .to.have.lengthOf( 2 )
            .to.include.deep.members( [
                {
                    'name': 'Group B From Jhon Doe'
                },
                {
                    'name': 'Group Test'
                }
            ] )

        const responseNone = await ( this as any ).graphqlRequest( query, {
            groups: { none: { name_contains: 'Group' } }
        } )
        users = responseNone.users
        expect( users ).to.be.an( 'array' ).to.have.lengthOf( 0 )
    } )

    it( 'Should filter AND Groups name plus ManyToMay members to User username', async () => {
        const query: string = `query ( $members: FilterUser ) {
            groups(
                where: {
                    name_contains: "Group"
                    members: $members
                }
            ) { name members { username email } }
        }`
        let { groups } = await ( this as any ).graphqlRequest( query, {
            members: { some: { username_contains: 'Maria Doe' } }
        } )
        expect( groups ).to.be.an( 'array' ).to.have.lengthOf( 2 )
        forEach( groups, ( group: any ) => {
            expect( some( group.members, { 'username': 'Maria Doe', 'email': 'maria@doe.com' } ) ).to.be.true
        } )

        const responseNone = await ( this as any ).graphqlRequest( query, {
            members: { none: { username_in: [ 'Jhon Doe', 'Carlos Doe' ] } }
        } )
        groups = responseNone.groups
        expect( groups )
            .to.be.an( 'array' )
            .to.have.lengthOf( 1 )
        expect( groups[0].members )
            .to.be.an( 'array' )
            .to.have.lengthOf( 1 )
            .to.include.deep.members( [
                {
                    email: 'maria@doe.com',
                    username: 'Maria Doe'
                }
            ] )
    } )
    it( 'Should filter AND Groups name plus ManyToMany members User - username - plus Book name', async () => {
        const query: string = `query {
            groups(
                where: {
                    name_contains: "Group" 
                    members: {
                        some: {
                            username_contains: "Doe"
                            book: {
                                name: "Book A Maria Doe"
                            }
                        }
                    }
                }
            ) { name members ${userData} }
        }`
        const { groups } = await ( this as any ).graphqlRequest( query, {} )
        expect( groups ).to.be.an( 'array' ).to.have.lengthOf( 2 )
        forEach( groups, ( group: any ) => {
            expect( some( group.members, { 'book': { 'name': 'Book A Maria Doe' } } ) ).to.be.true
        } )
    } )
    it( 'Should filter AND Groups name plus ManyToMany memebers User - username - Book name - Team name', async () => {
        const query: string = `query {
                groups( where: {
                name_contains: "Doe"
                members: {
                    some: {
                        username_notcontains: "Carlos Doe"
                        book: { name_contains: "Book" }
                        team: { name: "Team Maria Doe" }
                    }
                }
            } ) { name members ${userData} }
        }`
        const { groups } = await ( this as any ).graphqlRequest( query, {} )
        expect( groups ).to.be.an( 'array' ).to.have.lengthOf( 1 )
        expect( some( groups, { 'name': 'Group A From Maria Doe' } ) ).to.be.true
        forEach( groups, ( group: any ) => {
            expect( some( group.members, {
                'username': 'Maria Doe',
                'book': { 'name': 'Book A Maria Doe' },
                'team': { 'name': 'Team Maria Doe' }
            } ) ).to.be.true
        } )
    } )

    it( 'Should filter AND Teams name plus biOneToMany players User - username', async() => {
        const query: string = `query {
            teams(
                where: {
                    name_notcontains: "test" 
                    players: { 
                        some: { username_neq: "Maria Doe" }
                    }
                }
            ) { name players ${userData} }
        }`
        const { teams } = await ( this as any ).graphqlRequest( query, {} )
        expect( teams ).to.be.an( 'array' ).to.have.lengthOf( 1 )
        expect( some( teams, { 'name': 'Team Carlos Doe' } ) ).to.be.true
        forEach( teams, ( team: any ) => {
            expect( some( team.players, {
                'username': 'Carlos Doe',
                'email': 'carlos@email.com'
            } ) ).to.be.true
        } )
    } )
    it( 'Should filter AND Teams name plus biOneToMany players User - username - plus Book name', async () => {
        const query: string = `query {
            teams( where: { 
                name_contains: "team" 
                players: { 
                    some: {
                        email_contains: "@" book: { name_notcontains: "Book From" }
                    }
                }
            } ) { name players ${userData} }
        }`
        const { teams } = await ( this as any ).graphqlRequest( query, {} )
        expect( teams ).to.be.an( 'array' ).to.have.lengthOf( 2 )
        expect(
            differenceWith( teams, [ { 'name': 'Team Maria Doe' }, { 'name': 'Team Test' } ], isMatch )
        ).to.be.an( 'array' ).have.length( 0 )
    } )
    it( 'Should filter AND Teams name plus biOneToMany players User - username - plus Book name - plus Group name', async () => {
        const query: string = `query {
            teams( where: {
                name_contains: "team"
                players: { 
                    some: {
                        email_contains: "@" 
                        book: { name_notcontains: "Book From" } 
                        groups: {
                            some: {
                                name: "Group B From Jhon Doe"
                            }
                        }
                    }
                }
            } ) { name players ${userData} }
        }`
        const { teams } = await ( this as any ).graphqlRequest( query, {} )
        expect( teams ).to.be.an( 'array' ).to.have.lengthOf( 1 )
        expect( some( teams, { 'name': 'Team Test' } ) ).to.be.true
    } )

    it( 'Should filter AND base with empty result plus relation biOneToMany Teams players User - username - plus Book name - plus Group name', async () => {
        const query: string = `query {
            teams( where: {
                name: "Team Test Some"
                players: {
                    some: {
                        email: "jhon@doe.com"
                        book: { name_notcontains: "Book From" }
                        groups: { some: { name: "Group B From Jhon Doe" } }
                    }
                }
            } ) { name players ${userData} }
        }`
        const { teams } = await ( this as any ).graphqlRequest( query, {} )
        expect( teams ).to.be.an( 'array' ).to.have.lengthOf( 0 )
    } )

    // TODO what if plus contains neq on players on groups property
    it( 'Should filter AND Teams name plus biOneToMany players User - plus Book - plus Group containsFilter' )

    it( 'Should filter AND Books name plus biOneToOne author User - username', async () => {
        const query: string = `query {
            books( where: { name_contains: "Doe" author: { username: "Maria Doe" } } ) { ${ bookFields } author { ${ userFields } } }
        }`
        const { books } = await ( this as any ).graphqlRequest( query, {} )
        expect( books ).to.have.lengthOf( 1 )
        expect( books[0] ).to.include( { 'name': 'Book A Maria Doe' } )
        expect( books[0] ).to.not.have.property( 'author', {
            'username': 'Maria Doe',
            'email': 'maria@doe.com'
        } )
    } )
    it( 'Should filter AND Books name plus biOneToOne author User - plus Team', async () => {
        const query: string = `query {
            books( where: {
                name_contains: "Book"
                author: { username_contains: "Doe" team: { name_notcontains: "Doe" } }
            } ) { name author ${userData} }
        }`
        const { books } = await ( this as any ).graphqlRequest( query, {} )
        expect( books ).to.be.an( 'array' ).to.have.lengthOf( 1 )
        expect( some(
            books, {
                'name': 'Book B Jhon Doe',
                'author': { 'username': 'Jhon Doe', 'email': 'jhon@doe.com', 'team': { 'name': 'Team Test' } }
            }
        ) ).to.be.true
    } )
    it( 'Should filter AND Books name plus biOneToOne author User - plus Group', async () => {
        const query: string = `query {
            books( where: {
                name_contains: "Book"
                author: {
                    username_contains: "Doe"
                    groups: { some: { name: "Group B From Jhon Doe" } }
                }
            } ) { name author ${userData} }
        }`
        const { books } = await ( this as any ).graphqlRequest( query, {} )
        expect( books ).to.be.an( 'array' ).to.have.lengthOf( 1 )
        expect( some(
            books, {
                'name': 'Book B Jhon Doe',
                'author': {
                    'username': 'Jhon Doe',
                    'email': 'jhon@doe.com'
                }
            }
        ) ).to.be.true
    } )
    it( 'Should filter AND Books name plus biOneToOne User - plus Team - plus Group', async () => {
        const query: string = `query {
            books( where: {
                name_contains: "Book"
                author: {
                    username_contains: "Doe"
                    team: { name_contains: "Doe" }
                    groups: { some: { name: "Group Carlos Doe A" } }
                }
            } ) { name author ${userData} }
        }`
        const { books } = await ( this as any ).graphqlRequest( query, {} )
        expect( books ).to.be.an( 'array' ).to.have.lengthOf( 1 )
        expect( some(
            books, {
                'name': 'Book From Carlos Doe',
                'author': {
                    'username': 'Carlos Doe',
                    'email': 'carlos@email.com',
                    'team': {
                        'name': 'Team Carlos Doe'
                    }
                }
            }
        ) ).to.be.true
    } )

    it( 'Should filter OR Users plus biOneToOne Book name attribute', async () => {
        const query: string = `query {
            users( where: {
                OR: [
                    { email_in: [ "email@testa.com" "email@testb.com" ] }
                    { book: { name: "Book From Carlos Doe" } }
                ]
            } ) ${userData}
        }`
        const { users } = await ( this as any ).graphqlRequest( query, {} )
        expect( users ).to.be.an( 'array' ).to.have.lengthOf( 3 )
        expect(
            differenceWith( users, [
                { 'email': 'email@testa.com' },
                { 'email': 'email@testb.com' },
                { 'email': 'carlos@email.com', 'book': { 'name': 'Book From Carlos Doe' } }
            ], isMatch )
        ).to.be.an( 'array' ).have.length( 0 )
    } )
    it( 'Should filter OR Users username plus biOneToMany Team name', async () => {
        const query: string = `query { users( where: {
            OR: [ { email_in: [ "email@testa.com" "email@testb.com" ] } { team: { name: "Team Maria Doe" } } ]
        } ) ${userData} }`
        const { users } = await ( this as any ).graphqlRequest( query, { } )
        expect( users ).to.be.an( 'array' ).to.have.lengthOf( 3 )
        expect(
            differenceWith( users, [
                { 'email': 'email@testa.com' },
                { 'email': 'email@testb.com' },
                { 'email': 'maria@doe.com', 'team': { 'name': 'Team Maria Doe' } }
            ], isMatch )
        ).to.be.an( 'array' ).have.length( 0 )
    } )
    it( 'Should filter OR Users username plus ManyToMany Group name', async () => {
        const query: string = `query { users( where: {
            OR: [ 
                { email_notcontains: "@doe.com" }
                { groups: { some: { name_eq: "Group A From Maria Doe" } } } 
            ]
        } ) ${userData} }`
        const { users } = await ( this as any ).graphqlRequest( query, { } )
        expect( users ).to.be.an( 'array' ).to.have.lengthOf( 4 )
        expect(
            differenceWith( users, [
                { 'email': 'email@testa.com' },
                { 'email': 'email@testb.com' },
                { 'email': 'carlos@email.com' },
                { 'email': 'maria@doe.com' }
            ], isMatch )
        ).to.be.an( 'array' ).have.length( 0 )
    } )

    it( 'Should filter OR Groups name plus ManyToMay members User username', async () => {
        const query: string = `query { groups ( where: {
            OR: [
                { name_eq: "Group A From Maria Doe" }
                { members: { some: { username_eq: "Maria Doe" } } }
                { members: { some: { username_eq: "Jhon Doe" } } }
            ]
        } ) { name members ${userData} } }`
        const { groups } = await ( this as any ).graphqlRequest( query, { } )
        expect( groups ).to.be.an( 'array' ).to.have.lengthOf( 3 )
        expect(
            differenceWith( groups, [
                { 'name': 'Group A From Maria Doe' },
                { 'name': 'Group Test' },
                { 'name': 'Group B From Jhon Doe' },
            ], isMatch )
        ).to.be.an( 'array' ).have.length( 0 )
    } )
    it( 'Should filter OR Groups name plus ManyToMany members User - plus Book name', async () => {
        const query: string = `query { groups ( where: {
            OR: [
                { name_eq: "Group A From Maria Doe" }
                {
                    members: {
                        some: {
                            username_in: ["Maria Doe", "Jhon Doe"]
                            book: { name: "Book A Maria Doe" }
                        }
                    }
                }
            ]
        } ) { name members ${userData} } }`
        const { groups } = await ( this as any ).graphqlRequest( query, { } )
        expect( groups ).to.be.an( 'array' ).to.have.lengthOf( 2 )
        expect(
            differenceWith( groups, [
                { 'name': 'Group A From Maria Doe' },
                { 'name': 'Group Test' },
            ], isMatch )
        ).to.be.an( 'array' ).have.length( 0 )
    } )
    it( 'Should filter OR Books name plus biOneToOne author User', async () => {
        const query: string = `query {
            books( where: {
                OR: [
                    { name_contains: "Jhon Doe" }
                    { name_contains: "Maria Doe" }
                    { author: { username_contains: "Carlos Doe" } }
                ]
            } ) { name author ${userData} }
        }`
        const { books } = await ( this as any ).graphqlRequest( query, {} )
        expect( books ).to.be.an( 'array' ).to.have.lengthOf( 3 )
        expect(
            differenceWith( books, [ { 'name': 'Book A Maria Doe' }, { 'name': 'Book B Jhon Doe' }, { 'name': 'Book From Carlos Doe', 'author': { 'username': 'Carlos Doe' } } ], isMatch )
        ).to.be.an( 'array' ).have.length( 0 )
    } )
    it( 'Should filter OR Groups name plus relation ManyToMany memebers User - username attribute - plus relation Book name - plus relation Team name' )
    it( 'Should filter OR Teams name plus relation biOneToMany members User - username attribute' )
    it( 'Should filter OR Teams name plus relation biOneToMany memebers User - username attribute - plus relation Book name' )
    it( 'Should filter OR Teams name plus relation biOneToMany memebers User - username attribute - plus relation Group name' )
    it( 'Should filter OR Teams name plus relation biOneToMany memebers User - username attribute - plus relation Book name - plus relation Group name' )
    it( 'Should filter OR Books name plus relation biOneToOne author User - username attribute - plus relation Team name' )
    it( 'Should filter OR Books name plus relation biOneToOne author User - username attribute - plus relation Group name' )
    it( 'Should filter OR Books name plus relation biOneToOne author User - username attribute - plus relation Team name - plus relation Group name' )

    // TODO Add testing recursive backlink

}
