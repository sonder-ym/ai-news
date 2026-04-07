import type { NewsItem } from '@/app/types/news';

export type FeedFilter = 'all' | 'paper' | 'oss' | 'tool';

export function filterByCategory(list: NewsItem[], key: FeedFilter): NewsItem[] {
  if (key === 'all') return list;
  if (key === 'paper') return list.filter((i) => i.category === 'Paper');
  if (key === 'tool') return list.filter((i) => i.category === 'Tool');
  return list.filter((i) => i.category === 'News');
}

export function filterByTopic(list: NewsItem[], topicKey: 'all' | string): NewsItem[] {
  if (topicKey === 'all') return list;
  return list.filter((i) => i.tags.includes(topicKey));
}

export function matchesNewsKeyword(item: NewsItem, q: string): boolean {
  const lower = q.trim().toLowerCase();
  if (!lower) return true;
  return (
    item.title.toLowerCase().includes(lower) ||
    item.titleZh.toLowerCase().includes(lower) ||
    item.summary.toLowerCase().includes(lower) ||
    item.sourceName.toLowerCase().includes(lower) ||
    item.sourceId.toLowerCase().includes(lower) ||
    item.tags.some((t) => t.toLowerCase().includes(lower))
  );
}

export function filterNewsList(
  items: NewsItem[],
  category: FeedFilter,
  topicKey: 'all' | string,
  keyword: string,
): NewsItem[] {
  let list = filterByCategory(items, category);
  list = filterByTopic(list, topicKey);
  const q = keyword.trim();
  if (!q) return list;
  return list.filter((i) => matchesNewsKeyword(i, q));
}

/** 侧栏主题标签及出现次数（降序） */
export function buildTopicCatalog(items: NewsItem[]): [string, number][] {
  const counts = new Map<string, number>();
  for (const i of items) {
    for (const t of i.tags) {
      counts.set(t, (counts.get(t) ?? 0) + 1);
    }
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'zh-CN'));
}

export function slicePage<T>(list: T[], page: number, pageSize: number): T[] {
  const start = (page - 1) * pageSize;
  return list.slice(start, start + pageSize);
}

export function totalPages(totalItems: number, pageSize: number): number {
  return Math.max(1, Math.ceil(totalItems / pageSize) || 1);
}
