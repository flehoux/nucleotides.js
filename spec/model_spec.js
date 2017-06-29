/* global describe it expect jasmine */

describe('A Model with simple attributes, methods and derived properties', function () {
  const { Model } = require('..')

  var Person = Model('Person')
      .attributes({
        firstName: String,
        lastName: String,
        birthdate: Date
      })
      .method('toUpperCase', function () {
        this.firstName = this.firstName.toUpperCase()
        this.lastName = this.lastName.toUpperCase()
      })
      .derive('fullName', function () { return this.firstName + ' ' + this.lastName })

  it('should hold valid data with respect to attribute definition', function () {
    var person = new Person({
      firstName: 'John',
      lastName: 'Smith',
      birthdate: 527817600000
    })

    expect(person.firstName).toEqual(jasmine.any(String))
    expect(person.lastName).toEqual(jasmine.any(String))
    expect(person.birthdate).toEqual(new Date(Date.UTC(1986, 8, 23)))
  })

  it('should be able to derive dynamic properties just-in-time', function () {
    var person = new Person({
      firstName: 'John',
      lastName: 'Smith',
      birthdate: 527817600000
    })

    expect(person.fullName).toEqual('John Smith')
  })

  it('should be able to expose methods that change internal data', function () {
    var person = new Person({
      firstName: 'John',
      lastName: 'Smith',
      birthdate: 527817600000
    })

    person.toUpperCase()

    expect(person.fullName).toEqual('JOHN SMITH')
  })
})

describe('A Model with array attributes', function () {
  const { Model } = require('..')

  var Person = Model('Person')
      .attributes({
        firstName: String,
        lastName: String,
        emails: [String]
      })

  it('should apply the typed generator to each component of the array', function () {
    var person = new Person({
      firstName: 'John',
      lastName: 'Smith',
      emails: ['asd', new Date(), 1]
    })

    expect(person.emails[0]).toEqual(jasmine.any(String))
    expect(person.emails[1]).toEqual(jasmine.any(String))
    expect(person.emails[1]).toEqual(jasmine.any(String))
  })

  it('should apply the typed generator to each component of the array', function () {
    var person = new Person({
      firstName: 'John',
      lastName: 'Smith',
      emails: []
    })
    person.emails = ['asd', new Date(), 1]

    expect(person.emails[0]).toEqual(jasmine.any(String))
    expect(person.emails[1]).toEqual(jasmine.any(String))
    expect(person.emails[1]).toEqual(jasmine.any(String))
  })
})

describe('A Model with an attribute typed as another Model', function () {
  const { Model } = require('..')

  var Name = Model('Name')
      .attributes({
        first: String,
        last: String
      })
      .derive('full', function () { return this.first + ' ' + this.last })

  var Email = Model('Email')
      .attributes({
        domain: String,
        user: String
      })
      .derive('full', function () { return this.user + '@' + this.domain })
      .construct(function (email) {
        if (typeof email === 'string') {
          const [user, domain] = email.split('@')
          this.user = user
          this.domain = domain
        }
      })

  var Person = Model('Person')
      .attributes({
        name: Name,
        birthdate: Date,
        emails: [Email]
      })

  it('should hold valid data with respect to attribute definition', function () {
    var person = new Person({
      name: {
        first: 'John',
        last: 2
      },
      birthdate: 527817600000
    })

    expect(person.name.first).toEqual(jasmine.any(String))
    expect(person.name.last).toEqual(jasmine.any(String))
    expect(person.name).toEqual(jasmine.any(Name))
    expect(person.name.full).toEqual('John 2')
  })

  it('should be able to accept already instantiated model instance', function () {
    var name = new Name({
      first: 'John',
      last: 'Smith'
    })
    var person = new Person({
      name,
      birthdate: 527817600000
    })

    expect(person.name.first).toEqual(jasmine.any(String))
    expect(person.name.last).toEqual(jasmine.any(String))
    expect(person.name).toEqual(jasmine.any(Name))
    expect(person.name.full).toEqual('John Smith')
  })

  it('should provide deeply cleaned data', function () {
    var person = new Person({
      name: {
        first: 'John',
        last: 2
      },
      birthdate: 527817600000
    })

    expect(person.clean).toEqual({
      name: {
        first: 'John',
        last: '2'
      },
      emails: null,
      birthdate: new Date(527817600000)
    })
  })

  it('should bubble up \'change\' events from child model attributes', function (done) {
    var spy = jasmine.createSpy()
    var person = new Person({
      name: {
        first: 'Larry',
        last: 2
      },
      birthdate: 527817600000
    })

    person.name.$on('change', spy)
    person.name.last = 'Smith'

    setTimeout(function () {
      expect(spy.calls.count()).toBe(1)
      expect(spy.calls.argsFor(0)[0].last).toBe('Smith')

      person.name.$off('change', spy)
      person.$on('change', spy)
      spy.calls.reset()

      person.name.last = 'Anderson'
      setTimeout(function () {
        expect(spy.calls.argsFor(0)[0].name.last).toBe('Anderson')
        expect(spy.calls.count()).toBe(1)
        done()
      }, 0)
    }, 0)
  })

  it('should properly instantiate each item of a list of nested models', function () {
    var person = new Person({
      name: {
        first: 'John',
        last: 'Smith'
      },
      emails: ['john@smith.org', 'johnsmith@gmail.com']
    })

    expect(person.emails[0]).toEqual(jasmine.any(Email))
    expect(person.emails[0].domain).toBe('smith.org')
    expect(person.emails[1]).toEqual(jasmine.any(Email))
    expect(person.emails[1].user).toBe('johnsmith')
    expect(person.emails[0].full).toBe('john@smith.org')
  })

  it('should bubble up \'change\' events from a list of nested models', function (done) {
    var spy = jasmine.createSpy()
    var person = new Person({
      name: {
        first: 'John',
        last: 'Smith'
      },
      emails: ['john@smith.org', 'johnsmith@gmail.com']
    })

    let email = person.emails[0]
    email.$on('change', spy)
    email.user = 'larry'

    setTimeout(function () {
      expect(spy.calls.count()).toBe(1)
      expect(spy.calls.argsFor(0)[0].user).toBe('larry')

      email.$off('change', spy)
      person.$on('change', spy)
      spy.calls.reset()

      email.user = 'karry'
      setTimeout(function () {
        expect(spy.calls.argsFor(0)[0].emails.user).toBe('karry')
        expect(spy.calls.count()).toBe(1)
        done()
      }, 0)
    }, 0)
  })
})

describe('A Model with simple class methods', function () {
  var {Model} = require('..')
  var Person = Model('Person')
    .attributes({
      firstName: String,
      lastName: {
        base: String,
        initial: 'Smith'
      }
    })
    .classMethod('create', function (...args) {
      return Reflect.construct(this, args)
    })

  it('should expose the class methods for execution', function () {
    var p = Person.create({firstName: 'John'})
    expect(p.firstName).toBe('John')
  })
})
