# Settings task ownership

The [CR03 checkpoint](frontend-renewal/23-settings-continuity.md) records implementation and actual verification status. This contract does not close F16's remaining visual, accessibility-preference or device acceptance work.

## Category and responsive ownership

`Settings` owns one active category, selected by `?section=`. `/settings` opens the category index; an explicit `?section=account` opens Account. Existing Profile, Personal Info, Reading Profile, Data & Backup, App Preferences, Notifications and Privacy links remain valid. `?section=support` retains its Support redirect. Category changes preserve unrelated query parameters and replace the current Settings entry rather than adding a Back entry for every choice.

Below 1024 CSS pixels, selecting a category opens its focused editor, with an explicit All settings action. At expanded widths the category navigation sits beside that same editor. Resizing changes presentation, never the editor's React position or key. Inputs, caret, import File and preview, and open nested pickers remain owned by the selected category. Intentional category departure unmounts that editor; this is not cross-route draft storage. Browser Back/Forward and reload retain browser ownership.

`SettingsTaskProvider` owns the departure confirmation and registers with the existing app Back coordinator. `useSettingsTask` reports dirty/pending state through a live reader; `useSettingsLeave` protects category changes and local task destinations. Pending work consumes departure. Dirty work offers Keep editing or Discard changes. Route/account/auth-resolution changes invalidate deferred acceptance and withdraw this Settings-owned confirmation. Standalone consumers outside Settings receive no new global navigation interception.

The same optional context protects actual shell links in ProfileDrawer, AppSidebar and MobileBottomNav while Settings owns the route. Modifier/new-tab link behavior remains browser-owned. Shell sign-out delegates to the Settings confirmation/transaction owner rather than bypassing it. Other routes keep their existing navigation behavior. After an accepted departure the confirmation must not restore the old invoker over the destination's focus; declined departure still restores its invoker.

Basic accessibility stays active without a preference. Category buttons have explicit names/current state; selection focuses the editor heading and returning to the category list focuses its prior button. A width-only transition must not move editor focus. Notification time fields retain native input semantics; the date picker retains its established parsing and open-session primitive policy.

## Draft and outcome contracts

| Category | Ownership and failure behavior |
| --- | --- |
| Account | Same-reader user-object refresh preserves password fields. Password submit has one pending owner through reauthentication/update; failed requests retain fields, obsolete reauthentication cannot start a password update. Existing CAPTCHA and provider rules remain. |
| Profile | Basics save acknowledges the submitted baseline without refetching over another draft. Photo selection/upload/update is one pending operation; a failed photo remains available for retry. A new avatar reference is confirmed before old storage cleanup. Cleanup failure is logged separately from confirmed success. Photo updates do not overwrite unsaved display name/bio. |
| Personal Info | Save and location permission → geocode → existing autosave are serialized; fields remain unavailable throughout. Date validation and coordinates retain existing rules. Failed save retains draft and inline error. Leaving an account stops later device/API continuations. |
| Reading Profile | Reading fields and keyboard-operable genre choices use a saved baseline. Pending blocks Save/Cancel/departure; failed Save retains editing and an inline error. Cancel discards only after approval when dirty, and restores the saved baseline without refetching. |
| Data & Backup | File, passphrase and import preview stay in one task. Controls freeze through parse/preview/commit/export. Failed commit retains the File and preview for retry; confirmed import clears them and the input. Existing merge and local/outbox services remain authoritative. |
| Notifications | Quiet hours and preference drafts share one saved baseline. Device registration is a separate outcome from confirmed preference persistence. Pending locks controls; failure remains visible without losing the draft. |
| Privacy | Immediate changes serialize and roll back the failed choice. A confirmed online-visibility write is not rolled back because presence refresh failed. Switches and status selector expose names. |
| App Preferences | Existing theme palette/mode remain immediate; mode buttons expose pressed state. No fake screen-reader setting is added. |

Sign-out has a named confirmation, safe Cancel, pending protection, explicit failure/retry and connected trigger restoration. It does not reuse a synchronous confirmation callback that closes before the request settles.

## Image and shared-surface boundary

ImagePickerDialog uses the existing adaptive MobileDialog, one selection owner per opening, and ignores obsolete image results after close/unmount. Pending selection blocks dismissal. The web hook awaits the browser chooser promise before clearing `picking`. Its camera/device APIs and permission behavior are unchanged. Photo handoff completes at selection; each consuming form still owns upload/save failure and retry.

MobileDialog accepts an optional connected return-focus ref. Existing callers without one keep their current focus contract. SupportPageLink accepts optional `beforeNavigate` for Settings departure protection while preserving its existing web/native destinations and browser modifier-link behavior.

Shared consumer review includes ImagePickerDialog in Profile, EditBook, ProgressLogger and ProfileSettings; direct useImagePicker also serves journal media. These shared changes do not close those screens' separately tracked editor/upload issues. Real native permission sheets, IME, OS Back and assistive technology require device evidence.
