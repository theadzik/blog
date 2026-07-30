# Security Policy

## Reporting a vulnerability

Please report security issues privately, **not** as a public issue or pull request.

Use [GitHub private vulnerability reporting](https://github.com/theadzik/blog/security/advisories/new),
which notifies the maintainer directly and keeps the report confidential until a
fix is published.

Expect an acknowledgement within 7 days. This is a personal blog maintained in
spare time, so please treat that as a best effort rather than a commitment.

## Scope

This repository builds and publishes the container image serving
[zmuda.pro](https://zmuda.pro). In scope:

- The site content and Docusaurus configuration under `zmuda-pro/`
- The container build (`Dockerfile`, `default.conf`)
- The GitHub Actions workflows under `.github/workflows/`
- The published image `docker.io/theadzik/zmuda-pro-blog`

Out of scope: the infrastructure the site runs on (that is a separate,
private-by-default homelab), and findings that require an already-compromised
maintainer account.

## What this project already does

So that reports can skip what is known and already handled:

- Base images are [Docker Hardened Images](https://www.docker.com/products/hardened-images/);
  every build stage uses `dhi.io/*`.
- Images are scanned with Trivy (HIGH/CRITICAL, fixable) **before** they are
  published; a finding fails the build.
- Every published image carries a cosign-signed SPDX SBOM and SLSA provenance
  attestation, verified at admission time before it is allowed to run.
- All third-party GitHub Actions are pinned by commit SHA.
- Dependencies are updated by Dependabot; `pnpm audit` fails a pull request on a
  high or critical advisory, and `dependency-review` blocks a pull request that
  would introduce one.
- CodeQL scans JavaScript/TypeScript and the Actions workflows themselves.
- Secret scanning with push protection is enabled, backed by a local
  `detect-secrets` pre-commit hook.

## Supported versions

Only the current release is supported. Fixes ship in the next CalVer release
(`YYYY.M.N`) rather than being backported.
