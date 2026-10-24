import math
from PIL import Image, ImageDraw, ImageFilter

SIZE = 512
img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
draw = ImageDraw.Draw(img)

# Background squircle
pad = 28
corner_radius = 96
# Outer glow
glow_layer = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
glow_draw = ImageDraw.Draw(glow_layer)
glow_draw.rounded_rectangle(
    [pad - 6, pad - 6, SIZE - pad + 6, SIZE - pad + 6],
    radius=corner_radius + 6,
    fill=(6, 182, 212, 60)
)
glow_layer = glow_layer.filter(ImageFilter.GaussianBlur(16))
img.paste(glow_layer, (0, 0), glow_layer)

# Main container background - dark sleek metallic gradient
base_layer = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
base_draw = ImageDraw.Draw(base_layer)
for y in range(pad, SIZE - pad):
    t = (y - pad) / (SIZE - 2 * pad)
    # Gradient from deep dark navy to midnight violet
    r = int(7 + t * 15)
    g = int(12 + t * 10)
    b = int(24 + t * 28)
    base_draw.line([(pad, y), (SIZE - pad, y)], fill=(r, g, b, 255))

# Mask with rounded rectangle
mask = Image.new("L", (SIZE, SIZE), 0)
mask_draw = ImageDraw.Draw(mask)
mask_draw.rounded_rectangle([pad, pad, SIZE - pad, SIZE - pad], radius=corner_radius, fill=255)
img.paste(base_layer, (0, 0), mask)

# Neon Border
border_layer = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
b_draw = ImageDraw.Draw(border_layer)
for i in range(4):
    inset = pad + i
    b_draw.rounded_rectangle(
        [inset, inset, SIZE - inset, SIZE - inset],
        radius=corner_radius - i,
        outline=(6, 182, 212, 180 - i * 35)
    )
img.paste(border_layer, (0, 0), border_layer)

# Draw 4x4 Soundboard Pad Grid
grid_size = 4
grid_margin = 72
grid_width = SIZE - 2 * grid_margin
cell_spacing = 14
cell_size = (grid_width - (grid_size - 1) * cell_spacing) / grid_size
btn_radius = 16

# Colors for active/idle pads (cyan, purple, electric violet, magenta, amber)
colors = [
    (6, 182, 212),   # Cyan
    (99, 102, 241),  # Indigo
    (139, 92, 246),  # Violet
    (236, 72, 153),  # Pink
    (59, 130, 246),  # Blue
    (16, 185, 129),  # Emerald
    (245, 158, 11),  # Amber
    (6, 182, 212),   # Cyan
    (139, 92, 246),  # Violet
    (236, 72, 153),  # Pink
    (6, 182, 212),   # Cyan
    (99, 102, 241),  # Indigo
    (59, 130, 246),  # Blue
    (6, 182, 212),   # Cyan
    (236, 72, 153),  # Pink
    (139, 92, 246),  # Violet
]

# Patterns of pad brightness: some are "active" (loud / playing), some are idle
active_indices = {1, 2, 4, 6, 7, 9, 11, 14}

pad_idx = 0
for row in range(grid_size):
    for col in range(grid_size):
        x0 = grid_margin + col * (cell_size + cell_spacing)
        y0 = grid_margin + row * (cell_size + cell_spacing)
        x1 = x0 + cell_size
        y1 = y0 + cell_size
        
        is_active = pad_idx in active_indices
        c = colors[pad_idx % len(colors)]
        
        if is_active:
            # Glow behind active pad
            pad_glow = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
            pg_draw = ImageDraw.Draw(pad_glow)
            pg_draw.rounded_rectangle([x0 - 4, y0 - 4, x1 + 4, y1 + 4], radius=btn_radius + 2, fill=(c[0], c[1], c[2], 120))
            pad_glow = pad_glow.filter(ImageFilter.GaussianBlur(8))
            img.paste(pad_glow, (0, 0), pad_glow)
            
            # Bright illuminated pad
            draw.rounded_rectangle([x0, y0, x1, y1], radius=btn_radius, fill=(c[0], c[1], c[2], 230), outline=(255, 255, 255, 180), width=2)
            # Gloss highlight
            draw.rounded_rectangle([x0 + 4, y0 + 3, x1 - 4, y0 + cell_size * 0.4], radius=btn_radius // 2, fill=(255, 255, 255, 80))
        else:
            # Idle sleek dark glass pad
            draw.rounded_rectangle([x0, y0, x1, y1], radius=btn_radius, fill=(25, 33, 52, 200), outline=(60, 75, 105, 120), width=1)
            # Subtle center dot
            cx = (x0 + x1) / 2
            cy = (y0 + y1) / 2
            draw.ellipse([cx - 4, cy - 4, cx + 4, cy + 4], fill=(c[0], c[1], c[2], 160))
            
        pad_idx += 1

# Central Soundwave / Audio Equalizer Overlay across the middle
wave_overlay = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
w_draw = ImageDraw.Draw(wave_overlay)

wave_bars = [18, 35, 55, 90, 130, 80, 120, 150, 110, 70, 140, 160, 120, 75, 45, 22]
bar_w = 12
total_bars = len(wave_bars)
wave_span = total_bars * 16
start_x = (SIZE - wave_span) / 2
center_y = SIZE / 2

for i, h in enumerate(wave_bars):
    bx = start_x + i * 16
    by0 = center_y - h / 2
    by1 = center_y + h / 2
    # Cyan to magenta color gradient along the wave
    t = i / total_bars
    r = int(6 + t * (236 - 6))
    g = int(182 - t * (182 - 72))
    b = int(212 + t * (255 - 212))
    w_draw.rounded_rectangle([bx, by0, bx + bar_w, by1], radius=6, fill=(r, g, b, 240))

# Blur wave slightly for neon bloom
bloom = wave_overlay.filter(ImageFilter.GaussianBlur(10))
img.paste(bloom, (0, 0), bloom)
img.paste(wave_overlay, (0, 0), wave_overlay)

# Add "FP" modern badge at bottom
# Save multi-size ICO and high-res PNG
build_dir = r"C:\Users\FlowUP\Documents\PROJETS\FreePad\build"
public_dir = r"C:\Users\FlowUP\Documents\PROJETS\FreePad\public"

ico_path = f"{build_dir}\\icon.ico"
png_path = f"{build_dir}\\icon.png"
public_png = f"{public_dir}\\icon.png"

img.save(png_path, "PNG")
img.save(public_png, "PNG")

# Generate ICO with all standard Windows resolutions
sizes = [(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (16, 16)]
img.save(ico_path, format="ICO", sizes=sizes)

print("SUCCESS: Icon generated at:", ico_path, png_path, public_png)
