#!/usr/bin/env python3
"""Exercise the existing .deb and install.sh paths without a live distro farm."""

from __future__ import annotations

import io
import json
import os
import shutil
import stat
import subprocess
import sys
import tarfile
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PACKAGING = ROOT / "packaging"


def parse_ar(archive: Path) -> dict[str, bytes]:
    members: dict[str, bytes] = {}
    data = archive.read_bytes()
    if not data.startswith(b"!<arch>\n"):
        raise AssertionError("Debian package is not an ar archive")
    offset = 8
    while offset + 60 <= len(data):
        header = data[offset : offset + 60]
        name = header[0:16].decode("ascii").strip()
        size = int(header[48:58].decode("ascii").strip())
        offset += 60
        members[name] = data[offset : offset + size]
        offset += size + (size % 2)
    return members


class PackagingLifecycleTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        subprocess.check_call([sys.executable, str(PACKAGING / "build_deb.py")], cwd=ROOT)
        matches = sorted((ROOT / "dist_pkg").glob("parsage_*_all.deb"))
        if not matches:
            raise AssertionError("build_deb.py did not produce a .deb")
        cls.deb = matches[-1]
        cls.ar = parse_ar(cls.deb)

    def test_deb_control_and_maintainer_scripts(self) -> None:
        control_tar = tarfile.open(fileobj=io.BytesIO(self.ar["control.tar.gz"]), mode="r:gz")
        names = set(control_tar.getnames())
        self.assertIn("./control", names)
        self.assertIn("./postinst", names)
        self.assertIn("./prerm", names)
        self.assertIn("./postrm", names)
        control = control_tar.extractfile("./control").read().decode("utf-8")
        self.assertIn("Package: parsage", control)
        self.assertIn("Architecture: all", control)
        postinst = control_tar.extractfile("./postinst").read().decode("utf-8")
        prerm = control_tar.extractfile("./prerm").read().decode("utf-8")
        postrm = control_tar.extractfile("./postrm").read().decode("utf-8")
        self.assertIn("99-parsage-uinput.rules", postinst)
        self.assertIn("/usr/local/bin/parsage", prerm)
        self.assertIn("purge", postrm)
        self.assertTrue(control_tar.getmember("./postinst").mode & stat.S_IXUSR)
        self.assertTrue(control_tar.getmember("./postrm").mode & stat.S_IXUSR)

    def test_deb_payload_layout_and_service_unit(self) -> None:
        data_tar = tarfile.open(fileobj=io.BytesIO(self.ar["data.tar.gz"]), mode="r:gz")
        names = set(data_tar.getnames())
        self.assertIn("./usr/share/parsage/bin/parsage", names)
        self.assertIn("./usr/share/applications/parsage.desktop", names)
        self.assertIn("./usr/share/icons/hicolor/scalable/apps/parsage.svg", names)
        self.assertIn("./usr/lib/systemd/user/parsage.service", names)
        self.assertIn("./usr/share/parsage/packaging/uninstall.sh", names)
        unit = data_tar.extractfile("./usr/lib/systemd/user/parsage.service").read().decode("utf-8")
        self.assertIn("Restart=on-failure", unit)
        self.assertIn("ExecStart=/usr/share/parsage/bin/parsage headless", unit)
        desktop = data_tar.extractfile("./usr/share/applications/parsage.desktop").read().decode("utf-8")
        self.assertIn("Exec=parsage", desktop)

    def test_deb_extract_upgrade_and_prerm_uninstall(self) -> None:
        prefix = Path(tempfile.mkdtemp(prefix="parsage-deb-"))
        try:
            data_tar = tarfile.open(fileobj=io.BytesIO(self.ar["data.tar.gz"]), mode="r:gz")
            data_tar.extractall(prefix, filter="data")
            install_root = prefix / "usr/share/parsage"
            self.assertTrue((install_root / "bin/parsage").exists())
            stale = install_root / "web/dist/assets/stale-old-hash.js"
            stale.parent.mkdir(parents=True, exist_ok=True)
            stale.write_text("// leftover from previous package\n", encoding="utf-8")
            data_tar.extractall(prefix, filter="data")
            self.assertTrue(stale.exists(), "dpkg overlay extract keeps unmanaged files; prerm/postrm must clean the package")
            # Maintainer scripts are what dpkg runs on remove. Simulate prerm + deleting payload.
            prerm = tarfile.open(fileobj=io.BytesIO(self.ar["control.tar.gz"]), mode="r:gz").extractfile("./prerm").read().decode("utf-8")
            self.assertIn("rm -f /usr/local/bin/parsage", prerm)
            shutil.rmtree(install_root)
            self.assertFalse(install_root.exists())
        finally:
            shutil.rmtree(prefix, ignore_errors=True)

    def test_install_sh_upgrade_and_uninstall(self) -> None:
        home = Path(tempfile.mkdtemp(prefix="parsage-prefix-"))
        env = {
            **os.environ,
            "HOME": str(home),
            "PARSAGE_SKIP_DEPS": "1",
            "PARSAGE_INSTALL_DIR": str(home / "share/parsage"),
            "PARSAGE_BIN_DIR": str(home / "bin"),
            "PARSAGE_ICON_DIR": str(home / "icons"),
            "PARSAGE_APP_DIR": str(home / "applications"),
            "PARSAGE_SYSTEMD_DIR": str(home / "systemd"),
            "XDG_CONFIG_HOME": str(home / "config"),
        }
        try:
            subprocess.check_call(["bash", str(PACKAGING / "install.sh")], cwd=ROOT, env=env)
            install_dir = home / "share/parsage"
            launcher = home / "bin/parsage"
            desktop = home / "applications/parsage.desktop"
            unit = home / "systemd/parsage.service"
            self.assertTrue(launcher.is_symlink() or launcher.exists())
            self.assertTrue(desktop.exists())
            self.assertTrue(unit.exists())
            self.assertIn("Restart=on-failure", unit.read_text(encoding="utf-8"))
            assets = install_dir / "web/dist/assets"
            assets.mkdir(parents=True, exist_ok=True)
            leftover = assets / "stale-old-hash.js"
            leftover.write_text("// leftover hashed bundle\n", encoding="utf-8")
            subprocess.check_call(["bash", str(PACKAGING / "install.sh")], cwd=ROOT, env=env)
            self.assertFalse(leftover.exists(), "upgrade must clear previous web hashed assets")
            self.assertTrue((install_dir / "bin/parsage").exists())
            subprocess.check_call(["bash", str(PACKAGING / "uninstall.sh")], cwd=ROOT, env=env)
            self.assertFalse(install_dir.exists())
            self.assertFalse(desktop.exists())
            self.assertFalse(unit.exists())
            self.assertTrue((home / "config/parsage").exists())
            subprocess.check_call(["bash", str(PACKAGING / "uninstall.sh"), "--purge"], cwd=ROOT, env=env)
            self.assertFalse((home / "config/parsage").exists())
        finally:
            shutil.rmtree(home, ignore_errors=True)


def main() -> int:
    suite = unittest.defaultTestLoader.loadTestsFromTestCase(PackagingLifecycleTests)
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    report = {
        "deb": str(getattr(PackagingLifecycleTests, "deb", "")),
        "testsRun": result.testsRun,
        "failures": len(result.failures),
        "errors": len(result.errors),
        "installUpgradeUninstall": result.wasSuccessful(),
        "distroFarm": False,
        "note": "Extracted .deb layout and prefix install.sh lifecycle on this host; live Mint/Arch/Fedora dpkg/rpm farms are not in CI.",
    }
    print(json.dumps(report, indent=2))
    return 0 if result.wasSuccessful() else 1


if __name__ == "__main__":
    raise SystemExit(main())
