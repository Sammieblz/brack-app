export const EMPTY_STATE_ASSETS = {
  emptyLibrary: "/3dicons/3dicons-notebook-front-clay.png",
  emptyFeed: "/3dicons/3dicons-chat-bubble-front-clay.png",
  emptyMessages: "/3dicons/3dicons-chat-front-clay.png",
  chooseConversation: "/3dicons/3dicons-chat-text-front-clay.png",
  badConnection: "/3dicons/3dicons-wifi-front-clay.png",
  emptyClubs: "/3dicons/3dicons-chat-bubble-front-clay.png",
  emptyLists: "/3dicons/3dicons-file-front-clay.png",
  emptyReviews: "/3dicons/3dicons-pencil-front-clay.png",
  emptyAnalytics: "/3dicons/3dicons-chart-front-clay.png",
  emptyJournal: "/3dicons/3dicons-notebook-front-clay.png",
  emptyProgress: "/3dicons/3dicons-chart-front-clay.png",
  emptyGoals: "/3dicons/3dicons-target-front-clay.png",
  emptyReaders: "/3dicons/3dicons-boy-front-clay.png",
  emptyComments: "/3dicons/3dicons-chat-text-front-clay.png",
  emptyQuotes: "/3dicons/3dicons-pencil-front-clay.png",
  noResults: "/3dicons/3dicons-file-front-clay.png",
  missingCover: "/3dicons/3dicons-notebook-front-clay.png",
  syncReviewClear: "/3dicons/3dicons-tick-front-clay.png",
} as const;

export type EmptyStateAssetKey = keyof typeof EMPTY_STATE_ASSETS;
