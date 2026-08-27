#!/usr/bin/env bash
# 🌿 PARSAGE Universal 1-Click Native Desktop App Installer
# Optimized for Linux Mint, Ubuntu, Debian, Pop!_OS, Arch, & Omarchy
# Created with ❤️ by Sage & Antigravity

set -e

# Reggae Colors
RED='\033[0;31m'
GOLD='\033[0;33m'
GREEN='\033[0;32m'
TEAL='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

echo -e "${GREEN}============================================================${NC}"
echo -e "${BOLD}${GREEN}  🌿 PARSAGE - Universal Native App Installer${NC}"
echo -e "${GOLD}  \"One love, low latency, no limits.\"${NC}"
echo -e "${RED}  Created with ❤️ by Sage & Antigravity${NC}"
echo -e "${GREEN}============================================================${NC}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
INSTALL_DIR="$HOME/.local/share/parsage"
BIN_DIR="$HOME/.local/bin"

echo -e "\n${BOLD}${TEAL}[1/4] Detecting Linux Distribution & Dependencies...${NC}"

if command -v apt &>/dev/null; then
    echo -e "${GOLD}Detected Debian/Ubuntu/Linux Mint base.${NC}"
    if ! command -v node &>/dev/null || ! command -v python3 &>/dev/null; then
        echo -e "Installing required runtime packages (nodejs, python3, pipewire)..."
        if sudo -n true 2>/dev/null || [ -t 0 ]; then
            sudo apt update -qq && sudo apt install -y -qq nodejs npm python3 pipewire electron || true
        fi
    fi
elif command -v pacman &>/dev/null; then
    echo -e "${GOLD}Detected Arch/Omarchy base.${NC}"
    if ! gst-inspect-1.0 webrtcbin &>/dev/null || ! gst-inspect-1.0 vah264enc &>/dev/null; then
        echo -e "Installing native PipeWire/WebRTC encoder dependencies..."
        if sudo -n true 2>/dev/null || [ -t 0 ]; then
            sudo pacman -S --needed --noconfirm gst-plugins-bad gst-plugins-ugly gst-plugin-va python-gobject libportal
        fi
    fi
fi

echo -e "\n${BOLD}${TEAL}[2/4] Checking /dev/uinput permissions for gamepads...${NC}"
if python3 -c 'import os; os.close(os.open("/dev/uinput", os.O_WRONLY|os.O_NONBLOCK))' 2>/dev/null; then
    echo -e "${GREEN}✅ /dev/uinput is already writable by current user!${NC}"
else
    UDEV_RULE='/etc/udev/rules.d/99-parsage-uinput.rules'
    if [ ! -f "$UDEV_RULE" ]; then
        if sudo -n true 2>/dev/null || [ -t 0 ]; then
            echo "Installing udev rule for zero-latency virtual Xbox 360 gamepads..."
            sudo bash -c 'echo "KERNEL==\"uinput\", MODE=\"0660\", GROUP=\"input\", TAG+=\"uaccess\"" > /etc/udev/rules.d/99-parsage-uinput.rules'
            sudo udevadm control --reload-rules && sudo udevadm trigger || true
            if ! groups "$USER" | grep -q '\binput\b'; then
                sudo usermod -aG input "$USER" || true
            fi
        fi
    fi
fi

echo -e "\n${BOLD}${TEAL}[3/4] Installing Parsage to ${INSTALL_DIR}...${NC}"
mkdir -p "$INSTALL_DIR" "$BIN_DIR"

# Remove old fingerprinted bundles so upgrades cannot accumulate stale assets.
if [ -d "$INSTALL_DIR/web/dist/assets" ]; then
    find "$INSTALL_DIR/web/dist/assets" -maxdepth 1 -type f -delete
fi

# Copy files
cp -r "$SCRIPT_DIR/app" "$INSTALL_DIR/"
cp -r "$SCRIPT_DIR/bin" "$INSTALL_DIR/"
cp -r "$SCRIPT_DIR/host" "$INSTALL_DIR/"
cp -r "$SCRIPT_DIR/server" "$INSTALL_DIR/"
cp -r "$SCRIPT_DIR/web" "$INSTALL_DIR/"
cp -r "$SCRIPT_DIR/packaging" "$INSTALL_DIR/"
cp "$SCRIPT_DIR/package.json" "$INSTALL_DIR/"
cp "$SCRIPT_DIR/README.md" "$INSTALL_DIR/"

chmod +x "$INSTALL_DIR/bin/parsage" "$INSTALL_DIR/host/"*.py

ln -sf "$INSTALL_DIR/bin/parsage" "$BIN_DIR/parsage"

echo -e "\n${BOLD}${TEAL}[4/4] Installing Desktop Launcher & App Menu Icon...${NC}"
ICON_DIR="$HOME/.local/share/icons/hicolor/scalable/apps"
APP_DIR="$HOME/.local/share/applications"
mkdir -p "$ICON_DIR" "$APP_DIR"

cp "$SCRIPT_DIR/packaging/parsage.svg" "$ICON_DIR/parsage.svg"

cat << 'DESKTOP_EOF' > "$APP_DIR/parsage.desktop"
[Desktop Entry]
Name=Parsage
GenericName=Game & Desktop Streamer
Comment=Plug-and-play low-latency game & desktop streaming for Linux and friends
Exec=parsage
Icon=parsage
Terminal=false
Type=Application
Categories=Network;Game;AudioVideo;
Keywords=parsec;stream;gaming;gamepad;remote;coop;
StartupWMClass=Parsage
DESKTOP_EOF

chmod +x "$APP_DIR/parsage.desktop"
update-desktop-database "$APP_DIR" 2>/dev/null || true

CONFIG_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/parsage"
mkdir -p "$CONFIG_DIR"
if [ ! -e "$CONFIG_DIR/env" ]; then
    cp "$SCRIPT_DIR/packaging/parsage.env.example" "$CONFIG_DIR/env"
    chmod 600 "$CONFIG_DIR/env"
fi

echo -e "\n${GREEN}============================================================${NC}"
echo -e "${BOLD}${GREEN}  🎉 PARSAGE INSTALLED SUCCESSFULLY!${NC}"
echo -e "${GREEN}============================================================${NC}"
echo -e "Launch Parsage by searching for ${BOLD}${GOLD}Parsage${NC} in your Application Menu,"
echo -e "or by typing ${BOLD}${GOLD}parsage${NC} in your terminal."
echo -e "${GREEN}============================================================${NC}\n"
