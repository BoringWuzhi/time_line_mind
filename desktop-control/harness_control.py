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
    """任务栏可见的桌面控制窗口。"""

    def __init__(self, root: tk.Tk) -> None:
        self.root = root
        self.root.title(f"{NAME} 桌面控制器")
        self.root.geometry("760x600")
        self.root.minsize(640, 520)
        # 任务栏图标分组（Windows）
        try:
            import ctypes
            ctypes.windll.shell32.SetCurrentProcessExplicitAppUserModelID("DeepSeek.HarnessDesktopControl.1")
        except Exception:
            pass
        # 使用自定义图标（窗口标题栏和任务栏）
        icon_path = BASE_DIR / "assets" / "harness.ico"
        if icon_path.exists():
            try:
                self.root.iconbitmap(default=str(icon_path))
            except Exception:
                pass
        self._build_ui()
        self.refresh_status()

    def _draw_washi_texture(self, canvas, width, height, count=80):
        """在画布上撒一层极淡的砂子纹理。"""
        rnd = random.Random(20240817)
        for _ in range(count):
            x = rnd.randint(0, max(0, width - 1))
            y = rnd.randint(0, max(0, height - 1))
            tone = rnd.choice(["#E9E1D4", "#EDE6DA", "#E4DBCB", "#F0E9DE"])
            canvas.create_rectangle(x, y, x + 1, y + 1, fill=tone, outline="")

    def _draw_break_line(self, canvas, y, x_start, x_end, color):
        """破墨横线：一条横线穿过约 1/3 处，线端渐隐、不闭合。"""
        steps = 14
        for i in range(steps):
            t = i / max(1, steps - 1)
            x0 = x_start + (x_end - x_start) * t
            x1 = x_start + (x_end - x_start) * (t + 1 / steps)
            alpha = 0.15 + 0.85 * (1 - t) ** 1.8
            # 用越来越接近底色的颜色模拟渐隐
            base = [245, 240, 232]
            target = [
                int(color[1:3], 16),
                int(color[3:5], 16),
                int(color[5:7], 16),
            ]
            r = int(base[0] + (target[0] - base[0]) * alpha)
            g = int(base[1] + (target[1] - base[1]) * alpha)
            b = int(base[2] + (target[2] - base[2]) * alpha)
            canvas.create_line(x0, y, x1, y, fill="#%02x%02x%02x" % (r, g, b), width=1)

    def _draw_ichimatsu(self, canvas, x, y, size, color):
        """茣蓙目（市松纹极简化）：两个交错正方形线框。"""
        s = size
        canvas.create_rectangle(x - s, y - s, x + s, y + s, outline=color, width=1)
        canvas.create_rectangle(x, y, x + s * 2, y + s * 2, outline=color, width=1)

    def _draw_bamboo(self, canvas, x, y_bottom, height, color, dark):
        """在 Canvas 上画一根低饱和和风竹。"""
        y_top = y_bottom - height
        canvas.create_line(x, y_top, x + 4, y_bottom, fill=color, width=4)
        for i in range(7):
            yy = y_bottom - height * i / 7
            canvas.create_line(x - 5, yy, x + 6, yy + 3, fill=dark, width=2)
        leaf_color = color
        canvas.create_polygon(x + 2, y_top + 6, x + 24, y_top - 8, x + 26, y_top + 12, fill=leaf_color, outline=dark)
        canvas.create_polygon(x + 3, y_top + 14, x + 26, y_top + 16, x + 18, y_top + 30, fill=leaf_color, outline=dark)
        canvas.create_polygon(x - 2, y_top + 22, x - 22, y_top + 14, x - 18, y_top + 34, fill=leaf_color, outline=dark)

    def _draw_maple_leaf(self, canvas, cx, cy, size, color, dark):
        """在 Canvas 上画一片低饱和枫叶。"""
        s = size
        points = [
            cx, cy - s,
            cx + s * 0.18, cy - s * 0.35,
            cx + s * 0.72, cy - s * 0.72,
            cx + s * 0.42, cy - s * 0.12,
            cx + s * 0.95, cy + s * 0.12,
            cx + s * 0.38, cy + s * 0.22,
            cx + s * 0.28, cy + s * 0.75,
            cx, cy + s * 0.35,
            cx - s * 0.28, cy + s * 0.75,
            cx - s * 0.38, cy + s * 0.22,
            cx - s * 0.95, cy + s * 0.12,
            cx - s * 0.42, cy - s * 0.12,
            cx - s * 0.72, cy - s * 0.72,
            cx - s * 0.18, cy - s * 0.35,
        ]
        canvas.create_polygon(points, fill=color, outline=dark, width=1)
        canvas.create_line(cx, cy, cx, cy + s * 0.3, fill=dark, width=1)

    def _build_ui(self) -> None:
        # ── 和风设计系统：来自 style guide 的变量 ──
        PAPER = "#F5F0E8"
        KON = "#1A2A3A"
        SHUJU = "#BC5A3E"
        MATCHA = "#8BA788"
        YAMABUKI = "#C59B5B"
        SUMI = "#2B2825"
        TEXT_SECONDARY = "#5A4E45"
        CARD_BG = "#FFFCF8"
        LINE = "#E3D5C5"
        FONT = ("Yu Gothic UI", 10)
        FONT_TITLE = ("Yu Gothic UI", 20)
        FONT_MONO = ("MS Gothic", 9)

        self.root.configure(bg=PAPER)
        container = tk.Frame(self.root, bg=PAPER)
        container.pack(fill=tk.BOTH, expand=True)

        # ── 顶部导航栏：屏风式 / 极简 ──
        navbar = tk.Frame(container, bg=PAPER)
        navbar.pack(fill=tk.X, padx=48, pady=(28, 8))

        logo = tk.Label(navbar, text="和风 · 样式", bg=PAPER, fg=KON,
                        font=("Yu Gothic UI", 13, "bold"), anchor="w")
        logo.pack(side=tk.LEFT)
        logo_sub = tk.Label(navbar, text="桌面控制器", bg=PAPER, fg=SHUJU,
                            font=("Yu Gothic UI", 9), anchor="w")
        logo_sub.pack(side=tk.LEFT, padx=(8, 0))

        manual_btn = tk.Button(
            navbar,
            text="说明书",
            command=self.open_manual,
            bg=PAPER,
            fg=SHUJU,
            activebackground=PAPER,
            activeforeground=KON,
            relief="flat",
            bd=0,
            font=("Yu Gothic UI", 9),
            cursor="hand2",
        )
        manual_btn.pack(side=tk.RIGHT)

        # ── Hero 区：大量余白 + 中文标题 ──
        hero = tk.Frame(container, bg=PAPER)
        hero.pack(fill=tk.X, padx=56, pady=(10, 6))
        tk.Label(hero, text="—— 静寂之美 ——", bg=PAPER, fg=SHUJU,
                 font=("Yu Gothic UI", 10), anchor="w").pack(fill=tk.X)
        tk.Label(hero, text=f"{NAME} 桌面控制器", bg=PAPER, fg=KON,
                 font=FONT_TITLE, anchor="w").pack(fill=tk.X, pady=(4, 2))
        tk.Label(hero, text="启动 / 关闭 / 重启 DeepSeek Harness", bg=PAPER,
                 fg=TEXT_SECONDARY, font=("Yu Gothic UI", 10), anchor="w").pack(fill=tk.X)

        # ── 破墨线 + 少量竹枫点缀 ──
        deco = tk.Canvas(container, height=64, bg=PAPER, highlightthickness=0)
        deco.pack(fill=tk.X, padx=48, pady=(14, 4))
        self._draw_washi_texture(deco, 640, 64, count=45)
        self._draw_break_line(deco, 32, 0, 240, YAMABUKI)
        self._draw_bamboo(deco, 530, 64, 48, MATCHA, "#6F856B")
        self._draw_maple_leaf(deco, 620, 28, 15, SHUJU, "#9A4630")

        # ── 页脚：中文版权 + 茣蓙目纹理（先 pack，保证底部可见） ──
        footer = tk.Frame(container, bg=PAPER)
        footer.pack(fill=tk.X, side=tk.BOTTOM, padx=48, pady=(20, 26))
        tk.Label(footer, text="© 2026 · 和风桌面控制器 · 余白的设计", bg=PAPER,
                 fg=TEXT_SECONDARY, font=("Yu Gothic UI", 8)).pack(side=tk.LEFT)
        motif = tk.Canvas(footer, width=80, height=20, bg=PAPER, highlightthickness=0)
        motif.pack(side=tk.RIGHT)
        for i in range(4):
            x = 4 + i * 20
            motif.create_rectangle(x, 2, x + 14, 16, outline="#2B2825", width=1)
        for i in range(4):
            x = 14 + i * 20
            motif.create_rectangle(x, 2, x + 14, 16, outline="#2B2825", width=1)

        # ── 内容主体：左侧朱砂锚点分节 ──
        content = tk.Frame(container, bg=PAPER)
        content.pack(fill=tk.BOTH, expand=True, padx=56, pady=(10, 0))

        def make_dot(parent, size=10):
            dot = tk.Canvas(parent, width=size, height=size, bg=PAPER, highlightthickness=0)
            dot.create_oval(3, 3, size - 3, size - 3, fill=SHUJU, outline="")
            return dot

        # 状态模块
        status_row = tk.Frame(content, bg=PAPER)
        status_row.pack(fill=tk.X, pady=(0, 24))
        make_dot(status_row).pack(side=tk.LEFT, padx=(0, 10))
        tk.Label(status_row, text="状态：", bg=PAPER, fg=SUMI, font=FONT).pack(side=tk.LEFT)
        self.status_var = tk.StringVar(value="检测中…")
        self.status_label = tk.Label(status_row, textvariable=self.status_var, bg=PAPER,
                                     fg=SUMI, font=("Yu Gothic UI", 10, "bold"))
        self.status_label.pack(side=tk.LEFT)

        # 按钮模块：参考网页的 outline / primary 按钮
        buttons = tk.Frame(content, bg=PAPER)
        buttons.pack(fill=tk.X, pady=(0, 28))
        make_dot(buttons).pack(side=tk.LEFT, padx=(0, 10))

        def make_button(parent, text, style, command):
            if style == "primary":
                bg, fg, border, hover_bg, hover_fg = KON, "#F5F0E8", KON, SHUJU, "#FFFFFF"
            elif style == "shuju":
                bg, fg, border, hover_bg, hover_fg = PAPER, SHUJU, SHUJU, "#F1E2DB", KON
            else:
                bg, fg, border, hover_bg, hover_fg = PAPER, SUMI, SUMI, "#EFE9DF", SHUJU
            btn = tk.Button(
                parent,
                text=text,
                command=command,
                bg=bg,
                fg=fg,
                activebackground=hover_bg,
                activeforeground=hover_fg,
                disabledforeground="#C9BFAE",
                relief="flat",
                bd=0,
                highlightthickness=1,
                highlightbackground=border,
                highlightcolor=border,
                padx=24,
                pady=8,
                font=FONT,
                cursor="hand2",
            )
            def on_enter(_):
                if str(btn["state"]) != "disabled":
                    btn.configure(bg=hover_bg, fg=hover_fg, highlightbackground=hover_bg)
            def on_leave(_):
                if str(btn["state"]) != "disabled":
                    btn.configure(bg=bg, fg=fg, highlightbackground=border)
            btn.bind("<Enter>", on_enter)
            btn.bind("<Leave>", on_leave)
            return btn

        self.start_btn = make_button(buttons, "启动 Harness", "primary", self.on_start)
        self.start_btn.pack(side=tk.LEFT, padx=(0, 12))
        self.stop_btn = make_button(buttons, "关闭 Harness", "shuju", self.on_stop)
        self.stop_btn.pack(side=tk.LEFT, padx=(0, 12))
        self.restart_btn = make_button(buttons, "重启 Harness", "normal", self.on_restart)
        self.restart_btn.pack(side=tk.LEFT)

        # 日志卡片模块：渗纸卡片
        log_header = tk.Frame(content, bg=PAPER)
        log_header.pack(fill=tk.X, pady=(0, 8))
        make_dot(log_header, size=10).pack(side=tk.LEFT, padx=(0, 10))
        tk.Label(log_header, text="运行日志", bg=PAPER, fg=SUMI,
                 font=("Yu Gothic UI", 10, "bold")).pack(side=tk.LEFT)

        log_card = tk.Frame(content, bg=CARD_BG, highlightbackground=LINE, highlightthickness=1)
        log_card.pack(fill=tk.BOTH, expand=True)
        self.log_text = scrolledtext.ScrolledText(
            log_card,
            height=9,
            state=tk.DISABLED,
            font=FONT_MONO,
            bg=CARD_BG,
            fg=SUMI,
            insertbackground=SUMI,
            relief="flat",
            highlightthickness=0,
            padx=14,
            pady=10,
        )
        self.log_text.pack(fill=tk.BOTH, expand=True, padx=8, pady=8)

        self.append_log("和风 Harness 控制器已启动。")
        self.append_log(f"配置文件：{CONFIG_PATH}")

    def open_manual(self) -> None:
        manual = BASE_DIR / "说明书.md"
        if manual.exists():
            try:
                os.startfile(str(manual))
            except Exception as exc:
                self.append_log(f"无法打开说明书：{exc}")
        else:
            self.append_log("未找到说明书.md")

    def append_log(self, msg: str) -> None:
        self.log_text.configure(state=tk.NORMAL)
        self.log_text.insert(tk.END, f"[{time.strftime('%H:%M:%S')}] {msg}\n")
        self.log_text.see(tk.END)
        self.log_text.configure(state=tk.DISABLED)

    def refresh_status(self) -> None:
        running = port_in_use(PORT) or bool(find_dsh_pids())
        if running:
            self.status_var.set("● 运行中")
            self.status_label.configure(foreground="#2e7d32")
            self.start_btn.configure(state=tk.DISABLED)
            self.stop_btn.configure(state=tk.NORMAL)
            self.restart_btn.configure(state=tk.NORMAL)
        else:
            self.status_var.set("○ 未运行")
            self.status_label.configure(foreground="#c62828")
            self.start_btn.configure(state=tk.NORMAL)
            self.stop_btn.configure(state=tk.DISABLED)
            self.restart_btn.configure(state=tk.DISABLED)
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
                self.root.after(0, lambda: messagebox.showinfo(NAME, msg))
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
