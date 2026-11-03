import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});
var __commonJS = (cb, mod) => function __require2() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// node_modules/pngjs/lib/chunkstream.js
var require_chunkstream = __commonJS({
  "node_modules/pngjs/lib/chunkstream.js"(exports, module) {
    "use strict";
    var util = __require("util");
    var Stream = __require("stream");
    var ChunkStream = module.exports = function() {
      Stream.call(this);
      this._buffers = [];
      this._buffered = 0;
      this._reads = [];
      this._paused = false;
      this._encoding = "utf8";
      this.writable = true;
    };
    util.inherits(ChunkStream, Stream);
    ChunkStream.prototype.read = function(length, callback) {
      this._reads.push({
        length: Math.abs(length),
        // if length < 0 then at most this length
        allowLess: length < 0,
        func: callback
      });
      process.nextTick(
        function() {
          this._process();
          if (this._paused && this._reads && this._reads.length > 0) {
            this._paused = false;
            this.emit("drain");
          }
        }.bind(this)
      );
    };
    ChunkStream.prototype.write = function(data, encoding) {
      if (!this.writable) {
        this.emit("error", new Error("Stream not writable"));
        return false;
      }
      let dataBuffer;
      if (Buffer.isBuffer(data)) {
        dataBuffer = data;
      } else {
        dataBuffer = Buffer.from(data, encoding || this._encoding);
      }
      this._buffers.push(dataBuffer);
      this._buffered += dataBuffer.length;
      this._process();
      if (this._reads && this._reads.length === 0) {
        this._paused = true;
      }
      return this.writable && !this._paused;
    };
    ChunkStream.prototype.end = function(data, encoding) {
      if (data) {
        this.write(data, encoding);
      }
      this.writable = false;
      if (!this._buffers) {
        return;
      }
      if (this._buffers.length === 0) {
        this._end();
      } else {
        this._buffers.push(null);
        this._process();
      }
    };
    ChunkStream.prototype.destroySoon = ChunkStream.prototype.end;
    ChunkStream.prototype._end = function() {
      if (this._reads.length > 0) {
        this.emit("error", new Error("Unexpected end of input"));
      }
      this.destroy();
    };
    ChunkStream.prototype.destroy = function() {
      if (!this._buffers) {
        return;
      }
      this.writable = false;
      this._reads = null;
      this._buffers = null;
      this.emit("close");
    };
    ChunkStream.prototype._processReadAllowingLess = function(read) {
      this._reads.shift();
      let smallerBuf = this._buffers[0];
      if (smallerBuf.length > read.length) {
        this._buffered -= read.length;
        this._buffers[0] = smallerBuf.slice(read.length);
        read.func.call(this, smallerBuf.slice(0, read.length));
      } else {
        this._buffered -= smallerBuf.length;
        this._buffers.shift();
        read.func.call(this, smallerBuf);
      }
    };
    ChunkStream.prototype._processRead = function(read) {
      this._reads.shift();
      let pos = 0;
      let count = 0;
      let data = Buffer.alloc(read.length);
      while (pos < read.length) {
        let buf = this._buffers[count++];
        let len = Math.min(buf.length, read.length - pos);
        buf.copy(data, pos, 0, len);
        pos += len;
        if (len !== buf.length) {
          this._buffers[--count] = buf.slice(len);
        }
      }
      if (count > 0) {
        this._buffers.splice(0, count);
      }
      this._buffered -= read.length;
      read.func.call(this, data);
    };
    ChunkStream.prototype._process = function() {
      try {
        while (this._buffered > 0 && this._reads && this._reads.length > 0) {
          let read = this._reads[0];
          if (read.allowLess) {
            this._processReadAllowingLess(read);
          } else if (this._buffered >= read.length) {
            this._processRead(read);
          } else {
            break;
          }
        }
        if (this._buffers && !this.writable) {
          this._end();
        }
      } catch (ex) {
        this.emit("error", ex);
      }
    };
  }
});

// node_modules/pngjs/lib/interlace.js
var require_interlace = __commonJS({
  "node_modules/pngjs/lib/interlace.js"(exports) {
    "use strict";
    var imagePasses = [
      {
        // pass 1 - 1px
        x: [0],
        y: [0]
      },
      {
        // pass 2 - 1px
        x: [4],
        y: [0]
      },
      {
        // pass 3 - 2px
        x: [0, 4],
        y: [4]
      },
      {
        // pass 4 - 4px
        x: [2, 6],
        y: [0, 4]
      },
      {
        // pass 5 - 8px
        x: [0, 2, 4, 6],
        y: [2, 6]
      },
      {
        // pass 6 - 16px
        x: [1, 3, 5, 7],
        y: [0, 2, 4, 6]
      },
      {
        // pass 7 - 32px
        x: [0, 1, 2, 3, 4, 5, 6, 7],
        y: [1, 3, 5, 7]
      }
    ];
    exports.getImagePasses = function(width, height) {
      let images = [];
      let xLeftOver = width % 8;
      let yLeftOver = height % 8;
      let xRepeats = (width - xLeftOver) / 8;
      let yRepeats = (height - yLeftOver) / 8;
      for (let i = 0; i < imagePasses.length; i++) {
        let pass = imagePasses[i];
        let passWidth = xRepeats * pass.x.length;
        let passHeight = yRepeats * pass.y.length;
        for (let j = 0; j < pass.x.length; j++) {
          if (pass.x[j] < xLeftOver) {
            passWidth++;
          } else {
            break;
          }
        }
        for (let j = 0; j < pass.y.length; j++) {
          if (pass.y[j] < yLeftOver) {
            passHeight++;
          } else {
            break;
          }
        }
        if (passWidth > 0 && passHeight > 0) {
          images.push({ width: passWidth, height: passHeight, index: i });
        }
      }
      return images;
    };
    exports.getInterlaceIterator = function(width) {
      return function(x, y, pass) {
        let outerXLeftOver = x % imagePasses[pass].x.length;
        let outerX = (x - outerXLeftOver) / imagePasses[pass].x.length * 8 + imagePasses[pass].x[outerXLeftOver];
        let outerYLeftOver = y % imagePasses[pass].y.length;
        let outerY = (y - outerYLeftOver) / imagePasses[pass].y.length * 8 + imagePasses[pass].y[outerYLeftOver];
        return outerX * 4 + outerY * width * 4;
      };
    };
  }
});

// node_modules/pngjs/lib/paeth-predictor.js
var require_paeth_predictor = __commonJS({
  "node_modules/pngjs/lib/paeth-predictor.js"(exports, module) {
    "use strict";
    module.exports = function paethPredictor(left, above, upLeft) {
      let paeth = left + above - upLeft;
      let pLeft = Math.abs(paeth - left);
      let pAbove = Math.abs(paeth - above);
      let pUpLeft = Math.abs(paeth - upLeft);
      if (pLeft <= pAbove && pLeft <= pUpLeft) {
        return left;
      }
      if (pAbove <= pUpLeft) {
        return above;
      }
      return upLeft;
    };
  }
});

// node_modules/pngjs/lib/filter-parse.js
var require_filter_parse = __commonJS({
  "node_modules/pngjs/lib/filter-parse.js"(exports, module) {
    "use strict";
    var interlaceUtils = require_interlace();
    var paethPredictor = require_paeth_predictor();
    function getByteWidth(width, bpp, depth) {
      let byteWidth = width * bpp;
      if (depth !== 8) {
        byteWidth = Math.ceil(byteWidth / (8 / depth));
      }
      return byteWidth;
    }
    var Filter = module.exports = function(bitmapInfo, dependencies) {
      let width = bitmapInfo.width;
      let height = bitmapInfo.height;
      let interlace = bitmapInfo.interlace;
      let bpp = bitmapInfo.bpp;
      let depth = bitmapInfo.depth;
      this.read = dependencies.read;
      this.write = dependencies.write;
      this.complete = dependencies.complete;
      this._imageIndex = 0;
      this._images = [];
      if (interlace) {
        let passes = interlaceUtils.getImagePasses(width, height);
        for (let i = 0; i < passes.length; i++) {
          this._images.push({
            byteWidth: getByteWidth(passes[i].width, bpp, depth),
            height: passes[i].height,
            lineIndex: 0
          });
        }
      } else {
        this._images.push({
          byteWidth: getByteWidth(width, bpp, depth),
          height,
          lineIndex: 0
        });
      }
      if (depth === 8) {
        this._xComparison = bpp;
      } else if (depth === 16) {
        this._xComparison = bpp * 2;
      } else {
        this._xComparison = 1;
      }
    };
    Filter.prototype.start = function() {
      this.read(
        this._images[this._imageIndex].byteWidth + 1,
        this._reverseFilterLine.bind(this)
      );
    };
    Filter.prototype._unFilterType1 = function(rawData, unfilteredLine, byteWidth) {
      let xComparison = this._xComparison;
      let xBiggerThan = xComparison - 1;
      for (let x = 0; x < byteWidth; x++) {
        let rawByte = rawData[1 + x];
        let f1Left = x > xBiggerThan ? unfilteredLine[x - xComparison] : 0;
        unfilteredLine[x] = rawByte + f1Left;
      }
    };
    Filter.prototype._unFilterType2 = function(rawData, unfilteredLine, byteWidth) {
      let lastLine = this._lastLine;
      for (let x = 0; x < byteWidth; x++) {
        let rawByte = rawData[1 + x];
        let f2Up = lastLine ? lastLine[x] : 0;
        unfilteredLine[x] = rawByte + f2Up;
      }
    };
    Filter.prototype._unFilterType3 = function(rawData, unfilteredLine, byteWidth) {
      let xComparison = this._xComparison;
      let xBiggerThan = xComparison - 1;
      let lastLine = this._lastLine;
      for (let x = 0; x < byteWidth; x++) {
        let rawByte = rawData[1 + x];
        let f3Up = lastLine ? lastLine[x] : 0;
        let f3Left = x > xBiggerThan ? unfilteredLine[x - xComparison] : 0;
        let f3Add = Math.floor((f3Left + f3Up) / 2);
        unfilteredLine[x] = rawByte + f3Add;
      }
    };
    Filter.prototype._unFilterType4 = function(rawData, unfilteredLine, byteWidth) {
      let xComparison = this._xComparison;
      let xBiggerThan = xComparison - 1;
      let lastLine = this._lastLine;
      for (let x = 0; x < byteWidth; x++) {
        let rawByte = rawData[1 + x];
        let f4Up = lastLine ? lastLine[x] : 0;
        let f4Left = x > xBiggerThan ? unfilteredLine[x - xComparison] : 0;
        let f4UpLeft = x > xBiggerThan && lastLine ? lastLine[x - xComparison] : 0;
        let f4Add = paethPredictor(f4Left, f4Up, f4UpLeft);
        unfilteredLine[x] = rawByte + f4Add;
      }
    };
    Filter.prototype._reverseFilterLine = function(rawData) {
      let filter = rawData[0];
      let unfilteredLine;
      let currentImage = this._images[this._imageIndex];
      let byteWidth = currentImage.byteWidth;
      if (filter === 0) {
        unfilteredLine = rawData.slice(1, byteWidth + 1);
      } else {
        unfilteredLine = Buffer.alloc(byteWidth);
        switch (filter) {
          case 1:
            this._unFilterType1(rawData, unfilteredLine, byteWidth);
            break;
          case 2:
            this._unFilterType2(rawData, unfilteredLine, byteWidth);
            break;
          case 3:
            this._unFilterType3(rawData, unfilteredLine, byteWidth);
            break;
          case 4:
            this._unFilterType4(rawData, unfilteredLine, byteWidth);
            break;
          default:
            throw new Error("Unrecognised filter type - " + filter);
        }
      }
      this.write(unfilteredLine);
      currentImage.lineIndex++;
      if (currentImage.lineIndex >= currentImage.height) {
        this._lastLine = null;
        this._imageIndex++;
        currentImage = this._images[this._imageIndex];
      } else {
        this._lastLine = unfilteredLine;
      }
      if (currentImage) {
        this.read(currentImage.byteWidth + 1, this._reverseFilterLine.bind(this));
      } else {
        this._lastLine = null;
        this.complete();
      }
    };
  }
});

// node_modules/pngjs/lib/filter-parse-async.js
var require_filter_parse_async = __commonJS({
  "node_modules/pngjs/lib/filter-parse-async.js"(exports, module) {
    "use strict";
    var util = __require("util");
    var ChunkStream = require_chunkstream();
    var Filter = require_filter_parse();
    var FilterAsync = module.exports = function(bitmapInfo) {
      ChunkStream.call(this);
      let buffers = [];
      let that = this;
      this._filter = new Filter(bitmapInfo, {
        read: this.read.bind(this),
        write: function(buffer) {
          buffers.push(buffer);
        },
        complete: function() {
          that.emit("complete", Buffer.concat(buffers));
        }
      });
      this._filter.start();
    };
    util.inherits(FilterAsync, ChunkStream);
  }
});

// node_modules/pngjs/lib/constants.js
var require_constants = __commonJS({
  "node_modules/pngjs/lib/constants.js"(exports, module) {
    "use strict";
    module.exports = {
      PNG_SIGNATURE: [137, 80, 78, 71, 13, 10, 26, 10],
      TYPE_IHDR: 1229472850,
      TYPE_IEND: 1229278788,
      TYPE_IDAT: 1229209940,
      TYPE_PLTE: 1347179589,
      TYPE_tRNS: 1951551059,
      // eslint-disable-line camelcase
      TYPE_gAMA: 1732332865,
      // eslint-disable-line camelcase
      // color-type bits
      COLORTYPE_GRAYSCALE: 0,
      COLORTYPE_PALETTE: 1,
      COLORTYPE_COLOR: 2,
      COLORTYPE_ALPHA: 4,
      // e.g. grayscale and alpha
      // color-type combinations
      COLORTYPE_PALETTE_COLOR: 3,
      COLORTYPE_COLOR_ALPHA: 6,
      COLORTYPE_TO_BPP_MAP: {
        0: 1,
        2: 3,
        3: 1,
        4: 2,
        6: 4
      },
      GAMMA_DIVISION: 1e5
    };
  }
});

// node_modules/pngjs/lib/crc.js
var require_crc = __commonJS({
  "node_modules/pngjs/lib/crc.js"(exports, module) {
    "use strict";
    var crcTable = [];
    (function() {
      for (let i = 0; i < 256; i++) {
        let currentCrc = i;
        for (let j = 0; j < 8; j++) {
          if (currentCrc & 1) {
            currentCrc = 3988292384 ^ currentCrc >>> 1;
          } else {
            currentCrc = currentCrc >>> 1;
          }
        }
        crcTable[i] = currentCrc;
      }
    })();
    var CrcCalculator = module.exports = function() {
      this._crc = -1;
    };
    CrcCalculator.prototype.write = function(data) {
      for (let i = 0; i < data.length; i++) {
        this._crc = crcTable[(this._crc ^ data[i]) & 255] ^ this._crc >>> 8;
      }
      return true;
    };
    CrcCalculator.prototype.crc32 = function() {
      return this._crc ^ -1;
    };
    CrcCalculator.crc32 = function(buf) {
      let crc = -1;
      for (let i = 0; i < buf.length; i++) {
        crc = crcTable[(crc ^ buf[i]) & 255] ^ crc >>> 8;
      }
      return crc ^ -1;
    };
  }
});

// node_modules/pngjs/lib/parser.js
var require_parser = __commonJS({
  "node_modules/pngjs/lib/parser.js"(exports, module) {
    "use strict";
    var constants = require_constants();
    var CrcCalculator = require_crc();
    var Parser = module.exports = function(options, dependencies) {
      this._options = options;
      options.checkCRC = options.checkCRC !== false;
      this._hasIHDR = false;
      this._hasIEND = false;
      this._emittedHeadersFinished = false;
      this._palette = [];
      this._colorType = 0;
      this._chunks = {};
      this._chunks[constants.TYPE_IHDR] = this._handleIHDR.bind(this);
      this._chunks[constants.TYPE_IEND] = this._handleIEND.bind(this);
      this._chunks[constants.TYPE_IDAT] = this._handleIDAT.bind(this);
      this._chunks[constants.TYPE_PLTE] = this._handlePLTE.bind(this);
      this._chunks[constants.TYPE_tRNS] = this._handleTRNS.bind(this);
      this._chunks[constants.TYPE_gAMA] = this._handleGAMA.bind(this);
      this.read = dependencies.read;
      this.error = dependencies.error;
      this.metadata = dependencies.metadata;
      this.gamma = dependencies.gamma;
      this.transColor = dependencies.transColor;
      this.palette = dependencies.palette;
      this.parsed = dependencies.parsed;
      this.inflateData = dependencies.inflateData;
      this.finished = dependencies.finished;
      this.simpleTransparency = dependencies.simpleTransparency;
      this.headersFinished = dependencies.headersFinished || function() {
      };
    };
    Parser.prototype.start = function() {
      this.read(constants.PNG_SIGNATURE.length, this._parseSignature.bind(this));
    };
    Parser.prototype._parseSignature = function(data) {
      let signature = constants.PNG_SIGNATURE;
      for (let i = 0; i < signature.length; i++) {
        if (data[i] !== signature[i]) {
          this.error(new Error("Invalid file signature"));
          return;
        }
      }
      this.read(8, this._parseChunkBegin.bind(this));
    };
    Parser.prototype._parseChunkBegin = function(data) {
      let length = data.readUInt32BE(0);
      let type = data.readUInt32BE(4);
      let name = "";
      for (let i = 4; i < 8; i++) {
        name += String.fromCharCode(data[i]);
      }
      let ancillary = Boolean(data[4] & 32);
      if (!this._hasIHDR && type !== constants.TYPE_IHDR) {
        this.error(new Error("Expected IHDR on beggining"));
        return;
      }
      this._crc = new CrcCalculator();
      this._crc.write(Buffer.from(name));
      if (this._chunks[type]) {
        return this._chunks[type](length);
      }
      if (!ancillary) {
        this.error(new Error("Unsupported critical chunk type " + name));
        return;
      }
      this.read(length + 4, this._skipChunk.bind(this));
    };
    Parser.prototype._skipChunk = function() {
      this.read(8, this._parseChunkBegin.bind(this));
    };
    Parser.prototype._handleChunkEnd = function() {
      this.read(4, this._parseChunkEnd.bind(this));
    };
    Parser.prototype._parseChunkEnd = function(data) {
      let fileCrc = data.readInt32BE(0);
      let calcCrc = this._crc.crc32();
      if (this._options.checkCRC && calcCrc !== fileCrc) {
        this.error(new Error("Crc error - " + fileCrc + " - " + calcCrc));
        return;
      }
      if (!this._hasIEND) {
        this.read(8, this._parseChunkBegin.bind(this));
      }
    };
    Parser.prototype._handleIHDR = function(length) {
      this.read(length, this._parseIHDR.bind(this));
    };
    Parser.prototype._parseIHDR = function(data) {
      this._crc.write(data);
      let width = data.readUInt32BE(0);
      let height = data.readUInt32BE(4);
      let depth = data[8];
      let colorType = data[9];
      let compr = data[10];
      let filter = data[11];
      let interlace = data[12];
      if (depth !== 8 && depth !== 4 && depth !== 2 && depth !== 1 && depth !== 16) {
        this.error(new Error("Unsupported bit depth " + depth));
        return;
      }
      if (!(colorType in constants.COLORTYPE_TO_BPP_MAP)) {
        this.error(new Error("Unsupported color type"));
        return;
      }
      if (compr !== 0) {
        this.error(new Error("Unsupported compression method"));
        return;
      }
      if (filter !== 0) {
        this.error(new Error("Unsupported filter method"));
        return;
      }
      if (interlace !== 0 && interlace !== 1) {
        this.error(new Error("Unsupported interlace method"));
        return;
      }
      this._colorType = colorType;
      let bpp = constants.COLORTYPE_TO_BPP_MAP[this._colorType];
      this._hasIHDR = true;
      this.metadata({
        width,
        height,
        depth,
        interlace: Boolean(interlace),
        palette: Boolean(colorType & constants.COLORTYPE_PALETTE),
        color: Boolean(colorType & constants.COLORTYPE_COLOR),
        alpha: Boolean(colorType & constants.COLORTYPE_ALPHA),
        bpp,
        colorType
      });
      this._handleChunkEnd();
    };
    Parser.prototype._handlePLTE = function(length) {
      this.read(length, this._parsePLTE.bind(this));
    };
    Parser.prototype._parsePLTE = function(data) {
      this._crc.write(data);
      let entries = Math.floor(data.length / 3);
      for (let i = 0; i < entries; i++) {
        this._palette.push([data[i * 3], data[i * 3 + 1], data[i * 3 + 2], 255]);
      }
      this.palette(this._palette);
      this._handleChunkEnd();
    };
    Parser.prototype._handleTRNS = function(length) {
      this.simpleTransparency();
      this.read(length, this._parseTRNS.bind(this));
    };
    Parser.prototype._parseTRNS = function(data) {
      this._crc.write(data);
      if (this._colorType === constants.COLORTYPE_PALETTE_COLOR) {
        if (this._palette.length === 0) {
          this.error(new Error("Transparency chunk must be after palette"));
          return;
        }
        if (data.length > this._palette.length) {
          this.error(new Error("More transparent colors than palette size"));
          return;
        }
        for (let i = 0; i < data.length; i++) {
          this._palette[i][3] = data[i];
        }
        this.palette(this._palette);
      }
      if (this._colorType === constants.COLORTYPE_GRAYSCALE) {
        this.transColor([data.readUInt16BE(0)]);
      }
      if (this._colorType === constants.COLORTYPE_COLOR) {
        this.transColor([
          data.readUInt16BE(0),
          data.readUInt16BE(2),
          data.readUInt16BE(4)
        ]);
      }
      this._handleChunkEnd();
    };
    Parser.prototype._handleGAMA = function(length) {
      this.read(length, this._parseGAMA.bind(this));
    };
    Parser.prototype._parseGAMA = function(data) {
      this._crc.write(data);
      this.gamma(data.readUInt32BE(0) / constants.GAMMA_DIVISION);
      this._handleChunkEnd();
    };
    Parser.prototype._handleIDAT = function(length) {
      if (!this._emittedHeadersFinished) {
        this._emittedHeadersFinished = true;
        this.headersFinished();
      }
      this.read(-length, this._parseIDAT.bind(this, length));
    };
    Parser.prototype._parseIDAT = function(length, data) {
      this._crc.write(data);
      if (this._colorType === constants.COLORTYPE_PALETTE_COLOR && this._palette.length === 0) {
        throw new Error("Expected palette not found");
      }
      this.inflateData(data);
      let leftOverLength = length - data.length;
      if (leftOverLength > 0) {
        this._handleIDAT(leftOverLength);
      } else {
        this._handleChunkEnd();
      }
    };
    Parser.prototype._handleIEND = function(length) {
      this.read(length, this._parseIEND.bind(this));
    };
    Parser.prototype._parseIEND = function(data) {
      this._crc.write(data);
      this._hasIEND = true;
      this._handleChunkEnd();
      if (this.finished) {
        this.finished();
      }
    };
  }
});

// node_modules/pngjs/lib/bitmapper.js
var require_bitmapper = __commonJS({
  "node_modules/pngjs/lib/bitmapper.js"(exports) {
    "use strict";
    var interlaceUtils = require_interlace();
    var pixelBppMapper = [
      // 0 - dummy entry
      function() {
      },
      // 1 - L
      // 0: 0, 1: 0, 2: 0, 3: 0xff
      function(pxData, data, pxPos, rawPos) {
        if (rawPos === data.length) {
          throw new Error("Ran out of data");
        }
        let pixel = data[rawPos];
        pxData[pxPos] = pixel;
        pxData[pxPos + 1] = pixel;
        pxData[pxPos + 2] = pixel;
        pxData[pxPos + 3] = 255;
      },
      // 2 - LA
      // 0: 0, 1: 0, 2: 0, 3: 1
      function(pxData, data, pxPos, rawPos) {
        if (rawPos + 1 >= data.length) {
          throw new Error("Ran out of data");
        }
        let pixel = data[rawPos];
        pxData[pxPos] = pixel;
        pxData[pxPos + 1] = pixel;
        pxData[pxPos + 2] = pixel;
        pxData[pxPos + 3] = data[rawPos + 1];
      },
      // 3 - RGB
      // 0: 0, 1: 1, 2: 2, 3: 0xff
      function(pxData, data, pxPos, rawPos) {
        if (rawPos + 2 >= data.length) {
          throw new Error("Ran out of data");
        }
        pxData[pxPos] = data[rawPos];
        pxData[pxPos + 1] = data[rawPos + 1];
        pxData[pxPos + 2] = data[rawPos + 2];
        pxData[pxPos + 3] = 255;
      },
      // 4 - RGBA
      // 0: 0, 1: 1, 2: 2, 3: 3
      function(pxData, data, pxPos, rawPos) {
        if (rawPos + 3 >= data.length) {
          throw new Error("Ran out of data");
        }
        pxData[pxPos] = data[rawPos];
        pxData[pxPos + 1] = data[rawPos + 1];
        pxData[pxPos + 2] = data[rawPos + 2];
        pxData[pxPos + 3] = data[rawPos + 3];
      }
    ];
    var pixelBppCustomMapper = [
      // 0 - dummy entry
      function() {
      },
      // 1 - L
      // 0: 0, 1: 0, 2: 0, 3: 0xff
      function(pxData, pixelData, pxPos, maxBit) {
        let pixel = pixelData[0];
        pxData[pxPos] = pixel;
        pxData[pxPos + 1] = pixel;
        pxData[pxPos + 2] = pixel;
        pxData[pxPos + 3] = maxBit;
      },
      // 2 - LA
      // 0: 0, 1: 0, 2: 0, 3: 1
      function(pxData, pixelData, pxPos) {
        let pixel = pixelData[0];
        pxData[pxPos] = pixel;
        pxData[pxPos + 1] = pixel;
        pxData[pxPos + 2] = pixel;
        pxData[pxPos + 3] = pixelData[1];
      },
      // 3 - RGB
      // 0: 0, 1: 1, 2: 2, 3: 0xff
      function(pxData, pixelData, pxPos, maxBit) {
        pxData[pxPos] = pixelData[0];
        pxData[pxPos + 1] = pixelData[1];
        pxData[pxPos + 2] = pixelData[2];
        pxData[pxPos + 3] = maxBit;
      },
      // 4 - RGBA
      // 0: 0, 1: 1, 2: 2, 3: 3
      function(pxData, pixelData, pxPos) {
        pxData[pxPos] = pixelData[0];
        pxData[pxPos + 1] = pixelData[1];
        pxData[pxPos + 2] = pixelData[2];
        pxData[pxPos + 3] = pixelData[3];
      }
    ];
    function bitRetriever(data, depth) {
      let leftOver = [];
      let i = 0;
      function split() {
        if (i === data.length) {
          throw new Error("Ran out of data");
        }
        let byte = data[i];
        i++;
        let byte8, byte7, byte6, byte5, byte4, byte3, byte2, byte1;
        switch (depth) {
          default:
            throw new Error("unrecognised depth");
          case 16:
            byte2 = data[i];
            i++;
            leftOver.push((byte << 8) + byte2);
            break;
          case 4:
            byte2 = byte & 15;
            byte1 = byte >> 4;
            leftOver.push(byte1, byte2);
            break;
          case 2:
            byte4 = byte & 3;
            byte3 = byte >> 2 & 3;
            byte2 = byte >> 4 & 3;
            byte1 = byte >> 6 & 3;
            leftOver.push(byte1, byte2, byte3, byte4);
            break;
          case 1:
            byte8 = byte & 1;
            byte7 = byte >> 1 & 1;
            byte6 = byte >> 2 & 1;
            byte5 = byte >> 3 & 1;
            byte4 = byte >> 4 & 1;
            byte3 = byte >> 5 & 1;
            byte2 = byte >> 6 & 1;
            byte1 = byte >> 7 & 1;
            leftOver.push(byte1, byte2, byte3, byte4, byte5, byte6, byte7, byte8);
            break;
        }
      }
      return {
        get: function(count) {
          while (leftOver.length < count) {
            split();
          }
          let returner = leftOver.slice(0, count);
          leftOver = leftOver.slice(count);
          return returner;
        },
        resetAfterLine: function() {
          leftOver.length = 0;
        },
        end: function() {
          if (i !== data.length) {
            throw new Error("extra data found");
          }
        }
      };
    }
    function mapImage8Bit(image2, pxData, getPxPos, bpp, data, rawPos) {
      let imageWidth = image2.width;
      let imageHeight = image2.height;
      let imagePass = image2.index;
      for (let y = 0; y < imageHeight; y++) {
        for (let x = 0; x < imageWidth; x++) {
          let pxPos = getPxPos(x, y, imagePass);
          pixelBppMapper[bpp](pxData, data, pxPos, rawPos);
          rawPos += bpp;
        }
      }
      return rawPos;
    }
    function mapImageCustomBit(image2, pxData, getPxPos, bpp, bits, maxBit) {
      let imageWidth = image2.width;
      let imageHeight = image2.height;
      let imagePass = image2.index;
      for (let y = 0; y < imageHeight; y++) {
        for (let x = 0; x < imageWidth; x++) {
          let pixelData = bits.get(bpp);
          let pxPos = getPxPos(x, y, imagePass);
          pixelBppCustomMapper[bpp](pxData, pixelData, pxPos, maxBit);
        }
        bits.resetAfterLine();
      }
    }
    exports.dataToBitMap = function(data, bitmapInfo) {
      let width = bitmapInfo.width;
      let height = bitmapInfo.height;
      let depth = bitmapInfo.depth;
      let bpp = bitmapInfo.bpp;
      let interlace = bitmapInfo.interlace;
      let bits;
      if (depth !== 8) {
        bits = bitRetriever(data, depth);
      }
      let pxData;
      if (depth <= 8) {
        pxData = Buffer.alloc(width * height * 4);
      } else {
        pxData = new Uint16Array(width * height * 4);
      }
      let maxBit = Math.pow(2, depth) - 1;
      let rawPos = 0;
      let images;
      let getPxPos;
      if (interlace) {
        images = interlaceUtils.getImagePasses(width, height);
        getPxPos = interlaceUtils.getInterlaceIterator(width, height);
      } else {
        let nonInterlacedPxPos = 0;
        getPxPos = function() {
          let returner = nonInterlacedPxPos;
          nonInterlacedPxPos += 4;
          return returner;
        };
        images = [{ width, height }];
      }
      for (let imageIndex = 0; imageIndex < images.length; imageIndex++) {
        if (depth === 8) {
          rawPos = mapImage8Bit(
            images[imageIndex],
            pxData,
            getPxPos,
            bpp,
            data,
            rawPos
          );
        } else {
          mapImageCustomBit(
            images[imageIndex],
            pxData,
            getPxPos,
            bpp,
            bits,
            maxBit
          );
        }
      }
      if (depth === 8) {
        if (rawPos !== data.length) {
          throw new Error("extra data found");
        }
      } else {
        bits.end();
      }
      return pxData;
    };
  }
});

// node_modules/pngjs/lib/format-normaliser.js
var require_format_normaliser = __commonJS({
  "node_modules/pngjs/lib/format-normaliser.js"(exports, module) {
    "use strict";
    function dePalette(indata, outdata, width, height, palette) {
      let pxPos = 0;
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          let color = palette[indata[pxPos]];
          if (!color) {
            throw new Error("index " + indata[pxPos] + " not in palette");
          }
          for (let i = 0; i < 4; i++) {
            outdata[pxPos + i] = color[i];
          }
          pxPos += 4;
        }
      }
    }
    function replaceTransparentColor(indata, outdata, width, height, transColor) {
      let pxPos = 0;
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          let makeTrans = false;
          if (transColor.length === 1) {
            if (transColor[0] === indata[pxPos]) {
              makeTrans = true;
            }
          } else if (transColor[0] === indata[pxPos] && transColor[1] === indata[pxPos + 1] && transColor[2] === indata[pxPos + 2]) {
            makeTrans = true;
          }
          if (makeTrans) {
            for (let i = 0; i < 4; i++) {
              outdata[pxPos + i] = 0;
            }
          }
          pxPos += 4;
        }
      }
    }
    function scaleDepth(indata, outdata, width, height, depth) {
      let maxOutSample = 255;
      let maxInSample = Math.pow(2, depth) - 1;
      let pxPos = 0;
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          for (let i = 0; i < 4; i++) {
            outdata[pxPos + i] = Math.floor(
              indata[pxPos + i] * maxOutSample / maxInSample + 0.5
            );
          }
          pxPos += 4;
        }
      }
    }
    module.exports = function(indata, imageData, skipRescale = false) {
      let depth = imageData.depth;
      let width = imageData.width;
      let height = imageData.height;
      let colorType = imageData.colorType;
      let transColor = imageData.transColor;
      let palette = imageData.palette;
      let outdata = indata;
      if (colorType === 3) {
        dePalette(indata, outdata, width, height, palette);
      } else {
        if (transColor) {
          replaceTransparentColor(indata, outdata, width, height, transColor);
        }
        if (depth !== 8 && !skipRescale) {
          if (depth === 16) {
            outdata = Buffer.alloc(width * height * 4);
          }
          scaleDepth(indata, outdata, width, height, depth);
        }
      }
      return outdata;
    };
  }
});

// node_modules/pngjs/lib/parser-async.js
var require_parser_async = __commonJS({
  "node_modules/pngjs/lib/parser-async.js"(exports, module) {
    "use strict";
    var util = __require("util");
    var zlib = __require("zlib");
    var ChunkStream = require_chunkstream();
    var FilterAsync = require_filter_parse_async();
    var Parser = require_parser();
    var bitmapper = require_bitmapper();
    var formatNormaliser = require_format_normaliser();
    var ParserAsync = module.exports = function(options) {
      ChunkStream.call(this);
      this._parser = new Parser(options, {
        read: this.read.bind(this),
        error: this._handleError.bind(this),
        metadata: this._handleMetaData.bind(this),
        gamma: this.emit.bind(this, "gamma"),
        palette: this._handlePalette.bind(this),
        transColor: this._handleTransColor.bind(this),
        finished: this._finished.bind(this),
        inflateData: this._inflateData.bind(this),
        simpleTransparency: this._simpleTransparency.bind(this),
        headersFinished: this._headersFinished.bind(this)
      });
      this._options = options;
      this.writable = true;
      this._parser.start();
    };
    util.inherits(ParserAsync, ChunkStream);
    ParserAsync.prototype._handleError = function(err) {
      this.emit("error", err);
      this.writable = false;
      this.destroy();
      if (this._inflate && this._inflate.destroy) {
        this._inflate.destroy();
      }
      if (this._filter) {
        this._filter.destroy();
        this._filter.on("error", function() {
        });
      }
      this.errord = true;
    };
    ParserAsync.prototype._inflateData = function(data) {
      if (!this._inflate) {
        if (this._bitmapInfo.interlace) {
          this._inflate = zlib.createInflate();
          this._inflate.on("error", this.emit.bind(this, "error"));
          this._filter.on("complete", this._complete.bind(this));
          this._inflate.pipe(this._filter);
        } else {
          let rowSize = (this._bitmapInfo.width * this._bitmapInfo.bpp * this._bitmapInfo.depth + 7 >> 3) + 1;
          let imageSize = rowSize * this._bitmapInfo.height;
          let chunkSize = Math.max(imageSize, zlib.Z_MIN_CHUNK);
          this._inflate = zlib.createInflate({ chunkSize });
          let leftToInflate = imageSize;
          let emitError = this.emit.bind(this, "error");
          this._inflate.on("error", function(err) {
            if (!leftToInflate) {
              return;
            }
            emitError(err);
          });
          this._filter.on("complete", this._complete.bind(this));
          let filterWrite = this._filter.write.bind(this._filter);
          this._inflate.on("data", function(chunk) {
            if (!leftToInflate) {
              return;
            }
            if (chunk.length > leftToInflate) {
              chunk = chunk.slice(0, leftToInflate);
            }
            leftToInflate -= chunk.length;
            filterWrite(chunk);
          });
          this._inflate.on("end", this._filter.end.bind(this._filter));
        }
      }
      this._inflate.write(data);
    };
    ParserAsync.prototype._handleMetaData = function(metaData) {
      this._metaData = metaData;
      this._bitmapInfo = Object.create(metaData);
      this._filter = new FilterAsync(this._bitmapInfo);
    };
    ParserAsync.prototype._handleTransColor = function(transColor) {
      this._bitmapInfo.transColor = transColor;
    };
    ParserAsync.prototype._handlePalette = function(palette) {
      this._bitmapInfo.palette = palette;
    };
    ParserAsync.prototype._simpleTransparency = function() {
      this._metaData.alpha = true;
    };
    ParserAsync.prototype._headersFinished = function() {
      this.emit("metadata", this._metaData);
    };
    ParserAsync.prototype._finished = function() {
      if (this.errord) {
        return;
      }
      if (!this._inflate) {
        this.emit("error", "No Inflate block");
      } else {
        this._inflate.end();
      }
    };
    ParserAsync.prototype._complete = function(filteredData) {
      if (this.errord) {
        return;
      }
      let normalisedBitmapData;
      try {
        let bitmapData = bitmapper.dataToBitMap(filteredData, this._bitmapInfo);
        normalisedBitmapData = formatNormaliser(
          bitmapData,
          this._bitmapInfo,
          this._options.skipRescale
        );
        bitmapData = null;
      } catch (ex) {
        this._handleError(ex);
        return;
      }
      this.emit("parsed", normalisedBitmapData);
    };
  }
});

// node_modules/pngjs/lib/bitpacker.js
var require_bitpacker = __commonJS({
  "node_modules/pngjs/lib/bitpacker.js"(exports, module) {
    "use strict";
    var constants = require_constants();
    module.exports = function(dataIn, width, height, options) {
      let outHasAlpha = [constants.COLORTYPE_COLOR_ALPHA, constants.COLORTYPE_ALPHA].indexOf(
        options.colorType
      ) !== -1;
      if (options.colorType === options.inputColorType) {
        let bigEndian = function() {
          let buffer = new ArrayBuffer(2);
          new DataView(buffer).setInt16(
            0,
            256,
            true
            /* littleEndian */
          );
          return new Int16Array(buffer)[0] !== 256;
        }();
        if (options.bitDepth === 8 || options.bitDepth === 16 && bigEndian) {
          return dataIn;
        }
      }
      let data = options.bitDepth !== 16 ? dataIn : new Uint16Array(dataIn.buffer);
      let maxValue = 255;
      let inBpp = constants.COLORTYPE_TO_BPP_MAP[options.inputColorType];
      if (inBpp === 4 && !options.inputHasAlpha) {
        inBpp = 3;
      }
      let outBpp = constants.COLORTYPE_TO_BPP_MAP[options.colorType];
      if (options.bitDepth === 16) {
        maxValue = 65535;
        outBpp *= 2;
      }
      let outData = Buffer.alloc(width * height * outBpp);
      let inIndex = 0;
      let outIndex = 0;
      let bgColor = options.bgColor || {};
      if (bgColor.red === void 0) {
        bgColor.red = maxValue;
      }
      if (bgColor.green === void 0) {
        bgColor.green = maxValue;
      }
      if (bgColor.blue === void 0) {
        bgColor.blue = maxValue;
      }
      function getRGBA() {
        let red;
        let green;
        let blue;
        let alpha = maxValue;
        switch (options.inputColorType) {
          case constants.COLORTYPE_COLOR_ALPHA:
            alpha = data[inIndex + 3];
            red = data[inIndex];
            green = data[inIndex + 1];
            blue = data[inIndex + 2];
            break;
          case constants.COLORTYPE_COLOR:
            red = data[inIndex];
            green = data[inIndex + 1];
            blue = data[inIndex + 2];
            break;
          case constants.COLORTYPE_ALPHA:
            alpha = data[inIndex + 1];
            red = data[inIndex];
            green = red;
            blue = red;
            break;
          case constants.COLORTYPE_GRAYSCALE:
            red = data[inIndex];
            green = red;
            blue = red;
            break;
          default:
            throw new Error(
              "input color type:" + options.inputColorType + " is not supported at present"
            );
        }
        if (options.inputHasAlpha) {
          if (!outHasAlpha) {
            alpha /= maxValue;
            red = Math.min(
              Math.max(Math.round((1 - alpha) * bgColor.red + alpha * red), 0),
              maxValue
            );
            green = Math.min(
              Math.max(Math.round((1 - alpha) * bgColor.green + alpha * green), 0),
              maxValue
            );
            blue = Math.min(
              Math.max(Math.round((1 - alpha) * bgColor.blue + alpha * blue), 0),
              maxValue
            );
          }
        }
        return { red, green, blue, alpha };
      }
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          let rgba = getRGBA(data, inIndex);
          switch (options.colorType) {
            case constants.COLORTYPE_COLOR_ALPHA:
            case constants.COLORTYPE_COLOR:
              if (options.bitDepth === 8) {
                outData[outIndex] = rgba.red;
                outData[outIndex + 1] = rgba.green;
                outData[outIndex + 2] = rgba.blue;
                if (outHasAlpha) {
                  outData[outIndex + 3] = rgba.alpha;
                }
              } else {
                outData.writeUInt16BE(rgba.red, outIndex);
                outData.writeUInt16BE(rgba.green, outIndex + 2);
                outData.writeUInt16BE(rgba.blue, outIndex + 4);
                if (outHasAlpha) {
                  outData.writeUInt16BE(rgba.alpha, outIndex + 6);
                }
              }
              break;
            case constants.COLORTYPE_ALPHA:
            case constants.COLORTYPE_GRAYSCALE: {
              let grayscale = (rgba.red + rgba.green + rgba.blue) / 3;
              if (options.bitDepth === 8) {
                outData[outIndex] = grayscale;
                if (outHasAlpha) {
                  outData[outIndex + 1] = rgba.alpha;
                }
              } else {
                outData.writeUInt16BE(grayscale, outIndex);
                if (outHasAlpha) {
                  outData.writeUInt16BE(rgba.alpha, outIndex + 2);
                }
              }
              break;
            }
            default:
              throw new Error("unrecognised color Type " + options.colorType);
          }
          inIndex += inBpp;
          outIndex += outBpp;
        }
      }
      return outData;
    };
  }
});

// node_modules/pngjs/lib/filter-pack.js
var require_filter_pack = __commonJS({
  "node_modules/pngjs/lib/filter-pack.js"(exports, module) {
    "use strict";
    var paethPredictor = require_paeth_predictor();
    function filterNone(pxData, pxPos, byteWidth, rawData, rawPos) {
      for (let x = 0; x < byteWidth; x++) {
        rawData[rawPos + x] = pxData[pxPos + x];
      }
    }
    function filterSumNone(pxData, pxPos, byteWidth) {
      let sum = 0;
      let length = pxPos + byteWidth;
      for (let i = pxPos; i < length; i++) {
        sum += Math.abs(pxData[i]);
      }
      return sum;
    }
    function filterSub(pxData, pxPos, byteWidth, rawData, rawPos, bpp) {
      for (let x = 0; x < byteWidth; x++) {
        let left = x >= bpp ? pxData[pxPos + x - bpp] : 0;
        let val = pxData[pxPos + x] - left;
        rawData[rawPos + x] = val;
      }
    }
    function filterSumSub(pxData, pxPos, byteWidth, bpp) {
      let sum = 0;
      for (let x = 0; x < byteWidth; x++) {
        let left = x >= bpp ? pxData[pxPos + x - bpp] : 0;
        let val = pxData[pxPos + x] - left;
        sum += Math.abs(val);
      }
      return sum;
    }
    function filterUp(pxData, pxPos, byteWidth, rawData, rawPos) {
      for (let x = 0; x < byteWidth; x++) {
        let up = pxPos > 0 ? pxData[pxPos + x - byteWidth] : 0;
        let val = pxData[pxPos + x] - up;
        rawData[rawPos + x] = val;
      }
    }
    function filterSumUp(pxData, pxPos, byteWidth) {
      let sum = 0;
      let length = pxPos + byteWidth;
      for (let x = pxPos; x < length; x++) {
        let up = pxPos > 0 ? pxData[x - byteWidth] : 0;
        let val = pxData[x] - up;
        sum += Math.abs(val);
      }
      return sum;
    }
    function filterAvg(pxData, pxPos, byteWidth, rawData, rawPos, bpp) {
      for (let x = 0; x < byteWidth; x++) {
        let left = x >= bpp ? pxData[pxPos + x - bpp] : 0;
        let up = pxPos > 0 ? pxData[pxPos + x - byteWidth] : 0;
        let val = pxData[pxPos + x] - (left + up >> 1);
        rawData[rawPos + x] = val;
      }
    }
    function filterSumAvg(pxData, pxPos, byteWidth, bpp) {
      let sum = 0;
      for (let x = 0; x < byteWidth; x++) {
        let left = x >= bpp ? pxData[pxPos + x - bpp] : 0;
        let up = pxPos > 0 ? pxData[pxPos + x - byteWidth] : 0;
        let val = pxData[pxPos + x] - (left + up >> 1);
        sum += Math.abs(val);
      }
      return sum;
    }
    function filterPaeth(pxData, pxPos, byteWidth, rawData, rawPos, bpp) {
      for (let x = 0; x < byteWidth; x++) {
        let left = x >= bpp ? pxData[pxPos + x - bpp] : 0;
        let up = pxPos > 0 ? pxData[pxPos + x - byteWidth] : 0;
        let upleft = pxPos > 0 && x >= bpp ? pxData[pxPos + x - (byteWidth + bpp)] : 0;
        let val = pxData[pxPos + x] - paethPredictor(left, up, upleft);
        rawData[rawPos + x] = val;
      }
    }
    function filterSumPaeth(pxData, pxPos, byteWidth, bpp) {
      let sum = 0;
      for (let x = 0; x < byteWidth; x++) {
        let left = x >= bpp ? pxData[pxPos + x - bpp] : 0;
        let up = pxPos > 0 ? pxData[pxPos + x - byteWidth] : 0;
        let upleft = pxPos > 0 && x >= bpp ? pxData[pxPos + x - (byteWidth + bpp)] : 0;
        let val = pxData[pxPos + x] - paethPredictor(left, up, upleft);
        sum += Math.abs(val);
      }
      return sum;
    }
    var filters = {
      0: filterNone,
      1: filterSub,
      2: filterUp,
      3: filterAvg,
      4: filterPaeth
    };
    var filterSums = {
      0: filterSumNone,
      1: filterSumSub,
      2: filterSumUp,
      3: filterSumAvg,
      4: filterSumPaeth
    };
    module.exports = function(pxData, width, height, options, bpp) {
      let filterTypes;
      if (!("filterType" in options) || options.filterType === -1) {
        filterTypes = [0, 1, 2, 3, 4];
      } else if (typeof options.filterType === "number") {
        filterTypes = [options.filterType];
      } else {
        throw new Error("unrecognised filter types");
      }
      if (options.bitDepth === 16) {
        bpp *= 2;
      }
      let byteWidth = width * bpp;
      let rawPos = 0;
      let pxPos = 0;
      let rawData = Buffer.alloc((byteWidth + 1) * height);
      let sel = filterTypes[0];
      for (let y = 0; y < height; y++) {
        if (filterTypes.length > 1) {
          let min = Infinity;
          for (let i = 0; i < filterTypes.length; i++) {
            let sum = filterSums[filterTypes[i]](pxData, pxPos, byteWidth, bpp);
            if (sum < min) {
              sel = filterTypes[i];
              min = sum;
            }
          }
        }
        rawData[rawPos] = sel;
        rawPos++;
        filters[sel](pxData, pxPos, byteWidth, rawData, rawPos, bpp);
        rawPos += byteWidth;
        pxPos += byteWidth;
      }
      return rawData;
    };
  }
});

// node_modules/pngjs/lib/packer.js
var require_packer = __commonJS({
  "node_modules/pngjs/lib/packer.js"(exports, module) {
    "use strict";
    var constants = require_constants();
    var CrcStream = require_crc();
    var bitPacker = require_bitpacker();
    var filter = require_filter_pack();
    var zlib = __require("zlib");
    var Packer = module.exports = function(options) {
      this._options = options;
      options.deflateChunkSize = options.deflateChunkSize || 32 * 1024;
      options.deflateLevel = options.deflateLevel != null ? options.deflateLevel : 9;
      options.deflateStrategy = options.deflateStrategy != null ? options.deflateStrategy : 3;
      options.inputHasAlpha = options.inputHasAlpha != null ? options.inputHasAlpha : true;
      options.deflateFactory = options.deflateFactory || zlib.createDeflate;
      options.bitDepth = options.bitDepth || 8;
      options.colorType = typeof options.colorType === "number" ? options.colorType : constants.COLORTYPE_COLOR_ALPHA;
      options.inputColorType = typeof options.inputColorType === "number" ? options.inputColorType : constants.COLORTYPE_COLOR_ALPHA;
      if ([
        constants.COLORTYPE_GRAYSCALE,
        constants.COLORTYPE_COLOR,
        constants.COLORTYPE_COLOR_ALPHA,
        constants.COLORTYPE_ALPHA
      ].indexOf(options.colorType) === -1) {
        throw new Error(
          "option color type:" + options.colorType + " is not supported at present"
        );
      }
      if ([
        constants.COLORTYPE_GRAYSCALE,
        constants.COLORTYPE_COLOR,
        constants.COLORTYPE_COLOR_ALPHA,
        constants.COLORTYPE_ALPHA
      ].indexOf(options.inputColorType) === -1) {
        throw new Error(
          "option input color type:" + options.inputColorType + " is not supported at present"
        );
      }
      if (options.bitDepth !== 8 && options.bitDepth !== 16) {
        throw new Error(
          "option bit depth:" + options.bitDepth + " is not supported at present"
        );
      }
    };
    Packer.prototype.getDeflateOptions = function() {
      return {
        chunkSize: this._options.deflateChunkSize,
        level: this._options.deflateLevel,
        strategy: this._options.deflateStrategy
      };
    };
    Packer.prototype.createDeflate = function() {
      return this._options.deflateFactory(this.getDeflateOptions());
    };
    Packer.prototype.filterData = function(data, width, height) {
      let packedData = bitPacker(data, width, height, this._options);
      let bpp = constants.COLORTYPE_TO_BPP_MAP[this._options.colorType];
      let filteredData = filter(packedData, width, height, this._options, bpp);
      return filteredData;
    };
    Packer.prototype._packChunk = function(type, data) {
      let len = data ? data.length : 0;
      let buf = Buffer.alloc(len + 12);
      buf.writeUInt32BE(len, 0);
      buf.writeUInt32BE(type, 4);
      if (data) {
        data.copy(buf, 8);
      }
      buf.writeInt32BE(
        CrcStream.crc32(buf.slice(4, buf.length - 4)),
        buf.length - 4
      );
      return buf;
    };
    Packer.prototype.packGAMA = function(gamma) {
      let buf = Buffer.alloc(4);
      buf.writeUInt32BE(Math.floor(gamma * constants.GAMMA_DIVISION), 0);
      return this._packChunk(constants.TYPE_gAMA, buf);
    };
    Packer.prototype.packIHDR = function(width, height) {
      let buf = Buffer.alloc(13);
      buf.writeUInt32BE(width, 0);
      buf.writeUInt32BE(height, 4);
      buf[8] = this._options.bitDepth;
      buf[9] = this._options.colorType;
      buf[10] = 0;
      buf[11] = 0;
      buf[12] = 0;
      return this._packChunk(constants.TYPE_IHDR, buf);
    };
    Packer.prototype.packIDAT = function(data) {
      return this._packChunk(constants.TYPE_IDAT, data);
    };
    Packer.prototype.packIEND = function() {
      return this._packChunk(constants.TYPE_IEND, null);
    };
  }
});

// node_modules/pngjs/lib/packer-async.js
var require_packer_async = __commonJS({
  "node_modules/pngjs/lib/packer-async.js"(exports, module) {
    "use strict";
    var util = __require("util");
    var Stream = __require("stream");
    var constants = require_constants();
    var Packer = require_packer();
    var PackerAsync = module.exports = function(opt) {
      Stream.call(this);
      let options = opt || {};
      this._packer = new Packer(options);
      this._deflate = this._packer.createDeflate();
      this.readable = true;
    };
    util.inherits(PackerAsync, Stream);
    PackerAsync.prototype.pack = function(data, width, height, gamma) {
      this.emit("data", Buffer.from(constants.PNG_SIGNATURE));
      this.emit("data", this._packer.packIHDR(width, height));
      if (gamma) {
        this.emit("data", this._packer.packGAMA(gamma));
      }
      let filteredData = this._packer.filterData(data, width, height);
      this._deflate.on("error", this.emit.bind(this, "error"));
      this._deflate.on(
        "data",
        function(compressedData) {
          this.emit("data", this._packer.packIDAT(compressedData));
        }.bind(this)
      );
      this._deflate.on(
        "end",
        function() {
          this.emit("data", this._packer.packIEND());
          this.emit("end");
        }.bind(this)
      );
      this._deflate.end(filteredData);
    };
  }
});

// node_modules/pngjs/lib/sync-inflate.js
var require_sync_inflate = __commonJS({
  "node_modules/pngjs/lib/sync-inflate.js"(exports, module) {
    "use strict";
    var assert = __require("assert").ok;
    var zlib = __require("zlib");
    var util = __require("util");
    var kMaxLength = __require("buffer").kMaxLength;
    function Inflate(opts) {
      if (!(this instanceof Inflate)) {
        return new Inflate(opts);
      }
      if (opts && opts.chunkSize < zlib.Z_MIN_CHUNK) {
        opts.chunkSize = zlib.Z_MIN_CHUNK;
      }
      zlib.Inflate.call(this, opts);
      this._offset = this._offset === void 0 ? this._outOffset : this._offset;
      this._buffer = this._buffer || this._outBuffer;
      if (opts && opts.maxLength != null) {
        this._maxLength = opts.maxLength;
      }
    }
    function createInflate(opts) {
      return new Inflate(opts);
    }
    function _close(engine, callback) {
      if (callback) {
        process.nextTick(callback);
      }
      if (!engine._handle) {
        return;
      }
      engine._handle.close();
      engine._handle = null;
    }
    Inflate.prototype._processChunk = function(chunk, flushFlag, asyncCb) {
      if (typeof asyncCb === "function") {
        return zlib.Inflate._processChunk.call(this, chunk, flushFlag, asyncCb);
      }
      let self = this;
      let availInBefore = chunk && chunk.length;
      let availOutBefore = this._chunkSize - this._offset;
      let leftToInflate = this._maxLength;
      let inOff = 0;
      let buffers = [];
      let nread = 0;
      let error;
      this.on("error", function(err) {
        error = err;
      });
      function handleChunk(availInAfter, availOutAfter) {
        if (self._hadError) {
          return;
        }
        let have = availOutBefore - availOutAfter;
        assert(have >= 0, "have should not go down");
        if (have > 0) {
          let out = self._buffer.slice(self._offset, self._offset + have);
          self._offset += have;
          if (out.length > leftToInflate) {
            out = out.slice(0, leftToInflate);
          }
          buffers.push(out);
          nread += out.length;
          leftToInflate -= out.length;
          if (leftToInflate === 0) {
            return false;
          }
        }
        if (availOutAfter === 0 || self._offset >= self._chunkSize) {
          availOutBefore = self._chunkSize;
          self._offset = 0;
          self._buffer = Buffer.allocUnsafe(self._chunkSize);
        }
        if (availOutAfter === 0) {
          inOff += availInBefore - availInAfter;
          availInBefore = availInAfter;
          return true;
        }
        return false;
      }
      assert(this._handle, "zlib binding closed");
      let res;
      do {
        res = this._handle.writeSync(
          flushFlag,
          chunk,
          // in
          inOff,
          // in_off
          availInBefore,
          // in_len
          this._buffer,
          // out
          this._offset,
          //out_off
          availOutBefore
        );
        res = res || this._writeState;
      } while (!this._hadError && handleChunk(res[0], res[1]));
      if (this._hadError) {
        throw error;
      }
      if (nread >= kMaxLength) {
        _close(this);
        throw new RangeError(
          "Cannot create final Buffer. It would be larger than 0x" + kMaxLength.toString(16) + " bytes"
        );
      }
      let buf = Buffer.concat(buffers, nread);
      _close(this);
      return buf;
    };
    util.inherits(Inflate, zlib.Inflate);
    function zlibBufferSync(engine, buffer) {
      if (typeof buffer === "string") {
        buffer = Buffer.from(buffer);
      }
      if (!(buffer instanceof Buffer)) {
        throw new TypeError("Not a string or buffer");
      }
      let flushFlag = engine._finishFlushFlag;
      if (flushFlag == null) {
        flushFlag = zlib.Z_FINISH;
      }
      return engine._processChunk(buffer, flushFlag);
    }
    function inflateSync(buffer, opts) {
      return zlibBufferSync(new Inflate(opts), buffer);
    }
    module.exports = exports = inflateSync;
    exports.Inflate = Inflate;
    exports.createInflate = createInflate;
    exports.inflateSync = inflateSync;
  }
});

// node_modules/pngjs/lib/sync-reader.js
var require_sync_reader = __commonJS({
  "node_modules/pngjs/lib/sync-reader.js"(exports, module) {
    "use strict";
    var SyncReader = module.exports = function(buffer) {
      this._buffer = buffer;
      this._reads = [];
    };
    SyncReader.prototype.read = function(length, callback) {
      this._reads.push({
        length: Math.abs(length),
        // if length < 0 then at most this length
        allowLess: length < 0,
        func: callback
      });
    };
    SyncReader.prototype.process = function() {
      while (this._reads.length > 0 && this._buffer.length) {
        let read = this._reads[0];
        if (this._buffer.length && (this._buffer.length >= read.length || read.allowLess)) {
          this._reads.shift();
          let buf = this._buffer;
          this._buffer = buf.slice(read.length);
          read.func.call(this, buf.slice(0, read.length));
        } else {
          break;
        }
      }
      if (this._reads.length > 0) {
        throw new Error("There are some read requests waitng on finished stream");
      }
      if (this._buffer.length > 0) {
        throw new Error("unrecognised content at end of stream");
      }
    };
  }
});

// node_modules/pngjs/lib/filter-parse-sync.js
var require_filter_parse_sync = __commonJS({
  "node_modules/pngjs/lib/filter-parse-sync.js"(exports) {
    "use strict";
    var SyncReader = require_sync_reader();
    var Filter = require_filter_parse();
    exports.process = function(inBuffer, bitmapInfo) {
      let outBuffers = [];
      let reader = new SyncReader(inBuffer);
      let filter = new Filter(bitmapInfo, {
        read: reader.read.bind(reader),
        write: function(bufferPart) {
          outBuffers.push(bufferPart);
        },
        complete: function() {
        }
      });
      filter.start();
      reader.process();
      return Buffer.concat(outBuffers);
    };
  }
});

// node_modules/pngjs/lib/parser-sync.js
var require_parser_sync = __commonJS({
  "node_modules/pngjs/lib/parser-sync.js"(exports, module) {
    "use strict";
    var hasSyncZlib = true;
    var zlib = __require("zlib");
    var inflateSync = require_sync_inflate();
    if (!zlib.deflateSync) {
      hasSyncZlib = false;
    }
    var SyncReader = require_sync_reader();
    var FilterSync = require_filter_parse_sync();
    var Parser = require_parser();
    var bitmapper = require_bitmapper();
    var formatNormaliser = require_format_normaliser();
    module.exports = function(buffer, options) {
      if (!hasSyncZlib) {
        throw new Error(
          "To use the sync capability of this library in old node versions, please pin pngjs to v2.3.0"
        );
      }
      let err;
      function handleError(_err_) {
        err = _err_;
      }
      let metaData;
      function handleMetaData(_metaData_) {
        metaData = _metaData_;
      }
      function handleTransColor(transColor) {
        metaData.transColor = transColor;
      }
      function handlePalette(palette) {
        metaData.palette = palette;
      }
      function handleSimpleTransparency() {
        metaData.alpha = true;
      }
      let gamma;
      function handleGamma(_gamma_) {
        gamma = _gamma_;
      }
      let inflateDataList = [];
      function handleInflateData(inflatedData2) {
        inflateDataList.push(inflatedData2);
      }
      let reader = new SyncReader(buffer);
      let parser = new Parser(options, {
        read: reader.read.bind(reader),
        error: handleError,
        metadata: handleMetaData,
        gamma: handleGamma,
        palette: handlePalette,
        transColor: handleTransColor,
        inflateData: handleInflateData,
        simpleTransparency: handleSimpleTransparency
      });
      parser.start();
      reader.process();
      if (err) {
        throw err;
      }
      let inflateData = Buffer.concat(inflateDataList);
      inflateDataList.length = 0;
      let inflatedData;
      if (metaData.interlace) {
        inflatedData = zlib.inflateSync(inflateData);
      } else {
        let rowSize = (metaData.width * metaData.bpp * metaData.depth + 7 >> 3) + 1;
        let imageSize = rowSize * metaData.height;
        inflatedData = inflateSync(inflateData, {
          chunkSize: imageSize,
          maxLength: imageSize
        });
      }
      inflateData = null;
      if (!inflatedData || !inflatedData.length) {
        throw new Error("bad png - invalid inflate data response");
      }
      let unfilteredData = FilterSync.process(inflatedData, metaData);
      inflateData = null;
      let bitmapData = bitmapper.dataToBitMap(unfilteredData, metaData);
      unfilteredData = null;
      let normalisedBitmapData = formatNormaliser(
        bitmapData,
        metaData,
        options.skipRescale
      );
      metaData.data = normalisedBitmapData;
      metaData.gamma = gamma || 0;
      return metaData;
    };
  }
});

// node_modules/pngjs/lib/packer-sync.js
var require_packer_sync = __commonJS({
  "node_modules/pngjs/lib/packer-sync.js"(exports, module) {
    "use strict";
    var hasSyncZlib = true;
    var zlib = __require("zlib");
    if (!zlib.deflateSync) {
      hasSyncZlib = false;
    }
    var constants = require_constants();
    var Packer = require_packer();
    module.exports = function(metaData, opt) {
      if (!hasSyncZlib) {
        throw new Error(
          "To use the sync capability of this library in old node versions, please pin pngjs to v2.3.0"
        );
      }
      let options = opt || {};
      let packer = new Packer(options);
      let chunks = [];
      chunks.push(Buffer.from(constants.PNG_SIGNATURE));
      chunks.push(packer.packIHDR(metaData.width, metaData.height));
      if (metaData.gamma) {
        chunks.push(packer.packGAMA(metaData.gamma));
      }
      let filteredData = packer.filterData(
        metaData.data,
        metaData.width,
        metaData.height
      );
      let compressedData = zlib.deflateSync(
        filteredData,
        packer.getDeflateOptions()
      );
      filteredData = null;
      if (!compressedData || !compressedData.length) {
        throw new Error("bad png - invalid compressed data response");
      }
      chunks.push(packer.packIDAT(compressedData));
      chunks.push(packer.packIEND());
      return Buffer.concat(chunks);
    };
  }
});

// node_modules/pngjs/lib/png-sync.js
var require_png_sync = __commonJS({
  "node_modules/pngjs/lib/png-sync.js"(exports) {
    "use strict";
    var parse = require_parser_sync();
    var pack = require_packer_sync();
    exports.read = function(buffer, options) {
      return parse(buffer, options || {});
    };
    exports.write = function(png, options) {
      return pack(png, options);
    };
  }
});

// node_modules/pngjs/lib/png.js
var require_png = __commonJS({
  "node_modules/pngjs/lib/png.js"(exports) {
    "use strict";
    var util = __require("util");
    var Stream = __require("stream");
    var Parser = require_parser_async();
    var Packer = require_packer_async();
    var PNGSync = require_png_sync();
    var PNG3 = exports.PNG = function(options) {
      Stream.call(this);
      options = options || {};
      this.width = options.width | 0;
      this.height = options.height | 0;
      this.data = this.width > 0 && this.height > 0 ? Buffer.alloc(4 * this.width * this.height) : null;
      if (options.fill && this.data) {
        this.data.fill(0);
      }
      this.gamma = 0;
      this.readable = this.writable = true;
      this._parser = new Parser(options);
      this._parser.on("error", this.emit.bind(this, "error"));
      this._parser.on("close", this._handleClose.bind(this));
      this._parser.on("metadata", this._metadata.bind(this));
      this._parser.on("gamma", this._gamma.bind(this));
      this._parser.on(
        "parsed",
        function(data) {
          this.data = data;
          this.emit("parsed", data);
        }.bind(this)
      );
      this._packer = new Packer(options);
      this._packer.on("data", this.emit.bind(this, "data"));
      this._packer.on("end", this.emit.bind(this, "end"));
      this._parser.on("close", this._handleClose.bind(this));
      this._packer.on("error", this.emit.bind(this, "error"));
    };
    util.inherits(PNG3, Stream);
    PNG3.sync = PNGSync;
    PNG3.prototype.pack = function() {
      if (!this.data || !this.data.length) {
        this.emit("error", "No data provided");
        return this;
      }
      process.nextTick(
        function() {
          this._packer.pack(this.data, this.width, this.height, this.gamma);
        }.bind(this)
      );
      return this;
    };
    PNG3.prototype.parse = function(data, callback) {
      if (callback) {
        let onParsed, onError;
        onParsed = function(parsedData) {
          this.removeListener("error", onError);
          this.data = parsedData;
          callback(null, this);
        }.bind(this);
        onError = function(err) {
          this.removeListener("parsed", onParsed);
          callback(err, null);
        }.bind(this);
        this.once("parsed", onParsed);
        this.once("error", onError);
      }
      this.end(data);
      return this;
    };
    PNG3.prototype.write = function(data) {
      this._parser.write(data);
      return true;
    };
    PNG3.prototype.end = function(data) {
      this._parser.end(data);
    };
    PNG3.prototype._metadata = function(metadata) {
      this.width = metadata.width;
      this.height = metadata.height;
      this.emit("metadata", metadata);
    };
    PNG3.prototype._gamma = function(gamma) {
      this.gamma = gamma;
    };
    PNG3.prototype._handleClose = function() {
      if (!this._parser.writable && !this._packer.readable) {
        this.emit("close");
      }
    };
    PNG3.bitblt = function(src, dst, srcX, srcY, width, height, deltaX, deltaY) {
      srcX |= 0;
      srcY |= 0;
      width |= 0;
      height |= 0;
      deltaX |= 0;
      deltaY |= 0;
      if (srcX > src.width || srcY > src.height || srcX + width > src.width || srcY + height > src.height) {
        throw new Error("bitblt reading outside image");
      }
      if (deltaX > dst.width || deltaY > dst.height || deltaX + width > dst.width || deltaY + height > dst.height) {
        throw new Error("bitblt writing outside image");
      }
      for (let y = 0; y < height; y++) {
        src.data.copy(
          dst.data,
          (deltaY + y) * dst.width + deltaX << 2,
          (srcY + y) * src.width + srcX << 2,
          (srcY + y) * src.width + srcX + width << 2
        );
      }
    };
    PNG3.prototype.bitblt = function(dst, srcX, srcY, width, height, deltaX, deltaY) {
      PNG3.bitblt(this, dst, srcX, srcY, width, height, deltaX, deltaY);
      return this;
    };
    PNG3.adjustGamma = function(src) {
      if (src.gamma) {
        for (let y = 0; y < src.height; y++) {
          for (let x = 0; x < src.width; x++) {
            let idx = src.width * y + x << 2;
            for (let i = 0; i < 3; i++) {
              let sample = src.data[idx + i] / 255;
              sample = Math.pow(sample, 1 / 2.2 / src.gamma);
              src.data[idx + i] = Math.round(sample * 255);
            }
          }
        }
        src.gamma = 0;
      }
    };
    PNG3.prototype.adjustGamma = function() {
      PNG3.adjustGamma(this);
    };
  }
});

// server/ground/ground.ts
var import_pngjs2 = __toESM(require_png(), 1);

// src/model/geo.ts
var DEG = Math.PI / 180;
var COMPASS16 = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
function compassToDegrees(s) {
  const i = COMPASS16.indexOf(s.trim().toUpperCase());
  return i < 0 ? null : i * 22.5;
}

// src/model/nws.ts
var NWS = "https://api.weather.gov";
var HEADERS = { Accept: "application/geo+json" };
async function getJson(f, url, signal, base = NWS) {
  const target = base !== NWS && url.startsWith(NWS) ? base + url.slice(NWS.length) : url;
  const res = await f(target, { headers: HEADERS, signal });
  if (!res.ok) throw new Error(`NWS ${res.status} for ${url}`);
  return res.json();
}
function durationHours(d) {
  const m = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?)?$/.exec(d);
  if (!m) return 1;
  return Number(m[1] ?? 0) * 24 + Number(m[2] ?? 0) + Number(m[3] ?? 0) / 60;
}
function toMph(v, uom = "") {
  if (uom.endsWith("km_h-1")) return v * 0.621371;
  if (uom.endsWith("m_s-1")) return v * 2.23694;
  if (uom.endsWith("kt")) return v * 1.15078;
  return v;
}
function toF(v, uom = "") {
  return uom.endsWith("degF") ? v : v * 9 / 5 + 32;
}
function expandSeries(s, convert = (v) => v) {
  const out = /* @__PURE__ */ new Map();
  for (const { validTime, value } of s?.values ?? []) {
    if (value == null) continue;
    const [start, dur = "PT1H"] = validTime.split("/");
    const t0 = Math.floor(Date.parse(start) / 36e5) * 36e5;
    const h = Math.max(1, Math.round(durationHours(dur)));
    const v = convert(value, s?.uom);
    for (let k = 0; k < h; k++) out.set(t0 + k * 36e5, v);
  }
  return out;
}
function parseGridData(props, windowStart, windowHours = 48) {
  const temp = expandSeries(props.temperature, toF);
  const wind = expandSeries(props.windSpeed, toMph);
  const gust = expandSeries(props.windGust, toMph);
  const dir = expandSeries(props.windDirection);
  const sky = expandSeries(props.skyCover);
  const rh = expandSeries(props.relativeHumidity);
  const dew = expandSeries(props.dewpoint, toF);
  const start = Math.floor(windowStart / 36e5) * 36e5;
  const hours = [];
  for (let k = 0; k < windowHours; k++) {
    const t = start + k * 36e5;
    const tempF = temp.get(t);
    const windMph = wind.get(t);
    const windFrom = dir.get(t);
    if (tempF == null || windMph == null || windFrom == null) continue;
    hours.push({
      at: new Date(t).toISOString(),
      tempF,
      windMph,
      windFrom,
      gustMph: gust.get(t),
      skyCoverPct: sky.get(t),
      humidityPct: rh.get(t),
      dewPointF: dew.get(t)
    });
  }
  return hours;
}
function parseObservation(props, station) {
  const t = props?.temperature;
  const w = props?.windSpeed;
  const d = props?.windDirection;
  if (!props?.timestamp || t?.value == null || w?.value == null) return void 0;
  const windMph = toMph(w.value, w.unitCode);
  if (d?.value == null && windMph > 1) return void 0;
  const g = props.windGust;
  const layers = props.cloudLayers ?? [];
  const okta = { SKC: 0, CLR: 0, FEW: 20, SCT: 45, BKN: 75, OVC: 100, VV: 100 };
  const sky = layers.length ? Math.max(...layers.map((l) => okta[l.amount ?? ""] ?? 0)) : void 0;
  return {
    station,
    at: new Date(props.timestamp).toISOString(),
    tempF: toF(t.value, t.unitCode),
    windMph,
    windFrom: d?.value ?? 0,
    gustMph: g?.value != null ? toMph(g.value, g.unitCode) : void 0,
    skyCoverPct: sky,
    humidityPct: props.relativeHumidity?.value ?? void 0,
    // Stations report pressure in Pa.
    pressureHpa: props.barometricPressure?.value != null ? props.barometricPressure.value / 100 : void 0,
    dewPointF: props.dewpoint?.value != null ? toF(props.dewpoint.value, props.dewpoint.unitCode) : void 0
  };
}
function parseHourlyForecast(props) {
  return (props?.periods ?? []).flatMap((p) => {
    const speeds = String(p.windSpeed ?? "").match(/\d+/g)?.map(Number) ?? [];
    const windFrom = compassToDegrees(String(p.windDirection ?? ""));
    if (!speeds.length || windFrom == null) return [];
    const tempF = p.temperatureUnit === "C" ? p.temperature * 9 / 5 + 32 : p.temperature;
    return [
      {
        at: new Date(p.startTime).toISOString(),
        tempF,
        windMph: speeds.reduce((a, b) => a + b, 0) / speeds.length,
        windFrom,
        humidityPct: p.relativeHumidity?.value ?? void 0
      }
    ];
  });
}
async function fetchNws(lat, lon, opts = {}) {
  const f = opts.fetch ?? globalThis.fetch;
  const now = opts.now ?? /* @__PURE__ */ new Date();
  const base = opts.nwsBase ?? NWS;
  const get = (url) => getJson(f, url, opts.signal, base);
  const point = await get(`${NWS}/points/${lat.toFixed(4)},${lon.toFixed(4)}`);
  const pp = point?.properties ?? {};
  const windowStart = now.getTime() - 6 * 36e5;
  let hours = [];
  try {
    const grid = await get(pp.forecastGridData);
    hours = parseGridData(grid.properties, windowStart, 54);
  } catch (err) {
    if (!pp.forecastHourly) throw err;
  }
  if (hours.length < 6 && pp.forecastHourly) {
    const hourly = await get(pp.forecastHourly);
    hours = parseHourlyForecast(hourly.properties);
  }
  if (!hours.length) throw new Error("NWS returned no usable hours");
  let observed;
  try {
    const stations = await get(pp.observationStations);
    const id = stations?.features?.[0]?.properties?.stationIdentifier;
    if (id) {
      const obs = await get(`${NWS}/stations/${id}/observations/latest`);
      observed = parseObservation(obs?.properties, id);
      if (observed && now.getTime() - Date.parse(observed.at) > 2 * 36e5) observed = void 0;
    }
  } catch {
  }
  return {
    source: "nws",
    lat,
    lon,
    fetchedAt: now.toISOString(),
    timeZone: pp.timeZone,
    hours,
    observed
  };
}

// src/model/openMeteo.ts
var HOURLY = "temperature_2m,wind_speed_10m,wind_direction_10m,wind_gusts_10m,cloud_cover,relative_humidity_2m,surface_pressure,dew_point_2m";
function openMeteoUrl(lat, lon) {
  const q = new URLSearchParams({
    latitude: lat.toFixed(4),
    longitude: lon.toFixed(4),
    hourly: HOURLY,
    current: HOURLY,
    wind_speed_unit: "mph",
    temperature_unit: "fahrenheit",
    timezone: "auto",
    timeformat: "unixtime",
    past_hours: "6",
    forecast_hours: "48"
  });
  return `https://api.open-meteo.com/v1/forecast?${q}`;
}
function parseOpenMeteo(body, lat, lon, now) {
  const h = body?.hourly ?? {};
  const time = h.time ?? [];
  const hours = [];
  time.forEach((t, k) => {
    const tempF = h.temperature_2m?.[k];
    const windMph = h.wind_speed_10m?.[k];
    const windFrom = h.wind_direction_10m?.[k];
    if (tempF == null || windMph == null || windFrom == null) return;
    hours.push({
      at: new Date(t * 1e3).toISOString(),
      tempF,
      windMph,
      windFrom,
      gustMph: h.wind_gusts_10m?.[k] ?? void 0,
      skyCoverPct: h.cloud_cover?.[k] ?? void 0,
      humidityPct: h.relative_humidity_2m?.[k] ?? void 0,
      pressureHpa: h.surface_pressure?.[k] ?? void 0,
      dewPointF: h.dew_point_2m?.[k] ?? void 0
    });
  });
  const c = body?.current;
  const observed = c && c.wind_speed_10m != null && c.wind_direction_10m != null && c.temperature_2m != null ? {
    station: "open-meteo nowcast",
    at: new Date(c.time * 1e3).toISOString(),
    tempF: c.temperature_2m,
    windMph: c.wind_speed_10m,
    windFrom: c.wind_direction_10m,
    gustMph: c.wind_gusts_10m ?? void 0,
    skyCoverPct: c.cloud_cover ?? void 0,
    humidityPct: c.relative_humidity_2m ?? void 0,
    pressureHpa: c.surface_pressure ?? void 0,
    dewPointF: c.dew_point_2m ?? void 0
  } : void 0;
  return {
    source: "open-meteo",
    lat,
    lon,
    fetchedAt: now.toISOString(),
    timeZone: body?.timezone,
    hours,
    observed
  };
}
async function fetchOpenMeteo(lat, lon, opts = {}) {
  const f = opts.fetch ?? globalThis.fetch;
  const res = await f(openMeteoUrl(lat, lon), { signal: opts.signal });
  if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
  const fc = parseOpenMeteo(await res.json(), lat, lon, opts.now ?? /* @__PURE__ */ new Date());
  if (!fc.hours.length) throw new Error("Open-Meteo returned no usable hours");
  return fc;
}

// src/model/forecast.ts
function memoryCache() {
  const m = /* @__PURE__ */ new Map();
  return { get: (k) => m.get(k), set: (k, v) => void m.set(k, v) };
}
var forecastKey = (lat, lon) => `${lat.toFixed(2)},${lon.toFixed(2)}`;
async function getForecast(lat, lon, opts = {}) {
  const now = opts.now ?? /* @__PURE__ */ new Date();
  const key = forecastKey(lat, lon);
  const cached = opts.cache ? await opts.cache.get(key) : void 0;
  const maxAge = (opts.maxAgeMin ?? 45) * 6e4;
  if (cached && now.getTime() - Date.parse(cached.fetchedAt) < maxAge) return { ...cached, stale: false };
  const providers = opts.providers ?? [fetchNws, fetchOpenMeteo];
  const errors = [];
  for (const p of providers) {
    try {
      let fc = await p(lat, lon, { fetch: opts.fetch, signal: opts.signal, now, nwsBase: opts.nwsBase });
      if (!opts.providers) fc = await withPressure(fc, lat, lon, { fetch: opts.fetch, signal: opts.signal, now });
      if (opts.cache) await opts.cache.set(key, fc);
      return fc;
    } catch (err) {
      if (opts.signal?.aborted) throw err;
      errors.push(err instanceof Error ? err.message : String(err));
    }
  }
  if (cached) return { ...cached, stale: true };
  throw new Error(`No weather for this spot: ${errors.join("; ")}`);
}
async function withPressure(fc, lat, lon, opts) {
  if (fc.hours.some((h) => h.pressureHpa != null)) return fc;
  try {
    const om = await fetchOpenMeteo(lat, lon, opts);
    const byHour = new Map(om.hours.map((h) => [h.at, h]));
    return {
      ...fc,
      hours: fc.hours.map((h) => {
        const o = byHour.get(h.at);
        return o ? { ...h, pressureHpa: o.pressureHpa, dewPointF: h.dewPointF ?? o.dewPointF } : h;
      })
    };
  } catch {
    return fc;
  }
}

// server/ground/vegetation.ts
var import_pngjs = __toESM(require_png(), 1);
var CDL_COLORS = [
  [1, [255, 211, 0]],
  // corn
  [4, [255, 158, 11]],
  // sorghum
  [5, [38, 112, 0]],
  // soybeans
  [24, [165, 112, 0]],
  // winter wheat
  [36, [255, 165, 226]],
  // alfalfa
  [37, [165, 245, 141]],
  // other hay
  [61, [191, 191, 119]],
  // fallow
  [176, [232, 255, 191]]
  // grass/pasture
];
function cdlFromRgb(r, g, b) {
  let best = 0, bestD = Infinity;
  for (const [code, [cr, cg, cb]] of CDL_COLORS) {
    const d = (r - cr) ** 2 + (g - cg) ** 2 + (b - cb) ** 2;
    if (d < bestD) {
      bestD = d;
      best = code;
    }
  }
  return bestD > 30 ** 2 ? 0 : best;
}
function exportSize(b, cols, scale = 4) {
  const w = cols * scale;
  return [w, Math.max(1, Math.round(w * (b.north - b.south) / (b.east - b.west)))];
}
function reduce(png, cols, rows, scale, cell) {
  const img = import_pngjs.PNG.sync.read(png);
  const out = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const px = [];
      for (let y = 0; y < scale; y++)
        for (let x = 0; x < scale; x++) {
          const X = Math.min(img.width - 1, Math.floor((c * scale + x + 0.5) / (cols * scale) * img.width));
          const Y = Math.min(img.height - 1, Math.floor((r * scale + y + 0.5) / (rows * scale) * img.height));
          const i = (Y * img.width + X) * 4;
          if (img.data[i + 3] < 128) continue;
          px.push([img.data[i], img.data[i + 1], img.data[i + 2]]);
        }
      out.push(cell(px));
    }
  return out;
}
function cropsFromPng(png, cols, rows = cols, scale = 4) {
  return reduce(png, cols, rows, scale, (px) => {
    const votes = /* @__PURE__ */ new Map();
    for (const [r, g, b] of px) {
      const code = cdlFromRgb(r, g, b);
      if (code) votes.set(code, (votes.get(code) ?? 0) + 1);
    }
    let best = 0, n = 0;
    for (const [code, k] of votes) if (k > n) {
      best = code;
      n = k;
    }
    return n >= Math.max(2, px.length / 3) ? best : 0;
  });
}
function greennessFromPng(png, cols, rows = cols, scale = 4) {
  return reduce(png, cols, rows, scale, (px) => {
    if (!px.length) return 0;
    let sum = 0;
    for (const [nir, red] of px) sum += nir + red > 0 ? (nir - red) / (nir + red) : 0;
    return Math.round(Math.max(0, sum / px.length * 100));
  });
}
async function image(f, url, host) {
  const res = await f(url, { headers: { "user-agent": "esaus-trails (hunting map)" } });
  if (!res.ok) throw new Error(`${host} returned ${res.status}`);
  if (!(res.headers.get("content-type") ?? "").includes("png")) throw new Error(`${host} did not return an image`);
  return Buffer.from(await res.arrayBuffer());
}
async function fetchCrops(b, f = fetch, cols = 32, rows = cols, year = (/* @__PURE__ */ new Date()).getFullYear() - 1) {
  const url = `https://nassgeodata.gmu.edu/CropScapeService/wms_cdlall.cgi?service=WMS&version=1.1.1&request=GetMap&layers=cdl_${year}&styles=&srs=EPSG:4326&bbox=${b.west},${b.south},${b.east},${b.north}&width=${cols * 4}&height=${rows * 4}&format=image/png&transparent=true`;
  return cropsFromPng(await image(f, url, "nassgeodata.gmu.edu"), cols, rows);
}
async function fetchGreenness(b, f = fetch, cols = 32, rows = cols) {
  const [w, h] = exportSize(b, cols);
  const url = `https://imagery.nationalmap.gov/arcgis/rest/services/USGSNAIPImagery/ImageServer/exportImage?f=image&bbox=${b.west},${b.south},${b.east},${b.north}&bboxSR=4326&imageSR=4326&size=${w},${h}&format=png&bandIds=3,0,1&interpolation=RSP_NearestNeighbor`;
  return greennessFromPng(await image(f, url, "imagery.nationalmap.gov"), cols, rows);
}

// server/ground/ground.ts
var GRID_SIZE = 32;
var HALF_LAT = 9e-3;
function bboxAround(lat, lng) {
  const halfLng = HALF_LAT / Math.cos(lat * Math.PI / 180);
  return { west: lng - halfLng, east: lng + halfLng, south: lat - HALF_LAT, north: lat + HALF_LAT };
}
function cellCenters(b, cols = GRID_SIZE, rows = cols) {
  const out = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      out.push({ lat: b.north - (r + 0.5) / rows * (b.north - b.south), lng: b.west + (c + 0.5) / cols * (b.east - b.west) });
  return out;
}
var sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function getJsonRetry(f, url, retryDelayMs, deadline, tries = 4) {
  for (let i = 1; ; i++) {
    const res = await f(url, { headers: { "user-agent": "esaus-trails (hunting map)" }, signal: AbortSignal.timeout(8e3) });
    if (res.ok) return res.json();
    if (res.status !== 429 && res.status < 500 || i >= tries) throw new Error(`${new URL(url).host} returned ${res.status}`);
    const header = res.headers.get("retry-after");
    const asked = header ? Number(header) : NaN;
    const wait = Number.isFinite(asked) ? Math.min(asked * 1e3, 5e3) : retryDelayMs * 2 ** (i - 1);
    if (Date.now() + wait > deadline) throw new Error(`${new URL(url).host} returned ${res.status}`);
    await sleep(wait);
  }
}
async function pool(tasks, limit) {
  const out = new Array(tasks.length);
  let next = 0;
  let failed = false;
  await Promise.all(
    Array.from({ length: Math.min(limit, tasks.length) }, async () => {
      while (!failed && next < tasks.length) {
        const i = next++;
        try {
          out[i] = await tasks[i]();
        } catch (err) {
          failed = true;
          throw err;
        }
      }
    })
  );
  return out;
}
var DepUnavailable = class extends Error {
};
var DEP_TIMEOUT_MS = 1e4;
var DEP_BREAKER_MS = 6e4;
var depDownUntil = 0;
function elevationFromTiff(buf, cols, rows) {
  const bad = (why) => new Error(`3DEP elevation reply was malformed or had no data (${why})`);
  if (buf.length < 16) throw bad("too short");
  const le = buf.toString("latin1", 0, 2) === "II";
  if (!le && buf.toString("latin1", 0, 2) !== "MM") throw bad("not a TIFF");
  const u16 = (o) => le ? buf.readUInt16LE(o) : buf.readUInt16BE(o);
  const u32 = (o) => le ? buf.readUInt32LE(o) : buf.readUInt32BE(o);
  const f32 = (o) => le ? buf.readFloatLE(o) : buf.readFloatBE(o);
  const tags = /* @__PURE__ */ new Map();
  try {
    const ifd = u32(4);
    const n = u16(ifd);
    for (let i = 0; i < n; i++) {
      const e = ifd + 2 + i * 12;
      const type = u16(e + 2), count = u32(e + 4);
      const size = type === 3 ? 2 : type === 4 ? 4 : 0;
      if (!size) continue;
      const at = count * size <= 4 ? e + 8 : u32(e + 8);
      tags.set(u16(e), Array.from({ length: Math.min(count, 1e5) }, (_, k) => size === 2 ? u16(at + k * 2) : u32(at + k * 4)));
    }
  } catch {
    throw bad("unreadable header");
  }
  const one = (t) => tags.get(t)?.[0];
  const width = one(256), height = one(257);
  if (width !== cols || height !== rows) throw bad("wrong size");
  if (one(259) !== 1 || one(258) !== 32 || one(339) !== 3 || (one(277) ?? 1) !== 1) throw bad("unsupported format");
  const out = new Array(cols * rows);
  const put = (r, c, at) => {
    if (r < rows && c < cols) out[r * cols + c] = f32(at);
  };
  try {
    if (tags.has(324)) {
      const tw = one(322), th = one(323), offs = tags.get(324);
      const perRow = Math.ceil(cols / tw);
      offs.forEach((off, t) => {
        const r0 = Math.floor(t / perRow) * th, c0 = t % perRow * tw;
        for (let r = 0; r < th; r++) for (let c = 0; c < tw; c++) put(r0 + r, c0 + c, off + (r * tw + c) * 4);
      });
    } else {
      const per = one(278) ?? rows, offs = tags.get(273);
      offs.forEach((off, s) => {
        for (let r = 0; r < per; r++) for (let c = 0; c < cols; c++) put(s * per + r, c, off + (r * cols + c) * 4);
      });
    }
  } catch {
    throw bad("truncated");
  }
  if (out.some((v) => !Number.isFinite(v) || v < -100 || v > 6e3)) throw bad("no data");
  return out;
}
async function fetch3dep(f, b, cols, rows) {
  if (Date.now() < depDownUntil) throw new DepUnavailable("3DEP skipped: it failed a moment ago");
  const [w, h] = exportSize(b, cols);
  const url = `https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer/exportImage?f=image&bbox=${b.west},${b.south},${b.east},${b.north}&bboxSR=4326&imageSR=4326&size=${w},${h}&format=tiff&pixelType=F32&noData=-9999&interpolation=RSP_BilinearInterpolation`;
  let buf;
  try {
    const res = await f(url, { headers: { "user-agent": "esaus-trails (hunting map)" }, signal: AbortSignal.timeout(DEP_TIMEOUT_MS) });
    if (!res.ok) throw new Error(`elevation.nationalmap.gov returned ${res.status}`);
    buf = Buffer.from(await res.arrayBuffer());
  } catch (err) {
    depDownUntil = Date.now() + DEP_BREAKER_MS;
    throw new DepUnavailable(err instanceof Error ? err.message : "3DEP unreachable");
  }
  return gridFromRaster(elevationFromTiff(buf, w, h), w, h, cols, rows);
}
function gridFromRaster(v, w, h, cols, rows) {
  const out = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const x0 = Math.floor(c * w / cols), x1 = Math.max(x0 + 1, Math.floor((c + 1) * w / cols));
      const y0 = Math.floor(r * h / rows), y1 = Math.max(y0 + 1, Math.floor((r + 1) * h / rows));
      let sum = 0, n = 0;
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
        sum += v[y * w + x];
        n++;
      }
      out.push(sum / n);
    }
  return out;
}
async function elevationFrom(source, chunks, f, delay, deadline) {
  const tasks = chunks.map((chunk, n) => async () => {
    if (source === "opentopodata" && n > 0 && delay > 0) await sleep(1100);
    if (source === "open-meteo") {
      const lat = chunk.map((p) => p.lat.toFixed(5)).join(",");
      const lng = chunk.map((p) => p.lng.toFixed(5)).join(",");
      const body2 = await getJsonRetry(f, `https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lng}`, delay, deadline);
      if (!Array.isArray(body2?.elevation) || body2.elevation.length !== chunk.length || body2.elevation.some((v) => typeof v !== "number")) throw new Error("elevation reply was malformed");
      return body2.elevation;
    }
    const locs = chunk.map((p) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`).join("|");
    const body = await getJsonRetry(f, `https://api.opentopodata.org/v1/srtm30m?locations=${locs}`, delay, deadline);
    const el = body?.results?.map((r) => r?.elevation);
    if (!Array.isArray(el) || el.length !== chunk.length || el.some((v) => typeof v !== "number")) throw new Error("elevation reply was malformed");
    return el;
  });
  return (await pool(tasks, source === "opentopodata" ? 1 : 3)).flat();
}
async function fetchElevationWithSource(b, f, cols, rows, opts = {}) {
  const pts = cellCenters(b, cols, rows);
  const chunks = [];
  for (let i = 0; i < pts.length; i += 100) chunks.push(pts.slice(i, i + 100));
  const delay = opts.retryDelayMs ?? 1e3;
  const deadline = Date.now() + (delay > 0 ? 2e4 : 1e9);
  let retryLater = false;
  try {
    return { values: await fetch3dep(f, b, cols, rows), source: "3dep" };
  } catch (err) {
    retryLater = err instanceof DepUnavailable;
  }
  try {
    return { values: await elevationFrom("open-meteo", chunks, f, delay, deadline), source: "open-meteo", retryLater };
  } catch (first) {
    try {
      return { values: await elevationFrom("opentopodata", chunks, f, delay, Date.now() + (delay > 0 ? 2e4 : 1e9)), source: "opentopodata", retryLater };
    } catch {
      throw first;
    }
  }
}
var NLCD_COLORS = [
  [11, [70, 107, 159]],
  [12, [209, 222, 248]],
  [21, [222, 197, 197]],
  [22, [217, 146, 130]],
  [23, [235, 0, 0]],
  [24, [171, 0, 0]],
  [31, [179, 172, 159]],
  [41, [104, 171, 95]],
  [42, [28, 95, 44]],
  [43, [181, 197, 143]],
  [52, [204, 184, 121]],
  [71, [223, 223, 194]],
  [81, [220, 217, 57]],
  [82, [171, 108, 40]],
  [90, [184, 217, 235]],
  [95, [108, 159, 184]]
];
function nlcdFromRgb(r, g, b) {
  let best = 0, bestD = Infinity;
  for (const [code, [cr, cg, cb]] of NLCD_COLORS) {
    const d = (r - cr) ** 2 + (g - cg) ** 2 + (b - cb) ** 2;
    if (d < bestD) {
      bestD = d;
      best = code;
    }
  }
  return bestD > 40 ** 2 ? 0 : best;
}
function coverFromPng(png, cols = GRID_SIZE, rows = cols, scale = 4) {
  const img = import_pngjs2.PNG.sync.read(png);
  const out = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const votes = /* @__PURE__ */ new Map();
      for (let y = 0; y < scale; y++)
        for (let x = 0; x < scale; x++) {
          const px = Math.min(img.width - 1, Math.floor((c * scale + x + 0.5) / (cols * scale) * img.width));
          const py = Math.min(img.height - 1, Math.floor((r * scale + y + 0.5) / (rows * scale) * img.height));
          const i = (py * img.width + px) * 4;
          if (img.data[i + 3] < 128) continue;
          const code = nlcdFromRgb(img.data[i], img.data[i + 1], img.data[i + 2]);
          if (code) votes.set(code, (votes.get(code) ?? 0) + 1);
        }
      let best = 0, bestN = 0;
      for (const [code, k] of votes) if (k > bestN) {
        best = code;
        bestN = k;
      }
      out.push(best);
    }
  return out;
}
async function fetchCover(b, f = fetch, cols = GRID_SIZE, rows = cols) {
  const url = `https://www.mrlc.gov/geoserver/mrlc_display/NLCD_2021_Land_Cover_L48/wms?service=WMS&version=1.1.1&request=GetMap&layers=NLCD_2021_Land_Cover_L48&styles=&srs=EPSG:4326&bbox=${b.west},${b.south},${b.east},${b.north}&width=${cols * 4}&height=${rows * 4}&format=image/png&transparent=true`;
  const res = await f(url, { headers: { "user-agent": "esaus-trails (hunting map)" } });
  if (!res.ok) throw new Error(`mrlc.gov returned ${res.status}`);
  if (!(res.headers.get("content-type") ?? "").includes("png")) throw new Error("mrlc.gov did not return an image");
  return coverFromPng(Buffer.from(await res.arrayBuffer()), cols, rows);
}
var NWS_UA = process.env.NWS_USER_AGENT || "(esaus-trails, set NWS_USER_AGENT to 'app, contact@email')";
var forecastCache = memoryCache();
var defaultForecast = (lat, lng, now) => getForecast(lat, lng, {
  now,
  cache: forecastCache,
  maxAgeMin: 30,
  // NWS asks for a User-Agent with contact info; a server can send one.
  fetch: (url, init) => fetch(url, { ...init, headers: { ...init?.headers, "user-agent": NWS_UA } })
});
function toWeatherHours(hours, now) {
  const thisHour = Math.floor(now.getTime() / 36e5) * 36e5;
  return hours.filter((h) => Date.parse(h.at) >= thisHour).slice(0, 24).map((h) => ({ at: h.at, tempF: h.tempF, windMph: h.windMph, windFrom: h.windFrom, gustMph: h.gustMph, skyCover: h.skyCoverPct, pressureHpa: h.pressureHpa, dewPointF: h.dewPointF }));
}
var terrainCache = /* @__PURE__ */ new Map();
async function buildGround(lat, lng, opts = {}) {
  const snap = 25e-4;
  return buildGroundBbox(bboxAround(Math.round(lat / snap) * snap, Math.round(lng / snap) * snap), GRID_SIZE, GRID_SIZE, opts);
}
var terrainInFlight = /* @__PURE__ */ new Map();
async function buildTerrain(b, cols, rows, f, retryDelayMs) {
  const notes = [];
  let demNote = "Elevation: Copernicus 90 m DEM via Open-Meteo, so small benches and creek banks can be smoothed out.";
  let cacheable = true;
  let retryLater = false;
  const [elevationM, cover, crop, greenness] = await Promise.all([
    fetchElevationWithSource(b, f, cols, rows, { retryDelayMs }).then((r) => {
      if (r.retryLater) retryLater = true;
      if (r.source === "3dep") demNote = "Elevation: USGS 3DEP, about 10 m, so benches, saddles and draws show.";
      if (r.source === "opentopodata") demNote = "Elevation: SRTM 30 m DEM via Open Topo Data (the main elevation service was busy), so small benches and creek banks can be smoothed out.";
      return r.values;
    }).catch((err) => {
      cacheable = false;
      demNote = `Elevation unavailable (${err instanceof Error ? err.message : "error"}); the ground is treated as flat, so ridges, benches and bedding on slopes can't be read here right now. Try again in a minute.`;
      return new Array(cols * rows).fill(0);
    }),
    fetchCover(b, f, cols, rows).catch((err) => {
      notes.push(`Land cover unavailable (${err instanceof Error ? err.message : "error"}); cover is unknown.`);
      return new Array(cols * rows).fill(0);
    }),
    fetchCrops(b, f, cols, rows).catch(() => {
      notes.push("Crop map (CDL) unavailable; cultivated fields show as cultivated crops.");
      return new Array(cols * rows).fill(0);
    }),
    fetchGreenness(b, f, cols, rows).catch(() => {
      notes.push("Overhead greenness (NAIP) unavailable; food is predicted from land cover and topography only.");
      return void 0;
    })
  ]);
  return { terrain: { elevationM, cover, crop, greenness, notes: [demNote, ...notes], ...retryLater && cacheable ? { expiresAt: Date.now() + DEP_BREAKER_MS } : {} }, cacheable };
}
async function buildGroundBbox(b, cols, rows, opts = {}) {
  const f = opts.fetch ?? fetch;
  const now = opts.now ?? /* @__PURE__ */ new Date();
  const key = [b.west, b.south, b.east, b.north].map((x) => x.toFixed(4)).join(",") + `/${cols}x${rows}`;
  let terrain = terrainCache.get(key);
  if (terrain?.expiresAt && Date.now() > terrain.expiresAt) {
    terrainCache.delete(key);
    terrain = void 0;
  }
  if (!terrain) {
    let building = terrainInFlight.get(key);
    if (!building) {
      building = buildTerrain(b, cols, rows, f, opts.retryDelayMs).finally(() => {
        if (terrainInFlight.get(key) === building) terrainInFlight.delete(key);
      });
      terrainInFlight.set(key, building);
    }
    const built = await building;
    terrain = built.terrain;
    if (built.cacheable) {
      if (terrainCache.size > 500) terrainCache.clear();
      terrainCache.set(key, terrain);
    }
  }
  const midLat = (b.north + b.south) / 2;
  const midLng = (b.east + b.west) / 2;
  const fc = await (opts.forecast ?? defaultForecast)(midLat, midLng, now);
  const hours = toWeatherHours(fc.hours, now);
  if (!hours.length) throw new Error("forecast had no future hours");
  const notes = fc.stale ? [...terrain.notes, "Weather is an older cached forecast; the phone may be out of service."] : terrain.notes;
  return {
    ...b,
    cols,
    rows,
    elevationM: terrain.elevationM,
    cover: terrain.cover,
    crop: terrain.crop,
    ...terrain.greenness ? { greenness: terrain.greenness } : {},
    weather: { source: fc.source, hours },
    notes
  };
}

// server/ground/route.ts
async function handleGround(req, res) {
  const url = new URL(req.url || "/", "http://localhost");
  if (url.pathname !== "/api/ground") return false;
  const send = (status, body) => {
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify(body));
  };
  if (req.method !== "GET") {
    send(405, { error: "GET only" });
    return true;
  }
  const q = (k) => url.searchParams.has(k) ? Number(url.searchParams.get(k)) : NaN;
  const [west, south, east, north] = ["west", "south", "east", "north"].map(q);
  const lat = q("lat"), lng = q("lng");
  const okLat = (v) => Number.isFinite(v) && Math.abs(v) <= 85;
  const okLng = (v) => Number.isFinite(v) && Math.abs(v) <= 180;
  try {
    if ([west, east].every(okLng) && [south, north].every(okLat)) {
      const cols = Math.round(q("cols") || 32), rows = Math.round(q("rows") || 32);
      if (!(west < east && south < north) || east - west > 0.4 || north - south > 0.3 || cols < 4 || rows < 4 || cols > 64 || rows > 64) {
        send(400, { error: "box too large or malformed (max 0.4 x 0.3 degrees, 64 x 64 cells)" });
        return true;
      }
      send(200, await buildGroundBbox({ west, south, east, north }, cols, rows));
    } else if (okLat(lat) && okLng(lng)) {
      send(200, await buildGround(lat, lng));
    } else {
      send(400, { error: "give lat and lng, or west, south, east and north" });
    }
  } catch (err) {
    console.error("ground:", err);
    send(502, { error: `Couldn't read the ground here: ${err instanceof Error ? err.message : "unknown error"}` });
  }
  return true;
}

// server/vercel/ground.ts
async function handler(req, res) {
  if (!await handleGround(req, res)) {
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "not found" }));
  }
}
export {
  handler as default
};
