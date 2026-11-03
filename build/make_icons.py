#!/usr/bin/env python3
"""应用图标处理流水线 v2：
1. 从 AI 生成图（白底、图形铺满画布）拟合圆角半径，生成透明背景
2. 修补右下角 AI 水印
3. 按 macOS 规范缩放居中（约 824/1024），输出 icon.png 与各尺寸
"""
from PIL import Image, ImageDraw, ImageFilter

SRC = "icon-source.png"
SIZE = 1024

img = Image.open(SRC).convert("RGBA")
px = img.load()

def is_white(p):
    return p[0] > 240 and p[1] > 240 and p[2] > 240

# ---------- 1) 扫描顶部轮廓推圆角半径 ----------
top_prof = []
for x in range(0, SIZE // 2, 4):
    y0 = next((y for y in range(0, SIZE // 2) if not is_white(px[x, y])), None)
    top_prof.append((x, y0))
flat_y = min(y for _, y in top_prof)
# 轮廓首次到达平直段的位置 ≈ 圆角半径
r_est = next(x for x, y in top_prof if y <= flat_y + 1)
radius = max(80, min(r_est, 400))
print(f"flat_y={flat_y}, corner radius ≈ {radius}")

# ---------- 2) 圆角矩形遮罩（贴边 + 羽化） ----------
mask = Image.new("L", (SIZE, SIZE), 0)
d = ImageDraw.Draw(mask)
d.rounded_rectangle([0, 0, SIZE - 1, SIZE - 1], radius=radius, fill=255)
mask = mask.filter(ImageFilter.GaussianBlur(1.2))
img.putalpha(mask)

# ---------- 3) 修补水印 ----------
px = img.load()
X0, X1 = 872, 996
Y0, Y1 = 936, 1018
LW = 28

def row_avg(y, xa, xb):
    sr = sg = sb = n = 0
    for x in range(max(0, xa), min(SIZE, xb)):
        r, g, b, a = px[x, y]
        if a > 128:
            sr += r; sg += g; sb += b; n += 1
    return (sr / n, sg / n, sb / n) if n else None

for y in range(Y0, Y1):
    left_c = row_avg(y, X0 - LW, X0)
    right_c = row_avg(y, X1, X1 + LW)
    for x in range(X0, X1):
        _, _, _, a = px[x, y]
        if a == 0:
            continue
        if left_c and right_c:
            t = (x - X0) / (X1 - X0)
            r = left_c[0] + (right_c[0] - left_c[0]) * t
            g = left_c[1] + (right_c[1] - left_c[1]) * t
            b = left_c[2] + (right_c[2] - left_c[2]) * t
        elif left_c or right_c:
            up = px[x, y - 1]
            r, g, b = up[0], up[1], up[2]
        else:
            r, g, b = (65, 60, 118)
        px[x, y] = (round(r), round(g), round(b), a)

# ---------- 4) 缩放居中到 1024 画布（824/1024 视觉尺寸，macOS 规范边距） ----------
CONTENT = 824
scaled = img.resize((CONTENT, CONTENT), Image.LANCZOS)
canvas = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
canvas.paste(scaled, ((SIZE - CONTENT) // 2, (SIZE - CONTENT) // 2))
canvas.save("icon.png")
print("icon.png saved")

for s in [16, 32, 64, 128, 256, 512]:
    canvas.resize((s, s), Image.LANCZOS).save(f"icon_{s}.png")
print("png sizes exported")
