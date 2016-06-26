(function () {

  const States = {
    PLAYING: 'PLAYING'
  };

  const loadImage_p = function loadImage_p (src) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onerror = function (e) {
        reject(e);
      };
      image.onload = function () {
        resolve(image);
      };
      image.src = src;
    });
  };

  class CanvasPlayer {

    constructor (canvas, { spritePath='/sprites/city-low/_{n}.jpg', fps=12, rows=2, cols=2, numFrames=122 }) {
      this.canvas = canvas;
      this.ctx = this.canvas.getContext('2d');
      this.fps = fps;
      this.rows = rows;
      this.cols = cols;
      this.numFrames = numFrames;
      this.numSprites = Math.ceil(numFrames / (rows * cols));
      this.sprites = new Array(this.numSprites);

      this.playState = States.PLAYING;
      this.nextFrame = 0;
      this.lastFrameTime;

      this.step = this.step.bind(this);

      this.loadImages(spritePath)
        .then(this.onSpritesLoaded.bind(this));
    }

    loadImages (spritePath) {
      var srcs = [];
      for (var i = 0; i < this.numSprites; i++) {
        srcs[i] = spritePath.replace('{n}', i);
      }
      return Promise.all(srcs.map((src) => loadImage_p(src)))
        .then((sprites) => {
          this.sprites = sprites;
        });
    }

    onSpritesLoaded () {
      this.width = this.sprites[0].width / this.cols;
      this.height = this.sprites[0].height / this.rows;

      this.canvas.width = this.width;
      this.canvas.height = this.height;

      this.canvas.style.display = 'block';
      this.canvas.style.width = '80%';
      this.canvas.style.margin = '0 auto';

      requestAnimationFrame(this.step);
    }

    step (time) {
      requestAnimationFrame(this.step);

      if (typeof this.lastFrameTime === 'undefined' || time - this.lastFrameTime > 1000 / this.fps) {
        this.lastFrameTime = time;
        this.shiftFrame();
      }
    }

    shiftFrame () {
      // get frame num
      const frame = this.nextFrame++;
      this.nextFrame = (this.nextFrame < this.numFrames) ? this.nextFrame : 0;

      const spriteNum = Math.floor(frame / (this.rows * this.cols));
      const frameInSprite = frame % (this.rows * this.cols);
      const row = Math.floor(frameInSprite / this.cols);
      const col = frameInSprite % this.cols;

      const sprite = this.sprites[spriteNum];

      this.ctx.clearRect(0, 0, this.width, this.height);
      this.ctx.drawImage(
        sprite, // image
        this.width * col,      // pos in sprite pos
        this.height * row,      // pos in sprite
        this.width,
        this.height,
        0,
        0,
        this.width,
        this.height
      );
    }
  }

  window.CanvasPlayer = CanvasPlayer;

})();
