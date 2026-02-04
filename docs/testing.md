# Testing Guide

Guide to testing strategies and best practices for Brack.

## Overview

**Current Status**: No automated tests implemented yet

**Recommended Stack**:
- **Unit Tests**: Vitest
- **Component Tests**: React Testing Library
- **E2E Tests**: Playwright
- **Visual Tests**: Storybook (optional)

## Manual Testing

### Web Testing

#### Development Testing

```bash
npm run dev
```

1. **Authentication Flow**:
   - Sign up with new email
   - Sign in with existing account
   - Sign out
   - Password reset

2. **Book Management**:
   - Add book manually
   - Search and add book
   - Scan barcode (web camera)
   - Scan cover (OCR)
   - Edit book details
   - Delete book
   - Change book status

3. **Reading Features**:
   - Start reading timer
   - Pause/resume timer
   - Stop timer and save session
   - Log progress manually
   - View progress analytics
   - Check streak calendar

4. **Social Features**:
   - Create post
   - Like/unlike posts
   - Comment on posts
   - Write book review
   - Follow/unfollow users
   - Send direct message
   - Join book club

5. **Offline Mode**:
   - Disconnect network
   - Perform actions (add book, log progress)
   - Reconnect network
   - Verify actions sync

#### Production Testing

```bash
npm run build
npm run preview
```

Test production build for:
- Bundle size
- Loading performance
- PWA functionality
- Service worker caching

### Mobile Testing

#### iOS Simulator

```bash
npm run build
npx cap sync ios
npx cap run ios
```

**Test**:
- UI layout and responsiveness
- Navigation
- Gestures (swipe, pull-to-refresh)
- Dark mode

**Limitations**:
- No camera
- No push notifications
- No haptics

#### Android Emulator

```bash
npm run build
npx cap sync android
npx cap run android
```

**Test**: Same as iOS

#### Physical Device (Required for Full Testing)

**iOS**:
1. Connect iPhone via USB
2. Open in Xcode
3. Select device as target
4. Build and run

**Android**:
1. Enable Developer Options on device
2. Enable USB Debugging
3. Connect via USB
4. Select device in Android Studio
5. Run

**Test Native Features**:
- Camera (barcode, cover scan, photo upload)
- Push notifications
- Haptic feedback
- Share functionality
- Deep linking
- Background timer
- Offline sync

## Testing Checklist

### Authentication
- [ ] Sign up with new account
- [ ] Sign in with existing account
- [ ] Sign out
- [ ] Session persists after page reload
- [ ] Auto-redirect when not authenticated
- [ ] Password reset flow

### Books
- [ ] Add book manually
- [ ] Add book via Google Books search
- [ ] Add book via barcode scan
- [ ] Add book via cover scan
- [ ] Edit book details
- [ ] Delete book (soft delete)
- [ ] Change book status (to_read → reading → completed)
- [ ] Auto-status change on first progress log
- [ ] Book detail page loads correctly
- [ ] Book pagination works (scroll to load more)
- [ ] Book search filters work

### Reading Tracking
- [ ] Start reading timer
- [ ] Timer persists in localStorage
- [ ] Timer continues counting during page navigation
- [ ] Timer shows background notification (native)
- [ ] Stop timer saves reading session
- [ ] Log progress manually (page, chapter, notes)
- [ ] Log progress with photo attachment
- [ ] Progress updates book's current_page
- [ ] Progress analytics calculate correctly
- [ ] Completion forecast shows
- [ ] Reading velocity calculates

### Streaks
- [ ] Streak increments after reading session
- [ ] Streak calendar shows activity
- [ ] Streak breaks after missing a day
- [ ] Streak freeze works (once per 7 days)
- [ ] Longest streak tracks correctly
- [ ] Streak milestones save to history
- [ ] Streak history displays in profile

### Goals
- [ ] Create new goal
- [ ] Goal progress calculates correctly
- [ ] Goal completion marks goal as done
- [ ] Goal reminder notifications (if implemented)
- [ ] Multiple goals work simultaneously

### Journaling
- [ ] Add note to book
- [ ] Add quote with page reference
- [ ] Add reflection
- [ ] Attach photo to journal entry
- [ ] Edit journal entry
- [ ] Delete journal entry
- [ ] Journal prompt appears after 5+ min session
- [ ] Quote collection filters and displays quotes
- [ ] Search quotes works

### Social
- [ ] Create post
- [ ] Like/unlike post
- [ ] Comment on post
- [ ] Write book review
- [ ] Like/unlike review
- [ ] Comment on review
- [ ] Follow/unfollow user
- [ ] View user profile
- [ ] Social feed loads and updates
- [ ] Activity feed shows recent activities

### Book Clubs
- [ ] Create book club
- [ ] Join book club
- [ ] Leave book club
- [ ] Post discussion
- [ ] Reply to discussion
- [ ] Set current book
- [ ] Admin can manage club

### Messaging
- [ ] Start new conversation
- [ ] Send message
- [ ] Receive message (real-time)
- [ ] Mark messages as read
- [ ] Typing indicator shows
- [ ] Conversation list updates

### Book Lists
- [ ] Create book list
- [ ] Add books to list
- [ ] Remove books from list
- [ ] Reorder books in list
- [ ] Make list public/private
- [ ] Delete book list
- [ ] View other users' public lists

### Mobile Features
- [ ] Barcode scanner works
- [ ] Cover scanner (OCR) extracts title/author
- [ ] Image picker opens camera
- [ ] Image picker opens photo library
- [ ] Share book opens native share sheet
- [ ] Haptic feedback triggers on actions
- [ ] Push notification registration
- [ ] Push notification received
- [ ] Local notification for timer
- [ ] Deep link navigation works
- [ ] Swipe gestures work
- [ ] Pull-to-refresh on all screens

### Offline
- [ ] Actions queue when offline
- [ ] Offline indicator shows
- [ ] Queue size displays
- [ ] Actions sync on reconnect
- [ ] Manual sync works
- [ ] Failed actions retry
- [ ] Data cache works
- [ ] Image cache works

### Performance
- [ ] Initial page load < 3 seconds
- [ ] Subsequent navigations instant
- [ ] Large lists use virtual scrolling
- [ ] Images lazy load
- [ ] No memory leaks (use DevTools)
- [ ] Service worker caches assets
- [ ] PWA install prompt works

### Responsiveness
- [ ] Works on mobile (320px width)
- [ ] Works on tablet (768px width)
- [ ] Works on desktop (1024px+ width)
- [ ] Portrait orientation works
- [ ] Landscape orientation works
- [ ] Bottom nav on mobile
- [ ] Sidebar nav on desktop

### Accessibility
- [ ] Keyboard navigation works
- [ ] Screen reader compatible
- [ ] Color contrast meets WCAG AA
- [ ] Focus indicators visible
- [ ] Alt text on images

### Security
- [ ] RLS policies prevent unauthorized access
- [ ] Input sanitization prevents XSS
- [ ] API keys not exposed in client
- [ ] HTTPS enforced in production

## Automated Testing (Future)

### Unit Tests (Vitest)

**Setup**:
```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom
```

**Example**:
```typescript
// utils/streakCalculation.test.ts
import { describe, it, expect } from 'vitest';
import { calculateStreakFromSessions } from './streakCalculation';

describe('calculateStreakFromSessions', () => {
  it('calculates current streak correctly', () => {
    const sessions = [
      { created_at: '2026-02-04', ... },
      { created_at: '2026-02-03', ... },
    ];
    
    const result = calculateStreakFromSessions(sessions, null);
    
    expect(result.currentStreak).toBe(2);
  });
});
```

### Component Tests (React Testing Library)

**Example**:
```typescript
// components/BookCard.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { BookCard } from './BookCard';

describe('BookCard', () => {
  it('renders book information', () => {
    const book = {
      id: '1',
      title: 'Test Book',
      author: 'Test Author',
    };
    
    render(<BookCard book={book} onClick={() => {}} />);
    
    expect(screen.getByText('Test Book')).toBeInTheDocument();
    expect(screen.getByText('Test Author')).toBeInTheDocument();
  });
  
  it('calls onClick when clicked', () => {
    const handleClick = vi.fn();
    render(<BookCard book={book} onClick={handleClick} />);
    
    fireEvent.click(screen.getByRole('button'));
    
    expect(handleClick).toHaveBeenCalled();
  });
});
```

### E2E Tests (Playwright)

**Example**:
```typescript
// e2e/auth.spec.ts
import { test, expect } from '@playwright/test';

test('user can sign up', async ({ page }) => {
  await page.goto('http://localhost:8080/auth');
  
  await page.fill('input[name="email"]', 'test@example.com');
  await page.fill('input[name="password"]', 'password123');
  await page.click('button[type="submit"]');
  
  await expect(page).toHaveURL('/dashboard');
});
```

## Performance Testing

### Lighthouse

```bash
# Install Lighthouse CLI
npm install -g lighthouse

# Run audit
lighthouse http://localhost:8080 --view

# Check scores:
# - Performance: Should be > 90
# - Accessibility: Should be > 90
# - Best Practices: Should be > 90
# - SEO: Should be > 80
```

### Bundle Analysis

```bash
# Build with analysis
npm run build

# Check dist/ folder sizes
du -sh dist/*
```

## Load Testing

### Database Load Testing

Use Supabase Dashboard:
1. Database → Performance
2. Run query performance tests
3. Check slow queries
4. Add indexes as needed

## Test Data

### Generate Test Data

Create seed file `supabase/seed.sql`:

```sql
-- Insert test users (use Supabase dashboard to create auth users first)
INSERT INTO profiles (id, display_name) VALUES
  ('user-1-uuid', 'Test User 1'),
  ('user-2-uuid', 'Test User 2');

-- Insert test books
INSERT INTO books (user_id, title, author, status) VALUES
  ('user-1-uuid', 'Test Book 1', 'Author 1', 'reading'),
  ('user-1-uuid', 'Test Book 2', 'Author 2', 'completed');
```

Apply seed:
```bash
npx supabase db reset --seed
```

## Further Reading

- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/react)
- [Playwright Documentation](https://playwright.dev/)
- [Contributing](./contributing.md)
