process.env.SUPPRESS_NO_CONFIG_WARNING = '1';
const cliProgress = require('cli-progress');
const cp = require('child_process');
const fs = require('fs');
const lzma = require('lzma-native');
const magic = require('mime-magic');
const mkdirp = require('mkdirp');
const path = require('path');
const tar = require('tar-fs');
const unbzip2 = require('unbzip2-stream');
const util = require('util');
const yauzl = require('yauzl');
const zlib = require('zlib');

const renameAsync = util.promisify(fs.rename);
const statAsync = util.promisify(fs.stat);
yauzl.openAsync = util.promisify(yauzl.open);

function uncompressGzip (stream) {
  return stream.pipe(zlib.createGunzip());
}

function uncompressBzip2 (stream) {
  return stream.pipe(unbzip2());
}

function uncompressXz (stream) {
  return stream.pipe(lzma.createDecompressor());
}

const COMPRESSIONS = {
  'application/x-gzip': uncompressGzip,
  'application/gzip': uncompressGzip,
  'application/x-bzip2': uncompressBzip2,
  'application/bzip2': uncompressBzip2,
  'application/x-xz': uncompressXz,
  'application/xz': uncompressXz,
};


function unarchiveTar (stream, dest) {
  return stream.pipe(tar.extract(dest));
}

async function unarchiveZip (file, dest) {
  const zipfile = await yauzl.openAsync(file, {'lazyEntries': true, 'autoClose': true});

  return await new Promise((accept, reject) => {
    zipfile.on('error', reject);
    zipfile.on('end', accept);

    zipfile.on('entry', entry => {
      const targetFile = path.join(dest, entry.fileName);

      /* if directory: create and continue */
      if (/\/$/.test(entry.fileName)) {
        return mkdirp(targetFile, (err) => {
          if (err) return reject(err);
          zipfile.readEntry();
        });
      }

      /* read and extract to file */
      zipfile.openReadStream(entry, (err, readStream) => {
        if (err) return reject(err);
        readStream.on('error', reject);

        mkdirp(path.dirname(targetFile), err => {
          if (err) return reject(err);

          const stream = readStream.pipe(fs.createWriteStream(targetFile));
          stream.on('finish', () => zipfile.readEntry());
        });
      });
    });

    /* start reading */
    zipfile.readEntry();
  });
}

const ARCHIVES = {
  'application/x-tar': {'fn': unarchiveTar, 'stream': true},
  'application/zip': {'fn': unarchiveZip, 'stream': false},
};




async function detectType (filename) {
  return await new Promise((accept, reject) => {
    const args =  [filename, '--magic-file', magic.magicFile, '--mime', '--uncompress', '--brief'];
    const proc = cp.execFile(magic.fileExec, args, (err, stdout, stderr) => {
      if (err) return reject(err);

      const mime = stdout.split(/;/)[0];

      const match = /compressed-encoding=([^\s;]+)/.exec(stdout);
      const compression = match ? match[1] : null;

      accept({mime, compression});
    });
  });
}


async function extract (fromFile, toDir) {
  const type = await detectType(fromFile);
  const compType = type.compression in COMPRESSIONS ? type.compression : null;
  const archType = type.compression in ARCHIVES ? type.compression : type.mime in ARCHIVES ? type.mime : null;
  if (!archType) {
    return false;
  }

  const uncompressor = (compType in COMPRESSIONS) ? COMPRESSIONS[compType] : x => x;
  const unarchiver = ARCHIVES[archType];

  if (unarchiver.stream) {
    const statFromFile = await statAsync(fromFile);

    await new Promise((accept, reject) => {
      const bar = new cliProgress.Bar({'clearOnComplete': true}, cliProgress.Presets.shades_classic);
      bar.start(statFromFile.size, 0);

      const sourceStream = fs.createReadStream(fromFile);
      const uncompStream = uncompressor(sourceStream);
      const unarchStream = unarchiver.fn(uncompStream, toDir);

      sourceStream.on('data', chunk => bar.increment(chunk.length));

      unarchStream.on('error', reject);
      unarchStream.on('finish', () => {
        bar.stop();
        accept();
      });
    });

  } else {
    await unarchiver.fn(fromFile, toDir);
  }

  return true;
}


module.exports = extract;
