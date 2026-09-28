# BRACK design system and adaptive component plan

Status: proposed frontend implementation specification informed by source review on 2026-09-27. Existing behavior is identified explicitly. This document does not claim a visual/device audit or WCAG conformance test has been completed.

## 1. Preserve the identity; fix the composition

Retain the theme system, theme-aware marks, chosen fonts and Iconoir. The redesign should be recognized through books, reading progress, typography, spatial hierarchy and consistent controls. A framework replacement alone will not create that identity.

Verified anchors:

- `apps/client/tailwind.config.ts:23`: Inter for UI, Playfair Display for display headings, Merriweather for book/reading content, existing system monospace for timers/numbers. Existing 4px spacing scale and 44/48px control sizing are useful foundations.
- `apps/client/src/contexts/ThemeContext.tsx:36`: theme surface styles include standard, paper, glass, comic and coloring-book; `lib/themes.ts` owns registered palettes. Keep mode/palette persistence, guest behavior and account transitions.
- `apps/client/src/components/ThemeAwareLogo.tsx`: shared logo mask uses `config/brackAssets.ts`; keep theme treatment and existing logo tests. Do not generate replacement brand art or put default Ionic icons in app navigation.
- `docs/design/iconography.md`: semantic icon registry at `config/iconography.ts`, `AppIcon` wrapper and restraint around decorative icon tiles. Preserve this contract; visual icon size and hit area are separate concerns.
- `components/ui/button.tsx`: existing semantic/Radix-slot foundation and minimum sizes, but global `transition-all`, hover displacement and default haptics require review.
- `components/ui/mobile-dialog.tsx`: one existing adaptive drawer/dialog wrapper, selected only by `useIsMobile`; adapt its boundary rather than creating unrelated wrappers in every feature.
- `components/ui/date-picker.tsx`, `date-picker-calendar.tsx`, `lib/dateOnly.ts` and `docs/ui-date-pickers.md`: active date controls already include custom direct year/month navigation, text entry, validation and accessibility work. This is an asset to preserve, not an untouched generic shadcn calendar.

## 2. Component ownership

The target has four responsibilities, without requiring a monorepo-wide move:

| Responsibility | Current/proposed location | Owns | Must not own |
| --- | --- | --- | --- |
| Tokens and identity | Existing theme/Tailwind/icon/asset modules; small token additions if needed | Semantic colors, typography, space, shape, motion roles | Feature data requests, native runtime events |
| Accessible primitive | Existing `components/ui` | Input semantics, focus, keyboard, state presentation | Reading-domain business rules, duplicate focus traps |
| Adaptive surface | Proposed small `components/adaptive` boundary or an evolved existing wrapper | Sheet/dialog/popover choice, platform interactions, dismissal intent | Copies of form schemas, mutations, authorization, date parsers |
| Product composition | Existing feature component folders; migrate only touched feature files when useful | Book row, progress editor, reading session, goal summary, list editor, feed composer | Direct Capacitor calls or global routing policy |

Do not export everything into a new package just to make the tree look tidy. `apps/client` already provides shared UI to mobile/desktop shells. Extract a workspace UI package only if a second independent consumer creates a concrete need. Keep public imports stable with temporary re-exports for incremental moves; remove them when the caller migration is complete.

Every new reusable component must name its product responsibility, document supported states and have at least two plausible consumers or a clear platform boundary. Otherwise keep it feature-local. Avoid a huge `AdaptiveAnything` prop surface.

## 3. Primitive retention and adoption decisions

Keep Radix/shadcn foundations where behavior is good; rewrite styling/composition deliberately. Custom does not mean hand-writing focus traps, menu keyboard navigation or date arithmetic. The [Ionic components](https://ionicframework.com/docs/components) are candidates for platform behavior, not a requirement to replace every HTML control.

| Surface | Planned visual/behavior owner | Mobile/tablet approach | Web/desktop approach | Migration gate |
| --- | --- | --- | --- | --- |
| Page/header/scroll | Shell adapter | Ionic page/content/header if coherent route-shell gate passes; otherwise evolved current shell | Existing semantic shell with shared tokens | Preserve single scroll owner and measured header contract |
| Primary navigation | One navigation model | Anchored branded tabs on native/PWA; tablet tabs/rail | Browser drawer/rail/sidebar per platform plan | Same destinations, history and feature gates |
| Dialog/sheet | One adaptive surface | Ionic modal candidate or existing accessible drawer; content-sized and keyboard-safe | Radix dialog or anchored side panel | One portal/focus owner; dismissal and resizing tests |
| Action menu | Adaptive action menu | Reachable sheet with verbs and separate destructive group | Radix menu/popover with visible trigger | No long-press-only actions; icon + text where helpful |
| Date field | Existing date-only composite | Branded accessible sheet; IonDatetime only after complete parity spike | Current text field + popover calendar | Historical-date, keyboard, timezone, validation and consumer contracts |
| Calendar/history | Domain calendar | Branded month/list view emphasizing reading activity | Wider calendar and accessible activity list | Not a generic input picker; data text equivalent and timezone semantics |
| Form input/textarea | Existing semantic primitives | Comfortable field height, proper inputmode/autocomplete, native keyboard | Same model and labels, pointer/keyboard refinement | No blanket native-plugin dependency |
| Select | Task-specific adaptive select | Native HTML select where it handles options well; searchable sheet for long data sets | Native select or accessible combobox/popover | Existing Journey WebKit native-select fix remains |
| Tabs/segments | Semantic view switcher | Few labelled local views, scroll only if needed | Tabs or segmented control | Do not apply tab semantics to route navigation links |
| Swipe rows/reorder | Feature surface + gesture owner | Ionic sliding rows candidate; keep existing verified direction/click guards until migrated | Visible row actions and keyboard reorder | One transform/gesture owner, undo/fallback |
| Toast/status | One feedback coordinator | Short accessible feedback clear of tabs/keyboard | Same status intent, appropriate placement | Do not simultaneously announce equivalent feedback through multiple systems |
| Book/progress/list/feed components | BRACK composites | Content-led, reachable task action, grouped secondary detail | Adapt information density and pane layout | Preserve existing domain operations and accessible interaction contract |

[Ionic modal documentation](https://ionicframework.com/docs/api/modal) describes sheet configuration, focus handling and controlled dismissal. Selecting it does not exempt BRACK from validating nested controls, dirty drafts, screen-reader reading order or large text. Do not nest an Ionic modal and a Radix dialog for one surface.

## 4. Visual rules for the implementation

### Hierarchy and density

Each screen first exposes its title, the content relevant to the task and one dominant local action. Passive totals, achievements, promotional art and management actions cannot all compete in the first viewport. Secondary information should use a labelled details group, overflow menu or focused drawer, while active state remains visible.

- Prefer list rows and section spacing over a card around every item. Cards indicate a coherent group with a meaningful boundary, not automatic decoration.
- Keep surfaces calm by default. Use brand color for selection, progress and primary action; neutral surfaces carry content. Glass/paper/comic themes can express their style without changing target geometry or semantics.
- Remove redundant gradients, glow layers, double borders and elevation from routine shell controls. Do not remove intentional theme surface identities globally.
- Use a consistent layout rhythm from existing tokens: tight related content, larger section gaps. Initial compact gutters 16–24px based on available width and readability; never enforce 24px if it makes a 320px form unusable.
- Avoid all-caps or tiny low-contrast metadata for essential state. Status and progress must be readable in every theme. Long book titles wrap; accessible names retain full content even if a visual secondary line is truncated.
- Root headings can use the display font; dense control labels and forms use Inter; reading excerpts use Merriweather. Large title decoration must not push the main action off a short screen. Keep numeric timer layout stable.
- Reuse semantic tokens (`background`, `foreground`, `card`, `primary`, `muted`, `border`, `ring`, destructive/status roles). Add a token only for a repeated semantic need; no feature-local palette copy.
- Explicitly test forced colors and system contrast. Focus cannot depend only on shadow, translucent fill or a palette's primary tint.

### Reach and target sizing

Use at least the existing 44px target baseline for essential touch controls, with approximately 48px for frequent or critical touch actions where space allows. These are BRACK design targets, not a statement that every accessibility law mandates them. Small visible Iconoir marks can sit inside larger transparent hit areas without adding decorative boxes.

Control text may wrap when needed; avoid fixed heights and `whitespace-nowrap` at large text where clipping results. Keep Save/Cancel separated, show destructive actions with text and explicit meaning, and preserve visible keyboard focus. Input errors appear by the field and in a useful form summary for long forms; no placeholder-only labels.

### State inventory

Every migrated composite documents only states its data can actually reach: initial load, cached/background refresh, empty, filtered empty, error/retry, offline available, pending local change/sync, success, disabled with explanation, selection/reorder, validation and unavailable/deleted data. Do not add fake offline functionality to a remote-only flow; explain its real limit and preserve drafts when possible. No database/schema work is part of this visual renewal by default.

Loading placeholders reserve the final structure and target geometry. Background refresh does not wipe content. Immediate local operations get quiet confirmation, while pending network work keeps context and retry. The motion/feedback plan defines timing and announcement coordination.

## 5. Adaptive surfaces and decluttering

Choose surfaces by duration, complexity and persistence:

| User intent | Surface | Content and dismissal contract |
| --- | --- | --- |
| Choose one of a few secondary actions | Action sheet/menu | Explicit title/object context, action verbs, visible Cancel/Close; destructive group separated |
| Adjust filters/sort/view | Focused filter sheet/panel | Show current selection; Apply only if commitment is meaningful; Clear and active count visible; preserve state on resize |
| Log short progress | Reachable focused sheet or inline editor | Current value/unit, validation, single commit; keyboard does not cover commit; offline semantics unchanged |
| Create/edit substantial book/list/post | Route or spacious task surface | Draft ownership, labelled fields, visible save state, guarded discard; don't squeeze a long form into a tiny half-sheet |
| Inspect metadata | Collapsible details section or read-only panel | Summary visible; open state restored when useful; no hidden required information |
| Confirm destructive change | Alert dialog or focused confirmation surface | Clear object, consequence and safe cancel; use undo only if underlying operation supports it |
| Read book/post/review details | URL route, with optional tablet pane | Stable address, Back fallback and content hierarchy; a preview can exist but must offer full detail |

Overlay API intent should include labelled title/description, controlled open state, dismissal reason, initial/return focus, dirty-state veto and optional size preference. Feature components own draft/validation and decide whether dismissal loses work. Do not make every overlay wrapper invent save/discard logic.

For rotation or breakpoint changes while open, keep the same form state outside the presentation switch. Prevent two focus traps mounting simultaneously. If a presentation remount is unavoidable, restore the corresponding focused field after the new surface is ready without triggering duplicate submit/change callbacks. Back, Escape, drag, close button and backdrop follow the same dismissal policy.

Existing `DismissableSheetContent` (`components/ui/dismissable-sheet.tsx`) has internal `open` state changed by its pull callback without passing that state to the parent Radix root; `GoalsSheet.tsx` controls the root separately. Treat this as a source-level dismissal ownership defect to reproduce and correct during overlay consolidation. Do not retain a visual pull-away that leaves the actual modal open. Also review its blanket autofocus prevention and nested overflow against the accessibility contract.

## 6. Date picker and calendar specification

Read [the existing date-picker contract](../ui-date-pickers.md) before editing. Keep one canonical parser and one active field API. `Calendar` is a low-level DayPicker v8 wrapper; `DatePickerCalendar` supplies the active historical-date behavior. A class in the generic wrapper alone does not prove the actual date field has that class's target size because the composite overrides it.

### Preserve exactly

1. Domain values remain Gregorian `YYYY-MM-DD` or `null`; real session/event timestamps remain instants. No schema migration and no mass record rewriting.
2. Strict locale-aware typing with an explicit format hint and unambiguous ISO alternative. No guessed day/month swap, two-digit-year acceptance, rollover date or silent invalid-draft reset.
3. Fast year/decade, month, then day selection. Browsing month/year never commits a value. Optional clearing commits null; required fields remain distinguishable.
4. Field-specific inclusive bounds: DOB cannot be future; book dates obey today and paired range; goal dates allow historical/future deadlines and paired ranges. No invented age rule or arbitrary application-wide 1900 minimum.
5. `onValidityChange` continues to block owning Save/Next/autosave for invalid drafts; preserve personal-info location autosave guards.
6. Calendar-grid keyboard behavior, full spoken dates, visible focus including Firefox fallback/forced colors, focus return and restrained announcements. Do not remove the custom DayPicker v8 `AccessibleDay` renderer assuming `labels.labelDay` suffices.
7. Local-today/date-only helpers, leap years, DST, offset compatibility and rare skipped civil-date behavior remain tested.

### Improve presentation

- Use a clear field label, visible value, brief format guidance and one calendar trigger. The active theme controls selected day, focus, surface and separator; selected/today/range/disabled states have more than color alone.
- The compact/medium touch sheet contains a concise heading, a clear year/month navigation hierarchy, calendar grid and always-reachable close/clear/today controls only where relevant. At short height or large text, allow surface scrolling without clipping; do not shrink days below the target baseline.
- Desktop uses an anchored bounded popover; tablet can use a constrained sheet/popover according to space, maintaining the same accessible behavior and value semantics.
- Do not introduce a new Confirm transaction merely for visual symmetry if existing day selection commits immediately. A staged range workflow would be a separate explicit domain requirement with Cancel semantics and tests.
- Keep typed entry usable for screen-reader, keyboard and users who cannot operate a grid. The native input compatibility component does not become the active DOB control unless native UI parity is established on real systems.

### IonDatetime comparison gate

[Ionic Datetime](https://ionicframework.com/docs/api/datetime) offers date/time presentations and configurable interactions. Evaluate a date-only adapter in a fixture, not a product-wide replacement. It must pass every preservation item above, including rapid historical years, typed alternative, correct bounds and draft behavior, accessible labels/focus, exact date-only persistence and all theme modes. Do not convert a date-only value into a UTC instant to satisfy a timestamp-looking API. If any essential parity is missing, retain the current date composite and improve its shell/visual hierarchy.

### Reading calendar is separate

`components/StreakCalendar.tsx` is a reading-activity view, not a date input. Give it month context, a readable legend, concise day summaries and a corresponding chronological list/table for assistive technology. Selecting an activity day opens existing relevant history where supported; it does not silently alter streak dates. Distinguish no activity, loading, unavailable and future dates. Use date semantics already owned by reading history; never reuse a calendar-date parser to truncate event timestamps blindly.

## 7. BRACK product composites

| Composite | Always visible | Progressive detail | Tablet/desktop adaptation |
| --- | --- | --- | --- |
| Book row/card | Cover, title, author, status, meaningful progress, primary open action | Secondary metadata and management actions in labelled action surface | More metadata where readable; same activation contract |
| Continue reading | Current book, elapsed/current progress and resume/log action | Session history or goal relationship | Compact supporting pane, never a giant decorative card |
| Goal summary | Plain-language target/time period/progress | Breakdown and editing | Wider comparison if useful; same core semantics |
| List editor | List name, selected books, primary save/create | Description, privacy and management in clearly labelled groups | Search/books beside selection if it fits |
| Feed composer | Author context, text field, intended audience, submit state | Attachments/options grouped | Comfortable writing width with retained draft |
| Achievement/reward | Outcome and permanent progress state | Rich celebration/history on deliberate reveal | Same outcome accessible without motion/sound |
| Settings row/group | Label, current value and effect | Advanced explanation or focused child page | Category/detail panes only when minimum widths fit |

Honor [the current Library interaction contract](../ui-library-interactions.md): one primary control, sibling secondary actions, retained text selection, explicit selection/reorder modes, pointer drag suppression and focus restoration. Preserve Flat, Bookshelf and Carousel views. Reworking chrome is not permission to remove chosen reading representations or alter data operations. Do not animate the hit target away from a reader during selection.

## 8. Token and theme migration

1. Inventory all registered palette and surface-style combinations, semantic colors, typography roles and existing control variants. Capture a small fixture with real book rows, field errors, progress, disabled controls, navigation, date picker, sheet and long text.
2. Document any failing contrast/state combination with measured colors and component state; fix semantic mapping, not one screenshot by hardcoding white text. Preserve intentional palette identity and theme mode persistence.
3. Introduce only necessary shared surface/spacing/action roles. If Ionic is adopted, bridge BRACK tokens into its CSS variables/parts in one adapter; never redefine every theme inside Ionic separately.
4. Consolidate button/input/menu/sheet behavior in small slices, migrating the relevant consumers and keeping imports stable. Native haptics become explicit semantic events rather than every generic button press.
5. Verify system font scaling and reflow with these actual fonts. [Ionic dynamic font scaling documentation](https://ionicframework.com/docs/layout/dynamic-font-scaling) is relevant only to the installed Ionic version; importing it does not automatically prove BRACK's custom content scales correctly.
6. Remove superseded variants/wrappers only after all callers are migrated and relevant behavior tests pass. Record deprecation owner and exit criterion; avoid permanent parallel design systems.

## 9. Component-level acceptance evidence

For each migrated primitive/composite, record the implementation owner, old callers, new callers, states, runtime variants, applicable existing contract and completed validation. Required checks depend on the change:

- Theme fixture: supported palettes/surface styles, light/dark, forced colors, selected/error/disabled/focus states.
- Layout fixture: 320px compact, common phone, medium tablet, expanded tablet, narrow browser/Electron window; portrait/landscape; 200% text, 400% zoom/reflow where applicable; long localized labels.
- Interaction: touch, pointer, keyboard, cancel/interrupt, nested overlay focus, visible fallback for gesture action, state retention while resizing.
- Semantics: label/description/error association, native button/link behavior, current/selected states, appropriate live announcement and reading order.
- Device: real VoiceOver/TalkBack, keyboard occlusion, safe areas, system Back and native plugin failure where involved. DOM assertions are useful evidence but not replacements.
- Contract regression: existing date-picker, shell-scrolling, loading and Library fixture suites plus relevant unit tests. Do not rewrite tests merely to bless changed behavior; explain intended contract changes.

Keep tests meaningful: pure visual token edits need focused visual/contrast/reflow review, while changed navigation, parsing, gesture or dismissal semantics require behavioral tests. This planning pass did not run those suites or certify those devices. Implementation handoff must report precisely which checks passed and which remain unverified.
