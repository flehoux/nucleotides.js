# nucleotides.js

Agnostic and extensible organization of state

![Travis](https://travis-ci.org/matehat/nucleotides.js.svg?branch=master)

---

## Quick overview

```javascript
import {Mixin, Model} from "nucleotides";

var GenealogyMixin = new Mixin("Genealogy")
  .derive("parents", function (mixin) {
    // implement getting the parents of `this`
  })
  .derive("children", function (mixin) {
    // implement getting the children of `this`
  })
  .derive("siblings", {lazy: true}, function (mixin) {
    // implement getting the siblings of `this`
  });

var LocalStorageMixin = new Mixin("LocalStorage")
  .findOne(function(mixin, searchArgs, promise) {
    // Implement a getter for finding an item from the main key
  })
  .findMany(function(mixin, searchArgs, promise) {
    // Implement a getter for finding items from other criterias
  })
  .store(function(mixin, difference, promise) {
    // Implement how to store a object (as `this`), optionally using the difference
  })

var Person = new Model("Person")
  .fields({
    nas: {require: String},
    firstname: {require: String},
    lastname: {require: String},
    birthdate: Date,
    parentsNas: [String],
    gender: {require: ["M", "F"]}
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

MIT License

Copyright (c) 2017 Mathieu D'Amours

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
