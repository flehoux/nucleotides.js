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

describe('A Model with an attribute typed as another Model', function () {
  const { Model } = require('..')

  var Name = Model('Name')
      .attributes({
        first: String,
        last: String
      })
      .derive('full', function () { return this.first + ' ' + this.last })

  var Person = Model('Person')
      .attributes({
        name: Name,
        birthdate: Date
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
      birthdate: new Date(527817600000)
    })
  })
})
