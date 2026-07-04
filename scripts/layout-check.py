#!/usr/bin/env python3
# =====================================================================
# layout-check.py - S-LAYOUT-SSOT targeted layout regression suite
# -----------------------------------------------------------------------
# Render-verifies chord-tile / diagram geometry end-to-end in real headless
# Chromium against the live app (music/play/?p=guitar-standard - the
# guitar-standard profile has the WIDEST 'small' diagram canvas of any
# instrument profile, and is the exact profile named in the U5 "guitar
# chords overlapping" report - docs/plans/uat-walkthrough-20260704.md).
#
# At each of 360/412/768/1440px viewport widths x 1.0/1.3 simulated root-
# font scale (Android accessibility "font size" setting - see the
# _set_font_scale() note below), drives Compose to populate:
#   - the In-key chord palette (.keyPalette .chordCell)
#   - the progression strip (.prog .slot)
#   - the All-chords grid (#buildGrid .chord)
# then opens the Practice Studio ("Solo over it") to populate:
#   - the scale-fretboard box (.scaleBox)
#
# ...and asserts:
#   1. no two chord tiles in the SAME list have overlapping bounding rects
#   2. no chord tile's own <svg> spills more than 1px past its own .chord
#      card (the U5/#96 bug class: a diagram wider than its column bleeding
#      into the next tile)
#   3. the scale-fretboard box (.scaleBox) never renders wider than its own
#      container - it may legitimately scroll INTERNALLY
#      (songbook.css: .scaleBox{overflow-x:auto}) but must never force the
#      page itself into horizontal overflow
#   4. neither the chord-list scroll container (#composeChords) nor the
#      document itself ever gains horizontal scroll
#
# Manual/pre-merge dev tool - this repo stays no-build and has no CI browser
# runner (rules/pre-pr-ci-parity.md), so this is agent-run before a PR that
# touches chord-tile/diagram layout, not CI-wired. Uses the SHARED
# Python-Playwright venv (rules/shared-toolchain.md - browsers already
# cached at ~/.cache/ms-playwright/) rather than a per-project node
# install, since this repo has no node_modules/Playwright today (unlike
# scripts/verify-theme.mjs, which assumes one). Starts its OWN throwaway
# HTTP server (no separate terminal needed).
#
# Run:
#   source ~/.claude/.venv/bin/activate
#   python3 scripts/layout-check.py [--profile guitar-standard] [--port 8134]
#
# See music/engineering-wiki/systems/layout-tokens.md for the full geometry
# contract this suite guards, including the ONE known gap it deliberately
# does NOT check (tracks.css .bt-st-chords / Practice Studio chords-in-key
# row - out of this suite's required scope, documented as a follow-up).
# =====================================================================
import argparse
import functools
import http.server
import os
import sys
import threading

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))

VIEWPORTS = [
    (360, 800),
    (412, 915),   # Pixel-class phone (matches the CSS's Pixel 10 references)
    (768, 1024),
    (1440, 900),
]
FONT_SCALES = [1.0, 1.3]
EPS = 1.0  # px tolerance for "spill"/"overlap"/"overflow" assertions


def start_server(port):
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=REPO_ROOT)
    httpd = http.server.ThreadingHTTPServer(('127.0.0.1', port), handler)
    t = threading.Thread(target=httpd.serve_forever, daemon=True)
    t.start()
    return httpd


def rects_overlap(a, b, eps=EPS):
    return not (
        a['x'] + a['width'] <= b['x'] + eps
        or b['x'] + b['width'] <= a['x'] + eps
        or a['y'] + a['height'] <= b['y'] + eps
        or b['y'] + b['height'] <= a['y'] + eps
    )


def contained(inner, outer, eps=EPS):
    """inner's box must not spill past outer's box by more than eps px."""
    return (
        inner['x'] >= outer['x'] - eps
        and inner['y'] >= outer['y'] - eps
        and inner['x'] + inner['width'] <= outer['x'] + outer['width'] + eps
        and inner['y'] + inner['height'] <= outer['y'] + outer['height'] + eps
    )


def check_no_overlap(page, container_sel, tile_sel, label, failures):
    """No two TILE_SEL elements under CONTAINER_SEL overlap each other."""
    boxes = page.eval_on_selector_all(
        f'{container_sel} {tile_sel}',
        'els => els.map(e => e.getBoundingClientRect()).map(r => ({x:r.x,y:r.y,width:r.width,height:r.height}))',
    )
    boxes = [b for b in boxes if b['width'] > 0 and b['height'] > 0]
    if not boxes:
        return 0  # nothing rendered - caller decides whether that's itself a failure
    bad_pairs = 0
    for i in range(len(boxes)):
        for j in range(i + 1, len(boxes)):
            if rects_overlap(boxes[i], boxes[j]):
                bad_pairs += 1
    if bad_pairs:
        failures.append(f'{label}: {bad_pairs} overlapping tile pair(s) among {len(boxes)} tiles')
    return len(boxes)


def check_no_spill(page, tile_sel, inner_sel, label, failures):
    """Every INNER_SEL (e.g. svg) must stay inside its own ancestor TILE_SEL."""
    pairs = page.eval_on_selector_all(
        tile_sel,
        """(tiles, innerSel) => tiles.map(t => {
            const inner = t.querySelector(innerSel);
            if (!inner) return null;
            const tr = t.getBoundingClientRect(), ir = inner.getBoundingClientRect();
            return {
                tile: {x:tr.x,y:tr.y,width:tr.width,height:tr.height},
                inner: {x:ir.x,y:ir.y,width:ir.width,height:ir.height},
            };
        }).filter(Boolean)""",
        inner_sel,
    )
    bad = 0
    for p in pairs:
        if not contained(p['inner'], p['tile']):
            bad += 1
    if bad:
        failures.append(f'{label}: {bad}/{len(pairs)} tile(s) spill their inner content past their own card')
    return len(pairs)


def check_no_page_hscroll(page, label, failures):
    metrics = page.evaluate(
        """() => {
            const doc = document.documentElement, body = document.body;
            const composeChords = document.getElementById('composeChords');
            return {
                docScrollW: doc.scrollWidth, docClientW: doc.clientWidth,
                bodyScrollW: body.scrollWidth, bodyClientW: body.clientWidth,
                composeChordsScrollW: composeChords ? composeChords.scrollWidth : null,
                composeChordsClientW: composeChords ? composeChords.clientWidth : null,
            };
        }"""
    )
    if metrics['docScrollW'] > metrics['docClientW'] + EPS:
        failures.append(f"{label}: document has horizontal overflow ({metrics['docScrollW']} > {metrics['docClientW']})")
    if metrics['bodyScrollW'] > metrics['bodyClientW'] + EPS:
        failures.append(f"{label}: body has horizontal overflow ({metrics['bodyScrollW']} > {metrics['bodyClientW']})")
    if metrics['composeChordsScrollW'] is not None and metrics['composeChordsScrollW'] > metrics['composeChordsClientW'] + EPS:
        failures.append(
            f"{label}: #composeChords has horizontal overflow "
            f"({metrics['composeChordsScrollW']} > {metrics['composeChordsClientW']})"
        )


def check_scalebox_contained(page, label, failures):
    box = page.eval_on_selector_all(
        '.scaleBox',
        """els => els.map(e => {
            const r = e.getBoundingClientRect();
            const c = e.parentElement ? e.parentElement.getBoundingClientRect() : null;
            return { self: {x:r.x,y:r.y,width:r.width,height:r.height},
                     parent: c ? {x:c.x,y:c.y,width:c.width,height:c.height} : null };
        })""",
    )
    if not box:
        failures.append(f'{label}: .scaleBox did not render (expected the Practice Studio to be open)')
        return
    b = box[0]
    if b['parent'] and b['self']['width'] > b['parent']['width'] + EPS:
        failures.append(
            f"{label}: .scaleBox ({b['self']['width']}px) renders wider than its own container "
            f"({b['parent']['width']}px) - it must scroll INTERNALLY (overflow-x:auto), not spill"
        )


def set_font_scale(page, scale):
    # Simulates the Android accessibility "font size" setting: rem-based text
    # (the app's typography is rem throughout, no html{font-size} override) is
    # driven by the root font-size. There is no native Playwright/Chromium
    # "font scale" emulation, so this is the same technique used ad hoc during
    # the original U5 investigation (songbook.css's U5 comment: "simulated
    # Android font scaling, root font-size up to 1.5x").
    page.evaluate('(px) => { document.documentElement.style.fontSize = px + "px"; }', 16 * scale)


def run_one_config(browser, base_url, width, height, font_scale, failures_all):
    label = f'{width}x{height} @ {font_scale}x font'
    failures = []
    ctx = browser.new_context(viewport={'width': width, 'height': height})
    page = ctx.new_page()
    console_errors = []
    page.on('console', lambda m: console_errors.append(m.text) if m.type == 'error' else None)
    page.on('pageerror', lambda e: console_errors.append(str(e)))

    # domcontentloaded, not networkidle: the app @imports Google Fonts (blocked
    # in sandboxed/offline environments), which can hang networkidle well past
    # a reasonable timeout. wait_for_selector below is the real boot signal.
    page.goto(base_url, wait_until='domcontentloaded', timeout=20000)
    page.wait_for_selector('#s-library', timeout=10000)
    set_font_scale(page, font_scale)

    # --- Navigate to Compose, pick a key, build a small progression ---
    page.click('button[data-tab="compose"]')
    page.wait_for_selector('#keyPickerCompact', timeout=8000)
    page.click('#keyPickerCompact')
    page.wait_for_selector('#keyRoots .rootChip', timeout=8000)
    page.click('#keyRoots .rootChip >> nth=0')  # pick the first root, any root works for geometry
    # Re-tap the current (already-selected) mode chip to confirm + close the fly-out.
    page.click('#keyModes .chip.on')
    # [hidden] elements are never "visible", so wait_for_selector(state='visible')
    # (the default) would time out on a selector that's true precisely because the
    # element IS hidden - poll the boolean property directly instead.
    page.wait_for_function("document.getElementById('keyFlyout').hidden === true", timeout=8000)

    # In-key view is the default once a key is set. Measure it, then build a
    # small progression by tapping a few in-key tiles.
    page.wait_for_selector('.inKeyLead .keyPalette .chordCell', timeout=8000)
    n_inkey = check_no_overlap(page, '.inKeyLead .keyPalette', '.chordCell', f'{label} [in-key palette]', failures)
    check_no_spill(page, '.keyPalette .chordCell > .chord', 'svg', f'{label} [in-key palette]', failures)
    if n_inkey == 0:
        failures.append(f'{label}: in-key palette rendered zero tiles (expected diatonic chords for the chosen key)')

    tiles = page.query_selector_all('.keyPalette .chordCell .chord')
    for t in tiles[: min(4, len(tiles))]:
        t.click()
    page.wait_for_timeout(80)

    check_no_overlap(page, '#prog', '.slot', f'{label} [progression strip]', failures)
    check_no_spill(page, '.prog .slot .chord', 'svg', f'{label} [progression strip]', failures)

    # --- Switch to the All-chords grid ---
    all_btn = page.query_selector('.chordSeg .chordSegBtn:has-text("All")')
    if all_btn:
        all_btn.click()
        page.wait_for_timeout(80)
        page.wait_for_selector('#buildGrid .chord', timeout=8000)
        n_all = check_no_overlap(page, '#buildGrid', '.chord', f'{label} [all-chords grid]', failures)
        check_no_spill(page, '#buildGrid .chord', 'svg', f'{label} [all-chords grid]', failures)
        if n_all == 0:
            failures.append(f'{label}: all-chords grid rendered zero tiles')
    else:
        failures.append(f'{label}: could not find the In key|All segmented toggle\'s "All" button')

    check_no_page_hscroll(page, label, failures)

    # --- Save the progression, THEN open the Practice Studio ("Solo over it") ---
    # for the scale-fretboard check. Saving FIRST (rather than tapping "Solo over
    # it" on a never-saved progression, which routes through songbook.js's inline
    # save/skip choice row) is a deliberate workaround for a real, orthogonal,
    # pre-existing NavHistory bug this suite's development surfaced (NOT fixed
    # here - out of scope, see the PR body): dismissing the choice row's "Skip"
    # button synchronously opens the Studio (a NEW NavHistory layer) from
    # WITHIN nav-history.js's popstate while-loop (see nav-history.js's own
    # settleAfter() doc comment - exactly the "closing one layer opens another"
    # case that function exists to handle safely; the choice-row flow uses a
    # bare dismiss() instead), causing an immediate erroneous double-pop that
    # closes the Studio right after it opens. Saving first takes the
    # "already saved this session" branch (songbook.js's #soloBackingBtn
    # handler), which opens the Studio directly from a plain top-level click -
    # no nested popstate, no bug - a real, un-buggy user path to the same
    # screen this suite needs to measure.
    page.click('#cSave')
    save_btn = page.wait_for_selector('.composeRow button.red', timeout=8000)
    save_btn.click()
    page.wait_for_timeout(200)

    solo_btn = page.query_selector('#soloBackingBtn')
    if solo_btn and solo_btn.is_visible():
        solo_btn.click()
        page.wait_for_selector('.bt-player.studio.on .scaleBox', timeout=8000)
        check_scalebox_contained(page, f'{label} [studio scale box]', failures)
        check_no_page_hscroll(page, f'{label} [studio open]', failures)
    else:
        failures.append(f'{label}: #soloBackingBtn was not visible after picking a key + building a progression')

    bad_console = [e for e in console_errors if 'favicon' not in e and 'manifest' not in e and 'Service Worker' not in e and 'fonts.g' not in e]
    if bad_console:
        failures.append(f'{label}: {len(bad_console)} console/page error(s): {bad_console[:3]}')

    ctx.close()
    status = 'PASS' if not failures else 'FAIL'
    print(f'[{status}] {label}')
    for f in failures:
        print(f'    ! {f}')
    failures_all.extend(failures)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--profile', default='guitar-standard', help='instrument profile to test (widest-canvas default)')
    ap.add_argument('--port', type=int, default=8134)
    args = ap.parse_args()

    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print('layout-check: playwright not installed - run: source ~/.claude/.venv/bin/activate', file=sys.stderr)
        return 1

    httpd = start_server(args.port)
    base_url = f'http://127.0.0.1:{args.port}/music/play/?p={args.profile}'
    all_failures = []
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            for width, height in VIEWPORTS:
                for scale in FONT_SCALES:
                    run_one_config(browser, base_url, width, height, scale, all_failures)
            browser.close()
    finally:
        httpd.shutdown()

    print()
    if all_failures:
        print(f'FAIL: {len(all_failures)} issue(s) across {len(VIEWPORTS) * len(FONT_SCALES)} configs')
        return 1
    print(f'ALL GREEN: {len(VIEWPORTS) * len(FONT_SCALES)} configs (viewport x font-scale), zero tile overlaps, zero content spill, zero page horizontal overflow')
    return 0


if __name__ == '__main__':
    sys.exit(main())
