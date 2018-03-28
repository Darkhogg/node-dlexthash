const fs = require('fs');
const os = require('os');
const path = require('path');
const rimraf = require('rimraf');
const util = require('util');

const mkdirAsync = util.promisify(fs.mkdir);
const readdirAsync = util.promisify(fs.readdir);
const rimrafAsync = util.promisify(rimraf);

const {describe, it, beforeEach, afterEach} = require('mocha');
const {expect} = require('chai');


const extract = require('../lib/extract');


describe('extract()', () => {
  let tmpDir;
  beforeEach('create a temporary directory', async () => {
    const dir = path.join(os.tmpdir(), `node-dlexthash-test-${Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)}`);
    await mkdirAsync(dir);
    tmpDir = dir;
  });

  afterEach('clear temporary directory', async () => {
    await rimrafAsync(tmpDir);
    tmpDir = null;
  });

  it('should not do anything with non-archive files', async () => {
    await extract(path.join(__dirname, 'archives', 'foo.txt'), tmpDir);

    const entries = await readdirAsync(tmpDir);
    expect(entries).to.have.length(0);
  });

  it('should extract TAR files', async () => {
    await extract(path.join(__dirname, 'archives', 'foo.tar'), tmpDir);

    const entries = await readdirAsync(tmpDir);
    expect(entries).to.deep.equal(['foo.txt']);
  });

  it('should extract ZIP files', async () => {
    await extract(path.join(__dirname, 'archives', 'foo.zip'), tmpDir);

    const entries = await readdirAsync(tmpDir);
    expect(entries).to.deep.equal(['foo.txt']);
  });

  it('should uncompress and extract TAR GZ files', async () => {
    await extract(path.join(__dirname, 'archives', 'foo.tar.gz'), tmpDir);

    const entries = await readdirAsync(tmpDir);
    expect(entries).to.deep.equal(['foo.txt']);
  });

  it('should uncompress and extract TAR BZ2 files', async () => {
    await extract(path.join(__dirname, 'archives', 'foo.tar.bz2'), tmpDir);

    const entries = await readdirAsync(tmpDir);
    expect(entries).to.deep.equal(['foo.txt']);
  });

  it('should uncompress and extract TAR XZ files', async () => {
    await extract(path.join(__dirname, 'archives', 'foo.tar.xz'), tmpDir);

    const entries = await readdirAsync(tmpDir);
    expect(entries).to.deep.equal(['foo.txt']);
  });
});
