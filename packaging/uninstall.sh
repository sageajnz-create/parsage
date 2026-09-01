#!/usr/bin/env bash
# Remove a user-local Parsage install created by packaging/install.sh.
# User configuration in ~/.config/parsage is kept unless --purge is passed.

set -euo pipefail

PURGE=0
if [ "${1:-}" = "--purge" ]; then
  PURGE=1
fi

INSTALL_DIR="${PARSAGE_INSTALL_DIR:-$HOME/.local/share/parsage}"
BIN_DIR="${PARSAGE_BIN_DIR:-$HOME/.local/bin}"
ICON_DIR="${PARSAGE_ICON_DIR:-$HOME/.local/share/icons/hicolor/scalable/apps}"
APP_DIR="${PARSAGE_APP_DIR:-$HOME/.local/share/applications}"
SYSTEMD_DIR="${PARSAGE_SYSTEMD_DIR:-$HOME/.config/systemd/user}"
CONFIG_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/parsage"

systemctl --user stop parsage.service 2>/dev/null || true
systemctl --user disable parsage.service 2>/dev/null || true
rm -f "$SYSTEMD_DIR/parsage.service"
rm -f "$BIN_DIR/parsage"
rm -f "$APP_DIR/parsage.desktop"
rm -f "$ICON_DIR/parsage.svg"
rm -rf "$INSTALL_DIR"
update-desktop-database "$APP_DIR" 2>/dev/null || true

if [ "$PURGE" -eq 1 ]; then
  rm -rf "$CONFIG_DIR"
fi

echo "Parsage user install removed from $INSTALL_DIR"
if [ "$PURGE" -eq 0 ]; then
  echo "Kept $CONFIG_DIR (pass --purge to delete saved config)."
fi
