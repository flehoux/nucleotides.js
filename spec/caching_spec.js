describe("A Model with cached derived properties", function () {
  var Model = require('../src/model')

  var spies = {
    lazy: jasmine.createSpy().and.returnValue("lazily evaluated"),
    eager: jasmine.createSpy().and.returnValue("eagerly evaluated"),
    specificLazy: jasmine.createSpy().and.returnValue("lazily evaluated")
  }

  var Person = Model("Person")
      .fields({
        firstName: String,
        lastName: String,
        birthdate: { type: Date }
      })
      .derive("lazy", {cached: true}, spies.lazy)
      .derive("eager", {cached: true, eager: true}, spies.eager)
      .derive("specificLazy", {cached: ['firstName']}, spies.specificLazy)

  beforeEach(function (done) {
    spies.lazy.calls.reset()
    spies.eager.calls.reset()
    spies.specificLazy.calls.reset()
    done()
  })

  it("should be able to derive lazy properties only when needed", function () {
    var person = new Person({
      firstName: "John",
      lastName: "Smith",
      birthdate: 527832000000
    })

    expect(spies.lazy).not.toHaveBeenCalled()
    expect(person.lazy).toEqual("lazily evaluated")
    expect(spies.lazy).toHaveBeenCalled()

    person.firstName = "Larry"
    spies.lazy.calls.reset()

    expect(spies.lazy).not.toHaveBeenCalled()
    expect(person.lazy).toEqual("lazily evaluated")
    expect(spies.lazy).toHaveBeenCalled()
  })

  it("should be able to invalidate cached lazy properties", function () {
    var person = new Person({
      firstName: "John",
      lastName: "Smith",
      birthdate: 527832000000
    })

    expect(person.lazy).toEqual("lazily evaluated")
    expect(spies.lazy).toHaveBeenCalled()

    spies.lazy.calls.reset()
    person.firstName = "Larry"

    expect(spies.lazy).not.toHaveBeenCalled()
    expect(person.lazy).toEqual("lazily evaluated")
    expect(spies.lazy).toHaveBeenCalled()
  })

  it("should be able to eagerly derive and cache dynamic properties", function () {
    var person = new Person({
      firstName: "John",
      lastName: "Smith",
      birthdate: 527832000000
    })

    expect(spies.eager).toHaveBeenCalled()
    spies.eager.calls.reset()
    expect(person.eager).toEqual("eagerly evaluated")
    expect(spies.eager).not.toHaveBeenCalled()
  })

  it("should be able to eagerly derive and cache dynamic properties", function () {
    var person = new Person({
      firstName: "John",
      lastName: "Smith",
      birthdate: 527832000000
    })

    spies.eager.calls.reset()
    person.firstName = 'Larry'

    expect(spies.eager).toHaveBeenCalled()
    spies.eager.calls.reset()
    expect(person.eager).toEqual("eagerly evaluated")
    expect(spies.eager).not.toHaveBeenCalled()
  })

  it("should be able to invalidate cached lazy properties only when dependencies are changed", function () {
    var person = new Person({
      firstName: "John",
      lastName: "Smith",
      birthdate: 527832000000
    })

    expect(spies.specificLazy).not.toHaveBeenCalled()
    expect(person.specificLazy).toEqual("lazily evaluated")
    expect(spies.specificLazy).toHaveBeenCalled()

    spies.specificLazy.calls.reset()
    person.firstName = "Larry"

    expect(spies.specificLazy).not.toHaveBeenCalled()
    expect(person.specificLazy).toEqual("lazily evaluated")
    expect(spies.specificLazy).toHaveBeenCalled()

    spies.specificLazy.calls.reset()
    person.lastName = "Larry"

    expect(spies.specificLazy).not.toHaveBeenCalled()
    expect(person.specificLazy).toEqual("lazily evaluated")
    expect(spies.specificLazy).not.toHaveBeenCalled()
  })
})
