import math

cx, cy, R = 140, 140, 130
lines = []

# Ticks every 5deg
for i in range(72):
    angle_deg = i * 5
    angle_rad = math.radians(angle_deg - 90)
    is_cardinal = angle_deg % 90 == 0
    is_intercardinal = angle_deg % 45 == 0 and not is_cardinal
    is_ten = angle_deg % 10 == 0 and not is_cardinal and not is_intercardinal
    outer = R - 2
    if is_cardinal:        inner = outer - 20
    elif is_intercardinal: inner = outer - 15
    elif is_ten:           inner = outer - 10
    else:                  inner = outer - 6
    x1 = cx + outer * math.cos(angle_rad)
    y1 = cy + outer * math.sin(angle_rad)
    x2 = cx + inner * math.cos(angle_rad)
    y2 = cy + inner * math.sin(angle_rad)
    sw = '2.5' if (is_cardinal or is_intercardinal) else ('1.5' if is_ten else '0.8')
    col = '#e74c3c' if angle_deg == 0 else '#c8a050'
    lines.append(f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" stroke="{col}" stroke-width="{sw}"/>')

# Degree labels every 30deg (skip cardinals)
for i in range(12):
    angle_deg = i * 30
    if angle_deg % 90 == 0:
        continue
    angle_rad = math.radians(angle_deg - 90)
    lr = R - 30
    x = cx + lr * math.cos(angle_rad)
    y = cy + lr * math.sin(angle_rad)
    lines.append(f'<text x="{x:.1f}" y="{y:.1f}" text-anchor="middle" dominant-baseline="middle" fill="#b09050" font-size="8" font-family="serif">{angle_deg}</text>')

# Cardinal labels
cardinals = [('N', 0, '#f5c842', '16'), ('E', 90, '#c8a050', '12'), ('S', 180, '#c8a050', '12'), ('O', 270, '#c8a050', '12')]
for label, deg, col, fs in cardinals:
    rad = math.radians(deg - 90)
    lr = R - 26
    x = cx + lr * math.cos(rad)
    y = cy + lr * math.sin(rad)
    lines.append(f'<text x="{x:.1f}" y="{y:.1f}" text-anchor="middle" dominant-baseline="middle" fill="{col}" font-size="{fs}" font-family="serif" font-weight="bold">{label}</text>')

# Intercardinal labels
for label, deg in [('NE', 45), ('SE', 135), ('SO', 225), ('NO', 315)]:
    rad = math.radians(deg - 90)
    lr = R - 28
    x = cx + lr * math.cos(rad)
    y = cy + lr * math.sin(rad)
    lines.append(f'<text x="{x:.1f}" y="{y:.1f}" text-anchor="middle" dominant-baseline="middle" fill="#9a8040" font-size="9" font-family="serif">{label}</text>')

# Compass rose polygons
rose = [
  '<polygon points="140,60 144,128 140,134 136,128" fill="#e8d070" opacity="0.9"/>',
  '<polygon points="140,220 144,152 140,146 136,152" fill="#7a6030" opacity="0.8"/>',
  '<polygon points="60,140 128,136 134,140 128,144" fill="#7a6030" opacity="0.8"/>',
  '<polygon points="220,140 152,136 146,140 152,144" fill="#7a6030" opacity="0.8"/>',
  '<polygon points="83,83 133,133 134,140 128,136" fill="#b09040" opacity="0.5"/>',
  '<polygon points="197,83 147,133 146,140 152,136" fill="#b09040" opacity="0.5"/>',
  '<polygon points="83,197 133,147 134,140 128,144" fill="#b09040" opacity="0.5"/>',
  '<polygon points="197,197 147,147 146,140 152,144" fill="#b09040" opacity="0.5"/>',
  '<circle cx="140" cy="140" r="8" fill="#2a1a08" stroke="#c8a050" stroke-width="1.5"/>',
  '<circle cx="140" cy="140" r="3" fill="#f1c40f"/>',
]

parts = [
  '<svg viewBox="0 0 280 280" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" style="pointer-events:none;">',
  '<defs>',
  '<radialGradient id="cbg" cx="50%" cy="40%" r="65%">',
  '<stop offset="0%" stop-color="#3a2812"/>',
  '<stop offset="100%" stop-color="#110b04"/>',
  '</radialGradient>',
  '</defs>',
  '<circle cx="140" cy="140" r="135" fill="url(#cbg)"/>',
  '<circle cx="140" cy="140" r="132" fill="none" stroke="#c8a050" stroke-width="2"/>',
  '<circle cx="140" cy="140" r="108" fill="none" stroke="#c8a050" stroke-width="0.4" stroke-opacity="0.4"/>',
  '<circle cx="140" cy="140" r="80" fill="none" stroke="#c8a050" stroke-width="0.3" stroke-opacity="0.3"/>',
] + lines + rose + ['</svg>']

with open('compass.svg', 'w', encoding='utf-8') as f:
    f.write('\n'.join(parts))

print('OK')
