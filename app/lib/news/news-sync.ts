import type { Client } from '@libsql/client';
import type { NewsItem } from '@/app/types/news';
import {
  fetchCuratedFeedItems,
  storyPublishedIso,
  storyUrl,
  type RssStoryItem,
} from '@/app/lib/news/rss-fetch';
import { fetchArticleTextExcerpt } from '@/app/lib/news/article-text';
import { summarizeWithQwen } from '@/app/lib/news/qwen';

const SYNC_INTERVAL_MS = 6 * 60 * 60 * 1000;
const RSS_FETCH_LIMIT = 40;
/** 单次同步最多写入条数，避免冷启动时请求过多导致超时（环境变量为空或 0 时回退为 8） */
const MAX_NEW_PER_SYNC = Math.max(
  1,
  Number.parseInt(process.env.NEWS_SYNC_MAX_ITEMS ?? '8', 10) || 8,
);
const EXCERPT_LEN = 10000;

export async function ensureNewsSchema(db: Client) {
  const master = await db.execute(
    "SELECT sql FROM sqlite_master WHERE type='table' AND name='news'",
  );
  const row = master.rows[0] as Record<string, unknown> | undefined;
  const ddl = row?.sql ? String(row.sql) : '';

  if (ddl.includes('hn_id')) {
    await db.execute(`ALTER TABLE news RENAME TO news_legacy_hn`);
    await db.execute(`
      CREATE TABLE news (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        item_key TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL,
        title_zh TEXT NOT NULL DEFAULT '',
        summary TEXT NOT NULL,
        category TEXT NOT NULL,
        url TEXT NOT NULL,
        created_at TEXT NOT NULL
      )
    `);
    await db.execute(`
      INSERT INTO news (item_key, title, title_zh, summary, category, url, created_at)
      SELECT 'legacy:hn:' || CAST(hn_id AS TEXT), title, '', summary, category, url, created_at
      FROM news_legacy_hn
    `);
    await db.execute(`DROP TABLE news_legacy_hn`);
  } else {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS news (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        item_key TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL,
        title_zh TEXT NOT NULL DEFAULT '',
        summary TEXT NOT NULL,
        category TEXT NOT NULL,
        url TEXT NOT NULL,
        created_at TEXT NOT NULL
      )
    `);
  }

  const colInfo = await db.execute(`PRAGMA table_info(news)`);
  const hasTitleZh = colInfo.rows.some(
    (r) => String((r as Record<string, unknown>).name) === 'title_zh',
  );
  if (!hasTitleZh) {
    await db.execute(`ALTER TABLE news ADD COLUMN title_zh TEXT NOT NULL DEFAULT ''`);
  }

  await db.execute(`
    CREATE TABLE IF NOT EXISTS news_sync_meta (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      last_sync_at INTEGER NOT NULL
    )
  `);
}

function rowToNewsItem(row: Record<string, unknown>): NewsItem {
  return {
    id: Number(row.id),
    title: String(row.title),
    titleZh: row.title_zh != null ? String(row.title_zh) : '',
    summary: String(row.summary),
    category: row.category as NewsItem['category'],
    url: String(row.url),
    createdAt: String(row.created_at),
  };
}

async function getLastSync(db: Client): Promise<number | null> {
  const r = await db.execute('SELECT last_sync_at FROM news_sync_meta WHERE id = 1');
  const row = r.rows[0] as Record<string, unknown> | undefined;
  if (!row) return null;
  return Number(row.last_sync_at);
}

async function setLastSync(db: Client, t: number) {
  await db.execute({
    sql: `INSERT INTO news_sync_meta (id, last_sync_at) VALUES (1, ?)
          ON CONFLICT(id) DO UPDATE SET last_sync_at = excluded.last_sync_at`,
    args: [t],
  });
}

async function itemKeyExists(db: Client, key: string): Promise<boolean> {
  const r = await db.execute({
    sql: 'SELECT 1 FROM news WHERE item_key = ? LIMIT 1',
    args: [key],
  });
  return r.rows.length > 0;
}

async function buildExcerpt(item: RssStoryItem): Promise<string> {
  const url = storyUrl(item);
  if (url.includes('news.ycombinator.com/item')) {
    return '';
  }
  return fetchArticleTextExcerpt(url, EXCERPT_LEN);
}

/** 使用 ON CONFLICT 幂等插入，避免并发 / 双请求时 UNIQUE 报错 */
async function insertStory(db: Client, item: RssStoryItem): Promise<boolean> {
  const title = item.title ?? '';
  const excerpt = await buildExcerpt(item);
  const { titleZh, summary, category } = await summarizeWithQwen(title, excerpt);
  const url = storyUrl(item);
  const createdAt = storyPublishedIso(item);

  const rs = await db.execute({
    sql: `INSERT INTO news (item_key, title, title_zh, summary, category, url, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(item_key) DO NOTHING`,
    args: [item.itemKey, title, titleZh, summary, category, url, createdAt],
  });
  return (rs.rowsAffected ?? 0) > 0;
}

export async function maybeSyncNewsFeeds(db: Client) {
  try {
    await ensureNewsSchema(db);

    const now = Date.now();
    const last = await getLastSync(db);
    const countRow = await db.execute('SELECT COUNT(*) AS c FROM news');
    const total = Number((countRow.rows[0] as Record<string, unknown>)?.c ?? 0);

    const needSync = total === 0 || last == null || now - last > SYNC_INTERVAL_MS;

    if (!needSync) return;

    const stories = await fetchCuratedFeedItems(RSS_FETCH_LIMIT);
    if (stories.length === 0) {
      console.warn('[news-sync] no RSS items fetched, skip updating last_sync');
      return;
    }

    let added = 0;
    for (const item of stories) {
      if (added >= MAX_NEW_PER_SYNC) break;
      if (await itemKeyExists(db, item.itemKey)) continue;
      try {
        const inserted = await insertStory(db, item);
        if (inserted) added += 1;
      } catch (e) {
        console.error('news sync item failed', item.itemKey, e);
      }
    }

    await setLastSync(db, now);
  } catch (error) {
    console.error('news sync failed', error);
    throw error;
  }
}

export async function selectAllNews(db: Client): Promise<NewsItem[]> {
  const result = await db.execute(
    'SELECT id, title, title_zh, summary, category, url, created_at FROM news ORDER BY created_at DESC',
  );
  return result.rows.map((row) => rowToNewsItem(row as Record<string, unknown>));
}
