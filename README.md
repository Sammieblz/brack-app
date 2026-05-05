# Brack - Book Tracking App

Brack is a comprehensive book tracking application that helps readers manage their reading journey, connect with fellow readers, and achieve their reading goals.

## ✨ Features

- 📚 **Book Management** - Add, organize, and track your reading list
- ⏱️ **Reading Timer** - Track reading time with persistent timers
- 📊 **Progress Tracking** - Detailed analytics and reading statistics
- 🔥 **Reading Streaks** - Stay motivated with daily reading streaks
- 📝 **Journaling** - Notes, quotes, and reflections
- 👥 **Social Features** - Connect with readers, share reviews, join book clubs
- 📱 **Mobile Apps** - Native iOS and Android apps via Capacitor
- 🔍 **Book Search** - Powered by Google Books API
- 📷 **Barcode & Cover Scanning** - Quick book entry with camera
- 🔔 **Push Notifications** - Stay engaged with timely notifications
- 🌓 **Dark Mode** - Beautiful themes for day and night reading
- ✈️ **Offline Support** - Read and track offline, sync when online

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm
- Supabase account (free tier works)
- For mobile: Xcode (iOS) or Android Studio (Android)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd brack-app

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your Supabase credentials

# Run development server
npm run dev
```

The app will be available at `http://localhost:8080`

### Environment Variables

#### Required

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PROJECT_ID=your-project-id
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key
```

#### Optional

```env
GOOGLE_BOOKS_API_KEY=your-google-books-api-key
VITE_SENTRY_DSN=your-sentry-dsn
ALLOWED_ORIGINS=http://localhost:8080,https://yourdomain.com
ENVIRONMENT=development
FCM_SERVER_KEY=your-fcm-server-key
SUPABASE_ACCESS_TOKEN=your-supabase-cli-token
SUPABASE_DB_PASSWORD=your-linked-project-db-password
```

See [Getting Started Guide](./docs/getting-started.md) for detailed setup instructions.

## 📖 Documentation

Comprehensive documentation is available in the `/docs` directory:

### Getting Started
- **[Project Overview](./docs/project-overview.md)** - High-level overview and goals
- **[Getting Started](./docs/getting-started.md)** - Setup and installation
- **[Quick Reference](./docs/quick-reference.md)** - Cheat sheet for common tasks

### Architecture & Development
- **[Tech Stack](./docs/tech-stack.md)** - Technologies and libraries
- **[Architecture](./docs/architecture.md)** - System design and patterns
- **[File Structure](./docs/file-structure.md)** - Project organization
- **[Database Schema](./docs/database-schema.md)** - Database design
- **[API Reference](./docs/api-reference.md)** - Edge Functions documentation

### Features & Guides
- **[Mobile Features](./docs/mobile-features.md)** - Native mobile capabilities
- **[Offline Support](./docs/offline-support.md)** - Local-first reading core, outbox sync, and offline caveats
- **[Authentication](./docs/authentication.md)** - User auth and security
- **[State Management](./docs/state-management.md)** - Data flow and caching
- **[Hooks Reference](./docs/hooks.md)** - Custom React hooks

### Deployment & Maintenance
- **[Deployment](./docs/deployment.md)** - Build and deployment process
- **[Testing](./docs/testing.md)** - Testing strategies and checklist
- **[Troubleshooting](./docs/troubleshooting.md)** - Common issues and solutions

### Community
- **[Contributing](./docs/contributing.md)** - Contribution guidelines
- **[FAQ](./docs/faq.md)** - Frequently asked questions

**[📚 Full Documentation Index](./docs/README.md)**

## 🛠️ Development

### Available Scripts

```bash
npm run dev              # Start development server
npm run build           # Production build
npm run build:dev       # Development build
npm run lint            # Run ESLint
npm run preview         # Preview production build

# Mobile Development
npm run cap:sync        # Build & sync to native projects
npm run cap:open:ios    # Open Xcode
npm run cap:open:android # Open Android Studio
```

### Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Mobile**: Capacitor 7 (iOS & Android)
- **Backend**: Supabase (PostgreSQL + Edge Functions)
- **UI**: Tailwind CSS + shadcn/ui
- **State**: TanStack Query (React Query)
- **Real-time**: Supabase Subscriptions

See [Tech Stack](./docs/tech-stack.md) for complete list.

## 📱 Mobile Development

### iOS

```bash
npm run build
npx cap sync ios
npx cap open ios
```

Requirements: macOS, Xcode 14+, CocoaPods

### Android

```bash
npm run build
npx cap sync android
npx cap open android
```

Requirements: Android Studio, Android SDK (API 24+)

See [Mobile Features](./docs/mobile-features.md) for detailed mobile development guide.

## 🗄️ Database

This project uses Supabase with PostgreSQL.

### Running Migrations

```bash
# Link to your Supabase project
npx supabase link --project-ref your-project-id

# Apply migrations
npx supabase db push

# Or reset database (development only)
npx supabase db reset
```

See [Database Schema](./docs/database-schema.md) for complete schema documentation.

## 🧪 Testing

```bash
# Run linter
npm run lint

# Fix linting errors
npm run lint -- --fix
```

## 🚢 Deployment

### Web

Build the project and deploy the `dist/` directory to any static hosting service (Vercel, Netlify, Cloudflare Pages, etc.):

```bash
npm run build
```

### Mobile

1. Build and sync: `npm run build && npx cap sync`
2. Open in native IDE: `npx cap open ios` or `npx cap open android`
3. Build and submit to App Store / Play Store

See [Deployment Guide](./docs/deployment.md) for detailed deployment instructions.

## 🤝 Contributing

Contributions are welcome! Please see [Contributing Guidelines](./docs/contributing.md).

## 📄 License

This project is licensed under the terms specified in the LICENSE file.

## 🆘 Support

- Check [Troubleshooting Guide](./docs/troubleshooting.md)
- Review [FAQ](./docs/faq.md)
- Search existing issues
- Create a new issue

## 🙏 Acknowledgments

Built with:
- [React](https://react.dev/)
- [Supabase](https://supabase.com/)
- [Capacitor](https://capacitorjs.com/)
- [Tailwind CSS](https://tailwindcss.com/)
- [shadcn/ui](https://ui.shadcn.com/)
- And many more amazing open-source projects
