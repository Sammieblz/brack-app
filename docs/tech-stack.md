# Tech Stack

Brack uses modern, production-ready technologies for web and mobile development.

## Frontend Framework

### React 18.3.1
- **Why**: Industry-standard UI library with excellent ecosystem
- **Features Used**:
  - Hooks API
  - Suspense for lazy loading
  - Error boundaries
  - Concurrent rendering

### TypeScript 5.5.3
- **Why**: Type safety and better developer experience
- **Configuration**: Relaxed strictness for rapid development
- **Features Used**:
  - Interface definitions
  - Type inference
  - Generics

## Build Tools

### Vite 5.4.1
- **Why**: Lightning-fast HMR and optimized builds
- **Plugins**:
  - `@vitejs/plugin-react-swc` - Fast React compilation
  - `vite-plugin-pwa` - Progressive Web App support
  - `lovable-tagger` - Component tagging for development

### SWC
- **Why**: 20x faster than Babel for compilation
- **Usage**: React JSX transformation

## Mobile Framework

### Capacitor 7.4.4
- **Why**: Native mobile access with web technologies
- **Platform Support**: iOS, Android, Web
- **Advantages**:
  - Unified codebase
  - Native plugin system
  - Web-first development

### Capacitor Plugins

| Plugin | Version | Purpose |
|--------|---------|---------|
| @capacitor/app | 7.1.0 | App lifecycle events |
| @capacitor/camera | 7.0.3 | Camera & photos |
| @capacitor/device | 7.0.2 | Device information |
| @capacitor/filesystem | 7.1.6 | File storage |
| @capacitor/haptics | 7.0.2 | Vibration feedback |
| @capacitor/local-notifications | 7.0.4 | Local alerts |
| @capacitor/network | 7.0.2 | Network status |
| @capacitor/push-notifications | 7.0.4 | Push alerts |
| @capacitor/share | 7.0.3 | Native sharing |

## Backend & Database

### Supabase
- **PostgreSQL 15** - Relational database
- **PostgREST** - RESTful API
- **Realtime** - WebSocket subscriptions
- **Edge Functions** - Serverless functions (Deno)
- **Storage** - Object storage for images
- **Auth** - User authentication with JWT

#### Why Supabase?
- Open-source Firebase alternative
- Built-in Row Level Security (RLS)
- Real-time subscriptions
- Automatic REST API generation
- Generous free tier

### Edge Functions (Deno)
- **Runtime**: Deno 1.x
- **Language**: TypeScript
- **Functions**:
  - `search-books` - Google Books API integration
  - `discover-readers` - Reader recommendations
  - `enhanced-activity` - Activity feed generation
  - `log-progress` - Progress tracking with transactions
  - `monthly-stats` - Statistics calculation
  - `social-feed` - Social feed aggregation
  - `send-push-notification` - FCM integration
  - `calculate-book-progress` - Progress analytics

## State Management

### TanStack Query 5.56.2
- **Why**: Best-in-class data fetching and caching
- **Features Used**:
  - Query caching with stale-while-revalidate
  - Automatic refetching
  - Optimistic updates
  - Persistence to localStorage
  - Infinite scrolling support

### React Context API
- **Usage**: Global state for:
  - Theme (dark/light mode)
  - User profile
  - Reading timer
  - Dialog confirmations

## UI & Styling

### Tailwind CSS 3.4.11
- **Why**: Utility-first CSS for rapid development
- **Plugins**:
  - `@tailwindcss/typography` - Rich text styling
  - `tailwindcss-animate` - Animation utilities

### shadcn/ui
- **Why**: High-quality, accessible components
- **Components**: 54 pre-built components
- **Based on**: Radix UI primitives
- **Customization**: Full control via Tailwind

### Radix UI
- **Why**: Unstyled, accessible component primitives
- **Components Used**:
  - Dialog, Dropdown, Popover
  - Select, Slider, Switch
  - Tabs, Toast, Tooltip
  - And 10+ more

### Additional UI Libraries

| Library | Purpose |
|---------|---------|
| iconoir-react | Icon system (1000+ icons) |
| recharts | Data visualization |
| date-fns | Date formatting |
| embla-carousel-react | Carousels |
| react-day-picker | Date picker |
| sonner | Toast notifications |
| vaul | Bottom sheets |
| cmdk | Command palette |

## Utilities

### Form Handling
- **react-hook-form** 7.53.0 - Form state management
- **@hookform/resolvers** 3.9.0 - Validation integration
- **zod** 3.23.8 - Schema validation

### Gesture & Interaction
- **react-swipeable** 7.0.2 - Swipe gestures
- **@dnd-kit** 6.3.1 - Drag and drop
- **react-simple-pull-to-refresh** 1.3.3 - Pull to refresh

### Image Processing
- **tesseract.js** 7.0.0 - OCR for cover scanning
- **@zxing/library** 0.21.3 - Barcode scanning

### Security
- **dompurify** 3.3.1 - XSS prevention

### Monitoring
- **@sentry/react** 10.32.1 - Error tracking
- **@sentry/browser** 10.32.1 - Browser error tracking

## Development Tools

### Linting & Formatting
- **ESLint** 9.9.0 - JavaScript/TypeScript linting
- **typescript-eslint** 8.0.1 - TypeScript rules
- **eslint-plugin-react-hooks** 5.1.0 - React Hooks rules
- **eslint-plugin-react-refresh** 0.4.9 - Fast Refresh rules

### Build Optimization
- **@tanstack/react-virtual** 3.13.12 - Virtual scrolling
- **react-resizable-panels** 2.1.3 - Resizable layouts

## APIs & Integrations

### Google Books API
- **Purpose**: Book search and metadata
- **Endpoint**: `googleapis.com/books/v1`
- **Rate Limit**: Handled in Edge Function
- **Caching**: 5-minute cache in browser

### Firebase Cloud Messaging (FCM)
- **Purpose**: Push notifications
- **Platforms**: Android, iOS
- **Integration**: Via Supabase Edge Function

## Package Manager

### npm
- **Version**: Comes with Node.js
- **Lock File**: `package-lock.json`
- **Alternative**: Bun (experimental, `bun.lockb` exists)

## Version Control

### Git
- **Hosting**: GitHub (assumed)
- **Branching**: Feature branches recommended
- **Ignore**: `.gitignore` for build artifacts, env files

## Deployment Targets

### Web
- **Static Hosting**: Vercel, Netlify, or Cloudflare Pages
- **Build Output**: `dist/` directory
- **PWA**: Service worker for offline support

### Mobile
- **iOS**: App Store
- **Android**: Google Play Store
- **Build Tools**: Xcode, Android Studio

## Performance Features

### Code Splitting
- Route-based lazy loading
- Component lazy loading with Suspense
- Dynamic imports

### Caching Strategy
- React Query cache (in-memory)
- localStorage persistence
- Service worker cache (static assets)
- Filesystem cache (mobile images)

### Optimization
- Image lazy loading
- Virtual scrolling for long lists
- Debounced/throttled operations
- Batch database queries

## Security Features

### Authentication
- Supabase Auth with JWT
- Email/password authentication
- Session persistence
- Auto token refresh

### Authorization
- Row Level Security (RLS) policies
- User-specific data access
- Public/private content control

### Data Protection
- Input sanitization (DOMPurify)
- XSS prevention
- HTTPS-only in production
- Environment variable protection

## Testing (Recommended)

While not currently implemented, recommended stack:

- **Vitest** - Unit testing
- **React Testing Library** - Component testing
- **Playwright** - E2E testing
- **Storybook** - Component development

## Analytics (Optional)

Recommended for production:

- **Sentry** - Error tracking (configured)
- **PostHog** - Product analytics
- **Google Analytics** - Web analytics
- **Firebase Analytics** - Mobile analytics

## Development Environment

### Recommended IDE
- **VS Code** with extensions:
  - ESLint
  - Prettier
  - Tailwind CSS IntelliSense
  - TypeScript
  - React Developer Tools

### Browser DevTools
- React Developer Tools
- Redux DevTools (for TanStack Query)
- Supabase Client
- Network tab for API debugging

## Technology Decisions

### Why React over Vue/Angular?
- Largest ecosystem and community
- Best mobile framework support (Capacitor)
- Excellent TypeScript integration
- Industry standard for startups

### Why Supabase over Firebase?
- Open-source and self-hostable
- PostgreSQL (relational data)
- Better SQL capabilities
- Generous free tier
- Built-in RLS for security

### Why Capacitor over React Native?
- Web-first development
- Share code with web app
- Easier debugging
- Simpler build process
- Better plugin ecosystem for our needs

### Why TanStack Query over Redux?
- Built for async data fetching
- Automatic caching and invalidation
- Less boilerplate
- Better TypeScript support
- Optimistic updates out of the box

### Why Tailwind over CSS-in-JS?
- Faster development
- Smaller bundle size
- Better performance (no runtime)
- Easier to maintain
- Class-based approach scales well

## Version Philosophy

- **Dependencies**: Use stable, well-maintained libraries
- **Updates**: Regular updates for security patches
- **Breaking Changes**: Careful evaluation before major version bumps
- **Lock Files**: Committed to ensure consistent installations

## Further Reading

- [Architecture Overview](./architecture.md)
- [Database Schema](./database-schema.md)
- [API Reference](./api-reference.md)
- [Mobile Features](./mobile-features.md)
