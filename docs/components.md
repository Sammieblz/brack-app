# Components Reference

Guide to key components in Brack and their usage.

## Component Categories

### Layout Components

#### MobileLayout

**Location**: `apps/client/src/components/MobileLayout.tsx`

**Purpose**: Wrapper for mobile screens with bottom navigation

```tsx
<MobileLayout showBottomNav={true}>
  <YourContent />
</MobileLayout>
```

**Props**:
- `children` - Content to render
- `showBottomNav` - Show/hide bottom navigation (default: true)

#### MobileHeader

**Location**: `apps/client/src/components/MobileHeader.tsx`

**Purpose**: Mobile page header with title and actions

```tsx
<MobileHeader 
  title="My Books" 
  showBack={true}
  action={<Button>Action</Button>}
/>
```

**Props**:
- `title` - Page title
- `showBack` - Show back button (default: false)
- `action` - Action button/element

#### NativeHeader

**Location**: `apps/client/src/components/NativeHeader.tsx`

**Purpose**: Desktop header with large title and subtitle

```tsx
<NativeHeader 
  title="Dashboard"
  subtitle="Your reading journey"
  action={<Button>Action</Button>}
  scrollContainerId="scroll-container"
/>
```

**Features**:
- Hides on scroll down
- Shows on scroll up
- Smooth transitions

#### NativeScrollView

**Location**: `apps/client/src/components/NativeScrollView.tsx`

**Purpose**: Scrollable container with native scrolling behavior

```tsx
<NativeScrollView id="scroll-container" className="p-4">
  <YourContent />
</NativeScrollView>
```

### Display Components

#### BookCard

**Location**: `apps/client/src/components/BookCard.tsx`

**Purpose**: Display book information in card format

```tsx
<BookCard 
  book={book}
  onClick={(id) => navigate(`/book/${id}`)}
  userId={userId}
/>
```

**Props**:
- `book` - Book object
- `onClick` - Click handler
- `userId` - Current user ID (optional, for context actions)

**Features**:
- Cover image
- Title, author
- Progress bar
- Status badge
- Rating stars

#### SwipeableBookCard

**Location**: `apps/client/src/components/SwipeableBookCard.tsx`

**Purpose**: Book card with swipe actions (mobile)

```tsx
<SwipeableBookCard
  book={book}
  onView={handleView}
  onEdit={handleEdit}
  onDelete={handleDelete}
  onStatusChange={handleStatusChange}
>
  <BookCard book={book} />
</SwipeableBookCard>
```

**Swipe Actions**:
- Swipe left: Delete
- Swipe right: Change status

#### StreakDisplay

**Location**: `apps/client/src/components/StreakDisplay.tsx`

**Purpose**: Display reading streak information

```tsx
<StreakDisplay 
  streakData={streakData}
  onUseFreeze={handleUseFreeze}
/>
```

**Shows**:
- Current streak count
- Longest streak
- Streak freeze button
- Motivational messages

#### StreakCalendar

**Location**: `apps/client/src/components/StreakCalendar.tsx`

**Purpose**: Lightweight 90-day streak activity calendar

```tsx
<StreakCalendar activityCalendar={activityCalendar} />
```

**Features**:
- 90-day activity view
- Color-coded by activity level
- Tooltips with details
- Mobile-optimized

#### ReadingHeatmap

**Location**: `apps/client/src/components/charts/ReadingHeatmap.tsx`

**Purpose**: ApexCharts heatmap for dashboard and analytics reading activity

```tsx
<ReadingHeatmap data={activityData} />
```

**Features**:
- Lazy-loads `react-apexcharts`
- Uses the `apex-vendor` build chunk
- Supports pages, minutes, sessions, and streak views
- Height-stable loading state

### Interactive Components

#### FloatingTimerWidget

**Location**: `apps/client/src/components/FloatingTimerWidget.tsx`

**Purpose**: Floating reading timer with minimize/expand

```tsx
<FloatingTimerWidget />
```

**Features**:
- Minimized/expanded states
- Play/pause controls
- Finish with session save
- Cancel with confirmation
- Draggable position (could be added)

**State**: Managed by `TimerContext`

#### FloatingActionButton

**Location**: `apps/client/src/components/FloatingActionButton.tsx`

**Purpose**: Mobile FAB with quick actions

```tsx
<FloatingActionButton />
```

**Actions**:
- Add book
- Scan barcode
- Scan cover
- Add to list

#### ProgressLogger

**Location**: `apps/client/src/components/ProgressLogger.tsx`

**Purpose**: Dialog for logging reading progress

```tsx
<ProgressLogger
  bookId={bookId}
  bookTitle={bookTitle}
  currentPage={currentPage}
  open={isOpen}
  onOpenChange={setIsOpen}
  onSuccess={handleSuccess}
/>
```

**Features**:
- Page, chapter, paragraph input
- Time spent input
- Notes
- Photo attachment
- Quick buttons (+1, +5, +10, +50 pages)

#### QuickProgressWidget

**Location**: `apps/client/src/components/QuickProgressWidget.tsx`

**Purpose**: Quick progress update widget

```tsx
<QuickProgressWidget 
  book={book}
  onUpdate={handleUpdate}
/>
```

**Features**:
- Inline progress update
- Quick page increment
- No modal needed

### Journal Components

#### JournalEntryDialog

**Location**: `apps/client/src/components/JournalEntryDialog.tsx`

**Purpose**: Create/edit journal entries

```tsx
<JournalEntryDialog
  bookId={bookId}
  open={isOpen}
  onOpenChange={setIsOpen}
  entry={existingEntry} // Optional, for editing
  onSuccess={handleSuccess}
/>
```

**Entry Types**:
- Note
- Quote
- Reflection

#### QuickJournalEntryDialog

**Location**: `apps/client/src/components/QuickJournalEntryDialog.tsx`

**Purpose**: Quick journal entry after reading session

```tsx
<QuickJournalEntryDialog
  bookId={bookId}
  bookTitle={bookTitle}
  open={isOpen}
  onOpenChange={setIsOpen}
  onSuccess={handleSuccess}
/>
```

**Features**:
- Auto-prompted after 5+ min session
- Quick entry types
- Photo attachment
- Skip option

#### JournalEntriesList

**Location**: `apps/client/src/components/JournalEntriesList.tsx`

**Purpose**: Display list of journal entries

```tsx
<JournalEntriesList bookId={bookId} />
```

**Features**:
- Filter by type (note, quote, reflection)
- Edit/delete entries
- Photo display
- Empty state

#### QuoteCollection

**Location**: `apps/client/src/components/QuoteCollection.tsx`

**Purpose**: Display and search quotes

```tsx
<QuoteCollection userId={userId} />
```

**Features**:
- Search by content, title, book, author
- Share quotes
- Beautiful card layout

### Social Components

#### PostCard

**Location**: `apps/client/src/components/social/PostCard.tsx`

**Purpose**: Social media post display

```tsx
<PostCard post={post} />
```

**Features**:
- User info with avatar
- Book context
- Like/comment buttons
- Timestamp

#### ReviewCard

**Location**: `apps/client/src/components/social/ReviewCard.tsx`

**Purpose**: Book review display

```tsx
<ReviewCard review={review} />
```

**Features**:
- Star rating
- Spoiler toggle
- Like/comment
- Share button

#### ReviewForm

**Location**: `apps/client/src/components/social/ReviewForm.tsx`

**Purpose**: Create/edit book review

```tsx
<ReviewForm
  bookId={bookId}
  open={isOpen}
  onOpenChange={setIsOpen}
/>
```

#### UserCard

**Location**: `apps/client/src/components/social/UserCard.tsx`

**Purpose**: User profile card for discovery

```tsx
<UserCard user={user} />
```

**Features**:
- Avatar and name
- Bio snippet
- Follow button
- Reading stats
- Distance (if location available)

### Search Components

#### BookSearch

**Location**: `apps/client/src/components/BookSearch.tsx`

**Purpose**: Search books via Google Books API

```tsx
<BookSearch 
  onSelectBook={handleSelect}
  onQuickAdd={handleQuickAdd}
  initialQuery={searchQuery}
/>
```

**Features**:
- Search input with debouncing
- Result list with covers
- Quick add button
- Select for editing

#### NativeSearchBar

**Location**: `apps/client/src/components/NativeSearchBar.tsx`

**Purpose**: Native-styled search input

```tsx
<NativeSearchBar
  value={query}
  onChange={setQuery}
  placeholder="Search..."
/>
```

### Feedback Components

#### OfflineIndicator

**Location**: `apps/client/src/components/OfflineIndicator.tsx`

**Purpose**: Show offline status and reading-core sync state

```tsx
<OfflineIndicator />
```

**Features**:
- Shows when offline
- Pending and failed outbox counts
- Manual sync button
- Auto-hides when online

#### PullToRefresh

**Location**: `apps/client/src/components/PullToRefresh.tsx`

**Purpose**: Pull-to-refresh wrapper

```tsx
<PullToRefresh onRefresh={handleRefresh}>
  <YourContent />
</PullToRefresh>
```

**Features**:
- Pull gesture detection
- Loading spinner
- Haptic feedback
- Mobile-optimized

### Utility Components

#### OptimizedImage

**Location**: `apps/client/src/components/OptimizedImage.tsx`

**Purpose**: Image with caching and lazy loading

```tsx
<OptimizedImage
  src={imageUrl}
  alt="Description"
  cacheKey="unique-key"
  className="w-full"
/>
```

**Features**:
- Automatic caching
- Lazy loading
- Error fallback
- Placeholder

#### LoadingSpinner

**Location**: `apps/client/src/components/LoadingSpinner.tsx`

**Purpose**: Loading indicator

```tsx
<LoadingSpinner size="lg" text="Loading..." />
```

**Sizes**: `sm`, `md`, `lg`

#### ErrorBoundary

**Location**: `apps/client/src/components/ErrorBoundary.tsx`

**Purpose**: Catch and display component errors

```tsx
<ErrorBoundary>
  <YourComponent />
</ErrorBoundary>
```

**Features**:
- Error logging to Sentry
- User-friendly error message
- Reset button

### Navigation Components

#### MobileBottomNav

**Location**: `apps/client/src/components/MobileBottomNav.tsx`

**Purpose**: Bottom navigation bar (mobile)

**Routes**:
- Home (Dashboard)
- Books (Library)
- Feed (Social)
- Readers (Discovery)
- Profile

#### Navbar

**Location**: `apps/client/src/components/Navbar.tsx`

**Purpose**: Desktop sidebar navigation

#### SwipeBackHandler

**Location**: `apps/client/src/components/SwipeBackHandler.tsx`

**Purpose**: iOS-style swipe back gesture

```tsx
<SwipeBackHandler>
  <YourRoutes />
</SwipeBackHandler>
```

## shadcn/ui Components

Located in `apps/client/src/components/ui/`

### Common Components

```tsx
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
```

### Button Variants

```tsx
<Button variant="default">Primary</Button>
<Button variant="outline">Outline</Button>
<Button variant="ghost">Ghost</Button>
<Button variant="destructive">Delete</Button>
<Button variant="link">Link</Button>
```

### Button Sizes

```tsx
<Button size="sm">Small</Button>
<Button size="default">Default</Button>
<Button size="lg">Large</Button>
<Button size="icon">Icon Only</Button>
```

### Card Structure

```tsx
<Card>
  <CardHeader>
    <CardTitle>Title</CardTitle>
    <CardDescription>Description</CardDescription>
  </CardHeader>
  <CardContent>
    Content
  </CardContent>
  <CardFooter>
    Actions
  </CardFooter>
</Card>
```

### Dialog Pattern

```tsx
const [open, setOpen] = useState(false);

<Dialog open={open} onOpenChange={setOpen}>
  <DialogTrigger asChild>
    <Button>Open</Button>
  </DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Title</DialogTitle>
      <DialogDescription>Description</DialogDescription>
    </DialogHeader>
    <DialogFooter>
      <Button onClick={() => setOpen(false)}>Close</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

### Form Components

```tsx
<form onSubmit={handleSubmit}>
  <div className="space-y-4">
    <div>
      <Label htmlFor="title">Title</Label>
      <Input
        id="title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Enter title"
        required
      />
    </div>
    
    <div>
      <Label htmlFor="genre">Genre</Label>
      <Select value={genre} onValueChange={setGenre}>
        <SelectTrigger>
          <SelectValue placeholder="Select genre" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="fiction">Fiction</SelectItem>
          <SelectItem value="non-fiction">Non-Fiction</SelectItem>
        </SelectContent>
      </Select>
    </div>
    
    <Button type="submit">Submit</Button>
  </div>
</form>
```

## Charts Components

Located in `apps/client/src/components/charts/`

### WeeklyReadingChart

```tsx
<WeeklyReadingChart data={weeklyData} />
```

### MonthlyProgressChart

```tsx
<MonthlyProgressChart data={monthlyData} />
```

### GenreDistributionChart

```tsx
<GenreDistributionChart data={genreData} />
```

## Skeleton Components

Located in `apps/client/src/components/skeletons/`

### Usage

```tsx
import { BookCardSkeleton } from '@/components/skeletons/BookCardSkeleton';

{loading ? (
  <div className="space-y-3">
    <BookCardSkeleton />
    <BookCardSkeleton />
    <BookCardSkeleton />
  </div>
) : (
  <BookList books={books} />
)}
```

**Available Skeletons**:
- `BookCardSkeleton`
- `DashboardCardSkeleton`
- `PostCardSkeleton`
- `StatCardSkeleton`
- `ActivityItemSkeleton`
- `ReviewCardSkeleton`

## Component Patterns

### Controlled Components

```tsx
// Parent controls state
const [value, setValue] = useState('');

<Input 
  value={value}
  onChange={(e) => setValue(e.target.value)}
/>
```

### Compound Components

```tsx
<Card>
  <CardHeader>
    <CardTitle>Title</CardTitle>
  </CardHeader>
  <CardContent>
    Content
  </CardContent>
</Card>
```

### Render Props

```tsx
<DataProvider>
  {({ data, loading }) => (
    loading ? <Spinner /> : <Content data={data} />
  )}
</DataProvider>
```

### Children as Function

```tsx
<ConfirmDialog>
  {(confirm) => (
    <Button onClick={async () => {
      if (await confirm('Delete?')) {
        deleteItem();
      }
    }}>
      Delete
    </Button>
  )}
</ConfirmDialog>
```

## Styling Patterns

### Responsive Classes

```tsx
<div className="p-4 md:p-6 lg:p-8">
  {/* Padding increases on larger screens */}
</div>

<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {/* Grid columns increase on larger screens */}
</div>
```

### Dark Mode

```tsx
<div className="bg-white dark:bg-gray-900 text-black dark:text-white">
  {/* Automatically adapts to theme */}
</div>
```

### Conditional Classes

```tsx
import { cn } from '@/lib/utils';

<div className={cn(
  "base-classes",
  isActive && "active-classes",
  variant === 'primary' && "primary-classes"
)}>
```

## Component Best Practices

### 1. Props Interface

```typescript
interface MyComponentProps {
  // Required props
  title: string;
  onClick: () => void;
  
  // Optional props
  subtitle?: string;
  variant?: 'default' | 'outline';
  
  // Children
  children?: ReactNode;
  
  // Style
  className?: string;
}
```

### 2. Default Props

```typescript
export const MyComponent = ({ 
  title,
  variant = 'default',
  className = '',
}: MyComponentProps) => {
  // ...
};
```

### 3. Memo for Performance

```typescript
export const ExpensiveComponent = memo(({ data }: Props) => {
  // Only re-renders if data changes
  return <div>{/* ... */}</div>;
});
```

### 4. Forward Refs

```typescript
export const MyInput = forwardRef<HTMLInputElement, Props>(
  ({ className, ...props }, ref) => {
    return <input ref={ref} className={className} {...props} />;
  }
);
```

### 5. Compound Component Pattern

```tsx
const MyComponent = ({ children }: { children: ReactNode }) => {
  return <div className="container">{children}</div>;
};

MyComponent.Header = ({ children }: { children: ReactNode }) => {
  return <header>{children}</header>;
};

MyComponent.Body = ({ children }: { children: ReactNode }) => {
  return <main>{children}</main>;
};

// Usage
<MyComponent>
  <MyComponent.Header>Header</MyComponent.Header>
  <MyComponent.Body>Body</MyComponent.Body>
</MyComponent>
```

## Creating New Components

### Template

```typescript
// apps/client/src/components/MyComponent.tsx
import { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

interface MyComponentProps {
  title: string;
  className?: string;
}

export const MyComponent = ({ 
  title, 
  className 
}: MyComponentProps) => {
  return (
    <div className={cn("default-classes", className)}>
      <h2>{title}</h2>
    </div>
  );
};
```

### Adding to Component Library

1. Create component file in `apps/client/src/components/`
2. Export from component file
3. Import where needed: `import { MyComponent } from '@/components/MyComponent'`
4. Add to documentation (this file)

## Icon Usage

```tsx
import { Book, Star, Settings } from 'iconoir-react';

<Book className="h-4 w-4" />
<Star className="h-5 w-5 text-yellow-500" />
<Settings className="mr-2 h-4 w-4" /> Settings
```

**Icon Library**: iconoir-react (1000+ icons)

## Animation Classes

```tsx
// Fade in
<div className="animate-fade-in">

// Scale in
<div className="animate-scale-in">

// Slide in from right
<div className="animate-slide-in-right">

// Spin
<div className="animate-spin">
```

**Configuration**: `apps/client/tailwind.config.ts` - tailwindcss-animate plugin

## Further Reading

- [File Structure](./file-structure.md)
- [State Management](./state-management.md)
- [Hooks Reference](./hooks.md)
- [shadcn/ui Documentation](https://ui.shadcn.com/)
