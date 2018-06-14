/* global describe it expect jasmine */

describe('A Model, as an event emitter', function () {
  const { Model } = require('..')

  var Person = Model('Person')
      .attributes({
        firstName: String,
        lastName: String,
        age: { type: Number }
      })

  it('should trigger a \'new\' event on the Model', function () {
    let spy = jasmine.createSpy()
    Person.$on('new', spy)

    let i = 5
    let p = null
    while (i-- > 0) {
      p = new Person()
    }

    expect(p).toEqual(jasmine.any(Person))
    expect(spy.calls.count()).toEqual(5)
    expect(spy.calls.argsFor(0)[0]).toEqual(jasmine.any(Person))
    expect(spy.calls.mostRecent().object).toEqual(Person)

    Person.$off('new')
  })

  it('should trigger a \'update\' event on the Model', function () {
    let spy = jasmine.createSpy()
    Person.$on('update', spy)

    let i = 20
    let p = new Person({firstName: 'Larry', lastName: 'Smith'})

    expect(spy.calls.count()).toEqual(0)

    while (i-- > 15) { p.age = i }

    expect(spy.calls.count()).toEqual(5)
    expect(spy.calls.argsFor(0)[0]).toEqual(jasmine.any(Person))
    expect(spy.calls.argsFor(0)[1].age.currentValue).toEqual(19)
    expect(spy.calls.argsFor(0)[1].$size).toEqual(1)
    expect(spy.calls.mostRecent().object).toEqual(Person)

    Person.$off('update')
  })

  it('should trigger a \'update\' event on the Model instance', function () {
    let spy = jasmine.createSpy()

    let i = 20
    let p = new Person({firstName: 'Larry', lastName: 'Smith'})
    p.$on('update', spy)

    while (i-- > 15) { p.age = i }

    expect(spy.calls.count()).toEqual(5)
    expect(spy.calls.argsFor(0)[0].age.currentValue).toEqual(19)
    expect(spy.calls.argsFor(0)[0].$size).toEqual(1)
    expect(spy.calls.mostRecent().object).toEqual(p)

    p.$updateAttributes({firstName: 'John', age: 50})
    expect(spy.calls.count()).toEqual(6)
    expect(spy.calls.argsFor(5)[0].age.currentValue).toEqual(50)
    expect(spy.calls.argsFor(5)[0].firstName.currentValue).toEqual('John')
    expect(spy.calls.argsFor(5)[0].$size).toEqual(2)
  })
})
