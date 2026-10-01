# F10c browser evidence

Baseline `b97119d`; current uncommitted implementation. Actual MyBooks and both previews, isolated APIs and local fixture records. Covers deliberately use the existing BRACK mark; these are not real library records.

## Visual comparison

| Surface | Before | After |
| --- | --- | --- |
| Phone bookshelf | [Before](before-composition-bookshelf-390-composition.png) | [After](after-composition-bookshelf-phone-composition.png) |
| Phone carousel | [Before](before-composition-carousel-390-composition.png) | [After](after-composition-carousel-phone-composition.png) |
| Tablet carousel | [Before](before-composition-carousel-834-composition.png) | [After](after-composition-carousel-tablet-composition.png) |
| Phone shelf preview | [Before](before-composition-bookshelf-390-preview.png) | [After](after-composition-bookshelf-phone-preview.png) |
| Paper shelf | No matched baseline | [After](after-composition-bookshelf-paper-composition.png) |
| Dark preview | No matched baseline | [After](after-composition-carousel-dark-preview.png) |
| Large-text reorder | No matched baseline | [After](after-shelf-large-text-movement-alternatives-stay-reachable-large-text-reorder.png) |

Six baseline captures and29 final Chromium captures are retained. Final composition tests assert Inter, Merriweather and Playfair Display loaded; baseline awaited fonts without the later face-status assertion. Before carousel previews were not captured: the test clicked the covered primary instead of its delegated content/native keyboard action. Those failures remain recorded rather than being treated as baseline passes.

Visual review inspected phone/tablet carousel, shelf, shared preview, dark/paper and200% text/movement states. Large-text captures intentionally include scrolled positions used to reach actions; they do not claim all content fits one viewport. The reconstructed preview puts actions before optional metadata and removes clipped full-title/description content; the carousel no longer nests two boxed card surrounds. Theme status colors/wood/physical cover identity remain.

These screenshots do not establish physical native behavior, screen-reader conformance, contrast across every registered theme, real cover-art rendering quality, large-library performance, or live offline/partial-write behavior. See [checkpoint30](../../30-library-modes.md) and verification.json for exact results and outstanding gates.
