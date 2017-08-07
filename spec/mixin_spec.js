/* global describe it expect jasmine */

describe('A Model modified using a mixin that defines attributes', function () {
  const { Model, Mixin } = require('..')

  var LogAttributesMixin = Mixin('LogAttributesMixin')
      .attributes({
        updated_by: String
      })

  var Person = Model('Person')
      .attributes({
        firstName: String,
        lastName: String
      })
      .use(new LogAttributesMixin())

  it('should be able to configure the augmented attributes', function () {
    var person = new Person({
      firstName: 'John',
      lastName: 'Smith',
      updated_by: 'Paul'
    })

    expect(person.updated_by).toEqual('Paul')
  })

  it('should keep the augmented attributes when returning it\'s clean version', function () {
    var person = new Person({
      firstName: 'John',
      lastName: 'Smith',
      updated_by: 'Paul'
    })

    expect(person.$clean.updated_by).toEqual('Paul')
  })
})

describe('A Model modified using a mixin that defines derived properties', function () {
  const { Model, Mixin } = require('..')
  const mixinSpy = jasmine.createSpy()

  var NameMixin = Mixin('NameMixin')
      .derive('fullName', function (mixin) {
        mixinSpy(mixin)
        return this.firstName + ' ' + this.lastName
      })
      .method('toUpperCase', function (mixin) {
        mixinSpy(mixin)
        this.firstName = this.firstName.toUpperCase()
        this.lastName = this.lastName.toUpperCase()
      })
      .classMethod('create', function (mixin, ...args) {
        mixinSpy(mixin)
        return Reflect.construct(this, args)
      })

  var Person = Model('Person')
      .attributes({
        firstName: String,
        lastName: String,
        birthdate: Date
      })
      .use(new NameMixin({foo: 'bar'}))

  it('should be able to derive dynamic properties just-in-time', function () {
    var person = new Person({
      firstName: 'John',
      lastName: 'Smith',
      birthdate: 527832000000
    })

    expect(person.fullName).toEqual('John Smith')
  })

  it('should pass mixin instance down to derived property getters', function () {
    var person = new Person({
      firstName: 'John',
      lastName: 'Smith',
      birthdate: 527832000000
    })

    person.fullName // eslint-disable-line no-unused-expressions
    expect(mixinSpy.calls.argsFor(0)[0].foo).toEqual('bar')
  })

  it('should pass mixin instance down to mixin-inherited methods', function () {
    var person = new Person({
      firstName: 'John',
      lastName: 'Smith',
      birthdate: 527832000000
    })

    mixinSpy.calls.reset()

    person.toUpperCase() // eslint-disable-line no-unused-expressions
    expect(mixinSpy.calls.argsFor(0)[0].foo).toEqual('bar')
    expect(person.fullName).toEqual('JOHN SMITH')
  })

  it('should expose the class methods for execution', function () {
    mixinSpy.calls.reset()
    var p = Person.create({firstName: 'John', lastName: 'Smith'})
    expect(mixinSpy.calls.argsFor(0)[0].foo).toEqual('bar')
    expect(p.fullName).toBe('John Smith')
  })
})

describe('A Mixin being used in a Model', function () {
  const { Model, Mixin } = require('..')

  it('should trigger the \'use\' event', function () {
    const MixinA = Mixin('A')

    let mixin = new MixinA()
    let spy = jasmine.createSpy()

    MixinA.$on('use', spy)
    mixin.$on('use', spy)

    const ModelA = Model('A').use(mixin)

    expect(spy).toHaveBeenCalled()
    expect(spy.calls.count()).toEqual(2)
    expect(spy.calls.argsFor(0)[0]).toEqual(jasmine.any(MixinA))
    expect(spy.calls.argsFor(0)[1]).toEqual(ModelA)
    expect(spy.calls.argsFor(1)[0]).toEqual(ModelA)
  })

  it('cannot be reused a second time in the same model', function () {
    const MixinA = Mixin('A')

    let mixin = new MixinA()
    let otherMixin = new MixinA()
    let spy = jasmine.createSpy()

    MixinA.$on('use', spy)
    mixin.$on('use', spy)

    var createModel = function () {
      var ModelA = Model('A') // eslint-disable-line no-unused-vars
        .use(mixin)
        .use(otherMixin)
    }

    expect(createModel).toThrow()
  })
})

describe('A Mixin used in another mixin', function () {
  const { Model, Mixin } = require('..')
  const mixinSpy = jasmine.createSpy()

  var NameMixin = Mixin('NameMixin')
      .derive('fullName', function (mixin) {
        mixinSpy(mixin)
        return this.firstName + ' ' + this.lastName
      })

  var IntermediateMixin = Mixin('Middleman')
      .use(new NameMixin({foo: 'bar'}))

  var Person = Model('Person')
      .attributes({
        firstName: String,
        lastName: String,
        birthdate: Date
      })
      .use(new IntermediateMixin())

  it('should be able to derive dynamic properties just-in-time', function () {
    var person = new Person({
      firstName: 'John',
      lastName: 'Smith',
      birthdate: 527832000000
    })

    expect(person.fullName).toEqual('John Smith')
  })

  it('should pass mixin instance down to derived property getters', function () {
    var person = new Person({
      firstName: 'John',
      lastName: 'Smith',
      birthdate: 527832000000
    })

    person.fullName // eslint-disable-line no-unused-expressions
    expect(mixinSpy.calls.argsFor(0)[0].foo).toEqual('bar')
  })
})

describe('A Mixin used in another mixin dynamically', function () {
  const { Model, Mixin } = require('..')
  const mixinSpy = jasmine.createSpy()

  var NameMixin = Mixin('NameMixin')
      .derive('fullName', function (mixin) {
        mixinSpy(mixin)
        return this.firstName + ' ' + this.lastName
      })

  var IntermediateMixin = Mixin('Middleman')
      .use(function () {
        return new NameMixin({foo: this.param})
      })

  var Person = Model('Person')
      .attributes({
        firstName: String,
        lastName: String,
        birthdate: Date
      })
      .use(new IntermediateMixin({param: 'bar'}))

  it('should be able to derive dynamic properties just-in-time', function () {
    var person = new Person({
      firstName: 'John',
      lastName: 'Smith',
      birthdate: 527832000000
    })

    expect(person.fullName).toEqual('John Smith')
  })

  it('should pass mixin instance down to derived property getters', function () {
    var person = new Person({
      firstName: 'John',
      lastName: 'Smith',
      birthdate: 527832000000
    })

    person.fullName // eslint-disable-line no-unused-expressions
    expect(mixinSpy.calls.argsFor(0)[0].foo).toEqual('bar')
  })
})
