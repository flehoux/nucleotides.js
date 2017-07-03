/* global describe it expect jasmine */

describe('A simple Model modified using the DifferenceMixin', function () {
  const { Model } = require('../..')
  const DifferenceMixin = require('../../src/mixins/difference')

  const Person = Model('Person')
    .attributes({
      firstName: String,
      lastName: String,
      age: Number,
      emails: [String]
    })
    .use(new DifferenceMixin({exclude: ['age']}))

  it('should initially have an empty difference', function () {
    var p = new Person()
    expect(p.$difference).toEqual({})
    expect(p.$isPristine).toBe(true)

    p = new Person({firstName: 'Mathieu'})
    expect(p.$difference).toEqual({})
    expect(p.$isPristine).toBe(true)
  })

  it('should report a difference after a simple change', function () {
    var p = new Person()
    expect(p.$difference).toEqual({})
    expect(p.$isPristine).toBe(true)

    p.firstName = 'Mathieu'
    expect(p.$difference).toEqual({firstName: 'Mathieu'})
    expect(p.$isPristine).toBe(false)
  })

  it('should not report duplicate changes for the same attribute', function () {
    var p = new Person()
    expect(p.$difference).toEqual({})
    expect(p.$isPristine).toBe(true)

    p.firstName = 'Mathieu'
    expect(p.$difference).toEqual({firstName: 'Mathieu'})
    expect(p.$isPristine).toBe(false)

    p.firstName = 'John'
    expect(p.$difference).toEqual({firstName: 'John'})
    expect(p.$isPristine).toBe(false)
  })

  it('should not report changes to excluded keys', function () {
    var p = new Person()
    expect(p.$difference).toEqual({})
    expect(p.$isPristine).toBe(true)

    p.age = 2
    expect(p.$difference).toEqual({})
    expect(p.$isPristine).toBe(true)
  })

  it('should report simplified changes to nested arrays', function () {
    var p = new Person()
    expect(p.$difference).toEqual({})
    expect(p.$isPristine).toBe(true)

    p.emails = []
    expect(p.$difference).toEqual({})
    expect(p.$isPristine).toBe(true)

    p.emails = ['john@smith.org']
    expect(p.$difference).toEqual({emails: ['john@smith.org']})
    expect(p.$isPristine).toBe(false)

    p.$setPristine()

    p.emails[0] = 'john@smith.org'
    expect(p.$difference).toEqual({})
    expect(p.$isPristine).toBe(true)

    p.emails[0] = 'ron@smith.org'
    expect(p.$difference).toEqual({emails: ['ron@smith.org']})
    expect(p.$isPristine).toBe(false)
  })
})

describe('A Model with nested models, modified using the DifferenceMixin', function () {
  const { Model } = require('../..')
  const DifferenceMixin = require('../../src/mixins/difference')

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
      .use(new DifferenceMixin({}))

  it('should report simplified changes to a single nested model', function () {
    var p = new Person({name: {first: 'John', last: 'Smith'}})
    p.name.last = 'Conway'

    expect(p.$difference).toEqual({name: {first: 'John', last: 'Conway'}})
    expect(p.$difference.name).not.toEqual(jasmine.any(Name))
    expect(p.$isPristine).toBe(false)
  })
  it('should report simplified changes to a single nested model', function () {
    var p = new Person({name: {first: 'John', last: 'Smith'}})

    p.emails.push(new Email('john@smith.org'))
    expect(p.$difference).toEqual({emails: [{user: 'john', domain: 'smith.org'}]})
    expect(p.$difference.emails[0]).not.toEqual(jasmine.any(Name))
    expect(p.$isPristine).toBe(false)

    p.emails.push(new Email('johnsmith@gmail.com'))
    expect(p.$difference).toEqual({emails: [{user: 'john', domain: 'smith.org'}, {user: 'johnsmith', domain: 'gmail.com'}]})
    expect(p.$isPristine).toBe(false)
  })
})
