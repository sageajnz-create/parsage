# Parsage client matrix

This matrix lists **what CI and packaging checks actually exercise**. It is not a compatibility claim for platforms that have no automated evidence.

| Surface | Evidence in this repo | Status |
| --- | --- | --- |
| Signaling server (Node 22, Linux) | `.github/workflows/ci.yml` → `npm test` (unit + integration) | Covered |
| Production web build | `web` `tsc` + `vite build` in `npm test` | Covered |
| Host unit tests (no live GStreamer) | `scripts/test-host.mjs` | Covered |
| Chromium signaling reconnect / ICE restart | `npm run test:browser-reconnect` | Covered when Chromium is present |
| Accessibility landmarks, skip link, unlabeled controls | `npm run test:accessibility` | Covered when Chromium is present |
| Debian `.deb` layout, maintainer scripts, systemd unit | `python3 packaging/test_packaging.py` | Covered (extract + script inspect) |
| User-local `install.sh` install → upgrade → uninstall | same packaging test, prefix install | Covered |
| Live `dpkg -i` on Mint / Ubuntu / Debian | not in CI (no distro farm) | Untested in automation |
| Arch / Fedora package install | installer detects pacman; no rpm/pkgbuild CI | Untested in automation |
| Electron GUI | `app/main.cjs` crash-restart of child processes | Code present; no GUI CI |
| Windows / macOS clients | not shipped | Untested |
| Firefox / Safari | not in reconnect or a11y gates | Untested |

Update this file when a new automated gate lands. Do not mark a row green without a command in CI or `package.json`.
