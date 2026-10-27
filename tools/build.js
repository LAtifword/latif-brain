#!/usr/bin/env node
import webpack from 'webpack';
import createConfig from '../webpack.config.js';

console.log('Building LATIF...');
const config = createConfig({}, { mode: 'production' });
webpack(config, (err, stats) => {
  if (err || stats.hasErrors()) {
    console.error('Build failed:', err);
    if (stats) console.error(stats.toString({ all: false, errors: true, warnings: true }));
    process.exit(1);
  }
  console.log(stats.toString());
  console.log('✓ Build complete');
});
