# Social destination fixture

CR06a / RC-03 uses actual Readers, Feed, PostDetail, UserProfile, BookClubs, BookClubDetail, Reviews, ReviewDetail and BookDetail. Production Router, FeatureGate, layout, navigation, typography, theme tokens and target cards stay real. Data/auth/feature flags/native/local repositories and unrelated feature hooks are controlled through the explicit aliases in vite.config.ts. No live service writes.

From the repository root in PowerShell:

```powershell
$env:CR06_RUN='cr06-review'
npx playwright test --config tests/playwright/social-destinations.config.ts
npx tsc -p tests/playwright/tsconfig.social-destinations.json --noEmit
```

Port 8099 is isolated; each CR06_RUN preserves an independent JSON report and failure traces. One worker tests Chromium, WebKit and Firefox. Real font faces must load for visual checks; external font access is required, as in the renderer's HTML entry. Synthetic media uses an existing local brand asset, not representative cover artwork.

`?text=200` enlarges the root font to 32px; this is text reflow evidence, not physical OS text scaling or browser zoom acceptance. `?theme=dark`, `?palette=...` use the existing theme fixture. `?social=off` exercises production FeatureGate. Catalog and Dashboard are explicitly outside-fixture receipts. Tests only claim href/query or redirect behavior for those routes; they do not claim destination composition.

Sources and observed failures/results belong in [checkpoint26](../../../docs/frontend-renewal/26-social-destinations.md), not in generated Graphify/Obsidian notes. These bounded results cannot close whole F02/F14, legal accessibility, physical native, performance or service acceptance.
