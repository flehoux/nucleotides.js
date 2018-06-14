/* global describe it expect jasmine */

describe('A simple Model augmented using the AutoUpdate Mixin', function () {
  const {Model, Protocol, Mixin} = require('../..')

  const storage = {}
  var i = 0
  var getNewId = () => `${++i}`

  const Person = Model('Person')
    .attributes({
      firstName: String,
      lastName: String,
      age: Number,
      nas: String,
      emails: [String]
    })
    .set(Protocol.Identifiable.idKey, 'nas')
    .implement(Protocol.Queryable.store, function (flow) {
      storage[this.nas] = this.$clean
      flow.resolve(new Protocol.Queryable.Success(true))
    })
    .implement(Protocol.Queryable.findOne, function (flow, nas) {
      flow.resolve(new Protocol.Queryable.Success(storage[nas]))
    })
    .derive('fullName', function () { return this.firstName + ' ' + this.lastName })
    .use(new Mixin.AutoUpdate({}))

  it('should propagate saved updates to objects sharing the same ID', function (done) {
    let id = getNewId()
    let inst1 = Person.new({ firstName: 'John', lastName: 'Smith', nas: id })

    expect(inst1.$isNew).toBe(true)
    inst1.$save().then(function () {
      expect(inst1.$isNew).toBe(false)
      Person.findOne(id).then(function (inst2) {
        expect(inst2.fullName).toBe('John Smith')
        inst2.$autoUpdate()
        inst1.firstName = 'Larry'
        inst1.$save().then(function () {
          expect(inst2.fullName).toBe('Larry Smith')
          delete storage[id]
          done()
        })
      })
    })
  })

  it('should propagate saved updates to collections containing objects sharing the same ID', function (done) {
    let id = getNewId()
    let inst1 = Person.new({ firstName: 'John', lastName: 'Smith', nas: id })

    expect(inst1.$isNew).toBe(true)
    inst1.$save().then(function () {
      expect(inst1.$isNew).toBe(false)
      Person.findOne(id).then(function (inst2) {
        expect(inst2.fullName).toBe('John Smith')
        let people = Person.createCollection([inst2])
        people.$autoUpdate()
        inst1.firstName = 'Larry'
        inst1.$save().then(function () {
          expect(people[0].fullName).toBe('Larry Smith')
          delete storage[id]
          done()
        })
      })
    })
  })

  it('should stop propagating saved updates to objects after calling the unregister() callback', function (done) {
    let id = getNewId()
    let inst1 = Person.new({ firstName: 'John', lastName: 'Smith', nas: id })

    expect(inst1.$isNew).toBe(true)
    inst1.$save().then(function () {
      expect(inst1.$isNew).toBe(false)
      Person.findOne(id).then(function (inst2) {
        expect(inst2.fullName).toBe('John Smith')
        let unlisten = inst2.$autoUpdate()
        unlisten()
        inst1.firstName = 'Larry'
        inst1.$save().then(function () {
          expect(inst2.fullName).toBe('John Smith')
          delete storage[id]
          done()
        })
      })
    })
  })

  it('should stop propagating saved updates to collection after calling the unregister() callback', function (done) {
    let id = getNewId()
    let inst1 = Person.new({ firstName: 'John', lastName: 'Smith', nas: id })

    expect(inst1.$isNew).toBe(true)
    inst1.$save().then(function () {
      expect(inst1.$isNew).toBe(false)
      Person.findOne(id).then(function (inst2) {
        expect(inst2.fullName).toBe('John Smith')
        let people = Person.createCollection([inst2])
        let unlisten = people.$autoUpdate()
        unlisten()
        inst1.firstName = 'Larry'
        inst1.$save().then(function () {
          expect(people[0].fullName).toBe('John Smith')
          delete storage[id]
          done()
        })
      })
    })
  })

  it('should not propagate saved updates to objects if callback returns false', function (done) {
    let id = getNewId()
    let inst1 = Person.new({ firstName: 'John', lastName: 'Smith', nas: id })

    expect(inst1.$isNew).toBe(true)
    inst1.$save().then(function () {
      expect(inst1.$isNew).toBe(false)
      Person.findOne(id).then(function (inst2) {
        expect(inst2.fullName).toBe('John Smith')
        inst2.$autoUpdate(function ({firstName}) {
          return firstName.slice(0, 1) !== 'L'
        })
        inst1.firstName = 'Larry'
        inst1.$save().then(function () {
          expect(inst2.fullName).toBe('John Smith')
          inst1.firstName = 'Bob'
          inst1.$save().then(function () {
            expect(inst2.fullName).toBe('Bob Smith')
            delete storage[id]
            done()
          })
        })
      })
    })
  })

  it('should remove collection item if collection.matches(item) returns false', function (done) {
    let id = getNewId()
    let inst1 = Person.new({ firstName: 'John', lastName: 'Smith', nas: id })

    expect(inst1.$isNew).toBe(true)
    inst1.$save().then(function () {
      expect(inst1.$isNew).toBe(false)
      Person.findOne(id).then(function (inst2) {
        expect(inst2.fullName).toBe('John Smith')

        let people = Person.createCollection([inst2])
        expect(inst2).toBe(people[0])
        people.$autoUpdate()
        people.$addFilter(() => false)
        inst1.$save().then(function () {
          expect(people.length).toBe(0)
          done()
        })
      })
    })
  })

  it('should add item to collection if callback returns true', function (done) {
    let id = getNewId()
    let inst1 = Person.new({ firstName: 'John', lastName: 'Smith', nas: id })

    expect(inst1.$isNew).toBe(true)
    inst1.$save().then(function () {
      expect(inst1.$isNew).toBe(false)
      let people = Person.createCollection()
      people.$autoUpdate()
      people.$addFilter(() => true)
      inst1.$save().then(function () {
        expect(people.length).toBe(1)
        expect(people[0].$clean).toEqual(inst1.$clean)
        done()
      })
    })
  })

  it('should remove collection item if collection.matches(item) returns false', function (done) {
    let id = getNewId()
    let inst1 = Person.new({ firstName: 'John', lastName: 'Smith', nas: id })

    expect(inst1.$isNew).toBe(true)
    inst1.$save().then(function () {
      expect(inst1.$isNew).toBe(false)
      Person.findOne(id).then(function (inst2) {
        expect(inst2.fullName).toBe('John Smith')

        let people = Person.createCollection([inst2])
        expect(inst2).toBe(people[0])
        people.$autoUpdate()
        people.$addFilter(() => true)
        inst1.firstName = 'Larry'
        inst1.$save().then(function () {
          expect(people.length).toBe(1)
          expect(people[0].fullName).toBe('Larry Smith')
          done()
        })
      })
    })
  })

  it('should not propagate saved updates to objects if callback yields false asynchronously', function (done) {
    let id = getNewId()
    let inst1 = Person.new({ firstName: 'John', lastName: 'Smith', nas: id })

    expect(inst1.$isNew).toBe(true)
    inst1.$save().then(function () {
      expect(inst1.$isNew).toBe(false)
      Person.findOne(id).then(function (inst2) {
        expect(inst2.fullName).toBe('John Smith')
        inst2.$autoUpdate(function ({firstName}) {
          return new Promise(function (resolve) {
            resolve(firstName.slice(0, 1) !== 'L')
          })
        })
        inst1.firstName = 'Larry'
        inst1.$save().then(function () {
          expect(inst2.fullName).toBe('John Smith')
          inst1.firstName = 'Bob'
          inst1.$save().then(function () {
            expect(inst2.fullName).toBe('Bob Smith')
            delete storage[id]
            done()
          })
        })
      })
    })
  })

  it('should trigger \'update\' events on other objects sharing the same ID', function (done) {
    let id = getNewId()
    let inst1 = Person.new({firstName: 'John', lastName: 'Smith', nas: id})
    let spy = jasmine.createSpy()

    expect(inst1.$isNew).toBe(true)
    inst1.$save().then(function () {
      expect(inst1.$isNew).toBe(false)
      Person.findOne(id).then(function (inst2) {
        expect(inst2.fullName).toBe('John Smith')
        inst2.$autoUpdate()
        inst2.$on('update', spy)
        inst1.firstName = 'Larry'
        inst1.$save().then(function () {
          expect(spy.calls.count()).toBe(1)
          expect(spy.calls.argsFor(0)[0].firstName.currentValue).toBe('Larry')
          expect(inst2.firstName).toBe('Larry')

          inst2.firstName = 'John'
          spy.calls.reset()

          inst2.$save().then(function () {
            expect(spy.calls.count()).toBe(0)
            delete storage[id]
            done()
          })
        })
      })
    })
  })
})
