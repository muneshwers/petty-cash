const path = require('path')

module.exports = {
    entry : './javascript/index.js',
    output : {
        path : path.resolve(__dirname, 'dist'),
        filename : 'bundle.js',
    }
}