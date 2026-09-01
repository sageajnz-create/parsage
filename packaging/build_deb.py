#!/usr/bin/env python3
"""
🌿 PARSAGE Debian (.deb) Package Builder
Builds a 100% compliant .deb package for Linux Mint, Ubuntu, Debian, Pop!_OS
Created with ❤️ by Sage & Antigravity
"""

import os
import sys
import tarfile
import io
import struct
import shutil

PACKAGE_NAME = "parsage"
VERSION = "0.2.0"
MAINTAINER = "Sage & Antigravity <sage@parsage.local>"
DESCRIPTION = "Plug-and-play low-latency game & desktop streaming for Linux and friends"
SECTION = "games"
PRIORITY = "optional"
ARCHITECTURE = "all"
DEPENDS = "nodejs, npm, python3, python3-gi, pipewire, gstreamer1.0-pipewire, gstreamer1.0-plugins-bad, gstreamer1.0-plugins-ugly, gstreamer1.0-vaapi, gir1.2-xdp-1"

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(SCRIPT_DIR)
OUTPUT_DIR = os.path.join(ROOT_DIR, "dist_pkg")
DEB_FILE = os.path.join(OUTPUT_DIR, f"{PACKAGE_NAME}_{VERSION}_{ARCHITECTURE}.deb")

def create_ar_archive(output_path, files):
    with open(output_path, "wb") as ar:
        ar.write(b"!<arch>\n")
        for filename, data in files:
            name_bytes = filename.encode("ascii").ljust(16, b" ")
            timestamp = str(int(os.stat(ROOT_DIR).st_mtime)).encode("ascii").ljust(12, b" ")
            owner_id = b"0".ljust(6, b" ")
            group_id = b"0".ljust(6, b" ")
            file_mode = b"100644".ljust(8, b" ")
            file_size = str(len(data)).encode("ascii").ljust(10, b" ")
            fmag = b"`\n"

            ar.write(name_bytes + timestamp + owner_id + group_id + file_mode + file_size + fmag)
            ar.write(data)
            if len(data) % 2 != 0:
                ar.write(b"\n")

def build_deb():
    print("============================================================")
    print(f"  🌿 Building {PACKAGE_NAME}_{VERSION}_{ARCHITECTURE}.deb")
    print("  Optimized for Linux Mint & Ubuntu")
    print("============================================================")

    os.makedirs(OUTPUT_DIR, exist_ok=True)

    debian_binary = b"2.0\n"

    control_content = f"""Package: {PACKAGE_NAME}
Version: {VERSION}
Section: {SECTION}
Priority: {PRIORITY}
Architecture: {ARCHITECTURE}
Maintainer: {MAINTAINER}
Depends: {DEPENDS}
Description: {DESCRIPTION}
 Parsage is a native low-latency game and desktop streaming suite
 designed for Linux (Wayland/X11) and cross-platform clients.
 Includes an experimental native PipeWire/VA-API media backend and
 virtual Xbox-style multi-gamepad injection via /dev/uinput.
"""

    postinst_lines = [
        "#!/bin/sh",
        "set -e",
        'echo \'KERNEL=="uinput", MODE="0660", GROUP="input", TAG+="uaccess"\' > /etc/udev/rules.d/99-parsage-uinput.rules',
        "udevadm control --reload-rules 2>/dev/null || true",
        "udevadm trigger 2>/dev/null || true",
        "ln -sf /usr/share/parsage/bin/parsage /usr/local/bin/parsage 2>/dev/null || true",
        "update-desktop-database -q 2>/dev/null || true",
        "gtk-update-icon-cache -q /usr/share/icons/hicolor 2>/dev/null || true",
        "exit 0\n"
    ]
    postinst_content = "\n".join(postinst_lines)

    prerm_lines = [
        "#!/bin/sh",
        "set -e",
        "rm -f /usr/local/bin/parsage 2>/dev/null || true",
        "exit 0\n"
    ]
    prerm_content = "\n".join(prerm_lines)

    postrm_lines = [
        "#!/bin/sh",
        "set -e",
        'if [ "$1" = "purge" ]; then',
        "  rm -f /etc/udev/rules.d/99-parsage-uinput.rules",
        "  rm -f /usr/local/bin/parsage",
        "  udevadm control --reload-rules 2>/dev/null || true",
        "fi",
        "exit 0\n"
    ]
    postrm_content = "\n".join(postrm_lines)

    control_tar_io = io.BytesIO()
    with tarfile.open(fileobj=control_tar_io, mode="w:gz") as tar:
        ti = tarfile.TarInfo("./control")
        ti.size = len(control_content.encode("utf-8"))
        ti.mode = 0o644
        tar.addfile(ti, io.BytesIO(control_content.encode("utf-8")))

        ti_post = tarfile.TarInfo("./postinst")
        ti_post.size = len(postinst_content.encode("utf-8"))
        ti_post.mode = 0o755
        tar.addfile(ti_post, io.BytesIO(postinst_content.encode("utf-8")))

        ti_pre = tarfile.TarInfo("./prerm")
        ti_pre.size = len(prerm_content.encode("utf-8"))
        ti_pre.mode = 0o755
        tar.addfile(ti_pre, io.BytesIO(prerm_content.encode("utf-8")))

        ti_postrm = tarfile.TarInfo("./postrm")
        ti_postrm.size = len(postrm_content.encode("utf-8"))
        ti_postrm.mode = 0o755
        tar.addfile(ti_postrm, io.BytesIO(postrm_content.encode("utf-8")))

    control_tar_gz = control_tar_io.getvalue()

    data_tar_io = io.BytesIO()
    with tarfile.open(fileobj=data_tar_io, mode="w:gz") as tar:
        base_install_path = "/usr/share/parsage"
        for folder in ["app", "bin", "host", "server", "web", "packaging"]:
            folder_path = os.path.join(ROOT_DIR, folder)
            if not os.path.exists(folder_path):
                continue
            for root, dirs, files in os.walk(folder_path):
                if "node_modules" in root or ".git" in root or "dist_pkg" in root:
                    continue
                rel_root = os.path.relpath(root, ROOT_DIR)
                dest_root = f".{base_install_path}/{rel_root}"

                for f in files:
                    src_file = os.path.join(root, f)
                    dest_file = f"{dest_root}/{f}"
                    ti = tarfile.TarInfo(dest_file)
                    ti.size = os.path.getsize(src_file)
                    if f.endswith(".sh") or f.endswith(".py") or f == "parsage":
                        ti.mode = 0o755
                    else:
                        ti.mode = 0o644
                    with open(src_file, "rb") as sf:
                        tar.addfile(ti, sf)

        for root_file in ["package.json", "README.md"]:
            src = os.path.join(ROOT_DIR, root_file)
            if os.path.exists(src):
                ti = tarfile.TarInfo(f".{base_install_path}/{root_file}")
                ti.size = os.path.getsize(src)
                ti.mode = 0o644
                with open(src, "rb") as sf:
                    tar.addfile(ti, sf)

        icon_src = os.path.join(SCRIPT_DIR, "parsage.svg")
        if os.path.exists(icon_src):
            ti = tarfile.TarInfo("./usr/share/icons/hicolor/scalable/apps/parsage.svg")
            ti.size = os.path.getsize(icon_src)
            ti.mode = 0o644
            with open(icon_src, "rb") as sf:
                tar.addfile(ti, sf)

        desktop_src = os.path.join(SCRIPT_DIR, "parsage.desktop")
        if os.path.exists(desktop_src):
            ti = tarfile.TarInfo("./usr/share/applications/parsage.desktop")
            ti.size = os.path.getsize(desktop_src)
            ti.mode = 0o644
            with open(desktop_src, "rb") as sf:
                tar.addfile(ti, sf)

        service_src = os.path.join(SCRIPT_DIR, "parsage-deb.service")
        if os.path.exists(service_src):
            ti = tarfile.TarInfo("./usr/lib/systemd/user/parsage.service")
            ti.size = os.path.getsize(service_src)
            ti.mode = 0o644
            with open(service_src, "rb") as sf:
                tar.addfile(ti, sf)

    data_tar_gz = data_tar_io.getvalue()

    files_for_ar = [
        ("debian-binary", debian_binary),
        ("control.tar.gz", control_tar_gz),
        ("data.tar.gz", data_tar_gz)
    ]

    create_ar_archive(DEB_FILE, files_for_ar)

    size_kb = os.path.getsize(DEB_FILE) / 1024
    print(f"\n✅ Successfully generated Debian/Mint installer package:")
    print(f"   📦 {DEB_FILE} ({size_kb:.1f} KB)")
    print(f"   👉 To install on Linux Mint / Ubuntu: sudo dpkg -i {DEB_FILE}")
    print("============================================================\n")

if __name__ == "__main__":
    build_deb()
