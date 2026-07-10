/**
 * Webpack Configuration for LATIF
 * Builds browser bundle and Node.js distribution
 */

import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default (env, argv) => {
  const isDev = argv.mode === 'development';
  const isProduction = argv.mode === 'production';

  return [
    // Browser Bundle
    {
      name: 'browser',
      mode: isProduction ? 'production' : 'development',
      entry: './src/core/ai-core.js',
      output: {
        path: path.resolve(__dirname, 'dist/browser'),
        filename: 'latif.js',
        library: {
          type: 'umd',
          name: 'LATIF'
        },
        globalObject: 'typeof self !== "undefined" ? self : this'
      },
      module: {
        rules: [
          {
            test: /\.js$/,
            exclude: /node_modules/,
            use: {
              loader: 'babel-loader',
              options: {
                presets: ['@babel/preset-env'],
                plugins: [
                  '@babel/plugin-proposal-class-properties',
                  '@babel/plugin-proposal-optional-chaining'
                ]
              }
            }
          }
        ]
      },
      devtool: isDev ? 'source-map' : false,
      externals: {},
      optimization: {
        minimize: isProduction,
        minimizer: [
          (compiler) => {
            // Custom minifier configuration
          }
        ]
      }
    },

    // Node.js Distribution
    {
      name: 'node',
      mode: isProduction ? 'production' : 'development',
      target: 'node',
      entry: './src/core/ai-core.js',
      output: {
        path: path.resolve(__dirname, 'dist/node'),
        filename: 'index.js',
        libraryTarget: 'commonjs2'
      },
      module: {
        rules: [
          {
            test: /\.js$/,
            exclude: /node_modules/,
            use: 'babel-loader'
          }
        ]
      },
      devtool: isDev ? 'source-map' : false,
      externals: {
        // Node.js built-ins
        fs: 'commonjs fs',
        path: 'commonjs path',
        http: 'commonjs http',
        https: 'commonjs https',
        'child_process': 'commonjs child_process'
      }
    },

    // API Server Bundle
    {
      name: 'api-server',
      mode: isProduction ? 'production' : 'development',
      target: 'node',
      entry: './src/api/rest-server.js',
      output: {
        path: path.resolve(__dirname, 'dist/api'),
        filename: 'server.js',
        libraryTarget: 'commonjs2'
      },
      module: {
        rules: [
          {
            test: /\.js$/,
            exclude: /node_modules/,
            use: 'babel-loader'
          }
        ]
      },
      devtool: isDev ? 'source-map' : false,
      externals: {
        express: 'commonjs express',
        cors: 'commonjs cors',
        compression: 'commonjs compression',
        'pino': 'commonjs pino',
        'axios': 'commonjs axios'
      }
    }
  ];
};
