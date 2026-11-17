# Third party notices

Necromancer is released under the MIT license. The following third party software is used.

## GnuCOBOL 3.1.2

The compiler `cobc` is licensed under the GNU GPL version 3 or later. The runtime library `libcob` is licensed under the GNU LGPL version 3 or later. Source: https://ftp.gnu.org/gnu/gnucobol/gnucobol-3.1.2.tar.gz

## GNU MP 6.3.0

GMP is dual licensed under the GNU LGPL version 3 or later and the GNU GPL version 2 or later. This project uses it under the GNU LGPL version 3 or later. Source: https://ftp.gnu.org/gnu/gmp/gmp-6.3.0.tar.xz

## GNU C Library

The prebuilt oracle binary is linked statically against glibc, which is licensed under the GNU LGPL version 2.1 or later. The binary is built in the container image `amazonlinux:2023@sha256:8ee95c4096d455555cb208d1dcea7b759235afab02253351d566d22d904f2198`, with glibc and glibc-static 2.34-231.amzn2023.0.6. The corresponding source package, `glibc-2.34-231.amzn2023.0.6.src.rpm`, its sha256 and the package versions are attached to the `oracle-latest` release, together with the GNU MP 6.3.0 and GnuCOBOL 3.1.2 source tarballs. To relink the oracle against a modified glibc, libcob or GNU MP, change the build steps in `.github/workflows/oracle-linux.yml` and run the workflow, which rebuilds and relinks the binary statically.

## Prebuilt oracle binary

The release asset `uicalc-linux-x64` is the program in `legacy/UICALC.cbl` compiled with GnuCOBOL 3.1.2 and linked statically against libcob and GNU MP. To relink against a modified version of either library, rebuild it with `.github/workflows/oracle-linux.yml`. `legacy/UICALC.cbl` is the complete corresponding source of the program. The license texts are in the `licenses/` directory of this repository and are attached to each release.

## CardDemo (vendored COBOL source)

The directory `case_studies/carddemo_interest/vendor/` holds three source files and the license files of the CardDemo sample application by Amazon.com, Inc. or its affiliates, copied byte for byte: `CBACT04C.cbl`, `CVTRA01Y.cpy` and `CVTRA02Y.cpy`, with the upstream `LICENSE` and `NOTICE`. They are licensed under the Apache License, Version 2.0, which is included in that directory. Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved. Source: https://github.com/aws-samples/aws-mainframe-modernization-carddemo at commit `59cc6c2fd7ebd7ef7925cad552a01a4b8b6e4d5e`. The files are unmodified. The rest of this repository stays under the MIT license. Details, hashes and the license evidence are in `case_studies/carddemo_interest/NOTICE`.

## lightningcss

lightningcss is licensed under the MPL 2.0. It is a build tool pulled in by Vite and is not shipped in the site bundle. Source: https://github.com/parcel-bundler/lightningcss

## Other dependencies

Python packages (FastAPI, pydantic, Hypothesis, pytest, sse-starlette, httpx, mcp) and JavaScript packages (React, three.js, Vite, TypeScript) are used under their own licenses, which are permissive or MPL 2.0 (Hypothesis and certifi), as listed in their package metadata.
