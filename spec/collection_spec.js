/* global describe it expect jasmine */

describe('A Collection of a simple model', function () {
  const {Model, Protocol} = require('..')
  const Collection = require('../src/collection')

  const Person = Model('Person')
    .set(Protocol.Identifiable.idKey, 'id')
    .attributes({
      id: String,
      name: String,
      age: Number
    })

  it('automatically cast its items to the set model', function () {
    var coll = Collection.create(Person, {age: '25', name: 'John Smith'})
    expect(coll.$model).toBe(Person)
    expect(coll[0]).toEqual(jasmine.any(Person))
    expect(coll[0].age).toBe(25)
  })

  it('automatically cast added items to the set model', function () {
    var coll = Collection.create(Person)
    coll.push({age: '25', name: 'John Smith'}, {age: '26', name: 'Larry Smith'})
    expect(coll[0]).toEqual(jasmine.any(Person))
    expect(coll[0].age).toBe(25)
    expect(coll[1]).toEqual(jasmine.any(Person))
    expect(coll[1].age).toBe(26)
    expect(coll.length).toBe(2)
    coll.$clear()

    coll.unshift({age: '25', name: 'John Smith'})
    expect(coll[0]).toEqual(jasmine.any(Person))
    expect(coll[0].age).toBe(25)
    expect(coll.length).toBe(1)

    coll.splice(0, 1, {age: '26', name: 'Larry Smith'})
    expect(coll[0]).toEqual(jasmine.any(Person))
    expect(coll[0].age).toBe(26)
    expect(coll.length).toBe(1)
  })

  it('automatically maintain a map of items by their key', function () {
    var coll = Collection.create(Person)
    coll.push(
      {age: '25', name: 'John Smith', id: '1'},
      {age: '26', name: 'Larry Smith', id: '2'}
    )

    expect(coll.$byKey['1']).toBe(coll[0])
    expect(coll.$byKey['2']).toBe(coll[1])
  })

  it("should respond to whether an item is present, using it's id", function () {
    var coll = Person.createCollection()
    let johny = new Person({id: '5', name: 'Johny $', age: 54})
    expect(coll.$has(johny)).toBe(false)
    coll.push(johny)
    expect(coll.$has(johny)).toBe(true)
    coll.$clear()
    expect(coll.$has(johny)).toBe(false)
  })

  it("should get item contained in it using it's id", function () {
    var coll = Person.createCollection()
    let johny = new Person({id: '5', name: 'Johny $', age: 54})
    coll.push(johny)
    expect(coll.$get('5')).toBe(johny)
  })

  it("should update items contained in it, using it's id", function () {
    var coll = Person.createCollection()
    let johny = new Person({id: '5', name: 'Johny $', age: 54})
    coll.push(johny.$clean)
    expect(coll.$has(johny)).toBe(true)
    johny.age = 45
    coll.$update(johny)
    expect(johny.$clean).toEqual(coll[0].$clean)
  })

  it("should update items in-place contained in it, using it's id", function () {
    var coll = Person.createCollection()
    let johny = new Person({id: '5', name: 'Johny $', age: 54})
    coll.push(johny.$clean)
    let copy = coll[0]
    expect(coll.$has(johny)).toBe(true)
    johny.age = 45
    coll.$update(johny)
    expect(johny).not.toBe(coll[0])
    expect(copy).toBe(coll[0])
    expect(johny.$clean).toEqual(coll[0].$clean)
  })

  it("should replace items contained in it, using it's id", function () {
    var coll = Person.createCollection()
    let johny = new Person({id: '5', name: 'Johny $', age: 54})
    coll.push(johny.$clean)
    let copy = coll[0]
    expect(coll.$has(johny)).toBe(true)
    johny.age = 45
    coll.$put(johny)
    expect(johny).toBe(coll[0])
    expect(copy).not.toBe(coll[0])
    expect(johny.$clean).toEqual(coll[0].$clean)
  })

  it("should remove items contained in it, using it's id", function () {
    var coll = Person.createCollection()
    let johny = new Person({id: '5', name: 'Johny $', age: 54})
    coll.push(johny.$clean)
    coll.$remove(johny)
    expect(coll.length).toBe(0)
  })

  it('should provide a clean representation of all items', function () {
    let coll = Person.createCollection()
    let items = [
      {age: 25, name: 'John Smith', id: '1'},
      {age: 26, name: 'Larry Smith', id: '2'},
      {age: 27, name: 'Mary Smith', id: '3'},
      {age: 28, name: 'Kary Smith', id: '4'}
    ]
    coll.push(...items)
    expect(coll.$clean).toEqual(items)
  })

  it('should replace as many items as possible in-place when changing all content', function () {
    let items = [
      {age: 25, name: 'John Smith', id: '1'},
      {age: 26, name: 'Larry Smith', id: '2'},
      {age: 27, name: 'Mary Smith', id: '3'},
      {age: 28, name: 'Kary Smith', id: '4'}
    ]
    let coll = Person.createCollection(...items)
    let [john, larry, mary] = coll
    coll.$updateAll([
      {age: 35, name: 'John Smith', id: '1'},
      {age: 57, name: 'Mary Smith', id: '3'},
      {age: 46, name: 'Larry Smith', id: '2'}
    ])
    expect(coll[0]).toBe(john)
    expect(john.age).toBe(35)

    expect(coll[1]).toBe(mary)
    expect(mary.age).toBe(57)

    expect(coll[2]).toBe(larry)
    expect(larry.age).toBe(46)

    expect(coll[3]).toBeUndefined()
  })
})
