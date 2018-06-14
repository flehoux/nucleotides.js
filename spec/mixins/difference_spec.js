/* global describe it expect jasmine */

describe('A simple Model modified using the DifferenceMixin', function () {
  const { Model } = require('../..')

  const Person = Model('Person')
    .attributes({
      firstName: String,
      lastName: String,
      age: Number,
      emails: [String]
    })

  it('should initially have an empty difference', function () {
    var p = new Person()
    expect(p.$difference.$delta.size).toEqual(0)
    expect(p.$isPristine).toBe(true)

    p = new Person({firstName: 'Mathieu'})
    expect(p.$difference.$delta.size).toEqual(0)
    expect(p.$isPristine).toBe(true)
  })

  it('should report a difference after a simple change', function () {
    var p = new Person()
    expect(p.$difference.$delta.size).toEqual(0)
    expect(p.$isPristine).toBe(true)

    p.firstName = 'Mathieu'
    let changeset = p.$difference.$getChangeSet()

    expect(changeset.firstName).not.toBeUndefined()
    expect(changeset.firstName.currentValue).toEqual('Mathieu')
    expect(p.$difference.$delta.size).toEqual(1)
    expect(p.$isPristine).toBe(false)
  })

  it('should not report duplicate changes for the same attribute', function () {
    var p = new Person()
    expect(p.$difference.$delta.size).toEqual(0)
    expect(p.$isPristine).toBe(true)

    p.firstName = 'Mathieu'
    expect(p.$difference.$getChangeSet().firstName.currentValue).toEqual('Mathieu')
    expect(p.$difference.$delta.size).toEqual(1)
    expect(p.$isPristine).toBe(false)

    p.firstName = 'John'
    expect(p.$difference.$getChangeSet().firstName.currentValue).toEqual('John')
    expect(p.$difference.$delta.size).toEqual(1)
    expect(p.$isPristine).toBe(false)
  })

  it('should report simplified changes to nested arrays', function () {
    var p = new Person()
    expect(p.$difference.$delta.size).toEqual(0)
    expect(p.$isPristine).toBe(true)

    p.emails = []
    expect(p.$difference.$delta.size).toEqual(0)
    expect(p.$isPristine).toBe(true)

    p.emails = ['john@smith.org']
    expect(p.$difference.$getChangeSet().emails.currentValue).toEqual(['john@smith.org'])
    expect(p.$difference.$delta.size).toEqual(1)
    expect(p.$isPristine).toBe(false)

    p.$setPristine()

    p.emails[0] = 'john@smith.org'
    expect(p.$difference.$delta.size).toEqual(0)
    expect(p.$isPristine).toBe(true)
  })
})

describe('A Model with nested models, modified using the DifferenceMixin', function () {
  const { Model, Mixin } = require('../..')

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
      .use(new Mixin.Difference({}))

  it('should report simplified changes to a single nested model', function () {
    var p = new Person({name: {first: 'John', last: 'Smith'}})
    p.name.last = 'Conway'
    var changeSet = p.$difference.$getChangeSet()
    expect(changeSet.name.currentValue).toEqual({first: 'John', last: 'Conway'})
    expect(changeSet.name.currentValue).not.toEqual(jasmine.any(Name))
    expect(p.$isPristine).toBe(false)
  })

  it('should report simplified changes to a single nested model', function () {
    var p = new Person({name: {first: 'John', last: 'Smith'}})

    p.emails.push(new Email('john@smith.org'))

    var changeSet = p.$difference.$getChangeSet()
    expect(changeSet.emails.currentValue).toEqual([{user: 'john', domain: 'smith.org'}])
    expect(changeSet.emails.currentValue[0]).not.toEqual(jasmine.any(Name))
    expect(p.$isPristine).toBe(false)

    p.emails.push(new Email('johnsmith@gmail.com'))
    changeSet = p.$difference.$getChangeSet()
    expect(changeSet.emails.currentValue).toEqual([{user: 'john', domain: 'smith.org'}, {user: 'johnsmith', domain: 'gmail.com'}])
    expect(p.$isPristine).toBe(false)
  })
})
