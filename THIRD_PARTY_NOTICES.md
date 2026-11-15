# Third party notices

Necromancer is released under the MIT license. The following third party software is used.

## GnuCOBOL 3.1.2

The compiler `cobc` is licensed under the GNU GPL version 3 or later. The runtime library `libcob` is licensed under the GNU LGPL version 3 or later. Source: https://ftp.gnu.org/gnu/gnucobol/gnucobol-3.1.2.tar.gz

## GNU MP 6.3.0

GMP is dual licensed under the GNU LGPL version 3 or later and the GNU GPL version 2 or later. This project uses it under the GNU LGPL version 3 or later. Source: https://ftp.gnu.org/gnu/gmp/gmp-6.3.0.tar.xz

## GNU C Library

The prebuilt oracle binary is linked statically against glibc, which is licensed under the GNU LGPL version 2.1 or later. Source: https://ftp.gnu.org/gnu/glibc/. The binary is built on Amazon Linux 2023 and the glibc version is the one shipped in that image. For the corresponding glibc source, fetch the matching release from the URL above or from the Amazon Linux 2023 source package repository. To relink the oracle against a modified glibc, libcob or GNU MP, change the build steps in `.github/workflows/oracle-linux.yml` and run the workflow, which rebuilds and relinks the binary statically.

## Prebuilt oracle binary

The release asset `uicalc-linux-x64` is the program in `legacy/UICALC.cbl` compiled with GnuCOBOL 3.1.2 and linked statically against libcob and GNU MP. To relink against a modified version of either library, rebuild it with `.github/workflows/oracle-linux.yml`. `legacy/UICALC.cbl` is the complete corresponding source of the program. The license texts are in the `licenses/` directory of this repository and are attached to each release.

## lightningcss

lightningcss is licensed under the MPL 2.0. It is a build tool pulled in by Vite and is not shipped in the site bundle. Source: https://github.com/parcel-bundler/lightningcss

## Other dependencies

Python packages (FastAPI, pydantic, Hypothesis, pytest, sse-starlette, httpx, mcp) and JavaScript packages (React, Vite, TypeScript) are used under their own licenses, which are permissive or MPL 2.0 (Hypothesis and certifi), as listed in their package metadata.
