import { NextResponse } from 'next/server';
import {
  getLastNewsSyncAt,
  maybeSyncNewsFeeds,
  selectAllNews,
  selectHot24hNews,
  selectWeeklyTopNews,
} from '@/app/lib/news/pipeline/news-sync';
import { getDbClient, resolveTursoUrl } from '@/app/lib/turso-client';
import type { NewsItem } from '@/app/types/news';

export type { NewsItem } from '@/app/types/news';

export { getDbClient } from '@/app/lib/turso-client';

export const fetchNewsData = async () => {
  if (!resolveTursoUrl()) {
    return [];
  }
  const db = getDbClient();
  await maybeSyncNewsFeeds(db);
  return selectAllNews(db);
};

/** 首页：列表 + 上次同步时间（毫秒时间戳） */
export async function fetchNewsPageData(): Promise<{
  newsList: NewsItem[];
  lastSyncedAt: number | null;
  hot24h: NewsItem[];
  weeklyPicks: NewsItem[];
}> {
  if (!resolveTursoUrl()) {
    return { newsList: [], lastSyncedAt: null, hot24h: [], weeklyPicks: [] };
  }
  const db = getDbClient();
  await maybeSyncNewsFeeds(db);
  const [newsList, lastSyncedAt, hot24h] = await Promise.all([
    selectAllNews(db),
    getLastNewsSyncAt(db),
    selectHot24hNews(db, 5),
  ]);
  const weeklyPicks = await selectWeeklyTopNews(
    db,
    10,
    hot24h.map((i) => i.id),
  );
  return { newsList, lastSyncedAt, hot24h, weeklyPicks };
}

export async function GET() {
  try {
    const items = await fetchNewsData();
    return NextResponse.json(items);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to load news' }, { status: 500 });
  }
}
