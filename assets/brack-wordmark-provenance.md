# Consolidated Brack wordmark

Updated 2026-09-10 using the built-in image generation/editing tool (not the CLI).

## Approved composition and runtime encoding

- Left: the landing logo's open-page stack of books.
- Text: the rounded speech-bubble B and Brack's established literary serif lettering.
- Canonical output: `apps/client/public/brack-wordmark.webp`, 1024x256, lossless WebP.
- Every logo surface is colored by `ThemeAwareLogo` and the active palette, not the source image's color.
- The standalone `brack-mark.webp` and launcher/favicons are unchanged.
- Initial generated output had a painted checkerboard, not genuine alpha, and was rejected.
- A focused cleanup edit produced a black-on-white master. The existing media pipeline's explicit
  `--wordmark-ink-mask` import converts ink coverage to real alpha, including interior page bands
  and letter counters, trims the canvas, contains it within 1016x248, adds a 4px transparent border,
  and encodes the canonical. No checkerboard or white fill is shipped. RGB values of the mask are
  black; display color is applied entirely through CSS.
- Raw masters stay outside the repository. Old runtime variants are recoverable through Git.

## Input references

1. Previous `apps/client/public/brack-wordmark.webp` (onboarding lettering/B reference).
2. `apps/client/public/brack-mark.webp` (standalone B identity reference).
3. Previous `apps/client/public/landing-page/brack-logo-transparent-bg-orange-text.png` (book stack reference).

## External generated masters

- Initial (rejected fake transparency): `C:/Users/Samuel/.codex/generated_images/019fb087-2913-7ad0-800e-be8aea4a09ff/exec-e7d4f0b1-3d78-40da-a315-a58c6bd337a8.png`
- Final monochrome import master: `C:/Users/Samuel/.codex/generated_images/019fb087-2913-7ad0-800e-be8aea4a09ff/exec-20259650-245c-45a5-9a4d-32ea08cc3f63.png`

## Exact initial editing prompt

```text
Use case: compositing.
Asset type: Brack's canonical full wordmark for a reading app, used as a CSS alpha mask at 30-56px tall.
Input images: Image 1 is the old onboarding wordmark: use its bold distinctive RACK serif lettering, and the B with speech-bubble-shaped negative space is the desired direction. Image 2 is the canonical standalone B/speech-bubble mark: its exact silhouette and interior cutout are the authoritative identity of the B. Image 3 is the orange landing-page wordmark: use ONLY its elegant stack-of-three-books drawing at the left, with the visible open page spaces and gently curved book edges. Do NOT use Image 3's misshapen B or orange background haze.
Primary request: consolidate the best elements into ONE finished horizontal logo: the stacked books from Image 3, then the canonical B from Image 2 as the first letter of BRACK, then RACK in the established bold literary serif style of Image 1. Preserve recognizable supplied forms; this is careful brand compositing, not a new logo concept.
Text (verbatim): BRACK (B R A C K). Exactly once. The B is the speech-bubble B mark, not an extra symbol before another B.
Composition: stack at left, balanced small gap before the B, tight natural spacing between the B and RACK. Letters share a baseline. Stack is modestly taller than lettering, like original wordmarks. Wide horizontal lockup, centered, small transparent margin on all sides. Strong legibility at small header sizes.
Style: crisp flat single-color BLACK silhouette with actual transparent background and transparent negative spaces. All book page bands, speech-bubble opening and letter counters MUST be transparent holes, NOT white or cream fills. No texture, gradient, glow, shadow, outline haze, mockup, backdrop, badge or extra symbols. Preserve the book stack geometry, with slender book spines and distinct open page bands, do not fill it into a solid block. Preserve Image 2's rounded B and smooth speech bubble tail exactly. Edges clean and high resolution.
```

## Exact cleanup prompt

```text
Edit this exact logo, not a redesign. Remove the fake gray checkerboard pattern completely, including inside all three book page bands and inside every letter counter. Output genuine transparent alpha background and transparent interior negative spaces. If your image format cannot represent transparency, use pure solid white (#FFFFFF) in those places instead — absolutely no checkerboard, gray squares or texture. Preserve all black logo silhouettes, lettering, spacing and composition exactly. Sharp flat single-color black artwork, no shades, shadows or texture. This is a production logo mask, not a transparency preview.
```

