import { CURATED_RSS_FEEDS } from '@/app/lib/news/config/rss-feeds';

const EXTRA_FEED_NAMES: Record<string, string> = {
  'hf-papers': 'Hugging Face Daily Papers',
};

/** 展示用信源名称，提高列表可读性与信任度 */
export function getFeedDisplayName(feedId: string): string {
  const fromCurated = CURATED_RSS_FEEDS.find((f) => f.id === feedId);
  if (fromCurated) return fromCurated.name;
  return EXTRA_FEED_NAMES[feedId] ?? feedId;
}
