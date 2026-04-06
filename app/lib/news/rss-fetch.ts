import { createHash } from 'crypto';
import Parser from 'rss-parser';
import { CURATED_RSS_FEEDS } from '@/app/lib/news/rss-feeds';

export type RssStoryItem = {
  itemKey: string;
  feedId: string;
  title: string;
  link: string;
  pubDateIso: string;
};

const parser = new Parser({
  timeout: 25000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (compatible; ai-news/1.0)',
    Accept: 'application/rss+xml, application/xml, text/xml, */*',
  },
});

function guidString(raw: { guid?: string | { value?: string } }): string {
  const g = raw.guid;
  if (typeof g === 'string') return g;
  if (g && typeof g === 'object' && g.value) return String(g.value);
  return '';
}

function resolveLink(raw: {
  link?: string;
  guid?: string | { value?: string };
  comments?: string;
}): string | null {
  const l = raw.link?.trim();
  if (l?.startsWith('http')) return l;
  const g = guidString(raw);
  if (g.startsWith('http')) return g;
  const c = raw.comments?.trim();
  if (c?.startsWith('http')) return c;
  return null;
}

function makeItemKey(feedId: string, raw: { link?: string; guid?: string | { value?: string } }) {
  const stable = guidString(raw) || raw.link || '';
  const h = createHash('sha256').update(`${feedId}:${stable}`).digest('hex').slice(0, 32);
  return `${feedId}:${h}`;
}

/**
 * 并行拉取多个 RSS，按源内顺序保留；全局按 URL 去重（列表靠前源优先）；再按时间降序，截断到 totalLimit。
 */
export async function fetchCuratedFeedItems(totalLimit: number): Promise<RssStoryItem[]> {
  const settled = await Promise.allSettled(
    CURATED_RSS_FEEDS.map(async (feed) => {
      const parsed = await parser.parseURL(feed.url);
      const out: RssStoryItem[] = [];
      for (const raw of parsed.items) {
        const title = raw.title?.trim();
        if (!title) continue;
        const link = resolveLink(raw);
        if (!link) continue;
        const pubMs = raw.pubDate ? Date.parse(raw.pubDate) : Date.now();
        const pubDateIso = new Date(Number.isNaN(pubMs) ? Date.now() : pubMs).toISOString();
        out.push({
          itemKey: makeItemKey(feed.id, raw),
          feedId: feed.id,
          title,
          link,
          pubDateIso,
        });
        if (out.length >= feed.maxItems) break;
      }
      return out;
    }),
  );

  const merged: RssStoryItem[] = [];
  for (const s of settled) {
    if (s.status === 'fulfilled') merged.push(...s.value);
    else console.error('[rss-fetch] feed error', s.reason);
  }

  const seenUrl = new Set<string>();
  const seenKey = new Set<string>();
  const deduped: RssStoryItem[] = [];
  for (const it of merged) {
    const urlKey = it.link.split('#')[0].trim();
    if (seenUrl.has(urlKey) || seenKey.has(it.itemKey)) continue;
    seenUrl.add(urlKey);
    seenKey.add(it.itemKey);
    deduped.push(it);
  }

  deduped.sort((a, b) => Date.parse(b.pubDateIso) - Date.parse(a.pubDateIso));
  return deduped.slice(0, totalLimit);
}

export function storyUrl(item: RssStoryItem): string {
  return item.link;
}

export function storyPublishedIso(item: RssStoryItem): string {
  return item.pubDateIso;
}
