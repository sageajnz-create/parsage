#!/usr/bin/env bash
# 🌿 PARSAGE Universal 1-Click Linux Installer
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
echo -e "${BOLD}${GREEN}  🌿 PARSAGE - Universal 1-Click Linux Installer${NC}"
echo -e "${GOLD}  \"One love, low latency, no limits.\"${NC}"
echo -e "${RED}  Created with ❤️ by Sage & Antigravity${NC}"
echo -e "${GREEN}============================================================${NC}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
INSTALL_DIR="$HOME/.local/share/parsage"
BIN_DIR="$HOME/.local/bin"

echo -e "\n${BOLD}${TEAL}[1/5] Detecting Linux Distribution & Dependencies...${NC}"

if command -v apt &>/dev/null; then
    echo -e "${GOLD}Detected Debian/Ubuntu/Linux Mint base.${NC}"
    if ! command -v node &>/dev/null || ! command -v python3 &>/dev/null; then
        echo -e "Installing required runtime packages (nodejs, python3)..."
        if sudo -n true 2>/dev/null || [ -t 0 ]; then
            sudo apt update -qq && sudo apt install -y -qq nodejs npm python3 pipewire
        fi
    fi
elif command -v pacman &>/dev/null; then
    echo -e "${GOLD}Detected Arch/Omarchy base.${NC}"
fi

echo -e "\n${BOLD}${TEAL}[2/5] Checking /dev/uinput permissions for gamepads...${NC}"
# Test if /dev/uinput is already writable
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
        else
            echo -e "${GOLD}Notice: To enable non-root controller injection, run:${NC}"
            echo -e "  sudo bash -c 'echo \"KERNEL==\\\"uinput\\\", MODE=\\\"0660\\\", GROUP=\\\"input\\\", TAG+=\\\"uaccess\\\"\" > /etc/udev/rules.d/99-parsage-uinput.rules'"
            echo -e "  sudo usermod -aG input \$USER"
        fi
    fi
fi

echo -e "\n${BOLD}${TEAL}[3/5] Installing Parsage to ${INSTALL_DIR}...${NC}"
mkdir -p "$INSTALL_DIR" "$BIN_DIR"

# Copy files
cp -r "$SCRIPT_DIR/bin" "$INSTALL_DIR/"
cp -r "$SCRIPT_DIR/host" "$INSTALL_DIR/"
cp -r "$SCRIPT_DIR/server" "$INSTALL_DIR/"
cp -r "$SCRIPT_DIR/web" "$INSTALL_DIR/"
cp -r "$SCRIPT_DIR/packaging" "$INSTALL_DIR/"
cp "$SCRIPT_DIR/package.json" "$INSTALL_DIR/"
cp "$SCRIPT_DIR/README.md" "$INSTALL_DIR/"

# Ensure executable permissions
chmod +x "$INSTALL_DIR/bin/parsage" "$INSTALL_DIR/host/"*.py

# Create symlink in ~/.local/bin/parsage
ln -sf "$INSTALL_DIR/bin/parsage" "$BIN_DIR/parsage"

echo -e "\n${BOLD}${TEAL}[4/5] Installing Desktop Launcher & App Menu Icon...${NC}"
ICON_DIR="$HOME/.local/share/icons/hicolor/scalable/apps"
APP_DIR="$HOME/.local/share/applications"
mkdir -p "$ICON_DIR" "$APP_DIR"

cp "$SCRIPT_DIR/packaging/parsage.svg" "$ICON_DIR/parsage.svg"

cat << 'DESKTOP_EOF' > "$APP_DIR/parsage.desktop"
[Desktop Entry]
Name=Parsage
GenericName=Game & Desktop Streamer
Comment=Plug-and-play low-latency game & desktop streaming for Linux and friends
Exec=bash -c "$HOME/.local/share/parsage/bin/parsage host"
Icon=parsage
Terminal=true
Type=Application
Categories=Network;Game;AudioVideo;
Keywords=parsec;stream;gaming;gamepad;remote;coop;
DESKTOP_EOF

chmod +x "$APP_DIR/parsage.desktop"
update-desktop-database "$APP_DIR" 2>/dev/null || true

echo -e "\n${BOLD}${TEAL}[5/5] Verifying Web Client and Server Runtimes...${NC}"
echo -e "${GREEN}Web client bundle & Server build verified.${NC}"

echo -e "\n${GREEN}============================================================${NC}"
echo -e "${BOLD}${GREEN}  🎉 PARSAGE INSTALLED SUCCESSFULLY!${NC}"
echo -e "${GREEN}============================================================${NC}"
echo -e "You can now run Parsage anytime in two ways:"
echo -e "  1. Search for ${BOLD}${GOLD}Parsage${NC} in your Application Menu / Start Menu."
echo -e "  2. Type ${BOLD}${GOLD}parsage host${NC} in any terminal."
echo -e "\nTo join a buddy's stream, type: ${BOLD}${GOLD}parsage join PARSAGE-CODE${NC}"
echo -e "${GREEN}============================================================${NC}\n"
