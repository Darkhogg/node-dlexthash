const fs = require('fs');
const os = require('os');
const path = require('path');
const rimraf = require('rimraf');
const util = require('util');
const nock = require('nock')

const mkdirAsync = util.promisify(fs.mkdir);
const readdirAsync = util.promisify(fs.readdir);
const rimrafAsync = util.promisify(rimraf);

const {describe, it, beforeEach, afterEach} = require('mocha');
const {expect} = require('chai');

const download = require('../lib/download');

describe('download()', () => {
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

  it('should download files correctly', async () => {
    nock('http://example.org')
      .get('/foo.txt')
      .reply(() => fs.createReadStream(path.join(__dirname, 'archives', 'foo.txt')));

    const target = path.join(tmpDir, 'foo.txt');
    await download('http://example.org/foo.txt', target);

    const entries = await readdirAsync(tmpDir);
    expect(entries).to.deep.equal(['foo.txt']);
  });
});
