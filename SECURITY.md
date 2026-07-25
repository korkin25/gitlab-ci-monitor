# Security Policy

## Reporting a vulnerability

Please report suspected vulnerabilities **privately** — do not open a public issue.

- Preferred: GitHub **private vulnerability reporting** (Security → *Report a vulnerability*).
- Or contact the maintainer (`korkin25`) privately.

Include a description, reproduction steps, affected versions, and impact. We aim to
acknowledge within a few business days.

## Handling secrets

No secrets are ever committed. The GitLab access token is a **full-access credential** — it is
provided via VS Code settings, the `GITLAB_TOKEN` environment variable, or VS Code
SecretStorage, and is never logged, hard-coded, or committed. The marketplace publish tokens
(`VSCE_PAT` / `OVSX_PAT`) live only in CI secrets. If you believe a secret was exposed, revoke
it immediately and report it.

## Automated checks

CI runs a security suite on every push/PR via the shared `korkin25/open-ci-actions` `sast.yml`:
`gitleaks`, `semgrep`, `checkov`, and `trivy` (config), plus `npm audit` on the dev toolchain.
Dependency updates are proposed by Dependabot. See [`CLAUDE.md`](CLAUDE.md) § *Build, artifacts
& CI* and § *Agent security working agreements*.
