# Static media pipeline

Brack's repository-owned artwork is managed through one pipeline:

```sh
npm run media:assets
npm run media:assets:check
```

The first command performs safe, configured conversions and refreshes the media
inventory. The check command is read-only and is run in CI. It validates
formats, dimensions, the complete static-media inventory, and the budgets
recorded in `assets/media-assets-manifest.json`.

## Canonical and derived files

The pipeline never recompresses canonical artwork during routine runs:

- Every badge has exactly one `achievement-badges/*.webp` file. It is a 256px
  square using transparent padding and `contain`, so the complete artwork is
  visible without a separate thumbnail, detail image, or PNG fallback.
- Streak and trophy artwork likewise has exactly one transparent 256px WebP per
  illustration. Responsive duplicate files are intentionally not generated.
- In-app branding has exactly two canonical runtime assets:
  `brack-mark.webp` and `brack-wordmark.webp`. Both are lossless WebP files with
  real transparent pixels. Theme colors are applied in CSS, so separate
  light/dark/orange raster copies are neither needed nor allowed. The mark is a
  single 512px square canonical, preserving the complete transparent master at
  sufficient density for the largest loader on high-DPI screens; a separate
  256px runtime copy would only duplicate bytes. Its outer pixel ring must stay
  transparent, which makes accidental cropping fail validation. The full
  wordmark is a 1024x256 (4:1) mask with slim transparent padding, an open-page
  book stack, and the speech-bubble B. Its page bands and letter counters are
  transparent, not cream or white fills. Both canonical masks must retain a
  transparent outer pixel ring. Both logo URLs are explicitly included in the
  PWA precache, so offline screens use the same canonical files.
- Empty-state WebPs are lossless canonical runtime assets after their one-time
  PNG conversion.

Re-running `media:assets` with no input changes must leave the working tree
unchanged. Duplicate badge PNGs and old detail/thumbnail directories are
rejected by the check and removed by a normal pipeline run.

To import a future badge without retaining a raw repository copy:

```sh
npm run media:assets -- --import-badge C:\path\to\new_badge.png
```

The import creates one transparent, contained 256px WebP. Archive
high-resolution source artwork outside this repository if it may be needed
later.

To replace the Brack mark from an externally archived transparent master:

```sh
npm run media:assets -- --import-brand-mark C:\path\to\brack-mark-master.png
```

The source must be at least 512px in both dimensions. The pipeline contains the
complete artwork on a transparent 512px canvas and encodes one lossless WebP;
it does not retain or publish the source file or generate responsive copies.
Automation may pass the source bytes on standard input by using
`--import-brand-mark=-`.

## Shared logo standard

Use `ThemeAwareLogo` from `@/components/ThemeAwareLogo` everywhere: landing,
sign-in/signup, onboarding/loading, and authenticated application surfaces.
Use `variant="full"` for the books + BRACK lockup and `variant="icon"` for the
existing standalone B on compact surfaces. Set height through the `size` prop;
the full logo's 4:1 aspect ratio supplies its width without distorting the art.

The shared CSS applies `--gradient-primary` with `--primary` as its fallback,
so palette previews, persisted palettes, and light/dark mode all use the same
silhouette. Signup inherits the live onboarding palette through the existing
theme context; the logo must never read storage or reset that choice itself.
Forced-color mode uses `CanvasText`. Do not add campaign-only components,
fixed-orange `<img>` logos, color filters, or duplicate light/dark assets.

The old landing PNG and `LandingBrandLogo` component are retired. Historical
art remains recoverable in Git, but should not be restored to runtime URLs.
The standalone mark and platform launcher icons were not redesigned.
Artwork provenance and the exact editing prompts are in
[`assets/brack-wordmark-provenance.md`](../assets/brack-wordmark-provenance.md).

To import a replacement transparent high-resolution wordmark:

```sh
node scripts/optimize-media-assets.mjs --import-brand-wordmark /path/to/wordmark.png
```

For a flat black-on-white master only, add `--wordmark-ink-mask` to encode ink
coverage as actual alpha. This clears page bands and letter counters as well
as the background. Do not use that option for colored or checkerboard artwork.
The importer contains the trimmed art within 1024x256, reserves a transparent
edge, and produces one lossless WebP. Routine runs validate it without
recompressing it; raw generated masters remain outside the repository.

## Other media

Required browser and native PNG formats are optimized losslessly when a smaller
byte-identical-pixel encoding is available. The landing background video is a
quality-controlled canonical: routine runs validate its MP4 container and a
5 MiB ceiling without transcoding or recompressing it. ICO, ICNS, and other
required formats are likewise inventoried and budgeted. The
Capacitor web directories under Android and iOS are ignored build mirrors; run
the normal Capacitor sync after changing public assets.

The two `public/landing-page` Library PNGs are deliberate marketing exceptions
that preserve small interface text exactly. The pipeline optimizes them in
place. Product UI must select only the active light or dark capture at runtime
and must use `contain` so screenshots are never cropped. Logos have no marketing
exception: public and authenticated screens share the canonical wordmark mask.

The additional landing artwork uses optimized WebP: a 1600px sunset photograph
with an 800px mobile source, plus two 640px illustrations with genuine alpha.
The photograph is loaded eagerly with high fetch priority; the book sculptures
load lazily with explicit dimensions. They add approximately 187 KiB in total
to the static inventory, and a visitor downloads only the applicable hero
source. Sources remain in the external generated-images archive. Exact prompts,
tool provenance, paths, and encoding details are recorded in
[`assets/landing-artwork-prompts.md`](../assets/landing-artwork-prompts.md).

Repository-owned raw PNGs, obsolete media, and unmanaged public PNGs are
rejected so they cannot silently return. User-uploaded JPEG, PNG, and WebP
stills are normalized separately in the client before supported Storage uploads:
their long edge is bounded, metadata is removed, and the stored MIME type and
dimensions match the encoded object. Animated images and videos remain
byte-preserving and subject to their existing upload limits; server-side video
transcoding would be a separate ingestion concern.

Platform launch tiles are not interchangeable with in-app branding. iOS app
icons and Apple touch icons must be opaque, while Android adaptive icons require
an opaque background layer and a transparent foreground layer. PWA maskable
icons likewise retain an opaque safe-area canvas. Those platform-required files
remain derived outputs even when they depict the same Brack mark; only in-app
branding is required to be background-free.
