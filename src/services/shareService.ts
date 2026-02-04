import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';

interface ShareOptions {
  title?: string;
  text?: string;
  url?: string;
  dialogTitle?: string;
}

/**
 * Share service for native sharing functionality
 * Falls back to Web Share API on web if available
 */
export const shareService = {
  /**
   * Share reading statistics
   */
  async shareReadingStats(stats: {
    booksCompleted: number;
    totalHours: number;
    currentStreak: number;
    username?: string;
  }): Promise<void> {
    const text = `📚 My Reading Stats on Brack:\n\n` +
      `📖 Books Completed: ${stats.booksCompleted}\n` +
      `⏱️ Total Reading Time: ${stats.totalHours} hours\n` +
      `🔥 Current Streak: ${stats.currentStreak} days\n` +
      (stats.username ? `\nFollow me: @${stats.username}` : '');

    await this.share({
      title: 'My Reading Statistics',
      text,
    });
  },

  /**
   * Share a book review
   */
  async shareBookReview(review: {
    title: string;
    content: string;
    rating: number;
    bookTitle: string;
    bookAuthor?: string;
  }): Promise<void> {
    const stars = '⭐'.repeat(review.rating);
    const text = `📖 Review: ${review.bookTitle}${review.bookAuthor ? ` by ${review.bookAuthor}` : ''}\n\n` +
      `${stars} ${review.rating}/5\n\n` +
      (review.title ? `${review.title}\n\n` : '') +
      `${review.content}`;

    await this.share({
      title: `Review: ${review.bookTitle}`,
      text,
    });
  },

  /**
   * Share a reading quote
   */
  async shareReadingQuote(quote: {
    text: string;
    bookTitle: string;
    bookAuthor?: string;
    pageNumber?: number;
  }): Promise<void> {
    const text = `"${quote.text}"\n\n` +
      `— ${quote.bookTitle}${quote.bookAuthor ? ` by ${quote.bookAuthor}` : ''}` +
      (quote.pageNumber ? ` (p. ${quote.pageNumber})` : '');

    await this.share({
      title: 'Reading Quote',
      text,
    });
  },

  /**
   * Share a book
   */
  async shareBook(book: {
    title: string;
    author?: string;
    isbn?: string;
    coverUrl?: string;
  }): Promise<void> {
    const text = `📚 Check out this book: ${book.title}${book.author ? ` by ${book.author}` : ''}\n\n` +
      `Read it on Brack!`;

    await this.share({
      title: `Book: ${book.title}`,
      text,
      url: book.coverUrl,
    });
  },

  /**
   * Generic share function
   */
  async share(options: ShareOptions): Promise<void> {
    try {
      if (Capacitor.isNativePlatform()) {
        // Use Capacitor Share plugin
        await Share.share({
          title: options.title,
          text: options.text || '',
          url: options.url,
          dialogTitle: options.dialogTitle,
        });
      } else {
        // Use Web Share API if available
        if (navigator.share) {
          await navigator.share({
            title: options.title,
            text: options.text,
            url: options.url,
          });
        } else {
          // Fallback: copy to clipboard
          const textToCopy = [options.title, options.text, options.url]
            .filter(Boolean)
            .join('\n');
          
          await navigator.clipboard.writeText(textToCopy);
          throw new Error('Share not supported. Content copied to clipboard.');
        }
      }
    } catch (error: any) {
      // User cancelled or error occurred
      if (error.message?.includes('cancelled') || error.message?.includes('Share not supported')) {
        // Silently handle cancellation or show toast
        return;
      }
      throw error;
    }
  },
};
