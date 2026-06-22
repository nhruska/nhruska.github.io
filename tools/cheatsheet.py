#!/usr/bin/env python3
"""Generate a phone-readable music-theory cheat-sheet PNG (dark theme)."""

from PIL import Image, ImageDraw, ImageFont

# ---- palette ----
BG       = "#0d0f12"
PANEL    = "#181b21"
HAIR     = "#262b34"
BODY     = "#e8ebf0"
DIM      = "#8a92a0"
TEAL     = "#5eead4"
WARM     = "#fbbf24"

# ---- canvas ----
W = 1080
MARGIN = 48          # outer page margin
PANEL_INSET = 40     # padding inside each panel
GAP = 28             # gap between panels

FONT_DIR = "/usr/share/fonts/truetype/dejavu/"

def font(name, size):
    try:
        return ImageFont.truetype(FONT_DIR + name, size)
    except Exception:
        return ImageFont.load_default()

# type scale
F_TITLE   = font("DejaVuSans-Bold.ttf", 58)
F_HEAD    = font("DejaVuSans-Bold.ttf", 40)
F_SUB     = font("DejaVuSans.ttf", 26)
F_BODY    = font("DejaVuSans.ttf", 30)
F_BODY_B  = font("DejaVuSans-Bold.ttf", 30)
F_MONO    = font("DejaVuSansMono.ttf", 30)
F_MONO_S  = font("DejaVuSansMono.ttf", 27)
F_FOOT    = font("DejaVuSans.ttf", 24)

# A throwaway image just for text measurement
_measure = ImageDraw.Draw(Image.new("RGB", (10, 10)))

def text_w(s, f):
    return _measure.textlength(s, font=f)

def text_h(f):
    a = f.getmetrics()
    return a[0] + a[1]

# ----------------------------------------------------------------------------
# Layout model: build a list of draw-ops with measured heights, then paint.
# Each panel is a dict {title, sub, body_height, ops}. We compute total height
# first so the canvas never clips.
# ----------------------------------------------------------------------------

CONTENT_X = MARGIN + PANEL_INSET
CONTENT_W = W - 2 * (MARGIN + PANEL_INSET)

# Rich "run" rendering: a line is a list of (text, font, color) segments.
def line_height(segs):
    return max(text_h(f) for _, f, _ in segs)

def draw_line(d, x, y, segs):
    cx = x
    for s, f, c in segs:
        d.text((cx, y), s, font=f, fill=c)
        cx += text_w(s, f)
    return cx

# Wrap a plain (text,font,color) into multiple lines within max_w.
def wrap_segs(text, f, c, max_w):
    words = text.split(" ")
    lines, cur = [], ""
    for w_ in words:
        trial = (cur + " " + w_).strip()
        if text_w(trial, f) <= max_w or not cur:
            cur = trial
        else:
            lines.append([(cur, f, c)])
            cur = w_
    if cur:
        lines.append([(cur, f, c)])
    return lines

LINE_GAP = 12   # extra spacing between body lines
SUB_GAP  = 8

# Each "block" is a callable that, given (d, x, y, w) draws itself and returns
# the y after drawing. We also need a height pre-pass; to keep it simple each
# block exposes .height(w) and .draw(d, x, y, w).

class Line:
    """One logical line that may wrap. segs = list of (text,font,color)."""
    def __init__(self, segs, gap=LINE_GAP, mono_wrap=False):
        self.segs = segs
        self.gap = gap
    def _lines(self, w):
        # Greedy wrap honoring segment boundaries.
        out, cur, cur_w = [], [], 0
        for s, f, c in self.segs:
            # split long single segments by words if needed
            piece = s
            if cur_w + text_w(piece, f) <= w or not cur:
                # try to fit; if overflow and it's wrappable text, break words
                if cur_w + text_w(piece, f) <= w:
                    cur.append((piece, f, c)); cur_w += text_w(piece, f)
                else:
                    # break by words
                    words = piece.split(" ")
                    for wi, word in enumerate(words):
                        token = word if (wi == 0 and not cur) else " " + word
                        if cur_w + text_w(token, f) <= w or not cur:
                            cur.append((token, f, c)); cur_w += text_w(token, f)
                        else:
                            out.append(cur); cur = [(word, f, c)]; cur_w = text_w(word, f)
            else:
                out.append(cur); cur = [(s, f, c)]; cur_w = text_w(s, f)
        if cur:
            out.append(cur)
        return out
    def height(self, w):
        ls = self._lines(w)
        h = 0
        for i, ln in enumerate(ls):
            h += line_height(ln)
            if i < len(ls) - 1:
                h += self.gap
        return h
    def draw(self, d, x, y, w):
        ls = self._lines(w)
        for i, ln in enumerate(ls):
            draw_line(d, x, y, ln)
            y += line_height(ln)
            if i < len(ls) - 1:
                y += self.gap
        return y

class Wrapped:
    """A single-style paragraph that wraps."""
    def __init__(self, text, f, c, gap=LINE_GAP):
        self.text, self.f, self.c, self.gap = text, f, c, gap
    def height(self, w):
        ls = wrap_segs(self.text, self.f, self.c, w)
        return sum(line_height(l) for l in ls) + self.gap * (len(ls) - 1)
    def draw(self, d, x, y, w):
        for l in wrap_segs(self.text, self.f, self.c, w):
            draw_line(d, x, y, l)
            y += line_height(l) + self.gap
        return y - self.gap

class Spacer:
    def __init__(self, h): self.h = h
    def height(self, w): return self.h
    def draw(self, d, x, y, w): return y + self.h

class Table:
    """Columns table. cols = list of (header, width_frac). rows = list of lists."""
    def __init__(self, headers, rows, fracs, row_gap=18, header_color=TEAL):
        self.headers, self.rows, self.fracs = headers, rows, fracs
        self.row_gap = row_gap
        self.header_color = header_color
        self.rh = text_h(F_BODY)
    def _xs(self, w):
        xs, acc = [], 0
        for fr in self.fracs:
            xs.append(acc); acc += fr * w
        return xs
    def height(self, w):
        n = len(self.rows) + 1  # header
        return n * self.rh + (n - 1) * self.row_gap + 14  # +rule under header
    def draw(self, d, x, y, w):
        xs = self._xs(w)
        # header
        for i, h in enumerate(self.headers):
            d.text((x + xs[i], y), h, font=F_BODY_B, fill=self.header_color)
        y += self.rh + 8
        d.line([(x, y), (x + w, y)], fill=HAIR, width=2)
        y += 6 + self.row_gap - 8
        for row in self.rows:
            for i, cell in enumerate(row):
                f = F_MONO_S if i == 0 else F_BODY
                col = BODY if i == 0 else DIM if i == 2 else BODY
                d.text((x + xs[i], y), cell, font=f, fill=col)
            y += self.rh + self.row_gap
        return y - self.row_gap

# ---- panel definition ----
class Panel:
    def __init__(self, num, title, sub, blocks):
        self.num, self.title, self.sub, self.blocks = num, title, sub, blocks
    def content_height(self, w):
        h = text_h(F_HEAD)
        if self.sub:
            h += SUB_GAP + text_h(F_SUB)
        h += 22  # gap before body
        for b in self.blocks:
            h += b.height(w)
        return h
    def total_height(self, w):
        return self.content_height(w) + 2 * PANEL_INSET
    def draw(self, d, x, y, w_outer):
        h = self.total_height(CONTENT_W)
        d.rounded_rectangle([x, y, x + w_outer, y + h], radius=26,
                            fill=PANEL, outline=HAIR, width=2)
        cx = x + PANEL_INSET
        cy = y + PANEL_INSET
        # header: number chip + title
        chip = f"{self.num}"
        # number in teal, title in warm
        d.text((cx, cy), chip + "  ", font=F_HEAD, fill=TEAL)
        nx = cx + text_w(chip + "  ", F_HEAD)
        d.text((nx, cy), self.title, font=F_HEAD, fill=WARM)
        cy += text_h(F_HEAD)
        if self.sub:
            cy += SUB_GAP
            d.text((cx, cy), self.sub, font=F_SUB, fill=DIM)
            cy += text_h(F_SUB)
        cy += 22
        for b in self.blocks:
            cy = b.draw(d, cx, cy, CONTENT_W)
        return y + h

# ---------------------------------------------------------------------------
# Build content
# ---------------------------------------------------------------------------
def mono(s): return (s, F_MONO, TEAL)
def body(s): return (s, F_BODY, BODY)
def bodyb(s): return (s, F_BODY_B, BODY)
def dim(s): return (s, F_BODY, DIM)
def warm(s): return (s, F_BODY_B, WARM)

panels = []

# 1 — chord family
panels.append(Panel("1", "The chord family", "same pattern in every key", [
    Line([bodyb("Major key:  "), mono("I  ii  iii  IV  V  vi  vii°")]),
    Line([dim("              "), mono("maj min min maj maj min dim")], gap=LINE_GAP),
    Spacer(14),
    Line([bodyb("Minor key:  "), mono("i  ii°  III  iv  v  VI  VII")]),
    Line([dim("              "), mono("min dim maj min min maj maj")]),
    Spacer(16),
    Wrapped("Pick a key → these are the chords that are “in.”", F_BODY, DIM),
]))

# 2 — function
panels.append(Panel("2", "Function: the story", "home → away → tension → home", [
    Line([warm("HOME "), dim("(tonic):  "), mono("I, vi")]),
    Spacer(10),
    Line([warm("AWAY "), dim("(subdominant):  "), mono("IV, ii")]),
    Spacer(10),
    Line([warm("TENSION "), dim("(dominant):  "), mono("V"), dim("  (wants home)")]),
    Spacer(16),
    Wrapped("Strongest pull = root moves DOWN A 5TH:", F_BODY, BODY),
    Spacer(4),
    Line([mono("V→I, ii→V"), dim("   (that’s the circle of fifths)")]),
]))

# 3 — progressions
panels.append(Panel("3", "Progressions to own", None, [
    Line([mono("I–IV–V"), dim("   (blues / folk)")]),
    Spacer(10),
    Line([mono("I–V–vi–IV"), dim("   (pop)")]),
    Spacer(10),
    Line([mono("ii–V–I"), dim("   (the resolver)")]),
    Spacer(10),
    Line([mono("I–vi–IV–V"), dim("   (doo-wop)")]),
    Spacer(10),
    Line([mono("i–♭VII–♭VI"), dim("  and  "), mono("i–♭VII–♭VI–V")]),
    Line([dim("   (minor / Andalusian — e.g. Am–G–F–E)")]),
    Spacer(10),
    Line([mono("12-bar blues"), dim("  =  "), mono("I–IV–V")]),
]))

# 4 — color tools
panels.append(Panel("4", "Color tools", None, [
    Line([warm("Secondary dominant: ")]),
    Wrapped("any chord can be preceded by the major/7 chord a 5th above it (“V of”).",
            F_BODY, BODY),
    Spacer(4),
    Line([dim("e.g.  "), mono("E7→Am"), dim(",  "), mono("D7→G")]),
    Spacer(16),
    Line([warm("Borrowing: ")]),
    Line([dim("steal  "), mono("♭VII, ♭VI, ♭III"), dim("  from the parallel")]),
    Wrapped("minor (the rock move).", F_BODY, DIM),
]))

# 5 — scales
panels.append(Panel("5", "Top 5 scales", "priority order", [
    Line([warm("1  "), bodyb("Minor pentatonic + blues note "), mono("(♭5)")]),
    Line([dim("    #1 lead scale")]),
    Spacer(12),
    Line([warm("2  "), bodyb("Major pentatonic")]),
    Line([dim("    = relative minor pent, 3 frets down")]),
    Spacer(12),
    Line([warm("3  "), bodyb("Mixolydian "), dim("(major with ♭7)")]),
    Line([dim("    dominant / jam vamps")]),
    Spacer(12),
    Line([warm("4  "), bodyb("Dorian "), dim("(minor with ♮6)")]),
    Line([dim("    hopeful minor jams")]),
    Spacer(12),
    Line([warm("5  "), bodyb("Harmonic minor "), dim("(raise the 7th)")]),
    Line([dim("    the E7-over-Am pull")]),
]))

# 6 — modes table
modes_table = Table(
    ["Mode", "Change", "Sound"],
    [
        ["Ionian",     "major scale",    "bright / home"],
        ["Lydian",     "major ♯4",  "dreamy / floating"],
        ["Mixolydian", "major ♭7",  "bluesy / dominant"],
        ["Dorian",     "minor ♮6",  "hopeful minor"],
        ["Aeolian",    "natural minor",  "sad / neutral"],
        ["Phrygian",   "minor ♭2",  "Spanish / dark"],
    ],
    fracs=[0.30, 0.32, 0.38],
)
panels.append(Panel("6", "Modes = ONE note changed", "needs a held vamp to exist", [
    modes_table,
    Spacer(18),
    Wrapped("Rule: play the parent scale, lean on the one changed note, over a vamp.",
            F_BODY, BODY),
]))

# ---------------------------------------------------------------------------
# Compute total height
# ---------------------------------------------------------------------------
title_h = text_h(F_TITLE)
y = MARGIN
y += title_h + 36  # title + gap
for i, p in enumerate(panels):
    y += p.total_height(CONTENT_W)
    y += GAP
y += 12
foot_h = text_h(F_FOOT)
y += foot_h
H = y + MARGIN

img = Image.new("RGB", (W, H), BG)
d = ImageDraw.Draw(img)

# title
ty = MARGIN
title = "HARMONY CHEAT-SHEET"
tw = text_w(title, F_TITLE)
d.text(((W - tw) / 2, ty), title, font=F_TITLE, fill=BODY)
# teal underline accent
uy = ty + title_h + 10
d.line([((W - tw) / 2, uy), ((W + tw) / 2, uy)], fill=TEAL, width=4)
y = ty + title_h + 36

for p in panels:
    bottom = p.draw(d, MARGIN, y, W - 2 * MARGIN)
    y = bottom + GAP

# footer
foot = "Music app · circle-of-fifths teaching surface"
fw = text_w(foot, F_FOOT)
d.text(((W - fw) / 2, y + 4), foot, font=F_FOOT, fill=DIM)

OUT = "/home/user/nhruska.github.io/tools/theory-cheatsheet.png"
img.save(OUT)
print("saved", OUT, img.size)
