'use strict';

const path = require('path');
const fs = require('fs-extra');
const spawn = require('child_process').spawn;
const promisify = require('es6-promisify');

const stat_p = promisify(fs.stat);
const copy_p = promisify(fs.copy);
const remove_p = promisify(fs.remove);
const readdir_p = promisify(fs.readdir);
const emptyDir_p = promisify(fs.emptyDir);
const writeJson_p = promisify(fs.writeJson);

const EMPTY_FN = () => {};

const RX_FFMPEG_FRAME_PROGRESS = /frame=\s*(\d+)/;
const RX_FFMPEG_TIME_PROGRESS = /time=\s*([\d:\.]+)/;

const Defaults = {
  srcPath: '',
  outPath: '',

  sheetWidthMax: 1920,
  sheetHeightMax: 1080,
  fps: 24,
  quality: '60%',
  frameWidth: 720,

  frameFilenameNumberWidth: 6,

  spriteFilenameNumberWidth: 4,
  spriteFilenamePrefix: ''
};

function setupDirs ({opts}) {
  return Promise.all([
    emptyDir_p(opts.framesDir),
    emptyDir_p(opts.spritesDir)
  ]);
}

function getVideoInfo ({ opts, src, sprite }) {
  return new Promise((resolve, reject) => {
    var buffer = '';
    const ffprobe = spawn('ffprobe', [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_streams',
      opts.srcPath
    ]);

    ffprobe.stdout.on('data', (data) => {
      buffer += data;
    });

    ffprobe.on('close', (code) => {
      console.log(`ffprobe exited with code ${code}`);
      const probeInfo = JSON.parse(buffer);
      const videoInfo = probeInfo.streams.find((stream) => { return stream.codec_type === 'video'});

      // src video props
      src.width = videoInfo.width;
      src.height = videoInfo.height;
      src.duration = parseFloat(videoInfo.duration);

      // sprite props
      sprite.scale = opts.frameWidth / src.width;
      sprite.cols = Math.floor(opts.sheetWidthMax / (src.width * sprite.scale));
      sprite.rows = Math.floor(opts.sheetHeightMax / (src.height * sprite.scale));

      resolve();
    });
  });
}

function getImageInfo (imagePath) {
  return new Promise((resolve, reject) => {
    var buffer = '';
    const identify = spawn('identify', [
      '-format', '%[fx:w]x%[fx:h]',
      imagePath
    ]);

    identify.stdout.on('data', (data) => {
      buffer += data;
    });

    identify.on('close', (code) => {
      console.log(`identify exited with code ${code}`);
      const [w, h] = buffer.split('x');
      resolve({
        width: parseInt(w),
        height: parseInt(h)
      });
    });
  });
}

function extractFrames ({ opts, src, sprite }, onProgress=EMPTY_FN) {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', [
      '-v', 'info',
      '-stats',
      '-nostdin',
      '-i', opts.srcPath,
      '-vf',
      `scale=${opts.frameWidth}:-1`,
      '-r', opts.fps,
      path.join(opts.framesDir, `%0${opts.frameFilenameNumberWidth}d.png`)
    ]);

    ffmpeg.stderr.on('data', (data) => {
      const frameProgMatch = RX_FFMPEG_FRAME_PROGRESS.exec(data.toString());
      if (frameProgMatch && frameProgMatch[1]) {
        const frame = frameProgMatch[1];
        const prog = Math.min(frame/(src.duration*opts.fps), 1);  // limit prog to 1
        onProgress(prog);
      }
    });

    ffmpeg.on('close', (code) => {
      console.log(`ffmpeg exited with code ${code}`);
      if (code === 0) {
        readdir_p(opts.framesDir).then(files => {
          sprite.frames = files.length;
          getImageInfo(path.join(opts.framesDir, files[0])).then(({width, height}) => {
            sprite.frameWidth = width;
            sprite.frameHeight = height;
            resolve();
          });
        });
      }
      else {
        reject();
      }
    });
  });
}

function stitchTogetherFrames ({opts, sprite}) {
  return new Promise((resolve, reject) => {
    const montage = spawn('montage', [
      '-border', '0',
      '-geometry', `${opts.frameWidth}x`,
      '-tile', `${sprite.cols}x${sprite.rows}`,
      '-quality', opts.quality,
      path.join(opts.framesDir, '*.png'),
      path.join(opts.spritesDir, `${opts.spriteFilenamePrefix}%0${opts.spriteFilenameNumberWidth}d.jpg`)
    ]);

    montage.stderr.on('data', (data) => {
      console.log(`montage error: ${data}`);
    });

    montage.on('close', (code) => {
      console.log(`montage exited with code ${code}`);
      resolve();
    });
  });
}

function extractPoster ({opts}) {
  return new Promise((resolve, reject) => {
    const convert = spawn('convert', [
      '-geometry', '-1x-1',
      '-quality', '80%',
      path.join(opts.framesDir, `${new Array(opts.frameFilenameNumberWidth).join('0')}1.png`),
      path.join(opts.spritesDir, 'poster.jpg')
    ]);

    convert.stderr.on('data', (data) => {
      console.log(`convert error: ${data}`);
    });

    convert.on('close', (code) => {
      console.log(`convert exited with code ${code}`);
      resolve();
    });
  });
}

function writeStats (data) {
  return writeJson_p(path.join(data.opts.spritesDir, 'info.json'), data);
}

function cleanUp ({opts}) {
  return remove_p(opts.framesDir);
}

module.exports = function (options = {}) {
  const opts = Object.assign({}, Defaults, options);

  const data = {
    opts,
    src: {},
    sprite: {}
  };

  opts.framesDir = path.resolve(opts.outPath, '_frames');
  opts.spritesDir = opts.outPath;

  return setupDirs(data)
    .then(() => getVideoInfo(data))
    .then(() => extractFrames(data, (prog) => console.log(prog)))
    .then(() => stitchTogetherFrames(data))
    .then(() => extractPoster(data))
    .then(() => writeStats(data))
    .then(() => cleanUp(data))
    .catch((err) => console.log(err));
}
