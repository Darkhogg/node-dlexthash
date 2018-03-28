const fs = require('fs');
const nock = require('nock');
const os = require('os');
const path = require('path');
const rimraf = require('rimraf');
const util = require('util');
const crypto = require('crypto');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised')

const copyFileAsync = util.promisify(fs.copyFile);
const existsAsync = util.promisify(fs.exists);
const mkdirAsync = util.promisify(fs.mkdir);
const readFileAsync = util.promisify(fs.readFile);
const rimrafAsync = util.promisify(rimraf);

chai.use(chaiAsPromised);

const {describe, it, beforeEach, afterEach} = require('mocha');
const {expect} = chai;

const main = require('../lib');

describe('main', () => {
  let tmpDir;
  beforeEach('create a temporary directory', async () => {
    const dir = path.join(os.tmpdir(), `node-dlexthash-test-${Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)}`);
    await mkdirAsync(dir);
    tmpDir = dir;
  });

  let dlNock;
  beforeEach('mock download of files', () => {
    dlNock = nock('http://example.org')
      .get(/^\/[^/]+$/)
      .reply((uri, reqBody) => fs.createReadStream(path.join(__dirname, 'archives', uri.replace('/', ''))));
  });

  afterEach('clean mocks', () => {
    dlNock = null;
    nock.cleanAll();
  });

  afterEach('clear temporary directory', async () => {
    await rimrafAsync(tmpDir);
    tmpDir = null;
  });

  function getArchivePath (archive) {
    return path.join(__dirname, 'archives', archive);
  }

  function getHash (payload) {
    const hash = crypto.createHash('sha256').update(payload).digest('base64');
    return hash.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  }

  async function getFileHash (file) {
    return getHash(await readFileAsync(file));
  }

  async function getArchiveHash (archive) {
    return await getFileHash(getArchivePath(archive));
  }

  async function expectDownloadOk (filePath, hash) {
    expect(await existsAsync(filePath), 'download file exists').to.be.ok;
    expect(await getFileHash(filePath), 'hash matches').to.equal(hash);
  }

  async function expectExtractOk (dirPath) {
    expect(await existsAsync(dirPath), 'extract dir exists').to.be.ok;
  }

  it('should download file with correct hash', async () => {
    const hash = await getArchiveHash('foo.txt');
    const result = await main({
      'basePath': tmpDir,
      'uri': 'http://example.org/foo.txt',
      'hash': hash,
    });

    expect(dlNock.isDone()).to.be.ok;
    expectDownloadOk(result.downloadPath, hash);
  });

  it('should skip download if file is present and hash matches', async () => {
    const uriHash = getHash('http://example.org/foo.txt');
    const archiveHash = await getArchiveHash('foo.txt');

    await copyFileAsync(getArchivePath('foo.txt'), path.join(tmpDir, `${uriHash}.${archiveHash}.file`));

    const result = await main({
      'basePath': tmpDir,
      'uri': 'http://example.org/foo.txt',
      'hash': archiveHash,
    });

    expect(dlNock.isDone()).to.not.be.ok;
    expectDownloadOk(result.downloadPath, archiveHash);
  });

  it('should redownload if file is present but hash does not match', async () => {
    const uriHash = getHash('http://example.org/foo.txt');
    const archiveHash = await getArchiveHash('foo.txt');

    await copyFileAsync(getArchivePath('foo.tar'), path.join(tmpDir, `${uriHash}.${archiveHash}.file`));

    const result = await main({
      'basePath': tmpDir,
      'uri': 'http://example.org/foo.txt',
      'hash': archiveHash,
    });

    expect(dlNock.isDone()).to.be.ok;
    expectDownloadOk(result.downloadPath, archiveHash);
  });

  it('should fail if hash does not match after download', async () => {
    await expect(main({
      'basePath': tmpDir,
      'uri': 'http://example.org/foo.txt',
      'hash': 'this_is_not_a_hash',
    })).to.be.rejected;

    expect(dlNock.isDone()).to.be.ok;
  });

  it('should extract after download if target dir is not present', async () => {
    const hash = await getArchiveHash('foo.tar');
    const result = await main({
      'basePath': tmpDir,
      'uri': 'http://example.org/foo.tar',
      'hash': hash,
    });

    expect(dlNock.isDone()).to.be.ok;
    expectDownloadOk(result.downloadPath, hash);
    expectExtractOk(result.extractPath);
  });

  it('should extract after skipping download if target dir is not present', async () => {
    const uriHash = getHash('http://example.org/foo.tar');
    const archiveHash = await getArchiveHash('foo.tar');

    await copyFileAsync(getArchivePath('foo.tar'), path.join(tmpDir, `${uriHash}.${archiveHash}.file`));

    const result = await main({
      'basePath': tmpDir,
      'uri': 'http://example.org/foo.tar',
      'hash': archiveHash,
    });

    expect(!dlNock.isDone()).to.be.ok;
    expectDownloadOk(result.downloadPath, archiveHash);
    expectExtractOk(result.extractPath);
  });

  it('should skip extraction if target dir is present');
});
