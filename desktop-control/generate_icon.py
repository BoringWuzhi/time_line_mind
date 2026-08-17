#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""生成桌面/任务栏图标 assets/harness.ico。仅需要 Pillow。"""
from pathlib import Path
try:
    from PIL import Image, ImageDraw, ImageFont
except Exception as exc:
    raise SystemExit(f"需要 Pillow：{exc}")

HERE = Path(__file__).resolve().parent
OUT = HERE / "assets" / "harness.ico"
OUT.parent.mkdir(parents=True, exist_ok=True)

SIZE = 256
img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
draw = ImageDraw.Draw(img)

# 圆角深色底板
radius = 52
draw.rounded_rectangle((8, 8, SIZE - 8, SIZE - 8), radius=radius, fill=(18, 26, 48, 255))
# 顶部高光
draw.rounded_rectangle((24, 18, SIZE - 24, SIZE - 56), radius=28, fill=(34, 52, 88, 255))

# 中间 H 形：用两个竖条 + 横条
bar_w = 34
gap = 34
left = (SIZE - bar_w * 2 - gap) // 2
top = 62
bottom = 194
bar_h = bottom - top
# 左竖条
draw.rectangle((left, top, left + bar_w, bottom), fill=(80, 190, 255, 255))
# 右竖条
draw.rectangle((left + bar_w + gap, top, left + bar_w * 2 + gap, bottom), fill=(80, 190, 255, 255))
# 横条
draw.rectangle((left, top + (bar_h - bar_w) // 2, left + bar_w * 2 + gap, top + (bar_h + bar_w) // 2), fill=(80, 190, 255, 255))

# 底部状态小点：绿/红两半? 简单画一个圆点
draw.ellipse((106, 178, 150, 222), fill=(60, 220, 130, 255))

# 保存多尺寸 ICO
img.save(OUT, format="ICO", sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
print(f"已生成 {OUT}")
