const cliProgress = require('cli-progress');
const fs = require('fs');
const request = require('request');
const requestProgress = require('request-progress');


async function download (options, targetPath) {
  await new Promise((accept, reject) => {
    const requestStream = requestProgress(request(options), {'delay': 0, 'throttle': 50});
    const writeStream = requestStream.pipe(fs.createWriteStream(targetPath));

    const bar = new cliProgress.Bar({'clearOnComplete': true}, cliProgress.Presets.shades_classic);
    bar.start(1, 0);
    requestStream.on('progress', state => {
      bar.setTotal(state.size.total);
      bar.update(state.size.transferred);
    });

    writeStream.on('finish', () => {
      bar.stop();
      accept();
    });
    requestStream.on('error', reject);
  });
}

module.exports = download;
