export const EMPTY_STATE_ASSETS = {
  emptyLibrary: "/3dicons/3dicons-notebook-front-clay.webp",
  emptyFeed: "/3dicons/3dicons-chat-bubble-front-clay.webp",
  emptyMessages: "/3dicons/3dicons-chat-front-clay.webp",
  chooseConversation: "/3dicons/3dicons-chat-text-front-clay.webp",
  badConnection: "/3dicons/3dicons-wifi-front-clay.webp",
  emptyClubs: "/3dicons/3dicons-chat-bubble-front-clay.webp",
  emptyLists: "/3dicons/3dicons-file-front-clay.webp",
  emptyReviews: "/3dicons/3dicons-pencil-front-clay.webp",
  emptyAnalytics: "/3dicons/3dicons-chart-front-clay.webp",
  emptyJournal: "/3dicons/3dicons-notebook-front-clay.webp",
  emptyProgress: "/3dicons/3dicons-chart-front-clay.webp",
  emptyGoals: "/3dicons/3dicons-target-front-clay.webp",
  emptyReaders: "/3dicons/3dicons-boy-front-clay.webp",
  emptyComments: "/3dicons/3dicons-chat-text-front-clay.webp",
  emptyQuotes: "/3dicons/3dicons-pencil-front-clay.webp",
  noResults: "/3dicons/3dicons-file-front-clay.webp",
  missingCover: "/3dicons/3dicons-notebook-front-clay.webp",
  syncReviewClear: "/3dicons/3dicons-tick-front-clay.webp",
} as const;

export type EmptyStateAssetKey = keyof typeof EMPTY_STATE_ASSETS;
