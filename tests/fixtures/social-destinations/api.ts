import type { Post } from '../../../apps/client/src/services/api/social';
import type { BookClub } from '../../../apps/client/src/services/api/clubs';
import type { Review } from '../../../apps/client/src/services/api/reviews';
import type { UserSearchResult } from '../../../apps/client/src/services/api/readers';
import { post as basePost } from '../live-composers/api';
import { actions } from './data';
export * from '../live-composers/api';
const stamp = '2026-10-01T12:00:00Z';
const cover = '/brack-favicon/favicon-96x96.png';
const reader = { id: 'reader-one', display_name: 'Taylor Lane', avatar_url: null };
const book = { id: 'book-one', title: 'A Room of One’s Own', author: 'Virginia Woolf', cover_url: cover, pages: 240 };
const posts: Post[] = [{ ...basePost, user: reader, user_id: reader.id, book_id: book.id, book, post_type: 'book' },
  { ...basePost, id: 'post-club', title: 'Read together', user: reader, user_id: reader.id, club_id: 'club-one',
    club: { id: 'club-one', name: 'The Chapter Circle', description: 'A reading group' }, post_type: 'club' }];
const club: BookClub = { id: 'club-one', name: 'The Chapter Circle', description: 'Thoughtful reading, shared slowly.',
  created_by: reader.id, created_at: stamp, updated_at: stamp, is_private: false, genres: ['Fiction'], tags: ['Slow reading'],
  member_count: 2, discussion_count: 0, announcement_count: 0, user_role: 'member', join_status: 'member', avatar_image_url: cover };
const publicClub: BookClub = { ...club, id: 'club-public', name: 'Open Reading Circle', user_role: undefined, join_status: 'none' };
const privateMemberClub: BookClub = { ...club, id: 'club-private-member', name: 'Private Members Circle', is_private: true, preview_only: true };
const privateClub: BookClub = { ...club, id: 'club-private', name: 'Quiet Reading Circle', is_private: true, preview_only: true,
  user_role: undefined, join_status: 'none', banner_image_url: cover };
export const review: Review = { id: 'review-one', user_id: reader.id, book_id: book.id, book, profiles: reader, reviewer: reader,
  rating: 4, title: 'Space for thought', content: 'A thoughtful reading experience.', content_format: 'tiptap',
  content_html: '<p>A thoughtful reading experience. <a href="https://example.org/reading">Reading notes</a></p>',
  is_spoiler: true, is_public: true, likes_count: 2, comments_count: 0, created_at: stamp, updated_at: stamp, user_has_liked: false,
  viewer_book_id: book.id };
const related = { ...review, id: 'review-related', title: null, viewer_book_id: null, is_spoiler: false };
export const discoverReaders = async () => {
  const person: UserSearchResult = { ...reader, bio: 'Reading slowly and sharing passages.', current_streak: 3, books_read_count: 8,
    mutual_friend_count: 2, shared_club_count: 1, relationship: 'none', status_badge: 'reading_now', is_online: true,
    last_seen_at: stamp, badges: ['Fiction', 'Active now'], recommendation_reason: 'Shared reading interests', recommendation_score: 1 };
  return { suggestions: [person], nearby: [person], connections: [person], friendsOfFriends: [person], activeFriends: [person], searchResults: [person] };
};
export const getPostsFeed = async () => ({ items: posts, has_more: false, caught_up: true, feed_mode: 'following' });
export const getPostById = async (id: string) => posts.find(post => post.id === id) ?? posts[0];
export const fetchUserProfileTabData = async () => ({ books: [], posts: posts.map(post => ({ ...post, profiles: post.user, books: post.book })), clubs: [] });
export const getClubsHome = async () => ({ myClubs: [club, privateMemberClub], suggested: [publicClub, privateClub], nearby: [], popular: [publicClub],
  newest: [publicClub], invites: [], pendingRequests: [], searchResults: [publicClub, privateClub], summary: { my_clubs: 2, suggested: 2, nearby: 0, invites: 0, pending_requests: 0 } });
export const joinBookClub = async () => { actions.push('join'); };
export const leaveBookClub = async () => { actions.push('leave'); };
export const requestJoinClub = async () => { actions.push('request'); };
export const togglePostLike = async () => { actions.push('post-like'); return { liked: true, likes_count: 5 }; };
export const getReviewsFeed = async () => ({ items: [review, related], has_more: false, summary: { rating_mix: [], trending_books: [{ ...book, review_count: 2, average_rating: 4 }], review_opportunities: [] } });
export const fetchReviewDetail = async (id: string) => {
  if (id === 'missing') throw Object.assign(new Error('Fixture review unavailable'), { status: 404 });
  return { review: id === related.id ? related : review, related_reviews: id === related.id ? [review] : [related] };
};
export const fetchSingleReview = async () => review;
export const fetchBookReviews = async () => ({ reviews: [review], averageRating: 4, userHasReviewed: false });
export const fetchCommunityReviews = fetchBookReviews;
export const fetchReviewComments = async () => ({ comments: [], has_more: false });
export const checkBookReviewLiked = async () => false;
export const toggleBookReviewLike = async () => { actions.push('review-like'); return { liked: true, likes_count: 3 }; };
export const likeBookReview = toggleBookReviewLike;
export const unlikeBookReview = toggleBookReviewLike;
const unsupported = async () => { throw new Error('Mutation outside destination fixture'); };
export const createBookReview = unsupported;
export const updateBookReview = unsupported;
export const deleteBookReview = unsupported;
export const deleteReviewComment = unsupported;
export const addReviewComment = unsupported;
export const shareReview = unsupported;
export const fetchActiveBookById = async () => ({ ...book, user_id: 'shell-reader', status: 'reading', current_page: 40, created_at: stamp, updated_at: stamp });
export const fetchBookReadingSessions = async () => [];
export const fetchProgressLogs = async () => [];
export const getBookProgress = async () => null;
export const updateBookQuickProgress = unsupported;
export const emitBooksChanged = () => {};
