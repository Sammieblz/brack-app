Brack (Book Tracking) is a digital book tracking app that allows users to keep track of the books they are reading and progress of reading.

## Setup

1. Copy `.env.example` to `.env`.
2. Add your environment variables (see below).
3. Run `npm install` and `npm run dev`.

## Environment Variables

### Required

- `VITE_SUPABASE_URL` - Your Supabase project URL (e.g., `https://<project-id>.supabase.co`)
- `VITE_SUPABASE_PROJECT_ID` - Your Supabase project ID
- `VITE_SUPABASE_PUBLISHABLE_KEY` - Your Supabase anon/public key

### Optional

- `GOOGLE_BOOKS_API_KEY` - Google Books API key for enhanced book search functionality (recommended for production)
- `ALLOWED_ORIGINS` - Comma-separated list of allowed CORS origins for Supabase Edge Functions (e.g., `https://example.com,https://www.example.com`). If not set, defaults to `*` for local development
- `VITE_SENTRY_DSN` - Sentry DSN for error tracking and monitoring (optional)
- `DENO_ENV` - Environment name for Supabase Edge Functions (`development` or `production`). When set to `development`, CORS allows all origins
