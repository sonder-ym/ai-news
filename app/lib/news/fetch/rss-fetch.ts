import { createHash } from 'crypto';
import Parser from 'rss-parser';
import { CURATED_RSS_FEEDS } from '@/app/lib/news/config/rss-feeds';

export type RssStoryItem = {
  itemKey: string;
  feedId: string;
  title: string;
  link: string;
  pubDateIso: string;
  /** hnrss 等源里指向 HN 讨论页的链接，用于解析 story id */
  commentsUrl?: string;
  hnItemId?: number;
  hnScore?: number;
  hnDescendants?: number;
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

const HF_DAILY_PAPERS_API = 'https://huggingface.co/api/daily_papers';
const HF_PAPERS_FEED_ID = 'hf-papers';
const HF_PAPERS_MAX_RAW = 50;

type HfDailyPaperRow = {
  paper?: {
    id?: string;
    title?: string;
    publishedAt?: string;
    submittedOnDailyAt?: string;
  };
};

/**
 * Hugging Face Daily Papers：公开 JSON，映射为与 RSS 一致的 `RssStoryItem`。
 */
async function fetchHfDailyPapersItems(): Promise<RssStoryItem[]> {
  try {
    const res = await fetch(HF_DAILY_PAPERS_API, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ai-news/1.0)',
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(25000),
    });
    if (!res.ok) {
      console.error('[rss-fetch] HF daily_papers HTTP', res.status);
      return [];
    }
    const data = (await res.json()) as HfDailyPaperRow[];
    if (!Array.isArray(data)) return [];

    const out: RssStoryItem[] = [];
    for (const row of data) {
      const p = row.paper;
      if (!p) continue;
      const id = p.id?.trim();
      const title = p.title?.trim();
      if (!id || !title) continue;
      const link = `https://arxiv.org/abs/${id}`;
      const pubMs = Date.parse(p.submittedOnDailyAt ?? p.publishedAt ?? '') || Date.now();
      const pubDateIso = new Date(pubMs).toISOString();
      const raw = { guid: id, link };
      out.push({
        itemKey: makeItemKey(HF_PAPERS_FEED_ID, raw),
        feedId: HF_PAPERS_FEED_ID,
        title,
        link,
        pubDateIso,
      });
      if (out.length >= HF_PAPERS_MAX_RAW) break;
    }
    return out;
  } catch (e) {
    console.error('[rss-fetch] HF daily_papers failed', e);
    return [];
  }
}

/**
 * 并行拉取 RSS → 合并去重（先出现的源优先），不做全局时间排序。
 * 后续由 pipeline 做 HN 增强、打分、分层截断。
 */
export async function fetchRawCuratedFeedItems(): Promise<RssStoryItem[]> {
  const [hfItems, settled] = await Promise.all([
    fetchHfDailyPapersItems(),
    Promise.allSettled(
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
          const comments =
            typeof raw.comments === 'string' && raw.comments.startsWith('http')
              ? raw.comments
              : undefined;
          out.push({
            itemKey: makeItemKey(feed.id, raw),
            feedId: feed.id,
            title,
            link,
            pubDateIso,
            commentsUrl: comments,
          });
          if (out.length >= feed.maxItems) break;
        }
        return out;
      }),
    ),
  ]);

  const merged: RssStoryItem[] = [];
  merged.push(...hfItems);
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

  return deduped;
}

export function storyUrl(item: RssStoryItem): string {
  return item.link;
}

export function storyPublishedIso(item: RssStoryItem): string {
  return item.pubDateIso;
}
