# Journal editing and local save contract

Implemented behavior for frontend renewal F01. Actual verification and the current review checkpoint live in the [implementation tracker](frontend-renewal/13-implementation-tracker.md). This document describes the renderer contract, not native-device or remote-sync certification.

## Ownership

- `JournalEntriesList` owns the full editor's selection and local list presentation.
- `JournalPromptHandler` queues reading-session prompts behind the current quick editor and clears presentation context when the authenticated account changes.
- `useJournalEditor` owns draft state, picking/uploading, pending writes, discard, session identity and success feedback for both editors.
- `useJournalEntries` owns journal list reads and success-bearing mutations. The local journal adapter owns durable repository/outbox writes. Components do not call a database directly.

## Save and failure

`addEntry` and `updateEntry` return `{ entryId, savedLocally: true }` only after the local repository/outbox mutation resolves. A precommit failure rejects. A successful save is not a claim that the server or another device has received the entry. Editors announce that the entry was saved on this device and will sync automatically.

Fields and rich-text formatting lock while a save or photo operation is pending. The pending lock changes synchronously so repeated activation cannot submit a second write, including through a component remount. Failed saves keep title, formatted text, tags, page reference and photo selection for retry. Follow-up list/status refresh failure does not convert an already committed save into a retryable create. Online list refresh uses the existing preserve-local repository operation and retains unsynced creates, edits and deletion tombstones against stale remote snapshots.

The quick editor closes immediately after confirmed local success. Decorative success timers must not delay closure or close a later editor session.

Preserve-local hydration checks and writes must be atomic. `LocalDriver.upsertRecords` accepts `{ preserveUnsynced: true }`; web uses a single Dexie write transaction, and SQLite adapters use a conditional conflict update. A repository-side read followed by an unconditional bulk write is insufficient: an editor may commit between them. Ordinary sync acknowledgement paths keep their existing unconditional behavior. A reread must never return another account's cached data on an ID collision.

## Draft and dismissal

Drafts are scoped to authenticated account, book, entry (or new entry), and full/quick editor kind. Close/Escape/outside interaction and Cancel/Skip request discard when there are unsaved changes. The confirmation is inside the existing dialog focus scope. Keep editing returns focus to the content editor. Pending work blocks dismissal. Clean cancellation requires no confirmation.

Dirty/pending sessions survive React/route unmounts in process memory. They are consumed after successful save or explicit discard; a later opening of a clean existing entry adopts its latest saved data. This is **not durable draft storage**: browser reload, process termination and application restart are not covered. A browser unload warning is registered while a dirty/pending editor is open; hidden retained drafts have no unload warning. Future durable recovery needs explicit storage/retention/privacy requirements.

Account changes mask another reader's draft. Late attachment results cannot modify a different account, book, or editor opening. Pending save results still settle their original session, without announcing success or closing an unrelated editor.

## Attachments

Picking/uploading blocks saving until the operation settles. Replacement uses a unique storage path. The existing photo reference and preview remain valid if picking, upload or save fails. Remove photo sends explicit `null`, including through outbox serialization.

The editor never deletes a saved attachment during selection, replacement, discard, or local commit. Remote references may still need it until synchronization completes. Replaced or abandoned uploads can remain in storage; cleanup requires a separate sync-aware reference/ownership contract and is not part of F01.

## Accessibility and presentation

Visible labels identify title, content, page and tags. TipTap exposes a multiline textbox and becomes truly noneditable while pending; disabling an HTML fieldset alone does not disable contenteditable. Programmatic initialization and editability changes do not emit draft changes. Inline failure uses an alert; actual save/photo progress uses status feedback. Signed-out/unavailable states have specific text instead of a false upload indicator and retain an available exit.

The full editor's Add/Edit invokers receive focus before opening so focus restoration works with Safari pointer behavior as well as keyboard activation. Dialog height is limited by the dynamic viewport and contents can scroll. Existing themes, fonts, icons and accessible dialog foundations remain in use. OS Back, native picker/keyboard, VoiceOver/TalkBack, zoom and the broader composer redesign still require their dedicated implementation/device checks.

## Regression entrypoints

- [Browser fixture and commands](../tests/fixtures/journal-save/README.md): real editors, list, save hook, TipTap and dialogs; synthetic reader/service boundaries.
- `useJournalEditor.test.tsx`: deferred writes/uploads, session lifetime, identity, discard and late callbacks.
- `useJournalEntries.mutations.test.tsx` and `offlineOperation.journal.test.ts`: mutation outcome, rich text, null clearing and local hydration.
- `JournalPromptHandler.test.tsx`: prompt ordering and account isolation.
- Existing `useJournalEntries.loading.test.tsx`, `NestedReaderLoading.test.tsx` and local repository tests protect prior loading/persistence behavior.

Browser fixture passes do not prove live Storage, native SQLite/IndexedDB durability, server acknowledgement, assistive technology or process-death recovery.
