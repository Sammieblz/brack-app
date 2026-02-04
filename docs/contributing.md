# Contributing to Brack

Thank you for your interest in contributing to Brack! This guide will help you get started.

## Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/your-username/brack-app.git
   cd brack-app
   ```
3. **Install dependencies**:
   ```bash
   npm install
   ```
4. **Set up environment**: Follow the [Getting Started Guide](./getting-started.md)
5. **Create a branch** for your changes:
   ```bash
   git checkout -b feature/your-feature-name
   ```

## Development Workflow

### 1. Make Your Changes

- Follow the existing code style
- Keep changes focused and atomic
- Write self-documenting code
- Add comments for complex logic

### 2. Test Your Changes

```bash
# Run linter
npm run lint

# Test on web
npm run dev

# Test on mobile (if applicable)
npm run build
npx cap sync
npx cap open ios
npx cap open android
```

### 3. Commit Your Changes

Follow conventional commit format:

```bash
git commit -m "feat: add book cover search feature"
git commit -m "fix: resolve offline sync issue"
git commit -m "docs: update API reference"
```

**Commit Types**:
- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation
- `style` - Code style (formatting, no logic change)
- `refactor` - Code refactoring
- `perf` - Performance improvement
- `test` - Tests
- `chore` - Maintenance tasks

### 4. Push and Create Pull Request

```bash
git push origin feature/your-feature-name
```

Then create a Pull Request on GitHub with:
- Clear title and description
- Screenshots/videos for UI changes
- Link to related issues

## Code Guidelines

### TypeScript

```typescript
// ✅ DO: Use explicit types for function parameters
function calculateProgress(book: Book, page: number): number {
  return (page / book.pages) * 100;
}

// ❌ DON'T: Use implicit any
function calculateProgress(book, page) {
  return (page / book.pages) * 100;
}

// ✅ DO: Use interfaces for complex types
interface BookProgress {
  currentPage: number;
  percentage: number;
}

// ❌ DON'T: Use inline object types
function getProgress(): { currentPage: number; percentage: number } {
  // ...
}
```

### React Components

```typescript
// ✅ DO: Use functional components with hooks
const BookCard = ({ book }: { book: Book }) => {
  const [isLoading, setIsLoading] = useState(false);
  return <div>{book.title}</div>;
};

// ❌ DON'T: Use class components
class BookCard extends React.Component {
  // ...
}

// ✅ DO: Extract complex logic to custom hooks
const useBookData = (bookId: string) => {
  const { data, isLoading } = useQuery({
    queryKey: ['book', bookId],
    queryFn: () => fetchBook(bookId),
  });
  return { book: data, loading: isLoading };
};

// ❌ DON'T: Put business logic in components
const BookDetail = () => {
  const [book, setBook] = useState(null);
  useEffect(() => {
    fetch(`/api/books/${id}`).then(/* ... */);
  }, [id]);
};
```

### File Organization

```typescript
// ✅ DO: Group related imports
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { BookCard } from '@/components/BookCard';

import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

import type { Book } from '@/types';

// ❌ DON'T: Mix import groups
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import type { Book } from '@/types';
import { useAuth } from '@/hooks/useAuth';
```

### Naming Conventions

```typescript
// Components: PascalCase
const BookCard = () => { /* ... */ };

// Hooks: useCamelCase
const useBooks = () => { /* ... */ };

// Functions: camelCase
const calculateProgress = () => { /* ... */ };

// Constants: UPPER_SNAKE_CASE
const MAX_RETRIES = 3;

// Types/Interfaces: PascalCase
interface Book { /* ... */ }
type BookStatus = 'reading' | 'completed';
```

### Error Handling

```typescript
// ✅ DO: Handle errors gracefully
try {
  await saveBook(book);
  toast.success('Book saved!');
} catch (error) {
  console.error('Error saving book:', error);
  toast.error('Failed to save book');
}

// ❌ DON'T: Ignore errors
await saveBook(book);
toast.success('Book saved!'); // May not actually be saved

// ✅ DO: Provide user feedback
if (loading) return <Spinner />;
if (error) return <ErrorMessage error={error} />;

// ❌ DON'T: Leave users hanging
if (loading) return null;
if (error) return null;
```

### Performance

```typescript
// ✅ DO: Memoize expensive calculations
const filteredBooks = useMemo(
  () => books.filter(b => b.status === 'reading'),
  [books]
);

// ❌ DON'T: Calculate on every render
const filteredBooks = books.filter(b => b.status === 'reading');

// ✅ DO: Use useCallback for event handlers
const handleClick = useCallback(() => {
  onClick(book.id);
}, [book.id, onClick]);

// ❌ DON'T: Create new functions on every render
const handleClick = () => onClick(book.id);
```

## Database Changes

### Creating Migrations

```bash
# Create new migration
npx supabase migration new your_migration_name
```

Edit the generated file in `supabase/migrations/`:

```sql
-- Add your migration SQL here

-- Always include comments
-- Always handle existing data
-- Always add indexes for foreign keys
-- Always enable RLS on new tables
```

### Migration Best Practices

1. **Idempotent**: Use `IF NOT EXISTS`, `IF EXISTS`
2. **Reversible**: Consider rollback scenarios
3. **Indexed**: Add indexes for foreign keys and frequently queried columns
4. **RLS**: Enable Row Level Security on all tables
5. **Tested**: Test on local Supabase before pushing

Example:
```sql
-- ✅ Good migration
CREATE TABLE IF NOT EXISTS new_table (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_new_table_user 
  ON new_table(user_id);

ALTER TABLE new_table ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own records"
  ON new_table FOR SELECT
  USING (auth.uid() = user_id);
```

## Adding New Features

### Checklist

- [ ] Create feature branch
- [ ] Implement feature
- [ ] Add TypeScript types
- [ ] Handle errors gracefully
- [ ] Add loading states
- [ ] Test on web
- [ ] Test on mobile (if applicable)
- [ ] Update documentation
- [ ] Run linter
- [ ] Create pull request

### Feature Structure

For a new feature like "Reading Challenges":

1. **Database**: Create migration in `supabase/migrations/`
2. **Types**: Add to `src/types/index.ts`
3. **Hook**: Create `src/hooks/useReadingChallenges.ts`
4. **Service**: (Optional) Create `src/services/challengeService.ts`
5. **Component**: Create `src/components/ChallengeCard.tsx`
6. **Screen**: Create `src/screens/Challenges.tsx`
7. **Route**: Add to `src/App.tsx`
8. **Navigation**: Add to nav components

## Pull Request Guidelines

### PR Title

Use conventional commit format:

```
feat: add reading challenges feature
fix: resolve timer persistence issue
docs: update mobile setup guide
```

### PR Description

Include:

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Tested on web
- [ ] Tested on iOS
- [ ] Tested on Android
- [ ] Linter passes

## Screenshots
(If applicable)

## Related Issues
Closes #123
```

### Code Review

Expect reviewers to check:
- Code quality and style
- TypeScript type safety
- Error handling
- Performance considerations
- Security implications
- Test coverage
- Documentation updates

## Reporting Bugs

### Bug Report Template

```markdown
**Description**
Clear description of the bug

**Steps to Reproduce**
1. Go to '...'
2. Click on '...'
3. Scroll down to '...'
4. See error

**Expected Behavior**
What should happen

**Actual Behavior**
What actually happens

**Environment**
- OS: [e.g. iOS 16, Android 13, macOS 14]
- Browser: [e.g. Chrome 120, Safari 17]
- Device: [e.g. iPhone 14, Pixel 7]
- App Version: [e.g. 1.0.0]

**Screenshots**
If applicable

**Console Logs**
Error messages from console
```

## Feature Requests

### Feature Request Template

```markdown
**Is your feature request related to a problem?**
Clear description of the problem

**Describe the solution you'd like**
What you want to happen

**Describe alternatives you've considered**
Other solutions you've thought about

**Additional context**
Any other context, mockups, or examples
```

## Code of Conduct

- Be respectful and constructive
- Focus on the code, not the person
- Accept feedback gracefully
- Help others learn and grow
- Follow project conventions

## Questions?

- Check [FAQ](./faq.md)
- Search existing issues
- Ask in discussions
- Contact maintainers

## License

By contributing, you agree that your contributions will be licensed under the same license as the project.
