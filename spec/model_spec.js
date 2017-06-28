describe("A Model with simple fields and derived properties", function () {
  const { Model } = require('..')

  var Person = Model("Person")
      .fields({
        firstName: String,
        lastName: String,
        birthdate: Date
      })
      .derive("fullName", function() { return this.firstName + ' ' + this.lastName })

  it("should hold valid data with respect to field definition", function () {
    var person = new Person({
      firstName: "John",
      lastName: "Smith",
      birthdate: 527832000000
    })

    expect(person.firstName).toEqual(jasmine.any(String))
    expect(person.lastName).toEqual(jasmine.any(String))
    expect(person.birthdate).toEqual(new Date(1986, 8, 23))
  })

  it("should be able to derive dynamic properties just-in-time", function () {
    var person = new Person({
      firstName: "John",
      lastName: "Smith",
      birthdate: 527832000000
    })

    expect(person.fullName).toEqual("John Smith")
  })
})
