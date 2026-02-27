import os
import glob
import subprocess
from typing import Dict, Any, Optional

import decky


def _read_text(path: str) -> str:
    with open(path, "r", encoding="utf-8", errors="ignore") as f:
        return f.read().strip()


def _read_int(path: str) -> int:
    return int(_read_text(path))


def _find_hwmon_by_name(target: str) -> Optional[str]:
    for p in glob.glob("/sys/class/hwmon/hwmon*"):
        try:
            if _read_text(os.path.join(p, "name")) == target:
                return p
        except Exception:
            continue
    return None


def _find_temp_input(hwname: str) -> Optional[str]:
    hw = _find_hwmon_by_name(hwname)
    if not hw:
        return None

    cand = os.path.join(hw, "temp1_input")
    if os.path.exists(cand):
        return cand

    for tp in sorted(glob.glob(os.path.join(hw, "temp*_input"))):
        return tp
    return None


def _temp_c(path: str) -> float:
    v = _read_int(path)
    # hwmon temps are often millidegree; autodetect.
    return (v / 1000.0) if v >= 1000 else float(v)


class Plugin:
    async def _main(self):
        decky.logger.info("Ally Fan Control backend loaded")

    async def _unload(self):
        decky.logger.info("Ally Fan Control backend unloaded")

    async def get_status(self) -> Dict[str, Any]:
        asus = _find_hwmon_by_name("asus")
        curve = _find_hwmon_by_name("asus_custom_fan_curve")
        if not asus or not curve:
            return {
                "ok": False,
                "error": "Required hwmon not found (asus / asus_custom_fan_curve).",
                "asus": asus,
                "curve": curve,
            }

        cpu_rpm = None
        gpu_rpm = None
        try:
            cpu_rpm = _read_int(os.path.join(asus, "fan1_input"))
        except Exception:
            pass
        try:
            gpu_rpm = _read_int(os.path.join(asus, "fan2_input"))
        except Exception:
            pass

        cpu_temp = None
        gpu_temp = None
        cpu_tp = _find_temp_input("k10temp")
        gpu_tp = _find_temp_input("amdgpu")
        try:
            if cpu_tp:
                cpu_temp = _temp_c(cpu_tp)
        except Exception:
            pass
        try:
            if gpu_tp:
                gpu_temp = _temp_c(gpu_tp)
        except Exception:
            pass

        profile = "balanced"
        try:
            profile = _read_text("/etc/ally-fan-profile.conf") or "balanced"
        except Exception:
            pass

        def read_points(prefix: str):
            pts = []
            for i in range(1, 9):
                t = _read_int(os.path.join(curve, f"{prefix}_auto_point{i}_temp"))
                p = _read_int(os.path.join(curve, f"{prefix}_auto_point{i}_pwm"))
                pts.append({"i": i, "temp_c": t, "pwm": p})
            return pts

        return {
            "ok": True,
            "profile": profile,
            "cpu_rpm": cpu_rpm,
            "gpu_rpm": gpu_rpm,
            "cpu_temp_c": cpu_temp,
            "gpu_temp_c": gpu_temp,
            "pwm1_enable": _read_int(os.path.join(curve, "pwm1_enable")),
            "pwm2_enable": _read_int(os.path.join(curve, "pwm2_enable")),
            "curve_cpu_pwm1": read_points("pwm1"),
            "curve_gpu_pwm2": read_points("pwm2"),
        }

    async def set_profile(self, profile: str) -> Dict[str, Any]:
        profile = (profile or "").strip().lower()
        if profile not in ("balanced", "aggressive"):
            return {"ok": False, "error": "Invalid profile. Use balanced/aggressive."}

        # Persist selection
        try:
            with open("/etc/ally-fan-profile.conf", "w", encoding="utf-8") as f:
                f.write(profile + "\n")
        except Exception as e:
            return {"ok": False, "error": f"Cannot write /etc/ally-fan-profile.conf: {e!r}"}

        # Apply via your existing systemd service (preferred)
        try:
            subprocess.check_call(["systemctl", "restart", "ally-fan-curve.service"])
            return {"ok": True}
        except Exception as e:
            # Fallback: call helper directly (if present)
            try:
                subprocess.check_call(["/usr/local/bin/ally-fan-profile", profile])
                return {"ok": True}
            except Exception as e2:
                return {"ok": False, "error": f"Apply failed: {e!r}; fallback failed: {e2!r}"}
