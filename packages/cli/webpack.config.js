/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
const path = require('path')
const webpack = require('webpack')
module.exports = {
  mode: 'development', // production minification results in bad error stacks
  target: 'node',
  entry: './dist/src/main.js',
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'dist'),
  },
  context: path.resolve(__dirname),
  module: {
    rules: [
      {
        test: /\.js$/,
        use: ['source-map-loader'],
        enforce: 'pre',
      },
      {
        test: /\.template$/i,
        use: 'raw-loader',
      },
      {
        test: /\.xml$/i,
        use: 'raw-loader',
      },
      {
        test: /@oracle\/suitecloud-cli-localserver-command/i,
        use: 'null-loader',
      },
    ],
  },
  node: {
    __dirname: false,
    __filename: true,
  },
  stats: {
    warningsFilter: [
      /node_modules\/yargs/, // Ignore warnings due to yarg's dynamic module loading
    ],
  },
  plugins: [
    new webpack.EnvironmentPlugin({
      // SALTO_TELEMETRY_TOKEN should be defined in the build system, i.e. circleci
      SALTO_TELEMETRY_TOKEN: 'dev',
      SALTO_TELEMETRY_DISABLE: '0',
      SALTO_TELEMETRY_URL: 'https://telemetry.salto.io',
    }),
    // // This plugin fixes __dirname and __filename references from sibling
    // // projects in the monorepo. However it conflicts with nexe packaging so
    // // it is not used for now. Kept here for documentation purposes.
    // {
    //   apply(compiler) {
    //     function setModuleConstant(expressionName, fn) {
    //       compiler.hooks.normalModuleFactory.tap('MyPlugin', factory => {
    //         factory.hooks.parser.for('javascript/auto').tap('MyPlugin', (parser, _options) => {
    //           parser.hooks.expression.for(expressionName).tap('MyPlugin', _expression => {
    //             parser.state.current.addVariable(expressionName, JSON.stringify(fn(parser.state.module)))
    //             return true
    //           })
    //         })
    //       })
    //     }

    //     setModuleConstant('__filename', function (module) {
    //       return module.resource;
    //     });

    //     setModuleConstant('__dirname', function (module) {
    //       return module.context;
    //     });
    //   }
    // },
  ],
}
