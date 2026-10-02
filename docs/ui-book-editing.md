# Book metadata editing

This is the source contract for the S08 Edit Book child of F11. It describes implemented ownership and persistence behavior, not browser, native-device, assistive-technology or synchronization acceptance.

## Entry and presentation

[`App.tsx`](../apps/client/src/App.tsx) routes `/edit-book/:id` to [`EditBook`](../apps/client/src/screens/EditBook.tsx). Live entry points are Book Detail's **More > Edit book** and MyBooks' `handleEditBook`, passed through its grid/list actions, carousel preview and bookshelf selection/detail surfaces. All reach the same editor. The older `components/BookCard.tsx` also contains an edit link, but no production importer was found; it is not additional live coverage.

`EditorFrame` supplies contextual Back to `/book/:id`, with a Library fallback when no ID exists. The form has Book essentials and Reading details first, then native **Edition and series**, **Cover image**, and **Notes and tags** disclosures. Save Changes and Cancel remain in normal document flow. [`book-editor.css`](../apps/client/src/components/reading-progress/book-editor.css) adapts the same inputs to available width; a responsive header change does not replace the form, textarea, dates or upload owner. Theme tokens and established font roles remain in use.

## Loading and owner identity

`EditBook` mounts `OwnedBookEditor` only for resolved authentication and a book ID, keyed by reader and book. `OwnedBookEditor.readBook` reads `booksRepo.get` first and requires matching book ID, matching `user_id` and no deletion marker. A valid local book is editable offline. An invalid local owner/deleted record is rejected rather than replaced with a remote response.

Only a missing local book uses connected `fetchBookById`; the returned identity and deletion state are checked before `upsertRemoteManyPreservingLocal`. The authoritative returned local record is checked again. Read generations reject obsolete responses before remote fallback or hydration. Loading, unavailable/authentication and retry states remain distinct. This editor does not refresh an already loaded local book from a background remote response.

Authentication loading, reader changes, book changes and unmount end the old in-memory task. Epoch checks suppress its late upload/save feedback and navigation. Already-issued repository or storage requests are not cancelled.

## Metadata and validation

[`bookEditor.ts`](../apps/client/src/lib/bookEditor.ts) owns `createBookEditorDraft`, `buildBookEditorPatch`, `validateEditedBook` and conflict reconciliation. The draft preserves raw numeric strings. Page/chapter/series-total values must be safe whole numbers of at least one or blank/null. Current page accepts a nonnegative safe integer; blank means zero. Series position accepts nonnegative half-book increments, including zero. Fractions in integer fields, exponents and unsafe values are rejected rather than truncated. Rating supports no rating or 1 through 5. Title remains required.

The shared [`DatePicker`](../apps/client/src/components/ui/date-picker.tsx) retains canonical date-only values, invalid typed drafts and paired bounds. Start cannot be after finish or today; finish cannot be before start or after today. Invalid picker drafts block submission. Clearing an optional date commits null. Follow [the date contract](ui-date-pickers.md); do not introduce a second parser.

Only changed fields are submitted against the editor's baseline. An unrelated title edit therefore does not submit the opening current-page/status/date values. The save adapter merges that patch with the latest local book. If current-page/total-page or date bounds now conflict, `BookEditorValidationError` carries the current record: untouched fields are updated to that record, edited fields remain, and the reader can correct the visible conflict. Validation opens the relevant disclosure and focuses the first invalid field.

Metadata changes do not create reading activity, stop a timer, award rewards or infer completion/start dates. A page change here does not automatically change status. [Reading capture and quick correction](ui-reading-capture.md) retain their separate domain rules. Save Changes also includes a nonempty tag still being typed; Enter/Add tag adds it explicitly, and named Remove controls remove individual tags.

## Media, pending work and Back

The existing `ImagePickerDialog` owns camera/library selection and returns focus to Choose Image. `BookEditorForm.uploadCover` owns the upload through `uploadPublicStorageFile`. While uploading, other metadata can still be edited; a functional draft update applies only the returned cover URL. Cover replacement/removal and Save are unavailable during upload. The previous successful cover remains until replacement succeeds.

A failed upload retains its selected preview and offers Retry cover upload or Remove selection. Save remains blocked until that selection is resolved. A successful URL is retained for a later metadata-write retry. Upload requires connectivity; it is not an offline attachment queue. Closing a draft does not delete uploaded assets, and this work adds neither upload cancellation nor abandoned-asset cleanup.

A synchronous guard prevents duplicate saves. Native fields and dates are disabled while saving; errors retain the draft with persistent inline feedback. `useUnsavedAppBack` protects changed metadata, pending tags, selected covers and invalid date drafts; pending save/upload consumes app Back, while dirty Back/Cancel offers Keep editing or Discard changes. These guards do not intercept browser history, arbitrary links, reload or process termination. Drafts are not crash-persistent.

## Local save adapter and boundaries

[`bookOperations.update`](../apps/client/src/utils/offlineOperation.ts) accepts optional `{ expectedUserId, isCurrent }`. EditBook supplies both. It checks task currency before/after authentication and local reads and immediately before writing. All callers reject a wrong-owner, deleted or mismatched-ID record and cannot reassign book identity/ownership. Only calls supplying `expectedUserId` receive editor cross-field validation against the merged latest record.

The other production update callers remain two-argument calls: `BookDetail.handleFinishBook` supplies its existing completion/page/date patch; `MyBooks.handleStatusChange` supplies status only. Their domain behavior is not routed through editor validation. AddBook uses `create`; create/delete and journal behavior are outside this change.

`booksRepo.upsertLocal` remains the existing local row/outbox durability boundary. After it resolves, cache invalidation, book events, background-sync startup and optional offline feedback are independently protected so ancillary failures cannot reject a confirmed save. EditBook reports saved on this device and returns to Book Detail; this is not remote acknowledgement.

The read/merge/write is not serialized against every concurrent window or writer, and task checks cannot revoke an already-issued commit. The optional guard does not retrofit task-generation ownership into callers that omit it. This work does not add metadata-write idempotency, exactly-once delivery, a new transaction coordinator or schema changes.

Source regressions live in `bookEditor.test.ts`, `offlineOperation.book.test.ts`, `EditBook.back.test.tsx` and `dateFieldContexts.test.tsx`. The execution checkpoint owns commands, results, visual evidence and remaining device/AT gates.
