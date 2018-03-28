/* global describe it expect jasmine fail */

describe('A model defined with a storage implementation', function () {
  const {Model, Protocol} = require('../..')
  var storage = {}

  const Person = Model('Person')
    .attributes({
      nas: String,
      firstName: String,
      lastName: String
    })
    .implement(Protocol.Queryable.store, function (flow) {
      storage[this.nas] = this.$clean
      flow.resolve(new Protocol.Queryable.Success())
    })
    .implement(Protocol.Queryable.findOne, function (flow, nas) {
      flow.resolve(new Protocol.Queryable.Success(storage[nas]))
    })
    .implement(Protocol.Queryable.findMany, function (flow, lastName) {
      let result = []
      for (let nas in storage) {
        let object = storage[nas]
        if (object.lastName === lastName) {
          result.push(object)
        }
      }
      flow.resolve(new Protocol.Queryable.Success(result))
    })
    .implement(Protocol.Queryable.remove, function (flow) {
      delete storage[this.nas]
      flow.resolve(new Protocol.Queryable.Success(true))
    })

  it('should be able to create an instance with Person.new()', function (done) {
    let object = Person.new({nas: '1', firstName: 'John', lastName: 'Smith'})
    expect(object.firstName).toBe('John')
    expect(object.$isNew).toBe(true)
    done()
  })

  it('should be able to create and store data for an instance with Person.create()', function (done) {
    Person.create({nas: '1', firstName: 'John', lastName: 'Smith'}).then(function (object) {
      expect(storage['1'].firstName).toBe('John')
      expect(storage['1']).not.toEqual(jasmine.any(Person))
      delete storage['1']
      done()
    })
  })

  it('should be able to retrieve an instance with Person.findOne()', function (done) {
    storage['2'] = {nas: '2', firstName: 'John', lastName: 'Smith'}
    Person.findOne('2').then(function (person) {
      expect(person.firstName).toBe('John')
      expect(person).toEqual(jasmine.any(Person))
      expect(person.$isNew).toBe(false)
      delete storage['2']
      done()
    })
  })

  it('should throw an error if no object can be found with Person.findOne()', function (done) {
    Person.findOne('asldkmasldkm').then(function () {
      fail('Should not succeed')
    }, function (err) {
      expect(err).toEqual(jasmine.any(Protocol.Queryable.Failure))
      expect(err.code).toBe(404)
      done()
    })
  })

  it('should be able to retrieve an instance with Person.findOne() if it\'s immediately available', function () {
    storage['3'] = {nas: '3', firstName: 'John', lastName: 'Smith'}
    let person = Person.findOne('3').$result
    expect(person).toEqual(jasmine.any(Person))
    expect(person.firstName).toBe('John')
    delete storage['3']
  })

  it('should be able to retrieve multiple instances with Person.findMany()', function (done) {
    Person.create({nas: '4', firstName: 'John', lastName: 'Smith'})
    Person.create({nas: '5', firstName: 'Larry', lastName: 'Smith'})
    Person.create({nas: '6', firstName: 'Mary', lastName: 'Mackenzie'})

    Person.findMany('Smith').then(function (people) {
      people.sort(function (a, b) {
        if (a.firstName < b.firstName) {
          return -1
        }
        return 1
      })

      expect(people.length).toBe(2)
      expect(people[0]).toEqual(jasmine.any(Person))
      expect(people[0].firstName).toBe('John')
      expect(people[1].firstName).toBe('Larry')

      delete storage['4']
      delete storage['5']
      delete storage['6']
      done()
    })
  })

  it('should be able to retrieve multiple instances immediately with Person.findMany() if they\'re available', function () {
    Person.create({nas: '4', firstName: 'John', lastName: 'Smith'})
    Person.create({nas: '5', firstName: 'Larry', lastName: 'Smith'})
    Person.create({nas: '6', firstName: 'Mary', lastName: 'Mackenzie'})

    let people = Person.findMany('Smith').$result
    people.sort(function (a, b) {
      if (a.firstName < b.firstName) {
        return -1
      }
      return 1
    })
    expect(people.length).toBe(2)
    expect(people[0].firstName).toBe('John')
    expect(people[1].firstName).toBe('Larry')

    delete storage['4']
    delete storage['5']
    delete storage['6']
  })

  it('should be able to retrieve multiple instances with Person.findMany()', function (done) {
    Person.create({nas: '4', firstName: 'John', lastName: 'Smith'})
    Person.create({nas: '5', firstName: 'Larry', lastName: 'Smith'})

    Person.findMany('Smith').then(function (people) {
      expect(people.length).toBe(2)
      people[0].$remove().then(function () {
        Person.findMany('Smith').then(function (people) {
          expect(people.length).toBe(1)
          delete storage['5']
          delete storage['6']
          done()
        })
      })
    })
  })
})

describe('A model using a mixin that defines a storage implementation', function () {
  const {Model, Mixin, Protocol} = require('../..')
  var storage = {}

  const StorageMixin = Mixin('Storage')
    .implement(Protocol.Queryable.store, function (mixin, flow) {
      storage[this[mixin.key]] = this.$clean
      flow.resolve(new Protocol.Queryable.Success(true))
    })
    .implement(Protocol.Queryable.findOne, function (mixin, flow, key) {
      flow.resolve(new Protocol.Queryable.Success(storage[key]))
    })
    .implement(Protocol.Queryable.findMany, function (mixin, flow, key) {
      let result = []
      for (let pkey in storage) {
        let object = storage[pkey]
        if (object[mixin.looseKey] === key) {
          result.push(object)
        }
      }
      flow.resolve(new Protocol.Queryable.Success(result))
    })
    .implement(Protocol.Queryable.remove, function (mixin, flow) {
      delete storage[this[mixin.key]]
      flow.resolve(new Protocol.Queryable.Success(true))
    })

  const Person = Model('Person')
    .attributes({
      nas: String,
      firstName: String,
      lastName: String
    })
    .use(new StorageMixin({key: 'nas', looseKey: 'lastName'}))

  it('should be able to create and store data for an instance with Person.create()', function (done) {
    Person.create({nas: '1', firstName: 'John', lastName: 'Smith'}).then(function (object) {
      expect(storage['1'].firstName).toBe('John')
      expect(storage['1']).not.toEqual(jasmine.any(Person))
      delete storage['1']
      done()
    })
  })

  it('should be able to retrieve an instance with Person.findOne()', function (done) {
    storage['2'] = {nas: '2', firstName: 'John', lastName: 'Smith'}
    Person.findOne('2').then(function (person) {
      expect(person.firstName).toBe('John')
      expect(person).toEqual(jasmine.any(Person))
      expect(person.$isNew).toBe(false)
      delete storage['2']
      done()
    })
  })

  it('should be able to retrieve an instance with Person.findOne() if it\'s immediately available', function () {
    storage['3'] = {nas: '3', firstName: 'John', lastName: 'Smith'}
    let person = Person.findOne('3').$result
    expect(person).toEqual(jasmine.any(Person))
    expect(person.firstName).toBe('John')
    delete storage['3']
  })

  it('should be able to retrieve multiple instances with Person.findMany()', function (done) {
    Person.create({nas: '4', firstName: 'John', lastName: 'Smith'})
    Person.create({nas: '5', firstName: 'Larry', lastName: 'Smith'})
    Person.create({nas: '6', firstName: 'Mary', lastName: 'Mackenzie'})

    Person.findMany('Smith').then(function (people) {
      people.sort(function (a, b) {
        if (a.firstName < b.firstName) {
          return -1
        }
        return 1
      })
      expect(people.length).toBe(2)
      expect(people[0]).toEqual(jasmine.any(Person))
      expect(people[0].firstName).toBe('John')
      expect(people[1].firstName).toBe('Larry')

      delete storage['4']
      delete storage['5']
      delete storage['6']
      done()
    })
  })

  it('should be able to retrieve multiple instances immediately with Person.findMany() if they\'re available', function () {
    Person.create({nas: '4', firstName: 'John', lastName: 'Smith'})
    Person.create({nas: '5', firstName: 'Larry', lastName: 'Smith'})
    Person.create({nas: '6', firstName: 'Mary', lastName: 'Mackenzie'})

    let people = Person.findMany('Smith').$result
    people.sort(function (a, b) {
      if (a.firstName < b.firstName) {
        return -1
      }
      return 1
    })
    expect(people.length).toBe(2)
    expect(people[0].firstName).toBe('John')
    expect(people[1].firstName).toBe('Larry')

    delete storage['4']
    delete storage['5']
    delete storage['6']
  })

  it('should be able to retrieve multiple instances with Person.findMany()', function (done) {
    Person.create({nas: '4', firstName: 'John', lastName: 'Smith'})
    Person.create({nas: '5', firstName: 'Larry', lastName: 'Smith'})

    Person.findMany('Smith').then(function (people) {
      expect(people.length).toBe(2)
      people[0].$remove().then(function () {
        Person.findMany('Smith').then(function (people) {
          expect(people.length).toBe(1)
          delete storage['5']
          delete storage['6']
          done()
        })
      })
    })
  })
})
