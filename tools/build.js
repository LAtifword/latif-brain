#!/usr/bin/env node
const webpack = require('webpack');
const config = require('../webpack.config.js');

console.log('Building LATIF...');
webpack(config, (err, stats) => {
  if (err) {
    console.error('Build failed:', err);
    process.exit(1);
  }
  console.log(stats.toString());
  console.log('✓ Build complete');
});
