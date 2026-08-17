#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Harness Desktop Control — DeepSeek Harness 桌面控制器
一个不依赖 Harness 本身、可独立运行的桌面小工具：
- 桌面图标/快捷方式直接启动本程序（推荐用 install_desktop_shortcut.ps1 创建）
- 窗口会出现在任务栏，可固定到任务栏
- 界面提供：启动 Harness、关闭 Harness、重启 Harness
运行环境：Windows + Python 3（仅标准库，Tkinter 用于界面）。
"""
from __future__ import annotations
import json
import os
import random
import re
import shutil
import socket
import subprocess
import sys
import threading
import time
import webbrowser
from pathlib import Path
try:
    import tkinter as tk
    from tkinter import messagebox, scrolledtext, ttk
except Exception:  # pragma: no cover
    tk = None
BASE_DIR = Path(__file__).resolve().parent
CONFIG_PATH = BASE_DIR / "config.json"
# Windows process creation flags
CREATE_NEW_PROCESS_GROUP = 0x00000200
DETACHED_PROCESS = 0x00000008
CREATE_NO_WINDOW = 0x08000000

def load_config() -> dict:
    if CONFIG_PATH.exists():
        try:
            return json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
        except Exception as exc:
            print("读取 config.json 失败，使用默认配置：", exc)
    return {
        "name": "DeepSeek Harness",
        "command": ["dsh", "--profile", "web"],
        "url": "http://127.0.0.1:3080",
        "working_dir": None,
        "open_browser": True,
        "port": 3080,
        "pid_file": "state/harness.pid",
        "log_file": "state/harness.log",
    }
CONFIG = load_config()
NAME = str(CONFIG.get("name") or "Harness")
URL = str(CONFIG.get("url") or "http://127.0.0.1:3080")
PORT = int(CONFIG.get("port") or 3080)
PID_FILE = BASE_DIR / str(CONFIG.get("pid_file") or "state/harness.pid")
LOG_FILE = BASE_DIR / str(CONFIG.get("log_file") or "state/harness.log")

def log(msg: str) -> None:
    line = f"[{time.strftime('%H:%M:%S')}] {msg}"
    print(line)
    try:
        LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
        with LOG_FILE.open("a", encoding="utf-8") as fh:
            fh.write(line + "\n")
    except Exception:
        pass

def resolve_dsh_command() -> list[str]:
    """把配置里的命令解析成实际可执行命令；找不到 dsh 时尝试常见安装位置。"""
    command = CONFIG.get("command") or ["dsh", "--profile", "web"]
    if not isinstance(command, list) or not command:
        command = ["dsh", "--profile", "web"]
    first = str(command[0])
    if first.lower() in ("dsh", "dsh.cmd", "dsh.exe"):
        found = shutil.which(first)
        if found:
            command[0] = found
            return command
        # 常见 npx 缓存位置：C:\Users\<user>\AppData\Local\npm-cache\_npx\<hash>\node_modules\.bin\dsh.cmd
        candidates = []
        local = os.environ.get("LOCALAPPDATA")
        if local:
            npx_root = Path(local) / "npm-cache" / "_npx"
            if npx_root.exists():
                candidates.extend(npx_root.glob("*/node_modules/.bin/dsh.cmd"))
                candidates.extend(npx_root.glob("*/node_modules/.bin/dsh.exe"))
        home = Path.home()
        npx_home = home / "AppData" / "Local" / "npm-cache" / "_npx"
        if npx_home.exists():
            candidates.extend(npx_home.glob("*/node_modules/.bin/dsh.cmd"))
            candidates.extend(npx_home.glob("*/node_modules/.bin/dsh.exe"))
        for cand in candidates:
            if cand.exists():
                command[0] = str(cand)
                return command
    return command

def run_hidden(args: list[str]) -> str:
    """运行一个命令行工具并返回输出（隐藏窗口，避免闪烁）。"""
    creationflags = 0
    if os.name == "nt":
        creationflags = CREATE_NO_WINDOW
    try:
        proc = subprocess.run(
            args,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            creationflags=creationflags,
            timeout=30,
        )
        return (proc.stdout or "") + (proc.stderr or "")
    except Exception as exc:
        return str(exc)

def pid_alive(pid: int) -> bool:
    if pid <= 0:
        return False
    if os.name == "nt":
        out = run_hidden(["tasklist", "/FI", f"PID eq {pid}", "/NH"])
        return str(pid) in out
    try:
        os.kill(pid, 0)
        return True
    except OSError:
        return False

def read_pid_file() -> int:
    try:
        text = PID_FILE.read_text(encoding="utf-8").strip()
        return int(text)
    except Exception:
        return 0

def write_pid_file(pid: int) -> None:
    try:
        PID_FILE.parent.mkdir(parents=True, exist_ok=True)
        PID_FILE.write_text(str(pid), encoding="utf-8")
    except Exception as exc:
        log(f"写入 PID 文件失败：{exc}")

def clear_pid_file() -> None:
    try:
        PID_FILE.unlink(missing_ok=True)
    except Exception:
        pass

def port_in_use(port: int) -> bool:
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            sock.settimeout(0.4)
            return sock.connect_ex(("127.0.0.1", port)) == 0
    except Exception:
        return False

def find_pid_by_port(port: int) -> int:
    """通过 netstat 找监听指定端口的 PID。"""
    if os.name != "nt":
        return 0
    try:
        out = run_hidden(["netstat", "-ano", "-p", "tcp"])
        pattern = re.compile(rf"\s*TCP\s+[^:]+:{port}\s+\S+\s+LISTENING\s+(\d+)\s*$", re.M)
        match = pattern.search(out)
        if match:
            return int(match.group(1))
    except Exception as exc:
        log(f"查找端口 PID 失败：{exc}")
    return 0

def find_dsh_pids() -> list[int]:
    """尝试找出正在运行的 Harness/dsh 相关进程。"""
    pids: list[int] = []
    # 1. 优先使用 PID 文件
    pid = read_pid_file()
    if pid and pid_alive(pid):
        pids.append(pid)
    # 2. 端口占用者
    port_pid = find_pid_by_port(PORT)
    if port_pid and port_pid not in pids:
        pids.append(port_pid)
    # 已经通过端口/PID 文件找到进程时，直接返回；taskkill /T 会处理整棵进程树。
    if pids:
        return pids
    # 3. 通过 PowerShell 匹配命令行（dsh / --profile web / harness）
    #    只匹配常见 dsh 宿主进程名，避免把 PowerShell 自身或 shell 也纳入。
    if os.name == "nt":
        script = (
            "Get-CimInstance Win32_Process | "
            "Where-Object { $_.Name -in @('node.exe','cmd.exe','dsh.exe','dsh') "
            "-and $_.CommandLine -match 'dsh' -and $_.CommandLine -match 'web' } | "
            "Select-Object -ExpandProperty ProcessId"
        )
        out = run_hidden(["powershell", "-NoProfile", "-Command", script])
        for token in re.findall(r"\d+", out):
            p = int(token)
            if p not in pids:
                pids.append(p)
    return pids

def stop_harness() -> str:
    """关闭 Harness（终止进程树）。返回操作摘要。"""
    pids = find_dsh_pids()
    if not pids:
        log("未发现正在运行的 Harness，无需关闭。")
        return "未发现正在运行的 Harness。"
    killed = []
    for pid in pids:
        log(f"正在关闭进程 PID={pid}")
        if os.name == "nt":
            run_hidden(["taskkill", "/PID", str(pid), "/T", "/F"])
        else:
            try:
                os.kill(pid, 15)
            except OSError:
                pass
        killed.append(pid)
    # 等待端口释放
    for _ in range(30):
        if not port_in_use(PORT) and not any(pid_alive(p) for p in pids):
            break
        time.sleep(0.3)
    clear_pid_file()
    msg = f"已关闭 {len(killed)} 个进程：{', '.join(map(str, killed))}"
    log(msg)
    return msg

def start_harness() -> str:
    """启动 Harness；如果已经在运行则返回提示。"""
    if port_in_use(PORT):
        msg = f"{NAME} 已在运行（{URL} 可访问）。"
        log(msg)
        return msg
    command = resolve_dsh_command()
    working_dir = CONFIG.get("working_dir") or str(BASE_DIR)
    log(f"启动命令：{' '.join(command)}")
    log(f"工作目录：{working_dir}")
    try:
        creationflags = 0
        if os.name == "nt":
            creationflags = CREATE_NO_WINDOW | CREATE_NEW_PROCESS_GROUP
        proc = subprocess.Popen(
            command,
            cwd=working_dir,
            stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            close_fds=True,
            creationflags=creationflags,
        )
    except Exception as exc:
        msg = f"启动失败：{exc}"
        log(msg)
        return msg
    write_pid_file(proc.pid)
    log(f"已启动，PID={proc.pid}")
    # 等待端口就绪
    for _ in range(40):
        if port_in_use(PORT):
            log(f"{NAME} 已就绪：{URL}")
            if CONFIG.get("open_browser", True):
                threading.Timer(0.5, lambda: webbrowser.open(URL)).start()
            return f"已启动 {NAME}：{URL}"
    return f"{NAME} 启动命令已执行（PID={proc.pid}），但尚未检测到端口 {PORT} 就绪。"

def restart_harness() -> str:
    log("正在重启 Harness……")
    stop_harness()
    time.sleep(0.8)
    return start_harness()

class HarnessControlApp:
    """背景图片 + 右侧炎黄按钮 + 左侧中部日志的简洁控制器。"""

    FLAME = "#FFB400"
    FLAME_HOVER = "#FFC233"
    GRAY = "#B8B8B8"
    GRAY_TEXT = "#F0F0F0"
    TEXT = "#2B2825"
    CARD = "#FFF9F0"

    def __init__(self, root: tk.Tk) -> None:
        self.root = root
        self.root.title("Harness 桌面控制器")
        self.root.geometry("760x600")
        self.root.minsize(760, 600)
        self.root.resizable(False, False)

        try:
            import ctypes
            ctypes.windll.shell32.SetCurrentProcessExplicitAppUserModelID("DeepSeek.HarnessDesktopControl.1")
        except Exception:
            pass

        icon_path = BASE_DIR / "assets" / "harness.ico"
        if icon_path.exists():
            try:
                self.root.iconbitmap(default=str(icon_path))
            except Exception:
                pass

        self._buttons = {}
        self._build_ui()
        self.refresh_status()

    def _rounded_rect(self, canvas, x1, y1, x2, y2, r, **kwargs):
        points = [
            x1 + r, y1,
            x2 - r, y1,
            x2, y1,
            x2, y1 + r,
            x2, y2 - r,
            x2, y2,
            x2 - r, y2,
            x1 + r, y2,
            x1, y2,
            x1, y2 - r,
            x1, y1 + r,
            x1, y1,
        ]
        return canvas.create_polygon(points, smooth=True, **kwargs)

    def _create_button(self, key, cx, cy, text, command):
        canvas = self.bg_canvas
        x1, y1, x2, y2 = cx - 90, cy - 24, cx + 90, cy + 24
        rect = self._rounded_rect(canvas, x1, y1, x2, y2, 20,
                                  fill=self.FLAME, outline="")
        label = canvas.create_text(cx, cy, text=text, fill=self.TEXT,
                                   font=("Yu Gothic UI", 11, "bold"))
        info = {
            "rect": rect,
            "label": label,
            "command": command,
            "enabled": True,
        }
        self._buttons[key] = info
        for item in (rect, label):
            canvas.tag_bind(item, "<Button-1>", lambda e, k=key: self._on_button(k))
            canvas.tag_bind(item, "<Enter>", lambda e, k=key: self._on_hover(k, True))
            canvas.tag_bind(item, "<Leave>", lambda e, k=key: self._on_hover(k, False))

    def _set_button_enabled(self, key, enabled):
        info = self._buttons[key]
        info["enabled"] = enabled
        if enabled:
            self.bg_canvas.itemconfig(info["rect"], fill=self.FLAME)
            self.bg_canvas.itemconfig(info["label"], fill=self.TEXT)
        else:
            self.bg_canvas.itemconfig(info["rect"], fill=self.GRAY)
            self.bg_canvas.itemconfig(info["label"], fill=self.GRAY_TEXT)

    def _on_button(self, key):
        info = self._buttons.get(key)
        if info and info["enabled"] and info["command"]:
            info["command"]()

    def _on_hover(self, key, hovering):
        info = self._buttons.get(key)
        if not info or not info["enabled"]:
            return
        self.bg_canvas.itemconfig(info["rect"], fill=self.FLAME_HOVER if hovering else self.FLAME)

    def _build_ui(self) -> None:
        self.bg_canvas = tk.Canvas(self.root, highlightthickness=0)
        self.bg_canvas.pack(fill=tk.BOTH, expand=True)

        bg_path = BASE_DIR.parent / "img" / "background_ui.png"
        if not bg_path.exists():
            bg_path = BASE_DIR.parent / "img" / "background.png"
        self.bg_photo = tk.PhotoImage(file=str(bg_path))
        self.bg_canvas.create_image(0, 0, anchor="nw", image=self.bg_photo)

        # 左侧中部：圆角日志卡片
        self._rounded_rect(self.bg_canvas, 30, 150, 470, 460, 24,
                           fill=self.CARD, outline="#D8CDB8", width=1)
        self.log_text = scrolledtext.ScrolledText(
            self.bg_canvas,
            height=13,
            state=tk.DISABLED,
            font=("MS Gothic", 10),
            bg=self.CARD,
            fg=self.TEXT,
            insertbackground=self.TEXT,
            relief="flat",
            borderwidth=0,
            highlightthickness=0,
            padx=14,
            pady=10,
        )
        self.bg_canvas.create_window(50, 170, anchor="nw", window=self.log_text,
                                     width=390, height=260)

        # 右侧：三个炎黄圆角按钮
        self._create_button("start", 630, 190, "启动 Harness", self.on_start)
        self._create_button("stop", 630, 270, "关闭 Harness", self.on_stop)
        self._create_button("restart", 630, 350, "重启 Harness", self.on_restart)

        self.append_log("桌面控制器已启动。")

    def append_log(self, msg: str) -> None:
        self.log_text.configure(state=tk.NORMAL)
        self.log_text.insert(tk.END, f"[{time.strftime('%H:%M:%S')}] {msg}\n")
        self.log_text.see(tk.END)
        self.log_text.configure(state=tk.DISABLED)

    def refresh_status(self) -> None:
        running = port_in_use(PORT) or bool(find_dsh_pids())
        self._set_button_enabled("start", not running)
        self._set_button_enabled("stop", running)
        self._set_button_enabled("restart", running)
        self.root.after(2500, self.refresh_status)

    def run_action(self, fn) -> None:
        def worker() -> None:
            try:
                msg = fn()
            except Exception as exc:
                msg = f"操作失败：{exc}"
            self.root.after(0, lambda: self.append_log(msg))
            self.root.after(0, lambda: self.refresh_status())
            if "失败" in msg or "未发现" in msg or "已在运行" in msg:
                self.root.after(0, lambda: messagebox.showinfo("提示", msg))

        self.root.after(0, lambda: self.append_log("开始操作…"))
        threading.Thread(target=worker, daemon=True).start()

    def on_start(self) -> None:
        self.run_action(start_harness)

    def on_stop(self) -> None:
        if messagebox.askyesno("确认关闭", f"确定要关闭 {NAME} 吗？", parent=self.root):
            self.run_action(stop_harness)

    def on_restart(self) -> None:
        if messagebox.askyesno("确认重启", f"确定要重启 {NAME} 吗？", parent=self.root):
            self.run_action(restart_harness)

def main() -> int:
    if tk is None:
        print("当前环境缺少 Tkinter，无法显示桌面窗口。")
        return 1
    root = tk.Tk()
    try:
        style = ttk.Style(root)
        if "vista" in style.theme_names():
            style.theme_use("vista")
    except Exception:
        pass
    HarnessControlApp(root)
    root.mainloop()
    return 0
if __name__ == "__main__":
    sys.exit(main())
