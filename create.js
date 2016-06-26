const path = require('path');
const creator = require('./create_sprite_sheet');

creator({
  srcPath: path.resolve(__dirname, 'test-vids', 'test.mov'),
  outPath: path.resolve(__dirname, 'output', 'test'),
  sheetWidthMax: 720*2,
  sheetHeightMax: 405*2,
  fps: 24,
  frameWidth: 720,
  quality: '60%'
}).then(()=>{console.log('finished:vid')});
