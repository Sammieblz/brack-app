export interface GoogleBookResult {
  googleBooksId: string;
  title: string;
  author: string | null;
  isbn: string | null;
  genre: string | null;
  pages: number | null;
  cover_url: string | null;
  description: string | null;
  publisher: string | null;
  published_date: string | null;
}
