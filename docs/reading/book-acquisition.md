# Book Acquisition, Search, And Barcode Scanning

Source date: 2026-06-19  
Scope: book search, manual add, barcode-to-library flow, provider gateway, and duplicate handling.

## Surfaces

Brack has three acquisition paths:

- `Search` tab in `apps/client/src/screens/AddBook.tsx`: user searches provider metadata, previews a result, then adds it.
- `Manual` tab in `apps/client/src/screens/AddBook.tsx`: user enters book details directly. The ISBN field includes a camera control that opens scanner-assisted ISBN entry.
- `Scan` tab and `/scan-barcode`: user scans an ISBN barcode, Brack resolves the exact book, shows a confirmation preview, then adds it directly to the library.

The direct scanner flow is implemented by `apps/client/src/components/BarcodeScannerFlow.tsx` and is reused by both the Add Book scan tab and `apps/client/src/screens/ScanBarcode.tsx`.

## Direct Barcode Flow

The release target flow is:

```text
Scan ISBN -> normalize/validate ISBN -> exact metadata lookup -> preview -> confirm -> add to library
```

Implementation path:

1. `BarcodeScannerFlow` starts `useBarcodeScanner({ videoRef })`.
2. `useBarcodeScanner` returns a validated ISBN string or `null`.
3. `resolveScannedBook(isbn)` canonicalizes the ISBN to ISBN-13 where possible and rejects invalid payloads.
4. `lookupBookByIsbn(isbn)` calls `searchBooks({ query: "isbn:<canonical-isbn>" })`.
5. `findExactScannedBookMatch` accepts only a provider result whose normalized ISBN matches the scanned ISBN.
6. The UI shows an in-place preview with cover, title, author, ISBN, pages, genre, provider, and cached/stale state.
7. `addScannedBookToLibrary(match)` checks local library duplicates, then calls `addBookToLibrary`.
8. `addBookToLibrary` invokes the protected `add-book` Edge Function and upserts the returned book into the local repository.

The scanner does not silently create books. A user confirms the matched result first. If no exact metadata match exists, the UI sends the user to manual entry with the scanned ISBN prefilled.

## Scanner Implementation

`apps/client/src/hooks/useBarcodeScanner.ts` owns platform scanner access.

### Native iOS and Android

Native builds use `@capacitor/barcode-scanner`.

Behavior:

- opens the native scanner camera surface;
- uses the back camera when available;
- uses adaptive orientation and Android ML Kit scanning options;
- accepts ISBN barcodes and book QR codes only when the scanned value can be reduced to a valid ISBN;
- reports success/failure through core telemetry events.

Native camera permissions must be validated on physical Android and iOS devices before release.

### Web and Desktop

Web and desktop builds use `navigator.mediaDevices.getUserMedia` plus `@zxing/library`.

Behavior:

- requires a secure context, meaning HTTPS or `localhost`;
- enumerates video inputs and prefers rear/environment/world cameras by label when available;
- renders the live stream into the visible `videoRef` passed by `BarcodeScannerFlow`;
- scans the same visible video stream with `BrowserMultiFormatReader.decodeFromVideoDevice`;
- times out after 45 seconds;
- ignores transient ZXing `NotFoundException` frames while continuing to scan;
- stops media tracks and resets the video element on cleanup.

The user should always see the camera preview and viewfinder while scanning. A placeholder-only scanner means the video element is not receiving a stream and should be treated as a release blocker.

## ISBN Rules

ISBN helpers live in `apps/client/src/utils/isbn.ts`.

Rules:

- `normalizeIsbn` strips formatting, hyphens, spaces, and `urn:isbn:` prefixes.
- ISBN-10 is accepted only when the modulo-11 checksum is valid.
- ISBN-13 is accepted only when the EAN-13 checksum is valid.
- ISBN-10 values are converted to canonical ISBN-13 for matching.
- `extractIsbnFromScan` accepts raw ISBN strings and common ISBN URLs such as `/isbn/<isbn>`.
- QR codes are accepted only when a valid ISBN can be extracted from the payload.

## Provider Gateway

All provider lookup goes through `supabase/functions/search-books`.

Function contract:

- public Edge Function with `verify_jwt = false`;
- 30 requests per minute per client IP;
- query length max 200 characters;
- result limit clamped to 1-40;
- ISBN queries are normalized to `isbn:<isbn>`;
- Google Books is primary;
- Open Library is fallback when Google errors or returns no usable books;
- provider calls use a 9 second timeout;
- server metadata cache is stored in `book_metadata_cache`;
- ISBN cache entries expire after 7 days;
- non-ISBN search cache entries expire after 1 day;
- stale cache can be returned when providers fail.

The function returns provider metadata normalized to Brack book fields, including `source_provider`, `source_id`, ISBN, title, author, page count, genre, cover URL, description, publisher, publication date, and rating metadata.

## Client Search Cache

`apps/client/src/services/api/books.ts` caches search responses locally through `bookSearchCacheRepo`.

Behavior:

- cache keys include auth scope (`userId` or `public`), normalized query, and max result count;
- fresh client cache is preferred before calling the Edge Function;
- expired local cache can be used when the device is offline;
- successful online responses are cached with a 24 hour client expiry;
- search events record success, cache hit, and failure telemetry.

General search can show cached results offline. The direct barcode-to-library flow is intentionally connectivity-required because it must resolve an exact ISBN and then call the protected `add-book` endpoint before saving.

## Add And Duplicate Semantics

`addBookToLibrary` calls `supabase/functions/add-book`, which delegates duplicate rules to backend-owned logic.

Rules:

- ISBN is the primary duplicate identity.
- Title plus author is the fallback identity when ISBN is missing.
- A second active copy returns `409` with `code: "book_exists"`.
- Re-adding a soft-deleted matching book restores that row instead of creating a duplicate.
- The frontend also checks the local repository before scanned adds so duplicate feedback can be immediate.
- Added scanned books default to `to_read` and include source metadata such as provider, provider ID, and scanned ISBN.

After a successful add or restore, the returned book is written to the local repository, React Query book caches are invalidated, and a `books-changed` event updates mounted library views.

## Failure States

The scanner acquisition UI has explicit states for:

- `scanning`: camera is open and ZXing/native scanner is active.
- `finding book`: ISBN has been read and metadata lookup is running.
- `preview`: exact ISBN match was found and awaits confirmation.
- `adding`: protected add is in progress.
- `success`: book was added or restored.
- `duplicate`: the book already exists in the user's active library.
- `no match`: provider metadata could not be matched to the scanned ISBN.
- `offline`: lookup/add cannot proceed because connectivity is required.
- `error`: permission, timeout, provider, or unexpected failures.

Do not collapse these into a single generic error. The recovery action differs for each state.

## Release QA Checklist

- Web webcam shows live preview and viewfinder on `localhost`.
- Web scanner detects a known ISBN barcode through ZXing.
- Native scanner opens the platform camera and detects the same ISBN on Android and iOS.
- Invalid QR/barcode payloads are rejected unless a valid ISBN can be extracted.
- Exact ISBN lookup shows the correct preview.
- Provider mismatch is rejected rather than adding the wrong book.
- Duplicate scan shows `Already in your library`.
- Soft-deleted duplicate scan restores the existing book.
- No-match scan offers manual entry with ISBN prefilled.
- Camera permission denial shows a recoverable state.
- Network loss during lookup/add shows reconnect and retry actions.
- Repeated scans work without reopening the route.
