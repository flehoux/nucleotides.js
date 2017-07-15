const Protocol = require('../protocol')

const Collectable = Protocol('Collectable')
  .method('prepareCollection')
  .method('prepareElement')

module.exports = Collectable
