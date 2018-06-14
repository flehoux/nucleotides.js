# nucleotides.js

Agnostic and extensible model framework

![Travis](https://travis-ci.com/n9s/nucleotides.svg?branch=master)

---

## Quick overview

```javascript
import {Mixin, Model} from "@n9s/core";

var GenealogyMixin = Mixin("Genealogy")
  .derive("parents", function (mixin) {
    // implement getting the parents of `this`
  })
  .derive("children", function (mixin) {
    // implement getting the children of `this`
  })
  .derive("siblings", {eager: true}, function (mixin) {
    // implement getting the siblings of `this`
  });

var LocalStorageMixin = Mixin("LocalStorage")
  .findOne(function(mixin, searchArgs, promise) {
    // Implement a getter for finding an item from the main key
  })
  .findMany(function(mixin, searchArgs, promise) {
    // Implement a getter for finding items from other criterias
  })
  .store(function(mixin, difference, promise) {
    // Implement how to store a object (as `this`), optionally using the difference
  })

var Person = Model("Person")
  .attributes({
    nas: {require: true, type: String},
    firstname: {require: true, type: String},
    lastname: {require: true, type: String},
    birthdate: Date,
    parentsNas: [String],
    gender: {type: String, accept: ["M", "F"]}
  })
  .derive("fullname", function() { return this.firstname + " " + this.lastname; })
  .use(new GenealogyMixin({parentKey: "nas", childKey: "parentsNas"}))
  .use(new LocalStorageMixin({key: "nas", prefix: "people"}))
```

### Global event handlers

```javascript
Person.on('new', function () { console.log("New instance of Person created!") });
Person.on('change', function () { console.log("One of the instances of Person changed!") });

var john = Person.create({nas: "555", firstname: "John", lastname: "Smith", birthdate: new Date(), gender: "R"});
var mary = Person.create({nas: "666", firstname: "Mary", lastname: "Smith", birthdate: new Date(), gender: "F", parentsNas: ["555"]});
var peter = Person.create({nas: "777", firstname: "Peter", lastname: "Smith", birthdate: new Date(), gender: "M", parentsNas: ["555"]});
```

### Validation

```javascript
john.$isValid
// ==> false

john.$errors
// ==> {"gender": "invalid"}
```

### Using mixin-defined properties

```javascript
mary.parents
// ==> [Person{nas: "555", firstname: "John", ...}]

john.children
// ==> [Person{nas: "666", ...}, Person{nas: "777", ...}]

// Object lifecycle hooks

john.$on('change', function (difference) { console.log(this.fullname + " changed " + Objects.keys(difference)[0]) });

john.firstname = "Johnny"
// ==> One of the instances of Person changed!
// ==> Johnny Smith changed firstname
```

## Testing

With node.js installed

```javascript
$ npm i --dev
$ npm test
```

## Contributing

If you want to improve the nucleotides library, add functionality or improve the docs please feel free to submit a PR. Ensure you run and adapt tests if you do so.

## License

[MIT License](LICENSE) @ [matehat](github.com/matehat)
