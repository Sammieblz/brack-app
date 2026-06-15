# Rich Text Authoring

Brack stores long-form writing as Tiptap JSON with a plain-text fallback. The fallback remains the searchable excerpt and compatibility path for old content.

## Where To Use It

Use rich text for composed, reviewable content:

- Community posts.
- Journal entries and quick journal prompts.
- Book reviews.
- Book club discussions and announcements.

Do not use the full rich-text toolbar for chat. Direct messages and club chat stay compact: plain text, emoji, mentions, replies, GIFs, and image/GIF attachments.

## Data Contract

Long-form rows keep `content` and add:

- `content_format`: `plain` or `tiptap`.
- `content_json`: validated Tiptap JSON document.
- `content_html`: server-derived safe HTML for rendering.

The client may send a `rich_text` payload, but Edge Functions normalize and validate it before writing. The client must not treat its own HTML as trusted.

## Allowed Formatting

The first pass allows headings, paragraphs, bold, italic, underline, strike, blockquotes, bullet and ordered lists, inline code, code blocks, hard breaks, links, and mentions. Links must use safe protocols.

Unknown nodes, scripts, event handlers, unsafe links, and oversized documents are rejected by Edge Function validation.

## Rendering Rules

Use `RichTextRenderer` for rich content. It sanitizes HTML before rendering and falls back to safe plain text when rich fields are missing.

Use `RichTextEditor` for new long-form authoring surfaces. Preserve the returned `content` fallback whenever saving.
