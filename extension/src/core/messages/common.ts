export const commonEn = {
  'common.toast.copyFailed': 'Couldn’t copy to the clipboard',
  'common.toast.urlCopied': 'URL copied',
  'common.toast.markdownCopied': 'Markdown link copied',
  'common.toast.addedToFavorites': 'Added to Favorites',
  'common.toast.pinned': 'Pinned',
  'common.toast.unpinned': 'Unpinned',
  'common.toast.movedTo': 'Moved to “{name}”',
} as const;

export const commonJa: Record<keyof typeof commonEn, string> = {
  'common.toast.copyFailed': 'クリップボードにコピーできませんでした',
  'common.toast.urlCopied': 'URLをコピーしました',
  'common.toast.markdownCopied': 'Markdown リンクをコピーしました',
  'common.toast.addedToFavorites': 'Favorite に追加しました',
  'common.toast.pinned': 'ピン留めしました',
  'common.toast.unpinned': 'ピン留めを解除しました',
  'common.toast.movedTo': '「{name}」へ移動しました',
};
