`dload-extract-hashed`
=========================

Download, check SHA-256 and extract files from the Internet.  Already downloaded files are cached
so that they don't have to be downloaded again, and uncompressed archives are kept so they don't
need to be extracted again.

Why?
----

While testing some packages I needed to download runtimes for third-party software.  In doing so I
kept repeating the same actions to avoid downloading >100MiB files over and over again: Check for a
specific hash, download if different, extract the package.  After copy-pasting a few times I
decided to package that functionality here, so it can be reused by others.

When should I use this?
-----------------------

If you need to:

  - Download a publicly available file for which you have a permanent URI
  - Check that file against a known SHA-256 hash (and skip download if already present locally)
  - Optionally unpack the downloaded file if it was an archive

The perfect target are binary distributions of software packages, but you might find another use
case.  Note that the primary use case is to download single files from publicly accessed locations,
not download lists of files obtained from databases or other sources.  While such use cases might
be fulfilled with this packages, features that facilitate them (such as auto-removal of old cache
files) will not be incorporated.

Usage
-----

```javascript
const dlExtHash = require('download-extract-hashed');

dlExtHash({
  uri: 'http://example.org/some-archive.tar.gz',
  hash: '47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=',
  extract: true,
})
  .then(result => console.log(result));

/*
  output:
  {
    downloadPath: '/tmp/node-dlexthash/cH7Ni90kssxDV3ZdCj7Tp88IP-5LdlOhwBa3fFEFYqE.47DEQpj8HBSa-_TImW-5JCeuQeRkm5NMpJWZG3hSuFU.file',
    extracted: true,
    extractPath: '/tmp/node-dlexthash/cH7Ni90kssxDV3ZdCj7Tp88IP-5LdlOhwBa3fFEFYqE.47DEQpj8HBSa-_TImW-5JCeuQeRkm5NMpJWZG3hSuFU.dir'
  }
*/
```

### dlExtHash(options)

Download, check and extract a file from the Internet.

  - `options`: Options object, passed as is to `request` to perform the download.  The following extra options are available:
    + `hash`: Base-64 encoded SHA-256 hash of the target file.
    + `extract`: Whether to attempt extract the resulting archive, default to `true`.
    + `basePath`: Where to put downloaded and extracted files, defaults to `${os.tmpdir()}/node-dlexthash/`.

The actions performed by this call are as follows:

  - Check whether the target file exists and calculate its SHA-256 hash.
  - Download the file if it didn't exist or the hash didn't match
  - Check its hash again, and throw if it still doesn't match
  - Check whether the potential target extraction directory exists
  - Attempt to extract it if the directory didn't exist

Note that extraction is not checked against any hash.  Both download and extraction are performed
initially over a temporary path and only renamed to their correct locations after everything
completes successfully.

The names of the target files and directories are not configurable by the user, and have the
following form:

  + `<URI-hash>.<file-hash>.file` for downloaded files
  + `<URI-hash>.<file-hash>.dir` for the etraction directory

Both hashes are URL-safe Base64 hashes (`+` and `/` are converted to `-` and `_` respectively, and
the `=` padding is removed), ensuring different URIs and different files yield different paths.
Temporary files have the appropriate prefix plus a timestamp and a `.pending` suffix.

The resulting object contains the following fields:

  - `downloadPath`: The path to the downloaded file.
  - `extracted`: Whether the downloaded file is extracted.  This will be `true` whenever the
    extraction directory exists, even if the extraction was not performed in this call, and even if
    `options.extract` was `false`.
  - `extractPath`: The path of the extraction directory (if extracted).

Any temporary files or directories
