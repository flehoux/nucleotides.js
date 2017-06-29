/* global describe it expect jasmine */

describe('A Model with simple fields, methods and derived properties', function () {
  const { Model } = require('..')

  var Person = Model('Person')
      .fields({
        firstName: String,
        lastName: String,
        birthdate: Date
      })
      .method('toUpperCase', function () {
        this.firstName = this.firstName.toUpperCase()
        this.lastName = this.lastName.toUpperCase()
      })
      .derive('fullName', function () { return this.firstName + ' ' + this.lastName })

  it('should hold valid data with respect to field definition', function () {
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
  })
})
