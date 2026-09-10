# Landing artwork

Generated for BRACK on 2026-09-09 with the built-in `image_gen` tool. No CLI fallback or external image API runner was used.

Only optimized WebP assets are checked into the repository. PNG masters remain outside the repository in the local generated-images archive:

`C:/Users/Samuel/.codex/generated_images/01a0888f-16af-7800-8f11-de679bea4236/`

| Runtime asset | Dimensions | Bytes | Source master |
| --- | --- | ---: | --- |
| `apps/client/public/landing-page/sunset-reading-hero.webp` | 1600 × 900 | 58,286 | `exec-f8918a3f-2153-4380-9fcc-4f975b928def.png` |
| `apps/client/public/landing-page/sunset-reading-hero-mobile.webp` | 800 × 450 | 21,170 | Same hero master |
| `apps/client/public/landing-page/reading-book-sculpture.webp` | 640 × 640 | 35,014 | `exec-2a927caa-a60e-466c-a3ec-58b233ac1f86.png` |
| `apps/client/public/landing-page/reading-circle-sculpture.webp` | 640 × 640 | 76,488 | `exec-0b7c52f1-dc68-4c36-920a-c461c4a4907e.png` |

The two sculptures retain their generated alpha channels; both include fully transparent and fully opaque pixels. The hero is opaque photography. Sharp performs resizing and WebP encoding only, with quality 84 for the desktop hero, 82 for the mobile hero, and 85 / alpha quality 100 for the sculptures.

Use the sunset photograph with a dark overlay and white text; its left half reserves room for the title. The sculptures are decorative supporting images, suitable for empty alternative text when adjacent copy communicates their meaning. Keep their rendered size modest and avoid placing functional controls inside the illustrations.

## Exact final prompts

### Sunset reading hero

```text
Use case: photorealistic-natural
Asset type: background photograph for BRACK's reading companion website, with white headline text over the left half added later in HTML.
Primary request: A convincingly real editorial photograph of an open clothbound book on an old wooden windowsill beside a quiet lake at sunset. A single book, no other props.
Scene/backdrop: A simple lakeside cabin window, late evening, calm water and a low softly defocused tree line outside. The sunset is subtle and natural.
Composition/framing: Wide 16:9 landscape photograph. Place the entire open book in the lower RIGHT quadrant, its warm ivory pages catching a little last sunlight. The LEFT 55% of the frame is quiet, dark defocused interior wood/window shadow with generous negative space for white title text. Do not center the book. Show enough of the warm lake view on the right to establish sunset. Natural 50mm photographic perspective and shallow depth of field.
Lighting/mood: Warm low sunset light, soft shadow, a calm real reading evening. Understated premium literary editorial photography.
Materials/textures: Real uneven paper edges, subtly worn terracotta cloth cover, believable wood grain. Pages may show faint defocused print texture but no legible text.
Constraints: Truly photorealistic. No people, hands, faces, readable text, titles, logos, watermark, framing border, lens flare, sparkles, exaggerated sunbeams, fantasy scenery, painted or 3D rendered look. No typography in image.
```

### Open reading book

```text
Generate a clean premium 3D illustration on a TRANSPARENT BACKGROUND, with a real alpha channel. This is a cutout asset for a warm book-tracking app website.
One open terracotta clothbound book with thick warm ivory paper, a single page gently curled upward mid-turn, and one orange ribbon bookmark. No text anywhere. Seen from slightly above in three-quarter view. Smooth, softly rounded sculpted edges, warm tactile matte finish, very subtle fine cloth texture, soft studio light. Cozy crafted storybook object with a little whimsy. Centered on a square canvas with generous empty transparent margins.
The silhouette must be immaculate and continuous, all edges clean and antialiased: no loose fibers, detached flecks, floaters, block artifacts, glows or shadows outside the object. No backdrop, no floor, no pedestal, no checkerboard pattern, no gray or white fill. Genuine transparent pixels outside the one book. Output as a transparent image, no border or watermark.
```

### Reading circle

```text
Use case: stylized-concept
Asset type: transparent cutout illustration for the reading circles section of BRACK's website.
Primary request: Three small tactile clothbound books leaned together like a friendly trio. One muted terracotta book, one muted sage book, and one deep ink-brown book. A single small blank cream note is tucked between the pages of one book.
Scene/backdrop: Genuinely TRANSPARENT background with real alpha; no opaque backdrop or checkerboard drawn into the image.
Style/medium: Premium tactile 3D storybook sculpture with soft rounded shapes, fine woven cloth, thick warm ivory page edges, quiet warm studio lighting. A collectible crafted object, warm and restrained rather than glossy toy plastic.
Composition/framing: Square 1024 x 1024 composition. Center the three closed books in a loose compact leaning arrangement seen at a three-quarter angle, naturally supporting each other. Clearly readable silhouette, generous transparent margins, one focused group.
Color palette: Muted terracotta, sage, deep ink brown, warm ivory paper. Warm highlights and gentle natural contact shading.
Constraints: Actual transparent alpha around the subject. No text, letters, titles, logos, faces, people, hands, watermark, pedestal, floor/background, particles, sparkles, glow, ribbons, or extra props besides the single blank note. Retain a calm cozy reading identity.
```

## Selection notes

Images were visually inspected after WebP encoding and alpha was checked with Sharp metadata and pixel statistics. Exploratory cleanup variants that returned opaque checkerboard backgrounds were rejected and were never included in public assets. The original generated masters are retained outside the repository for future art refinement.

