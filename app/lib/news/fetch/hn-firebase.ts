import type { RssStoryItem } from '@/app/lib/news/fetch/rss-fetch';

const HN_API = 'https://hacker-news.firebaseio.com/v0';

type HNApiItem = {
  id?: number;
  type?: string;
  score?: number;
  descendants?: number;
};

export function extractHnStoryId(
  item: Pick<RssStoryItem, 'link' | 'commentsUrl'>,
): number | undefined {
  const fromQuery = (u: string) => {
    const m = u.match(/[?&]id=(\d+)/);
    return m ? Number(m[1]) : undefined;
  };
  if (item.commentsUrl?.includes('news.ycombinator.com')) {
    const id = fromQuery(item.commentsUrl);
    if (id != null) return id;
  }
  if (item.link.includes('news.ycombinator.com/item')) {
    return fromQuery(item.link);
  }
  return undefined;
}

async function fetchHNItem(id: number): Promise<HNApiItem | null> {
  try {
    const res = await fetch(`${HN_API}/item/${id}.json`, {
      next: { revalidate: 120 },
    });
    if (!res.ok) return null;
    return (await res.json()) as HNApiItem;
  } catch {
    return null;
  }
}

/**
 * 对含 HN story id 的条目并行拉取 Firebase 官方 API，写入 hnScore / hnDescendants。
 */
export async function enrichHnFromFirebase(items: RssStoryItem[]): Promise<void> {
  const idSet = new Map<number, RssStoryItem[]>();
  for (const it of items) {
    const id = extractHnStoryId(it) ?? it.hnItemId;
    if (id == null) continue;
    it.hnItemId = id;
    const list = idSet.get(id) ?? [];
    list.push(it);
    idSet.set(id, list);
  }

  const ids = [...idSet.keys()];
  const chunkSize = 25;
  const detail = new Map<number, HNApiItem>();

  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    const results = await Promise.all(chunk.map((id) => fetchHNItem(id)));
    for (let j = 0; j < chunk.length; j++) {
      const id = chunk[j];
      const row = results[j];
      if (row && row.type === 'story') detail.set(id, row);
    }
  }

  for (const it of items) {
    const id = it.hnItemId;
    if (id == null) continue;
    const row = detail.get(id);
    if (!row) continue;
    it.hnScore = row.score ?? 0;
    it.hnDescendants = row.descendants ?? 0;
  }
}

export function maxHnEngagementInBatch(items: RssStoryItem[]): number {
  let m = 1;
  for (const it of items) {
    if (it.hnItemId == null) continue;
    const raw = (it.hnScore ?? 0) + (it.hnDescendants ?? 0) * 0.5;
    if (raw > m) m = raw;
  }
  return m;
}
