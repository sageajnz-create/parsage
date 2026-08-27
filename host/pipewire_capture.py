#!/usr/bin/env python3
"""
🌿 PARSAGE Linux Hardware & PipeWire Diagnostics
Detects AMD VA-API, NVENC, Wayland Portal, and PipeWire Nodes
Created with ❤️ by Sage & Antigravity
"""

import os
import sys
import subprocess
import shutil

def check_command(cmd):
    return shutil.which(cmd) is not None

def is_process_running(proc_name):
    try:
        subprocess.check_output(["pgrep", "-f", proc_name], stderr=subprocess.DEVNULL)
        return True
    except Exception:
        return False

def get_system_diagnostics():
    info = {
        "display_server": "wayland" if os.environ.get("WAYLAND_DISPLAY") else "x11",
        "desktop_env": os.environ.get("XDG_CURRENT_DESKTOP", "unknown"),
        "wayland_display": os.environ.get("WAYLAND_DISPLAY", ""),
        "gpu_vendor": "unknown",
        "dri_render_node": None,
        "vaapi_available": False,
        "pipewire_available": False,
        "portal_available": False,
        "uinput_writable": False,
        "audio_sink": "default",
        "recommended_encoder": "software"
    }

    # Check /dev/dri/renderD*
    if os.path.exists("/dev/dri/renderD128"):
        info["dri_render_node"] = "/dev/dri/renderD128"

    # Check GPU info via lspci
    try:
        lspci = subprocess.check_output(["lspci"], text=True, stderr=subprocess.DEVNULL)
        if "AMD" in lspci or "Radeon" in lspci or "Navi" in lspci:
            info["gpu_vendor"] = "AMD Radeon"
            info["recommended_encoder"] = "vaapi_h264"
        elif "NVIDIA" in lspci:
            info["gpu_vendor"] = "NVIDIA"
            info["recommended_encoder"] = "nvenc_h264"
        elif "Intel" in lspci:
            info["gpu_vendor"] = "Intel"
            info["recommended_encoder"] = "vaapi_h264"
    except Exception:
        pass

    # Check VA-API
    if check_command("vainfo") or os.path.exists("/usr/lib/dri/radeonsi_drv_video.so") or os.path.exists("/usr/lib64/dri/radeonsi_drv_video.so"):
        info["vaapi_available"] = True

    # Check PipeWire
    if check_command("pw-cli") or check_command("wpctl") or is_process_running("pipewire"):
        info["pipewire_available"] = True

    # Check Portal (including xdg-desktop-portal-hyprland)
    if is_process_running("xdg-desktop-portal") or os.path.exists("/usr/lib/xdg-desktop-portal"):
        info["portal_available"] = True

    # Check uinput
    try:
        fd = os.open("/dev/uinput", os.O_WRONLY | os.O_NONBLOCK)
        os.close(fd)
        info["uinput_writable"] = True
    except Exception:
        info["uinput_writable"] = False

    return info

def print_diagnostics():
    diag = get_system_diagnostics()
    print("============================================================")
    print("  🌿 PARSAGE LINUX SYSTEM CAPABILITIES")
    print("  Created with ❤️ by Sage & Antigravity")
    print("============================================================")
    print(f"  • Display Server:     {diag['display_server'].upper()} ({diag['desktop_env']})")
    print(f"  • Wayland Display:    {diag['wayland_display'] or 'None'}")
    print(f"  • GPU Vendor:         {diag['gpu_vendor']}")
    print(f"  • DRI Render Node:    {diag['dri_render_node'] or 'None'}")
    print(f"  • Hardware Encoder:   {diag['recommended_encoder'].upper()}")
    print(f"  • PipeWire Audio/Vid: {'✅ Ready' if diag['pipewire_available'] else '❌ Missing'}")
    print(f"  • ScreenCast Portal:  {'✅ Ready (Wayland/Hyprland)' if diag['portal_available'] else '❌ Missing'}")
    print(f"  • Linux uinput (Joy): {'✅ Ready (Zero-lag P1-P4)' if diag['uinput_writable'] else '❌ Root/Udev needed'}")
    print("============================================================")
    return diag

if __name__ == "__main__":
    print_diagnostics()
