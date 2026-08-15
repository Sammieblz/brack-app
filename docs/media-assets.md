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
  light/dark/orange raster copies are neither needed nor allowed. The wordmark
  canvas is trimmed to its 418x123 alpha bounds rather than retaining empty
  square padding.
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

## Other media

Required browser and native PNG formats are optimized losslessly when a smaller
byte-identical-pixel encoding is available. The landing background video is a
quality-controlled canonical: routine runs validate its MP4 container and a
5 MiB ceiling without transcoding or recompressing it. ICO, ICNS, and other
required formats are likewise inventoried and budgeted. The
Capacitor web directories under Android and iOS are ignored build mirrors; run
the normal Capacitor sync after changing public assets.

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
