const cliProgress = require('cli-progress');
const crypto = require('crypto');
const fs = require('fs');
const mkdirp = require('mkdirp');
const os = require('os');
const path = require('path');
const rimraf = require('rimraf');
const util = require('util');

const existsAsync = util.promisify(fs.exists);
const mkdirpAsync = util.promisify(mkdirp);
const renameAsync = util.promisify(fs.rename);
const statAsync = util.promisify(fs.stat);
const unlinkAsync = util.promisify(fs.unlink);

const download = require('./download');
const extract = require('./extract');


const pendings = new Set();
process.on('exit', () => pendings.forEach(fn => rimraf.sync(fn)));


const BASE64_REPLACE = {'+': '-', '/': '_', '=': ''};
function cleanBase64 (base64) {
  return base64.replace(/[+/=]/g, (char) => BASE64_REPLACE[char]);
}


async function hashFile (filename) {
  if (!await existsAsync(filename)) {
    return null;
  }

  const stat = await statAsync(filename);

  return await new Promise((accept, reject) => {
    const hasher = crypto.createHash('sha256');
    const stream = fs.createReadStream(filename);

    const bar = new cliProgress.Bar({'clearOnComplete': true}, cliProgress.Presets.shades_classic);
    bar.start(stat.size, 0);

    stream.on('data', chunk => {
      bar.increment(chunk.length);
      hasher.update(chunk);
    });
    stream.on('error', reject);
    stream.on('end', () => {
      bar.stop();
      accept(cleanBase64(hasher.digest('base64')));
    });
  });
}


module.exports = async function (options) {
  const shouldExtract = (options.extract === undefined) ? true : !!options.extract;
  const cleanHash = cleanBase64(options.hash);
  const basePath = options.basePath || path.join(os.tmpdir(), 'node-dlexthash');

  if (!await existsAsync(basePath)) {
    await mkdirpAsync(basePath);
  }

  const uriHash = cleanBase64(crypto.createHash('sha256').update(options.uri).digest('base64'));

  const downloadPath = path.join(basePath, `${uriHash}.${cleanHash}.file`);
  const oldHash = await hashFile(downloadPath);

  if (oldHash !== cleanHash) {
    const downloadPendingPath = `${downloadPath}.${Date.now()}.pending`;

    pendings.add(downloadPendingPath);
    await download(options, downloadPendingPath);
    const newHash = await hashFile(downloadPendingPath);

    if (newHash !== cleanHash) {
      await unlinkAsync(downloadPendingPath);
      pendings.delete(downloadPendingPath);

      throw new Error(`hash mismatch: expected ${cleanHash}, got ${newHash}`);
    }

    await renameAsync(downloadPendingPath, downloadPath);
    pendings.delete(downloadPendingPath);
  }

  const extractPath = path.join(basePath, `${uriHash}.${cleanHash}.dir`);

  let wasExtracted = await existsAsync(extractPath);
  if (!wasExtracted && shouldExtract) {
    const pendingExtractPath = `${extractPath}.${Date.now()}.pending`;

    pendings.add(pendingExtractPath);
    wasExtracted = await extract(downloadPath, pendingExtractPath);

    if (wasExtracted) {
      await renameAsync(pendingExtractPath, extractPath);
    }

    pendings.delete(pendingExtractPath);
  }

  return {
    'downloadPath': downloadPath,
    'extracted': wasExtracted,
    'extractPath': wasExtracted ? extractPath : null,
  };
}
