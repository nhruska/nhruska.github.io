# M2 Adversarial Fold - Professor + P5 Seasoned Guitarist (2026-07-04)

Both passes: REQUEST_CHANGES. All findings folded. Dispositions:

## Professor (theory pages + scales implementation)

| # | Finding | Disposition |
|---|---|---|
| 1 | architecture.md/THEORY.md borrowed-chord example wrong (A# in D = bVI, not bVII) | FIXED - example changed to C in D major = bVII (a REAL page bug caught) |
| 2 | aeolian degree example missing b6 | FIXED - 1 2 b3 4 5 b6 b7 |
| 3 | soloScale is a 4th name-emitting surface | FIXED - surfaces table + prose now enumerate four |
| 4 | "canon never checks spelling" overbroad (S-BLUES block asserts regime-A literals) | FIXED - nuance stated in theory-verification.md + THEORY.md |

Scales tables, subset proofs, blue-note policy honesty: no findings - the implementation survived.

## P5 Seasoned Guitarist (docs + toolset)

| # | Finding | Disposition |
|---|---|---|
| 1 | "Five safe notes" caption context-false (fatal) | FIXED - three player-true captions shipped in tracks.js + tests + docs (inside-sound / blues-rub / land-on guidance) |
| 2 | No box-position labels despite box language (fatal) | DEFERRED with teeth - S-BLUES-BOXES queued (QUEUE SHORT-ready draft); ALL box promises stripped from captions/docs until it ships |
| 3 | Relative-pent trick missing | FIXED - pentMajor caption carries it ("same shape as its relative minor pent, two frets down") + solo-scales.md player phrasing |
| 4 | b5-shown-as-D# player language | FIXED-doc - explicit "shows D# today, reads Eb at S-BLUES-B" honesty line; pitch right, letter scheduled |
| 5 | Blues caption too absolute | FIXED - "bend, slide, or pass through; land on root, b3, 4, or 5 unless you want the rub" |
| 6 | S-DIAGRAM-PREF hand-wavy | FIXED-spec - SHAPE CLASSIFIER named as build step 0 (curated family/root-string/inversion metadata) before any rendering toggle |
| 7 | "No dots for pros" mis-target | FIXED-spec - patterns view KEEPS voicing facts (X/O, base fret, root tinting); strips instruction-numbering only |
| 8 | README overpromise | FIXED - current (position pager) vs queued (pattern view) stated plainly |

KEEP acknowledgments: solo/harmonization separation, the position pager, the P5 persona accuracy.

Verification after fold: node test/run-all.js 22 files 0 failed (caption tests updated); grep "Five safe" repo-wide = 0; sw v80.
