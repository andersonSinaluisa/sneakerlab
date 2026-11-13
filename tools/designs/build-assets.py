#!/usr/bin/env python3
"""
Genera las ilustraciones vectoriales ORIGINALES del Design Studio en public/designs/assets/*.svg.

Todas son composiciones propias (sin personajes comerciales), con fondo transparente, sin fuentes
externas, scripts ni referencias remotas (SVG seguro). Se mantienen como código para poder
regenerarlas, versionarlas y derivar variantes de color.

Uso: python3 tools/designs/build-assets.py
"""
import math
import os
import random

OUT = os.path.join(os.path.dirname(__file__), "..", "..", "public", "designs", "assets")
os.makedirs(OUT, exist_ok=True)
random.seed(7)

def svg(w, h, body, defs=""):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}" '
            f'fill="none">{"<defs>"+defs+"</defs>" if defs else ""}{body}</svg>')

ASSETS = {}

def add(name, w, h, body, defs=""):
    ASSETS[name] = svg(w, h, body, defs)

# ---------------------------------------------------------------------------
# Utilidades de dibujo
# ---------------------------------------------------------------------------
def polar(cx, cy, r, a):
    return cx + r * math.cos(a), cy + r * math.sin(a)

def speed_lines(cx, cy, r0, r1, n, color="#111", width=(2, 9), seed=1, sweep=(0, 2 * math.pi)):
    rnd = random.Random(seed)
    out = []
    for i in range(n):
        a = sweep[0] + (sweep[1] - sweep[0]) * (i + rnd.random() * 0.6) / n
        rr0 = r0 * (0.75 + rnd.random() * 0.5)
        rr1 = r1 * (0.85 + rnd.random() * 0.3)
        x0, y0 = polar(cx, cy, rr0, a)
        x1, y1 = polar(cx, cy, rr1, a)
        wdt = width[0] + rnd.random() * (width[1] - width[0])
        # trazo en cuña: ancho en el exterior, punta hacia el centro
        px, py = -math.sin(a) * wdt / 2, math.cos(a) * wdt / 2
        out.append(f'<path d="M{x0:.1f},{y0:.1f} L{x1+px:.1f},{y1+py:.1f} L{x1-px:.1f},{y1-py:.1f} Z" fill="{color}"/>')
    return "".join(out)

def halftone(x, y, w, h, color="#111", step=22, grow=(2, 9), direction="down", seed=3, opacity=1):
    out = []
    cols, rows = int(w // step), int(h // step)
    for j in range(rows):
        for i in range(cols):
            t = (j / max(1, rows - 1)) if direction == "down" else (i / max(1, cols - 1))
            r = grow[0] + (grow[1] - grow[0]) * t
            out.append(f'<circle cx="{x + i*step + step/2:.0f}" cy="{y + j*step + step/2:.0f}" r="{r:.1f}" fill="{color}" opacity="{opacity}"/>')
    return "".join(out)

def star(cx, cy, r, points=4, inner=0.38, fill="#fff"):
    pts = []
    for i in range(points * 2):
        rr = r if i % 2 == 0 else r * inner
        a = -math.pi / 2 + i * math.pi / points
        pts.append(f"{cx + rr*math.cos(a):.1f},{cy + rr*math.sin(a):.1f}")
    return f'<polygon points="{" ".join(pts)}" fill="{fill}"/>'

def smoke(cx, cy, scale, color, seed, n=7, opacity=0.9):
    rnd = random.Random(seed)
    out = []
    for i in range(n):
        r = scale * (0.35 + rnd.random() * 0.4)
        x = cx + (rnd.random() - 0.5) * scale * 1.6
        y = cy - i * scale * 0.35 + (rnd.random() - 0.5) * scale * 0.3
        out.append(f'<circle cx="{x:.0f}" cy="{y:.0f}" r="{r:.0f}" fill="{color}" opacity="{opacity}"/>')
    return "".join(out)

# ---------------------------------------------------------------------------
# 1. Máscara oni (Ink Demon)
# ---------------------------------------------------------------------------
def oni_mask(name, face="#b3121b", accent="#f3e9d2", ink="#0b0b0d"):
    body = smoke(512, 760, 260, ink, 11, n=9, opacity=0.85)
    body += smoke(300, 700, 160, ink, 12, n=5, opacity=0.7) + smoke(730, 720, 170, ink, 13, n=5, opacity=0.7)
    # cuernos
    body += f'<path d="M330,330 C300,220 290,150 340,90 C360,170 390,230 420,290 Z" fill="{accent}" stroke="{ink}" stroke-width="10" stroke-linejoin="round"/>'
    body += f'<path d="M694,330 C724,220 734,150 684,90 C664,170 634,230 604,290 Z" fill="{accent}" stroke="{ink}" stroke-width="10" stroke-linejoin="round"/>'
    # cara
    body += f'<path d="M512,250 C690,250 760,360 760,500 C760,640 680,760 512,800 C344,760 264,640 264,500 C264,360 334,250 512,250 Z" fill="{face}" stroke="{ink}" stroke-width="14" stroke-linejoin="round"/>'
    # cejas furiosas
    body += f'<path d="M330,400 C380,360 440,370 480,410" stroke="{ink}" stroke-width="22" stroke-linecap="round"/>'
    body += f'<path d="M694,400 C644,360 584,370 544,410" stroke="{ink}" stroke-width="22" stroke-linecap="round"/>'
    # ojos
    for sx in (1, -1):
        cx = 512 + sx * 100
        body += f'<path d="M{cx-70},460 Q{cx},400 {cx+70},460 Q{cx},500 {cx-70},460 Z" fill="{accent}" stroke="{ink}" stroke-width="10"/>'
        body += f'<circle cx="{cx + sx*8}" cy="458" r="22" fill="{ink}"/><circle cx="{cx + sx*14}" cy="450" r="7" fill="{accent}"/>'
    # nariz y boca con colmillos
    body += f'<path d="M490,540 L512,590 L534,540" stroke="{ink}" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>'
    body += f'<path d="M370,640 C440,600 584,600 654,640 C600,720 424,720 370,640 Z" fill="{ink}"/>'
    body += f'<path d="M410,650 L430,610 L452,655 Z M614,650 L594,610 L572,655 Z M470,655 L482,700 L500,655 Z M554,655 L542,700 L524,655 Z" fill="{accent}"/>'
    # grietas / detalles
    body += f'<path d="M300,470 L330,520 L310,560" stroke="{ink}" stroke-width="8" stroke-linecap="round" fill="none"/>'
    body += f'<path d="M724,470 L694,520 L714,560" stroke="{ink}" stroke-width="8" stroke-linecap="round" fill="none"/>'
    body += f'<path d="M560,300 L600,250 L640,300" stroke="{accent}" stroke-width="6" stroke-linecap="round" fill="none" opacity="0.8"/>'
    add(name, 1024, 1024, body)

oni_mask("oni-mask-crimson")
oni_mask("oni-mask-ink", face="#1a1a1f", accent="#e8e2d0", ink="#000000")
oni_mask("oni-mask-jade", face="#1f7a5a", accent="#f3f0e6", ink="#0e1a16")

# ---------------------------------------------------------------------------
# 2. Dragón oriental (Dragon Spirit)
# ---------------------------------------------------------------------------
def dragon(name, body_col="#2e8b57", belly="#d9f2c7", ink="#0d1b14", cloud="#ffffff"):
    out = ""
    # nubes japonesas
    def cloud_at(x, y, s, op=0.95):
        c = ""
        for dx, dy, r in ((0, 0, 1), (0.9, 0.2, 0.75), (-0.9, 0.25, 0.7), (0.45, -0.55, 0.65), (-0.4, -0.5, 0.6)):
            c += f'<circle cx="{x+dx*s:.0f}" cy="{y+dy*s:.0f}" r="{r*s:.0f}" fill="{cloud}" stroke="{ink}" stroke-width="8" opacity="{op}"/>'
        c += f'<rect x="{x-1.6*s:.0f}" y="{y:.0f}" width="{3.2*s:.0f}" height="{0.9*s:.0f}" fill="{cloud}"/>'
        c += f'<line x1="{x-1.6*s:.0f}" y1="{y+0.9*s:.0f}" x2="{x+1.6*s:.0f}" y2="{y+0.9*s:.0f}" stroke="{ink}" stroke-width="8"/>'
        return c
    out += cloud_at(300, 820, 70) + cloud_at(1700, 300, 60) + cloud_at(1400, 860, 50, 0.9)
    # cuerpo serpenteante (trazo grueso con relleno + vientre)
    spine = "M120,560 C300,300 520,300 700,520 C880,740 1100,760 1300,520 C1440,350 1640,330 1820,470"
    out += f'<path d="{spine}" stroke="{ink}" stroke-width="150" stroke-linecap="round" fill="none"/>'
    out += f'<path d="{spine}" stroke="{body_col}" stroke-width="124" stroke-linecap="round" fill="none"/>'
    out += f'<path d="{spine}" stroke="{belly}" stroke-width="40" stroke-linecap="round" fill="none" stroke-dasharray="26 22" transform="translate(0,28)"/>'
    # escamas (arcos)
    rnd = random.Random(5)
    for i in range(34):
        t = i / 33
        # muestreo aproximado de la curva por tramos
        x = 120 + t * 1700
        y = 560 - 240 * math.sin(t * math.pi * 1.9 + 0.3) * (1 - t * 0.35) + t * (-90)
        out += f'<path d="M{x-22:.0f},{y-30:.0f} q22,-26 44,0" stroke="{ink}" stroke-width="6" fill="none" opacity="0.6"/>'
    # aletas dorsales
    for i in range(14):
        t = 0.06 + i * 0.065
        x = 120 + t * 1700
        y = 560 - 240 * math.sin(t * math.pi * 1.9 + 0.3) * (1 - t * 0.35) + t * (-90) - 62
        out += f'<path d="M{x-28:.0f},{y+10:.0f} L{x:.0f},{y-70:.0f} L{x+28:.0f},{y+10:.0f} Z" fill="{body_col}" stroke="{ink}" stroke-width="8" stroke-linejoin="round"/>'
    # cabeza (extremo derecho)
    out += f'<path d="M1800,470 C1880,420 1960,440 1990,500 C2010,560 1950,620 1860,610 C1800,600 1760,560 1750,520 Z" fill="{body_col}" stroke="{ink}" stroke-width="14" stroke-linejoin="round"/>'
    out += f'<path d="M1870,440 C1900,380 1950,360 1980,370 C1950,400 1930,430 1920,460 Z M1800,450 C1790,390 1810,350 1840,340 C1840,390 1845,420 1850,450 Z" fill="{belly}" stroke="{ink}" stroke-width="10" stroke-linejoin="round"/>'
    out += f'<circle cx="1880" cy="500" r="22" fill="#fff" stroke="{ink}" stroke-width="8"/><circle cx="1886" cy="502" r="10" fill="{ink}"/>'
    out += f'<path d="M1990,520 C2050,500 2080,540 2100,600 M1985,560 C2040,580 2050,640 2040,700" stroke="{ink}" stroke-width="10" stroke-linecap="round" fill="none"/>'
    out += f'<path d="M1900,590 L1920,640 L1945,585" fill="#fff" stroke="{ink}" stroke-width="6" stroke-linejoin="round"/>'
    # garras
    for (x, y) in ((620, 640), (1250, 640)):
        out += f'<path d="M{x},{y} C{x-40},{y+70} {x-20},{y+130} {x+30},{y+140} M{x},{y} C{x+20},{y+80} {x+60},{y+120} {x+110},{y+110}" stroke="{ink}" stroke-width="34" stroke-linecap="round" fill="none"/>'
        out += f'<path d="M{x},{y} C{x-40},{y+70} {x-20},{y+130} {x+30},{y+140} M{x},{y} C{x+20},{y+80} {x+60},{y+120} {x+110},{y+110}" stroke="{body_col}" stroke-width="18" stroke-linecap="round" fill="none"/>'
        out += f'<path d="M{x+30},{y+140} l-30,30 m30,-30 l20,36 M{x+110},{y+110} l10,38 m-10,-38 l36,20" stroke="{ink}" stroke-width="10" stroke-linecap="round"/>'
    # cola en llama
    out += f'<path d="M120,560 C60,520 40,460 70,400 C90,460 110,470 150,480 C130,440 150,400 190,380 C180,440 190,500 220,540 Z" fill="{body_col}" stroke="{ink}" stroke-width="12" stroke-linejoin="round"/>'
    add(name, 2048, 1024, out)

dragon("dragon-jade")
dragon("dragon-gold", body_col="#d9a21b", belly="#fff1c2", ink="#2a1a05", cloud="#fffaf0")
dragon("dragon-ink", body_col="#2b2b33", belly="#b7b7c4", ink="#000", cloud="#f2f2f5")

# ---------------------------------------------------------------------------
# 3. Sakura
# ---------------------------------------------------------------------------
def blossom(cx, cy, r, petal="#f7b6c9", center="#e0557a", rot=0):
    out = ""
    for i in range(5):
        a = rot + i * 2 * math.pi / 5
        px, py = polar(cx, cy, r * 0.62, a)
        out += f'<ellipse cx="{px:.1f}" cy="{py:.1f}" rx="{r*0.5:.1f}" ry="{r*0.34:.1f}" fill="{petal}" transform="rotate({math.degrees(a):.1f} {px:.1f} {py:.1f})"/>'
    out += f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{r*0.16:.1f}" fill="{center}"/>'
    for i in range(5):
        a = rot + i * 2 * math.pi / 5 + 0.3
        x1, y1 = polar(cx, cy, r * 0.2, a)
        x2, y2 = polar(cx, cy, r * 0.42, a)
        out += f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" stroke="{center}" stroke-width="{max(1,r*0.05):.1f}" stroke-linecap="round"/>'
    return out

def petal(cx, cy, s, col, rot):
    return f'<path d="M0,-{s} C{s*0.7},-{s*0.6} {s*0.8},{s*0.4} 0,{s} C-{s*0.8},{s*0.4} -{s*0.7},-{s*0.6} 0,-{s} Z" fill="{col}" transform="translate({cx:.0f} {cy:.0f}) rotate({rot:.0f})"/>'

def sakura_branch(name, petal_col="#f7b6c9", center="#d94b70", branch="#3a2a24"):
    out = f'<path d="M-20,700 C250,620 420,560 640,470 C860,380 1040,330 1300,250 C1500,190 1700,210 2060,160" stroke="{branch}" stroke-width="30" stroke-linecap="round" fill="none"/>'
    out += f'<path d="M640,470 C700,380 760,330 860,300 M1040,340 C1000,260 1020,200 1080,150 M1300,250 C1360,320 1440,350 1540,340 M420,560 C380,480 400,420 460,380" stroke="{branch}" stroke-width="16" stroke-linecap="round" fill="none"/>'
    rnd = random.Random(21)
    for (x, y, r) in ((860, 300, 80), (1080, 150, 70), (1540, 340, 72), (460, 380, 64), (1300, 250, 56), (700, 440, 50), (1200, 300, 46), (1750, 210, 60), (250, 620, 54), (1880, 180, 44)):
        out += blossom(x, y, r, petal_col, center, rnd.random() * 2)
    for _ in range(26):
        out += petal(rnd.random() * 2048, rnd.random() * 1024, 14 + rnd.random() * 22, petal_col, rnd.random() * 360)
    add(name, 2048, 1024, out)

sakura_branch("sakura-branch")
sakura_branch("sakura-branch-night", petal_col="#ffd1e0", center="#ff6f9f", branch="#111115")

rnd = random.Random(9)
add("sakura-petals", 1024, 1024, "".join(petal(rnd.random() * 1024, rnd.random() * 1024, 18 + rnd.random() * 30, "#f7b6c9" if rnd.random() > 0.3 else "#ffd9e4", rnd.random() * 360) for _ in range(46)))

# ---------------------------------------------------------------------------
# 4. Olas japonesas (diseño propio)
# ---------------------------------------------------------------------------
def waves(name, sea="#1d4e89", foam="#f4f6f8", ink="#0d2238"):
    out = ""
    for row in range(3):
        y = 420 + row * 220
        for i in range(-1, 7):
            x = i * 340 + (row % 2) * 170
            out += f'<path d="M{x},{y} C{x+90},{y-230} {x+280},{y-230} {x+330},{y-60} C{x+300},{y-150} {x+200},{y-130} {x+210},{y-40} C{x+240},{y-120} {x+300},{y-90} {x+340},{y} Z" fill="{sea}" stroke="{ink}" stroke-width="10" stroke-linejoin="round"/>'
            for k in range(5):
                out += f'<circle cx="{x+230+k*22}" cy="{y-70-k*18}" r="{9-k}" fill="{foam}"/>'
            out += f'<path d="M{x+30},{y-30} C{x+90},{y-150} {x+190},{y-150} {x+240},{y-80}" stroke="{foam}" stroke-width="12" stroke-linecap="round" fill="none"/>'
            out += f'<path d="M{x+60},{y-10} C{x+110},{y-90} {x+170},{y-100} {x+210},{y-60}" stroke="{foam}" stroke-width="7" stroke-linecap="round" fill="none" opacity="0.8"/>'
    add(name, 2048, 1024, out)

waves("waves-indigo")
waves("waves-sunset", sea="#e0633c", foam="#fff1dc", ink="#4a1d10")
waves("waves-mono", sea="#2b2b2b", foam="#f5f5f5", ink="#000")

# ---------------------------------------------------------------------------
# 5. Caligrafía: kanji trazados a mano (力 fuerza, 心 corazón) y ensō
# ---------------------------------------------------------------------------
def brush(d, col="#111", w=58):
    return (f'<path d="{d}" stroke="{col}" stroke-width="{w}" stroke-linecap="round" stroke-linejoin="round" fill="none"/>'
            f'<path d="{d}" stroke="{col}" stroke-width="{w*0.55:.0f}" stroke-linecap="butt" fill="none" opacity="0.5" stroke-dasharray="40 9"/>')

add("kanji-chikara", 1024, 1024,
    brush("M300,300 L690,300 C700,540 640,720 500,790") + brush("M500,210 C480,480 380,700 190,830") +
    f'<circle cx="760" cy="780" r="42" fill="#b3121b"/>')
add("kanji-kokoro", 1024, 1024,
    brush("M330,420 C360,470 390,520 400,580") + brush("M300,640 C440,760 650,790 760,700 C790,660 760,560 740,500") +
    brush("M520,330 C560,400 590,460 600,520") + brush("M700,330 C730,380 760,430 770,470") +
    f'<circle cx="820" cy="800" r="38" fill="#b3121b"/>')
add("enso-brush", 1024, 1024,
    f'<path d="M520,170 C290,180 150,360 170,560 C190,760 380,880 560,860 C760,840 880,660 850,470 C830,330 720,230 600,200" stroke="#111" stroke-width="70" stroke-linecap="round" fill="none"/>'
    f'<path d="M520,170 C290,180 150,360 170,560 C190,760 380,880 560,860 C760,840 880,660 850,470 C830,330 720,230 600,200" stroke="#111" stroke-width="30" stroke-linecap="round" fill="none" opacity="0.5" stroke-dasharray="60 14"/>')

# ---------------------------------------------------------------------------
# 6. Ojo anime (Crimson Eye) — primer plano con tinta
# ---------------------------------------------------------------------------
def anime_eye(name, iris="#c81d2e", glow="#ff6a6a", ink="#0b0b0d", skin="#fff"):
    out = smoke(260, 760, 120, ink, 31, n=4, opacity=0.9) + smoke(1700, 300, 100, ink, 32, n=4, opacity=0.9)
    # salpicaduras de tinta
    rnd = random.Random(44)
    for _ in range(40):
        out += f'<circle cx="{rnd.random()*2048:.0f}" cy="{rnd.random()*1024:.0f}" r="{2+rnd.random()*9:.1f}" fill="{ink}" opacity="{0.5+rnd.random()*0.5:.2f}"/>'
    # párpado superior grueso y pestañas
    out += f'<path d="M300,560 C560,250 1340,220 1760,520 C1400,420 700,420 300,560 Z" fill="{ink}"/>'
    out += f'<path d="M1700,500 L1900,380 M1620,440 L1780,300 M1500,400 L1600,260 M380,540 L240,470 M470,480 L380,360" stroke="{ink}" stroke-width="26" stroke-linecap="round"/>'
    # esclerótica
    out += f'<path d="M330,560 C640,430 1300,430 1740,530 C1400,760 700,780 330,560 Z" fill="{skin}" stroke="{ink}" stroke-width="14"/>'
    # iris con degradado radial
    defs = (f'<radialGradient id="g{name}" cx="0.45" cy="0.4" r="0.6"><stop offset="0" stop-color="{glow}"/><stop offset="0.6" stop-color="{iris}"/><stop offset="1" stop-color="{ink}"/></radialGradient>')
    out += f'<ellipse cx="1040" cy="580" rx="240" ry="250" fill="url(#g{name})" stroke="{ink}" stroke-width="12"/>'
    for i in range(24):
        a = i * math.pi * 2 / 24
        x1, y1 = polar(1040, 580, 120, a); x2, y2 = polar(1040, 590, 235, a)
        out += f'<line x1="{x1:.0f}" y1="{y1:.0f}" x2="{x2:.0f}" y2="{y2:.0f}" stroke="{ink}" stroke-width="5" opacity="0.45"/>'
    out += f'<ellipse cx="1040" cy="590" rx="92" ry="110" fill="{ink}"/>'
    out += f'<ellipse cx="950" cy="490" rx="62" ry="48" fill="#fff"/><circle cx="1140" cy="680" r="26" fill="#fff" opacity="0.9"/>'
    # párpado inferior y línea de velocidad
    out += f'<path d="M420,620 C700,780 1400,760 1700,560" stroke="{ink}" stroke-width="16" stroke-linecap="round" fill="none"/>'
    out += speed_lines(1040, 560, 560, 980, 28, ink, (3, 10), 17)
    add(name, 2048, 1024, out, defs)

anime_eye("anime-eye-crimson")
anime_eye("anime-eye-cyan", iris="#0ea5e9", glow="#8ae6ff")
anime_eye("anime-eye-gold", iris="#d9a21b", glow="#ffe08a", ink="#1a1208")
anime_eye("anime-eye-violet", iris="#7c3aed", glow="#c4a3ff")

# ---------------------------------------------------------------------------
# 7. Rōnin — silueta original con kasa y katana, sol rojo
# ---------------------------------------------------------------------------
def ronin(name, ink="#0b0b0d", sun="#b3121b", mist="#9aa0a6", accent_face="#e8e2d0"):
    out = f'<circle cx="640" cy="330" r="260" fill="{sun}"/>'
    out += smoke(300, 920, 150, mist, 51, n=4, opacity=0.35) + smoke(760, 940, 160, mist, 52, n=4, opacity=0.35)
    # kasa (sombrero cónico)
    out += f'<path d="M330,450 L512,320 L694,450 Z" fill="{ink}"/><path d="M300,452 L724,452" stroke="{ink}" stroke-width="18" stroke-linecap="round"/>'
    # cabeza / cuello (la cara queda en sombra bajo el kasa, con una franja clara de luz)
    out += f'<path d="M452,452 L572,452 L560,520 L464,520 Z" fill="{ink}"/><path d="M470,480 L554,480" stroke="{accent_face}" stroke-width="6" opacity="0.7"/>'
    # kimono amplio (torso) con mangas
    out += f'<path d="M464,520 L560,520 L660,570 L720,760 L610,760 L600,900 L424,900 L414,760 L304,760 L364,570 Z" fill="{ink}"/>'
    out += f'<path d="M434,900 L600,900 L620,1000 L410,1000 Z" fill="{ink}"/>'
    # katana diagonal (vaina y hoja)
    out += f'<path d="M300,620 L820,980" stroke="{ink}" stroke-width="22" stroke-linecap="round"/>'
    out += f'<path d="M330,640 L560,800" stroke="#f3f3f3" stroke-width="7" stroke-linecap="round"/>'
    out += f'<path d="M560,780 L600,840 M540,820 L600,790" stroke="{ink}" stroke-width="12" stroke-linecap="round"/>'
    # detalle rojo: cordón y obi
    out += f'<path d="M420,760 L700,760" stroke="{sun}" stroke-width="20"/><path d="M500,760 L530,860 M540,760 L560,850" stroke="{sun}" stroke-width="8" stroke-linecap="round"/>'
    # pétalos/hojas cayendo
    rnd = random.Random(53)
    for _ in range(14):
        out += petal(rnd.random() * 1024, rnd.random() * 900, 8 + rnd.random() * 12, sun, rnd.random() * 360)
    add(name, 1024, 1024, out)

ronin("ronin-shadow")
ronin("ronin-moon", ink="#101014", sun="#e8e2d0", mist="#6b7280")

# ---------------------------------------------------------------------------
# 8. Elementos manga: líneas de velocidad, tramas, viñetas, explosión
# ---------------------------------------------------------------------------
add("speed-lines-black", 1024, 1024, speed_lines(512, 512, 180, 560, 90, "#0b0b0d", (2, 12), 61))
add("speed-lines-white", 1024, 1024, speed_lines(512, 512, 180, 560, 90, "#ffffff", (2, 12), 62))
add("halftone-black", 1024, 1024, halftone(0, 0, 1024, 1024, "#0b0b0d", 26, (1.5, 10), "down", 3))
add("halftone-white", 1024, 1024, halftone(0, 0, 1024, 1024, "#ffffff", 26, (1.5, 10), "down", 3))

def manga_panels(name, ink="#0b0b0d", paper="#ffffff", accent="#e11d48"):
    out = ""
    panels = ((40, 40, 900, 420), (980, 40, 1030, 600), (40, 500, 560, 480), (640, 500, 300, 480), (980, 680, 1030, 300))
    for i, (x, y, w, h) in enumerate(panels):
        skew = 30 if i % 2 else -30
        out += f'<path d="M{x},{y} L{x+w+skew},{y} L{x+w},{y+h} L{x-skew},{y+h} Z" fill="{paper}" stroke="{ink}" stroke-width="12" stroke-linejoin="round"/>'
    out += speed_lines(490, 250, 120, 470, 70, ink, (2, 9), 71)
    out += halftone(60, 520, 520, 440, ink, 20, (1, 7), "right", 4)
    out += f'<path d="M1500,100 L1620,260 L1800,180 L1720,360 L1900,420 L1700,460 L1760,640 L1580,520 L1440,620 L1470,440 L1280,420 L1450,330 L1380,170 Z" fill="{accent}" stroke="{ink}" stroke-width="12" stroke-linejoin="round"/>'
    out += speed_lines(1600, 400, 260, 420, 40, ink, (2, 6), 72)
    out += f'<path d="M1100,760 C1300,700 1500,720 1700,800 C1800,860 1850,900 1950,920" stroke="{ink}" stroke-width="18" stroke-linecap="round" fill="none"/>'
    for i in range(6):
        out += f'<path d="M{700+i*35},560 L{660+i*35},900" stroke="{ink}" stroke-width="{3+i}" stroke-linecap="round"/>'
    out += f'<path d="M180,600 L260,700 L160,720 L240,840 L140,880" stroke="{ink}" stroke-width="16" stroke-linecap="round" stroke-linejoin="round" fill="none"/>'
    add(name, 2048, 1024, out)

manga_panels("manga-panels-bw")
manga_panels("manga-panels-red", paper="#fff7f7", accent="#b3121b")

def comic_burst(name, fill="#ffd400", ink="#111", inner="#ff3b3b"):
    pts = []
    for i in range(24):
        r = 480 if i % 2 == 0 else 320
        a = i * math.pi / 12
        pts.append(f"{512+r*math.cos(a):.0f},{512+r*math.sin(a):.0f}")
    out = f'<polygon points="{" ".join(pts)}" fill="{fill}" stroke="{ink}" stroke-width="14" stroke-linejoin="round"/>'
    pts2 = []
    for i in range(16):
        r = 250 if i % 2 == 0 else 150
        a = i * math.pi / 8 + 0.2
        pts2.append(f"{512+r*math.cos(a):.0f},{512+r*math.sin(a):.0f}")
    out += f'<polygon points="{" ".join(pts2)}" fill="{inner}" stroke="{ink}" stroke-width="10" stroke-linejoin="round"/>'
    out += halftone(300, 300, 424, 424, ink, 24, (2, 6), "down", 5, 0.5)
    out += f'<path d="M560,330 L470,520 L540,520 L450,700 L600,470 L530,470 Z" fill="#fff" stroke="{ink}" stroke-width="10" stroke-linejoin="round"/>'
    add(name, 1024, 1024, out)

comic_burst("comic-burst-yellow")
comic_burst("comic-burst-cyan", fill="#38bdf8", inner="#f472b6")

# ---------------------------------------------------------------------------
# 9. Chibi kawaii — personaje original con orejas de gato
# ---------------------------------------------------------------------------
def chibi(name, hair="#6d4aff", skin="#ffe3cf", eyes="#2b1e66", outfit="#ff79b0", ink="#241c3a"):
    out = ""
    # cuerpo pequeño
    out += f'<path d="M420,700 L604,700 L640,900 L384,900 Z" fill="{outfit}" stroke="{ink}" stroke-width="12" stroke-linejoin="round"/>'
    out += f'<path d="M384,900 L640,900 L650,960 L374,960 Z" fill="{ink}"/>'
    out += f'<path d="M380,730 L320,840 M644,730 L704,840" stroke="{skin}" stroke-width="40" stroke-linecap="round"/><path d="M380,730 L320,840 M644,730 L704,840" stroke="{ink}" stroke-width="12" stroke-linecap="round" fill="none" opacity="0"/>'
    # cabeza enorme
    out += f'<circle cx="512" cy="470" r="250" fill="{skin}" stroke="{ink}" stroke-width="12"/>'
    # pelo con flequillo y orejas de gato
    out += f'<path d="M262,470 C250,300 350,200 512,200 C674,200 774,300 762,470 C740,400 700,360 650,350 C600,420 560,420 512,340 C464,420 424,420 374,350 C324,360 284,400 262,470 Z" fill="{hair}" stroke="{ink}" stroke-width="12" stroke-linejoin="round"/>'
    out += f'<path d="M300,330 L250,150 L400,250 Z M724,330 L774,150 L624,250 Z" fill="{hair}" stroke="{ink}" stroke-width="12" stroke-linejoin="round"/>'
    out += f'<path d="M310,300 L285,195 L365,255 Z M714,300 L739,195 L659,255 Z" fill="{outfit}" opacity="0.8"/>'
    # ojos grandes brillantes
    for sx in (-1, 1):
        cx = 512 + sx * 95
        out += f'<ellipse cx="{cx}" cy="500" rx="48" ry="70" fill="{eyes}" stroke="{ink}" stroke-width="8"/>'
        out += f'<ellipse cx="{cx - sx*14}" cy="480" rx="18" ry="26" fill="#fff"/><circle cx="{cx + sx*14}" cy="535" r="9" fill="#fff" opacity="0.9"/>'
        out += f'<path d="M{cx-52},{430} Q{cx},400 {cx+52},430" stroke="{ink}" stroke-width="10" stroke-linecap="round" fill="none"/>'
    # mejillas y boca
    out += f'<ellipse cx="372" cy="580" rx="36" ry="20" fill="#ff9ab5" opacity="0.7"/><ellipse cx="652" cy="580" rx="36" ry="20" fill="#ff9ab5" opacity="0.7"/>'
    out += f'<path d="M480,600 Q512,640 544,600" stroke="{ink}" stroke-width="10" stroke-linecap="round" fill="none"/>'
    # brillos y estrellas
    out += star(820, 240, 40, 4, 0.4, "#ffd166") + star(200, 620, 28, 4, 0.4, "#ffd166") + star(860, 700, 22, 4, 0.4, "#ffd166")
    add(name, 1024, 1024, out)

chibi("chibi-neko-violet")
chibi("chibi-neko-mint", hair="#2dd4bf", eyes="#0f3b3b", outfit="#fde047", ink="#1a2e2e")
chibi("chibi-neko-rose", hair="#ff7eb6", eyes="#4a1030", outfit="#8ec5ff", ink="#2a1620")

# ---------------------------------------------------------------------------
# 10. Mecha — cabeza de robot original con visor luminoso
# ---------------------------------------------------------------------------
def mecha(name, armor="#e5e7eb", dark="#1f2937", glow="#38bdf8", accent="#ef4444"):
    defs = f'<linearGradient id="v{name}" x1="0" x2="1"><stop offset="0" stop-color="{glow}" stop-opacity="0.2"/><stop offset="0.5" stop-color="{glow}"/><stop offset="1" stop-color="{glow}" stop-opacity="0.2"/></linearGradient>'
    out = f'<path d="M512,110 L560,230 L464,230 Z" fill="{accent}" stroke="{dark}" stroke-width="10"/>'  # cresta
    out += f'<path d="M300,260 L724,260 L790,420 L740,760 L600,880 L424,880 L284,760 L234,420 Z" fill="{armor}" stroke="{dark}" stroke-width="14" stroke-linejoin="round"/>'
    out += f'<path d="M234,420 L120,400 L90,560 L200,620 Z M790,420 L904,400 L934,560 L824,620 Z" fill="{armor}" stroke="{dark}" stroke-width="14" stroke-linejoin="round"/>'  # orejeras
    out += f'<path d="M330,420 L694,420 L660,520 L364,520 Z" fill="{dark}"/>'
    out += f'<path d="M350,440 L674,440 L648,500 L376,500 Z" fill="url(#v{name})"/>'  # visor
    out += f'<path d="M400,600 L624,600 L600,720 L424,720 Z" fill="{dark}"/>'
    for i in range(6):
        out += f'<rect x="{418+i*32}" y="620" width="14" height="80" fill="{armor}" opacity="0.7"/>'
    out += f'<path d="M284,760 L330,700 M740,760 L694,700 M300,300 L360,380 M724,300 L664,380" stroke="{dark}" stroke-width="10" stroke-linecap="round"/>'
    out += f'<circle cx="150" cy="500" r="26" fill="{glow}"/><circle cx="874" cy="500" r="26" fill="{glow}"/>'
    out += f'<path d="M512,760 L512,880" stroke="{accent}" stroke-width="18"/>'
    # energía azul alrededor
    out += speed_lines(512, 520, 470, 540, 26, glow, (4, 14), 81)
    add(name, 1024, 1024, out, defs)

mecha("mecha-head-steel")
mecha("mecha-head-crimson", armor="#b91c1c", dark="#1a0a0a", glow="#fbbf24", accent="#f3f4f6")
mecha("mecha-head-night", armor="#1f2933", dark="#05070a", glow="#a855f7", accent="#22d3ee")

# ---------------------------------------------------------------------------
# 11. Neón / cyberpunk: casco futurista con líneas de neón
# ---------------------------------------------------------------------------
def neon_warrior(name, a="#3b82f6", b="#a855f7", bg="#0b0614"):
    defs = (f'<linearGradient id="n{name}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{a}"/><stop offset="1" stop-color="{b}"/></linearGradient>'
            f'<filter id="f{name}" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="14"/></filter>')
    helmet = "M512,150 C700,150 800,300 800,480 C800,640 740,760 660,840 L364,840 C284,760 224,640 224,480 C224,300 324,150 512,150 Z"
    out = f'<path d="{helmet}" fill="{bg}" opacity="0.92"/>'
    out += f'<path d="{helmet}" stroke="url(#n{name})" stroke-width="26" fill="none" filter="url(#f{name})" opacity="0.9"/>'
    out += f'<path d="{helmet}" stroke="url(#n{name})" stroke-width="10" fill="none"/>'
    visor = "M300,440 L724,440 L690,560 L334,560 Z"
    out += f'<path d="{visor}" fill="url(#n{name})" filter="url(#f{name})" opacity="0.8"/><path d="{visor}" fill="url(#n{name})"/>'
    for y in (620, 680, 740):
        out += f'<path d="M380,{y} L644,{y}" stroke="url(#n{name})" stroke-width="8" stroke-linecap="round" opacity="0.9"/>'
    out += f'<path d="M224,480 L120,520 L140,700 M800,480 L904,520 L884,700 M512,150 L512,60 M430,170 L390,90 M594,170 L634,90" stroke="url(#n{name})" stroke-width="10" stroke-linecap="round" fill="none"/>'
    rnd = random.Random(91)
    for _ in range(18):
        x, y = rnd.random() * 1024, rnd.random() * 1024
        out += f'<rect x="{x:.0f}" y="{y:.0f}" width="{20+rnd.random()*90:.0f}" height="6" fill="{a if rnd.random()>0.5 else b}" opacity="0.8"/>'
    add(name, 1024, 1024, out, defs)

neon_warrior("neon-warrior-blue")
neon_warrior("neon-warrior-pink", a="#f472b6", b="#22d3ee", bg="#120616")

# ---------------------------------------------------------------------------
# 12. Aura oscura / energía (Dark Awakening) y aura dorada (Celestial)
# ---------------------------------------------------------------------------
def aura(name, dark="#0b0b0d", energy="#dc2626", spark="#fecaca"):
    """Humo oscuro ascendente con lenguas de energía: se coloca detrás de un personaje o solo."""
    defs = f'<filter id="b{name}" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="22"/></filter>'
    out = ""
    rnd = random.Random(101)
    # resplandor de energía detrás
    for i in range(5):
        x = 512 + (rnd.random() - 0.5) * 300
        y = 560 + (rnd.random() - 0.5) * 300
        out += f'<circle cx="{x:.0f}" cy="{y:.0f}" r="{150+rnd.random()*120:.0f}" fill="{energy}" opacity="0.35" filter="url(#b{name})"/>'
    # columna de humo (círculos superpuestos, más pequeños arriba)
    for i in range(26):
        t = i / 25
        x = 512 + math.sin(t * 7) * 150 * (1 - t) + (rnd.random() - 0.5) * 80
        y = 940 - t * 820
        r = 150 * (1 - t) + 30
        out += f'<circle cx="{x:.0f}" cy="{y:.0f}" r="{r:.0f}" fill="{dark}" opacity="{0.95 - t*0.5:.2f}"/>'
    # lenguas de energía (gotas invertidas) saliendo del humo
    for i in range(9):
        x = 512 + (rnd.random() - 0.5) * 520
        y = 300 + rnd.random() * 560
        h = 120 + rnd.random() * 160
        w = h * 0.32
        d = f"M{x},{y-h} C{x+w*0.4},{y-h*0.55} {x+w},{y-h*0.25} {x+w*0.6},{y} C{x+w*0.3},{y+h*0.12} {x-w*0.3},{y+h*0.12} {x-w*0.6},{y} C{x-w},{y-h*0.25} {x-w*0.4},{y-h*0.55} {x},{y-h} Z"
        out += f'<path d="{d}" fill="{energy}" opacity="0.95"/>'
        out += f'<path d="M{x},{y-h*0.7} C{x+w*0.25},{y-h*0.4} {x+w*0.3},{y-h*0.2} {x},{y-h*0.05} C{x-w*0.3},{y-h*0.2} {x-w*0.25},{y-h*0.4} {x},{y-h*0.7} Z" fill="{spark}" opacity="0.85"/>'
    # grietas eléctricas
    for _ in range(10):
        x, y = 200 + rnd.random() * 624, 200 + rnd.random() * 650
        out += f'<path d="M{x:.0f},{y:.0f} l{(rnd.random()-0.5)*90:.0f},{-30-rnd.random()*70:.0f} l{(rnd.random()-0.5)*90:.0f},{-30-rnd.random()*70:.0f} l{(rnd.random()-0.5)*60:.0f},{-20-rnd.random()*50:.0f}" stroke="{spark}" stroke-width="6" stroke-linecap="round" fill="none"/>'
    add(name, 1024, 1024, out, defs)

aura("aura-dark-red")
aura("aura-dark-violet", energy="#7c3aed", spark="#ddd6fe")

def celestial(name, gold="#f59e0b", light="#fff7d6", ink="#3b2a06"):
    defs = f'<radialGradient id="c{name}"><stop offset="0" stop-color="{light}"/><stop offset="0.5" stop-color="{gold}" stop-opacity="0.8"/><stop offset="1" stop-color="{gold}" stop-opacity="0"/></radialGradient>'
    out = f'<circle cx="512" cy="512" r="420" fill="url(#c{name})"/>'
    out += speed_lines(512, 512, 200, 520, 60, gold, (3, 16), 111)
    for (x, y, r) in ((300, 260, 46), (760, 220, 34), (820, 700, 40), (240, 740, 30), (512, 140, 26)):
        out += star(x, y, r, 4, 0.35, light) + f'<circle cx="{x}" cy="{y}" r="{r*0.18:.0f}" fill="{ink}" opacity="0.6"/>'
    # mechones estilizados (silueta de cabello en punta)
    out += f'<path d="M512,330 L440,520 L512,470 L584,520 Z M420,380 L330,560 L430,500 Z M604,380 L694,560 L594,500 Z" fill="{ink}"/>'
    add(name, 1024, 1024, out, defs)

celestial("aura-celestial-gold")
celestial("aura-celestial-ice", gold="#38bdf8", light="#e0f7ff", ink="#0b2a3b")

# ---------------------------------------------------------------------------
# 13. Energía shonen: rayos, corte de katana
# ---------------------------------------------------------------------------
def bolts(name, col="#facc15", ink="#111"):
    out = ""
    rnd = random.Random(121)
    for _ in range(7):
        x, y = rnd.random() * 1700 + 150, rnd.random() * 600 + 150
        s = 120 + rnd.random() * 200
        d = f"M{x},{y-s} L{x-s*0.35},{y} L{x+s*0.05},{y} L{x-s*0.25},{y+s} L{x+s*0.45},{y-s*0.15} L{x+s*0.05},{y-s*0.15} L{x+s*0.35},{y-s} Z"
        out += f'<path d="{d}" fill="{col}" stroke="{ink}" stroke-width="10" stroke-linejoin="round"/>'
    out += speed_lines(1024, 512, 300, 900, 40, ink, (2, 7), 122)
    add(name, 2048, 1024, out)

bolts("bolts-yellow")
bolts("bolts-cyan", col="#22d3ee")

def slash(name, blade="#ffffff", ink="#0b0b0d", accent="#dc2626"):
    out = ""
    for i, (x, y, l, a) in enumerate(((200, 700, 1500, -28), (500, 850, 1100, -35), (900, 300, 900, -18))):
        w = 70 - i * 18
        out += f'<path d="M0,0 C{l*0.3},{-w} {l*0.7},{-w} {l},0 C{l*0.7},{w*0.3} {l*0.3},{w*0.3} 0,0 Z" fill="{blade}" stroke="{ink}" stroke-width="10" transform="translate({x} {y}) rotate({a})"/>'
    out += speed_lines(1024, 512, 360, 980, 50, ink, (2, 8), 131)
    rnd = random.Random(132)
    for _ in range(18):
        out += f'<circle cx="{rnd.random()*2048:.0f}" cy="{rnd.random()*1024:.0f}" r="{3+rnd.random()*12:.0f}" fill="{accent}"/>'
    add(name, 2048, 1024, out)

slash("slash-white")
slash("slash-black", blade="#0b0b0d", ink="#0b0b0d", accent="#dc2626")

# ---------------------------------------------------------------------------
# 14. Urbano: graffiti (formas), gótico, geométrico, gaming, retro 90s, línea mínima, streetwear
# ---------------------------------------------------------------------------
def graffiti(name, a="#f97316", b="#0ea5e9", ink="#111"):
    out = ""
    # flecha graffiti con relleno y drips
    arrow = "M120,520 L560,300 L560,420 L1180,420 L1180,300 L1620,520 L1180,740 L1180,620 L560,620 L560,740 Z"
    out += f'<path d="{arrow}" fill="{a}" stroke="{ink}" stroke-width="22" stroke-linejoin="round" transform="translate(40 0)"/>'
    out += f'<path d="{arrow}" fill="{b}" stroke="{ink}" stroke-width="22" stroke-linejoin="round" transform="translate(300 -80) scale(0.55) translate(600 200)" opacity="0.95"/>'
    for x in (700, 820, 980, 1100):
        out += f'<path d="M{x},740 L{x},{860+(x%3)*40}" stroke="{a}" stroke-width="30" stroke-linecap="round"/><path d="M{x},740 L{x},{860+(x%3)*40}" stroke="{ink}" stroke-width="40" stroke-linecap="round" opacity="0" />'
        out += f'<circle cx="{x}" cy="{870+(x%3)*40}" r="20" fill="{a}" stroke="{ink}" stroke-width="8"/>'
    out += f'<path d="M620,460 L1120,460 M620,540 L980,540" stroke="#fff" stroke-width="18" stroke-linecap="round" opacity="0.7"/>'
    rnd = random.Random(141)
    for _ in range(30):
        out += f'<circle cx="{rnd.random()*2048:.0f}" cy="{rnd.random()*1024:.0f}" r="{3+rnd.random()*14:.0f}" fill="{b if rnd.random()>0.5 else a}" opacity="0.8"/>'
    out += star(1800, 260, 70, 5, 0.45, "#fff") + f'{star(1800, 260, 70, 5, 0.45, "none")}'
    add(name, 2048, 1024, out)

graffiti("graffiti-arrow-orange")
graffiti("graffiti-arrow-lime", a="#a3e635", b="#f472b6")

def gothic(name, ink="#0b0b0d", rose="#8b0000", leaf="#1f3d2b"):
    out = f'<path d="M512,120 L512,900 M330,330 L694,330" stroke="{ink}" stroke-width="46" stroke-linecap="round"/>'
    out += f'<path d="M512,120 L512,900 M330,330 L694,330" stroke="#444" stroke-width="12" stroke-linecap="round" stroke-dasharray="30 30"/>'
    # tallo espinoso enrollado
    out += f'<path d="M420,880 C380,760 640,720 600,600 C560,480 400,480 440,380 C470,300 580,300 560,230" stroke="{leaf}" stroke-width="16" stroke-linecap="round" fill="none"/>'
    for (x, y) in ((400, 820), (620, 680), (420, 440), (570, 260), (500, 560)):
        out += f'<path d="M{x},{y} l-22,-18 M{x},{y} l20,-20" stroke="{leaf}" stroke-width="8" stroke-linecap="round"/>'
    # rosa
    out += f'<circle cx="610" cy="590" r="78" fill="{rose}" stroke="{ink}" stroke-width="8"/>'
    out += f'<path d="M610,590 m-50,0 a50,50 0 1,0 100,0 M610,590 m-28,10 a30,30 0 1,1 56,-10 M610,590 m-10,-6 a12,12 0 1,0 20,8" stroke="{ink}" stroke-width="7" fill="none" stroke-linecap="round"/>'
    for a in (0.6, 2.2, 3.9, 5.2):
        x, y = polar(610, 590, 100, a)
        out += f'<path d="M{x:.0f},{y:.0f} q30,-40 70,-20 q-40,10 -70,20 Z" fill="{leaf}" stroke="{ink}" stroke-width="6" transform="rotate({math.degrees(a):.0f} {x:.0f} {y:.0f})"/>'
    add(name, 1024, 1024, out)

gothic("gothic-rose-cross")

def geometric(name, cols=("#111111", "#e11d48", "#f5f5f5")):
    out = ""
    rnd = random.Random(151)
    s = 128
    for j in range(8):
        for i in range(16):
            x, y = i * s, j * s
            k = rnd.random()
            c = cols[rnd.randrange(len(cols))]
            if k < 0.35:
                out += f'<path d="M{x},{y} L{x+s},{y} L{x},{y+s} Z" fill="{c}"/>'
            elif k < 0.6:
                out += f'<path d="M{x+s},{y} L{x+s},{y+s} L{x},{y+s} Z" fill="{c}"/>'
            elif k < 0.75:
                out += f'<circle cx="{x+s/2}" cy="{y+s/2}" r="{s*0.4}" fill="{c}"/>'
    add(name, 2048, 1024, out)

geometric("geometric-tri-red")
geometric("geometric-tri-blue", ("#0f172a", "#38bdf8", "#f8fafc"))

def pixel_art(name, grid, px=40, colors=None):
    out = ""
    for j, row in enumerate(grid):
        for i, ch in enumerate(row):
            if ch == ".":
                continue
            out += f'<rect x="{i*px}" y="{j*px}" width="{px}" height="{px}" fill="{colors[ch]}"/>'
    w, h = len(grid[0]) * px, len(grid) * px
    add(name, w, h, out)

# criatura pixel original ("Bitling") y corazón
pixel_art("pixel-bitling", [
    "....11111111....",
    "...1222222221...",
    "..122222222221..",
    ".12233222233221.",
    ".12233222233221.",
    "122222222222222 1".replace(" ", ""),
    "1222222222222221",
    "1222244444422221",
    "1222222222222221",
    ".11222222222211.",
    "..1.12222221.1..",
    ".....1....1.....",
    "....11....11....",
], px=48, colors={"1": "#1e1b4b", "2": "#22d3ee", "3": "#ffffff", "4": "#1e1b4b"})
pixel_art("pixel-heart", [
    "..111....111..",
    ".12221..12221.",
    "1222221122222 1".replace(" ", ""),
    "12222222222221",
    "12222222222221",
    ".122222222221.",
    "..1222222221..",
    "...12222221...",
    "....122221....",
    ".....1221.....",
    "......11......",
], px=56, colors={"1": "#4a0d1f", "2": "#ef4464"})

def retro90(name, a="#ff5fa2", b="#ffd166", c="#5ad1ff", ink="#2a1b3d"):
    out = ""
    for i in range(6):
        y = 120 + i * 150
        out += f'<path d="M0,{y} L2048,{y-60}" stroke="{[a,b,c][i%3]}" stroke-width="{34-i*3}" stroke-linecap="round" opacity="0.9"/>'
    rnd = random.Random(161)
    for _ in range(14):
        out += star(rnd.random() * 2048, rnd.random() * 1024, 26 + rnd.random() * 50, 4, 0.3, "#fff")
    for (x, y, r) in ((400, 600, 120), (1500, 400, 90), (1800, 800, 70)):
        out += f'<circle cx="{x}" cy="{y}" r="{r}" fill="none" stroke="{ink}" stroke-width="12"/><circle cx="{x}" cy="{y}" r="{r*0.6:.0f}" fill="{a}" stroke="{ink}" stroke-width="10"/>'
    out += halftone(1000, 600, 600, 380, ink, 28, (2, 9), "right", 6, 0.5)
    add(name, 2048, 1024, out)

retro90("retro-90s-sparkle")

def line_art(name, ink="#111"):
    # perfil femenino de una sola línea (original), cabello suelto
    out = f'<path d="M520,170 C420,160 350,230 350,330 C350,420 390,460 400,520 C410,560 380,580 370,610 C390,620 420,615 430,640 C410,670 420,700 450,720 C470,730 520,720 560,700 C640,660 690,580 700,500 C710,400 690,300 620,230 C600,210 560,180 520,170 Z" stroke="{ink}" stroke-width="14" stroke-linecap="round" stroke-linejoin="round" fill="none"/>'
    out += f'<path d="M700,500 C760,560 800,660 790,760 C780,840 720,900 650,920 M560,700 C580,780 560,860 520,930" stroke="{ink}" stroke-width="14" stroke-linecap="round" fill="none"/>'
    out += f'<path d="M480,430 C500,420 530,425 545,440" stroke="{ink}" stroke-width="12" stroke-linecap="round" fill="none"/>'
    out += f'<path d="M500,470 a26,30 0 1,0 52,0 a26,30 0 1,0 -52,0" stroke="{ink}" stroke-width="10" fill="none"/><circle cx="531" cy="470" r="10" fill="{ink}"/>'
    out += f'<path d="M560,590 C580,600 600,598 616,588" stroke="{ink}" stroke-width="10" stroke-linecap="round" fill="none"/>'
    out += petal(760, 300, 20, ink, 30) + petal(820, 380, 16, ink, 80) + petal(300, 760, 18, ink, 10)
    add(name, 1024, 1024, out)


def streetwear(name, a="#111", b="#f5f5f5", c="#e11d48"):
    out = ""
    for i in range(5):
        out += f'<rect x="{200+i*180}" y="0" width="90" height="1024" fill="{a if i%2==0 else c}" transform="skewX(-18)"/>'
    out += f'<rect x="1300" y="300" width="560" height="420" rx="30" fill="{b}" stroke="{a}" stroke-width="18" stroke-dasharray="40 24"/>'
    out += star(1580, 510, 150, 5, 0.45, c) + f'<circle cx="1580" cy="510" r="32" fill="{a}"/>'
    out += f'<rect x="1340" y="760" width="480" height="60" fill="{a}"/><rect x="1340" y="840" width="300" height="24" fill="{c}"/>'
    add(name, 2048, 1024, out)

streetwear("streetwear-stripes")
streetwear("streetwear-stripes-blue", a="#0f172a", b="#f8fafc", c="#2563eb")


# ---------------------------------------------------------------------------
# 15. Hechicero del vacío (original): figura encapuchada con círculo arcano y esfera de energía
# ---------------------------------------------------------------------------
def void_sorcerer(name, coat="#0f1020", glyph="#7dd3fc", energy="#a855f7", core="#f5d0fe"):
    defs = (f'<radialGradient id="s{name}"><stop offset="0" stop-color="{core}"/><stop offset="0.45" stop-color="{energy}"/><stop offset="1" stop-color="{energy}" stop-opacity="0"/></radialGradient>'
            f'<filter id="g{name}" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="16"/></filter>')
    out = ""
    # círculo arcano con runas geométricas
    out += f'<circle cx="512" cy="520" r="400" stroke="{glyph}" stroke-width="6" fill="none" opacity="0.8"/>'
    out += f'<circle cx="512" cy="520" r="360" stroke="{glyph}" stroke-width="3" fill="none" stroke-dasharray="18 14" opacity="0.7"/>'
    for i in range(12):
        a = i * math.pi / 6
        x1, y1 = polar(512, 520, 360, a); x2, y2 = polar(512, 520, 400, a)
        out += f'<line x1="{x1:.0f}" y1="{y1:.0f}" x2="{x2:.0f}" y2="{y2:.0f}" stroke="{glyph}" stroke-width="6" opacity="0.8"/>'
        if i % 2 == 0:
            rx, ry = polar(512, 520, 330, a)
            out += f'<rect x="{rx-10:.0f}" y="{ry-10:.0f}" width="20" height="20" fill="{glyph}" opacity="0.7" transform="rotate(45 {rx:.0f} {ry:.0f})"/>'
    pts = " ".join(f"{polar(512,520,300,-math.pi/2+i*2*math.pi/3)[0]:.0f},{polar(512,520,300,-math.pi/2+i*2*math.pi/3)[1]:.0f}" for i in range(3))
    out += f'<polygon points="{pts}" stroke="{glyph}" stroke-width="4" fill="none" opacity="0.6"/>'
    # figura: abrigo largo de cuello alto, capucha, hombros anchos
    out += f'<path d="M512,250 C470,250 440,290 440,340 L420,420 L330,470 L300,900 L724,900 L694,470 L604,420 L584,340 C584,290 554,250 512,250 Z" fill="{coat}"/>'
    out += f'<path d="M440,340 C470,300 554,300 584,340 L570,420 L454,420 Z" fill="#1b1d3a"/>'  # cuello alto
    out += f'<path d="M470,330 C480,290 544,290 554,330 L548,380 L476,380 Z" fill="#2b2d55"/>'   # sombra de la capucha (rostro en sombra)
    out += f'<path d="M484,372 L540,372" stroke="{glyph}" stroke-width="6" stroke-linecap="round"/>'  # destello de los ojos ocultos
    out += f'<path d="M400,900 L380,980 M624,900 L644,980" stroke="{coat}" stroke-width="80" stroke-linecap="round"/>'
    # brazos extendidos hacia la esfera
    out += f'<path d="M380,480 C330,560 360,640 440,660 M644,480 C694,560 664,640 584,660" stroke="{coat}" stroke-width="54" stroke-linecap="round" fill="none"/>'
    out += f'<path d="M440,660 L470,690 M584,660 L554,690" stroke="#f1dccb" stroke-width="30" stroke-linecap="round"/>'
    # esfera de energía
    out += f'<circle cx="512" cy="690" r="150" fill="url(#s{name})" filter="url(#g{name})"/>'
    out += f'<circle cx="512" cy="690" r="78" fill="url(#s{name})"/><circle cx="512" cy="690" r="34" fill="{core}"/>'
    for i in range(8):
        a = i * math.pi / 4 + 0.4
        x1, y1 = polar(512, 690, 95, a); x2, y2 = polar(512, 690, 150 + (i % 2) * 40, a)
        out += f'<line x1="{x1:.0f}" y1="{y1:.0f}" x2="{x2:.0f}" y2="{y2:.0f}" stroke="{core}" stroke-width="4" stroke-linecap="round" opacity="0.9"/>'
    # partículas
    rnd = random.Random(201)
    for _ in range(26):
        x, y = rnd.random() * 1024, rnd.random() * 1024
        out += f'<circle cx="{x:.0f}" cy="{y:.0f}" r="{2+rnd.random()*5:.1f}" fill="{glyph if rnd.random()>0.5 else core}" opacity="0.8"/>'
    add(name, 1024, 1024, out, defs)

void_sorcerer("void-sorcerer-violet")
void_sorcerer("void-sorcerer-crimson", coat="#14090c", glyph="#fca5a5", energy="#ef4444", core="#fee2e2")

# ---------------------------------------------------------------------------
# 16. Netrunner ácido (original): busto con visor, implantes y skyline neón con glitch
# ---------------------------------------------------------------------------
def acid_runner(name, acid="#e6ff2b", cyan="#19e6ff", ink="#0a0a12", skin="#1a1a2a"):
    defs = f'<filter id="g{name}" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="10"/></filter>'
    out = ""
    rnd = random.Random(211)
    # skyline con ventanas
    for i in range(14):
        x = 60 + i * 140 + rnd.random() * 40
        h = 180 + rnd.random() * 320
        w = 70 + rnd.random() * 60
        out += f'<rect x="{x:.0f}" y="{1000-h:.0f}" width="{w:.0f}" height="{h:.0f}" fill="{ink}" opacity="0.9"/>'
        for j in range(int(h // 40)):
            if rnd.random() > 0.45:
                out += f'<rect x="{x+10:.0f}" y="{1000-h+12+j*40:.0f}" width="{w*0.3:.0f}" height="14" fill="{acid if rnd.random()>0.5 else cyan}" opacity="0.85"/>'
    # busto: hombros con chaqueta, cuello, cabeza con corte asimétrico y visor
    out += f'<path d="M1024,380 C900,380 860,460 850,540 L800,560 L760,1000 L1288,1000 L1248,560 L1198,540 C1188,460 1148,380 1024,380 Z" fill="{skin}" stroke="{acid}" stroke-width="8"/>'
    out += f'<path d="M850,540 L1198,540 L1180,640 L868,640 Z" fill="{ink}"/>'
    out += f'<path d="M1024,160 C930,160 890,230 890,320 L900,440 C930,470 1118,470 1148,440 L1158,320 C1158,230 1118,160 1024,160 Z" fill="{skin}"/>'
    out += f'<path d="M890,300 C890,200 930,150 1024,140 C1130,150 1170,220 1158,300 C1120,260 1070,250 1024,280 C990,250 930,250 890,300 Z" fill="{acid}"/>'  # cabello
    out += f'<path d="M905,330 L1143,330 L1130,380 L918,380 Z" fill="{cyan}" filter="url(#g{name})" opacity="0.8"/><path d="M905,330 L1143,330 L1130,380 L918,380 Z" fill="{cyan}"/>'  # visor
    out += f'<path d="M940,355 L980,355 M1060,355 L1110,355" stroke="{ink}" stroke-width="6" stroke-linecap="round"/>'
    # implantes en cuello y sien
    out += f'<rect x="1150" y="340" width="36" height="90" rx="6" fill="{ink}" stroke="{acid}" stroke-width="4"/>'
    for j in range(3):
        out += f'<rect x="1158" y="{352+j*26}" width="20" height="10" fill="{acid}"/>'
    out += f'<path d="M960,470 L1090,470 M970,495 L1080,495" stroke="{cyan}" stroke-width="5" stroke-linecap="round"/>'
    # franjas glitch
    for _ in range(14):
        x, y = rnd.random() * 2048, rnd.random() * 1024
        out += f'<rect x="{x:.0f}" y="{y:.0f}" width="{60+rnd.random()*220:.0f}" height="{4+rnd.random()*10:.0f}" fill="{acid if rnd.random()>0.5 else cyan}" opacity="0.85"/>'
    # letras-barras tipo HUD (sin texto)
    for i in range(6):
        out += f'<rect x="{140+i*42}" y="140" width="26" height="{40+ (i%3)*22}" fill="{acid}" opacity="0.9"/>'
    out += f'<path d="M120,120 L120,260 M1900,120 L1900,260 M120,120 L260,120 M1900,120 L1760,120" stroke="{cyan}" stroke-width="8" stroke-linecap="round"/>'
    add(name, 2048, 1024, out, defs)

acid_runner("acid-runner")
acid_runner("acid-runner-magenta", acid="#ff2bd6", cyan="#9bf6ff")

# ---------------------------------------------------------------------------
# Escritura
# ---------------------------------------------------------------------------
for name, content in ASSETS.items():
    with open(os.path.join(OUT, f"{name}.svg"), "w", encoding="utf-8") as f:
        f.write(content)
print(f"{len(ASSETS)} ilustraciones escritas en {os.path.relpath(OUT)}")
