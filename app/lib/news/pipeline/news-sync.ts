import type { Client } from '@libsql/client';
import type { NewsItem } from '@/app/types/news';
import { runFeedPipeline } from './feed-pipeline';
import { storyPublishedIso, storyUrl, type RssStoryItem } from '@/app/lib/news/fetch/rss-fetch';
import { fetchArticleTextExcerpt } from '@/app/lib/news/fetch/article-text';
import { summarizeWithQwen } from '@/app/lib/news/fetch/qwen';
import { isPaperFeed } from '@/app/lib/news/utils/paper-filter';
import { getFeedDisplayName } from '@/app/lib/news/utils/feed-display';
import { deriveTopicTags } from '@/app/lib/news/utils/topic-tags';
import { startOfLocalDayMs } from '@/app/lib/news/utils/local-day';
import { refreshTrendsCache } from '@/app/lib/trends';

/** 距上次成功同步超过此时长才再次拉取 RSS（默认 2 小时） */
const SYNC_INTERVAL_MS = 2 * 60 * 60 * 1000;
const MS_DAY = 24 * 60 * 60 * 1000;
const MS_WEEK = 7 * MS_DAY;

function isoUtcMs(ms: number): string {
  return new Date(ms).toISOString();
}
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
        created_at TEXT NOT NULL,
        source_id TEXT NOT NULL DEFAULT '',
        source_name TEXT NOT NULL DEFAULT '',
        tags TEXT NOT NULL DEFAULT '[]',
        score REAL NOT NULL DEFAULT 0,
        db_synced_at INTEGER NOT NULL DEFAULT 0
      )
    `);
    await db.execute(`
      INSERT INTO news (item_key, title, title_zh, summary, category, url, created_at, source_id, source_name, tags, score, db_synced_at)
      SELECT 'legacy:hn:' || CAST(hn_id AS TEXT), title, '', summary, category, url, created_at, '', '', '[]', 0, 0
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
        created_at TEXT NOT NULL,
        source_id TEXT NOT NULL DEFAULT '',
        source_name TEXT NOT NULL DEFAULT '',
        tags TEXT NOT NULL DEFAULT '[]',
        score REAL NOT NULL DEFAULT 0,
        db_synced_at INTEGER NOT NULL DEFAULT 0
      )
    `);
  }

  const colInfo = await db.execute(`PRAGMA table_info(news)`);
  const columnNames = new Set(colInfo.rows.map((r) => String((r as Record<string, unknown>).name)));
  if (!columnNames.has('title_zh')) {
    await db.execute(`ALTER TABLE news ADD COLUMN title_zh TEXT NOT NULL DEFAULT ''`);
  }
  if (!columnNames.has('source_id')) {
    await db.execute(`ALTER TABLE news ADD COLUMN source_id TEXT NOT NULL DEFAULT ''`);
  }
  if (!columnNames.has('source_name')) {
    await db.execute(`ALTER TABLE news ADD COLUMN source_name TEXT NOT NULL DEFAULT ''`);
  }
  if (!columnNames.has('tags')) {
    await db.execute(`ALTER TABLE news ADD COLUMN tags TEXT NOT NULL DEFAULT '[]'`);
  }
  if (!columnNames.has('score')) {
    await db.execute(`ALTER TABLE news ADD COLUMN score REAL NOT NULL DEFAULT 0`);
  }
  if (!columnNames.has('db_synced_at')) {
    await db.execute(`ALTER TABLE news ADD COLUMN db_synced_at INTEGER NOT NULL DEFAULT 0`);
  }

  await backfillSourceMetadataIfNeeded(db);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS news_sync_meta (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      last_sync_at INTEGER NOT NULL
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS news_trends_cache (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      signal TEXT NOT NULL DEFAULT '',
      top_keywords TEXT NOT NULL DEFAULT '[]',
      source TEXT NOT NULL DEFAULT 'rules',
      count INTEGER NOT NULL DEFAULT 0,
      aligns_sync_at INTEGER NOT NULL DEFAULT 0
    )
  `);
}

function parseTagsJson(raw: unknown): string[] {
  if (raw == null || raw === '') return [];
  try {
    const p = JSON.parse(String(raw));
    return Array.isArray(p) ? p.map(String).filter(Boolean) : [];
  } catch {
    return [];
  }
}

/** `item_key` 形如 `feedId:hash` */
function parseFeedIdFromItemKey(itemKey: string): string | null {
  const i = itemKey.indexOf(':');
  if (i <= 0) return null;
  return itemKey.slice(0, i);
}

/** 旧数据无 source 列时，从 `item_key` 推导并写入 */
async function backfillSourceMetadataIfNeeded(db: Client) {
  const r = await db.execute({
    sql: `SELECT id, item_key, category FROM news
          WHERE (source_id IS NULL OR source_id = '')
            AND instr(COALESCE(item_key, ''), ':') > 0
            AND NOT (COALESCE(item_key, '') LIKE 'legacy:%')`,
    args: [],
  });
  for (const row of r.rows) {
    const rec = row as Record<string, unknown>;
    const id = Number(rec.id);
    const itemKey = String(rec.item_key ?? '');
    if (itemKey.startsWith('legacy:')) continue;
    const category = rec.category as NewsItem['category'];
    const feedId = parseFeedIdFromItemKey(itemKey);
    if (!feedId) continue;
    const sourceName = getFeedDisplayName(feedId);
    const tags = deriveTopicTags({ feedId, category });
    await db.execute({
      sql: `UPDATE news SET source_id = ?, source_name = ?, tags = ? WHERE id = ?`,
      args: [feedId, sourceName, JSON.stringify(tags), id],
    });
  }
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
    sourceId: row.source_id != null ? String(row.source_id) : '',
    sourceName: row.source_name != null ? String(row.source_name) : '',
    tags: parseTagsJson(row.tags),
    score: row.score != null && row.score !== '' ? Number(row.score) : 0,
  };
}

async function getLastSync(db: Client): Promise<number | null> {
  const r = await db.execute('SELECT last_sync_at FROM news_sync_meta WHERE id = 1');
  const row = r.rows[0] as Record<string, unknown> | undefined;
  if (!row) return null;
  return Number(row.last_sync_at);
}

/** 最近一次成功写入 `last_sync_at` 的时间戳（毫秒），无记录时为 null */
export async function getLastNewsSyncAt(db: Client): Promise<number | null> {
  return getLastSync(db);
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
async function insertStory(
  db: Client,
  item: RssStoryItem,
  pipelineScore: number,
): Promise<boolean> {
  const title = item.title ?? '';
  const excerpt = await buildExcerpt(item);
  const { titleZh, summary, category: catFromModel } = await summarizeWithQwen(title, excerpt);
  const category = isPaperFeed(item.feedId) ? 'Paper' : catFromModel;
  const url = storyUrl(item);
  const createdAt = storyPublishedIso(item);
  const sourceId = item.feedId;
  const sourceName = getFeedDisplayName(sourceId);
  const tagsJson = JSON.stringify(deriveTopicTags({ feedId: sourceId, category }));

  const syncedAt = Date.now();
  const rs = await db.execute({
    sql: `INSERT INTO news (item_key, title, title_zh, summary, category, url, created_at, source_id, source_name, tags, score, db_synced_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(item_key) DO NOTHING`,
    args: [
      item.itemKey,
      title,
      titleZh,
      summary,
      category,
      url,
      createdAt,
      sourceId,
      sourceName,
      tagsJson,
      pipelineScore,
      syncedAt,
    ],
  });
  return (rs.rowsAffected ?? 0) > 0;
}

export async function maybeSyncNewsFeeds(db: Client) {
  try {
    await ensureNewsSchema(db);

    const now = Date.now();
    const last = await getLastSync(db);
    const dayStart = startOfLocalDayMs();
    const countRow = await db.execute({
      sql: 'SELECT COUNT(*) AS c FROM news WHERE db_synced_at >= ?',
      args: [dayStart],
    });
    const totalToday = Number((countRow.rows[0] as Record<string, unknown>)?.c ?? 0);

    const needSync = totalToday === 0 || last == null || now - last > SYNC_INTERVAL_MS;

    if (!needSync) return;

    const { items: stories, insertLimit, scoreByItemKey } = await runFeedPipeline();
    if (stories.length === 0) {
      console.warn('[news-sync] no RSS items fetched, skip updating last_sync');
      return;
    }

    let added = 0;
    for (const item of stories) {
      if (added >= insertLimit) break;
      if (await itemKeyExists(db, item.itemKey)) continue;
      try {
        const pipelineScore = scoreByItemKey.get(item.itemKey) ?? 0;
        const inserted = await insertStory(db, item, pipelineScore);
        if (inserted) added += 1;
      } catch (e) {
        console.error('news sync item failed', item.itemKey, e);
      }
    }

    await setLastSync(db, now);
    await refreshTrendsCache(db, now).catch((e) => {
      console.error('[news-sync] trends cache failed', e);
    });
  } catch (error) {
    console.error('news sync failed', error);
    throw error;
  }
}

export async function selectAllNews(db: Client): Promise<NewsItem[]> {
  const dayStart = startOfLocalDayMs();
  const result = await db.execute({
    sql: `SELECT id, title, title_zh, summary, category, url, created_at, source_id, source_name, tags, score
          FROM news
          WHERE db_synced_at >= ?
          ORDER BY score DESC, created_at DESC`,
    args: [dayStart],
  });
  return result.rows.map((row) => rowToNewsItem(row as Record<string, unknown>));
}

/**
 * 今日同步批次内、发布时间落在最近 24 小时的高分条目（侧栏「今日热点」，与主列表同源）。
 */
export async function selectHot24hNews(db: Client, limit = 10): Promise<NewsItem[]> {
  const dayStart = startOfLocalDayMs();
  const since24h = isoUtcMs(Date.now() - MS_DAY);
  const result = await db.execute({
    sql: `SELECT id, title, title_zh, summary, category, url, created_at, source_id, source_name, tags, score
          FROM news
          WHERE db_synced_at >= ?
            AND created_at >= ?
          ORDER BY score DESC, created_at DESC
          LIMIT ?`,
    args: [dayStart, since24h, limit],
  });
  return result.rows.map((row) => rowToNewsItem(row as Record<string, unknown>));
}

/**
 * 近 7 天（按发布时间）高分精选；可排除与 24h 热点重复的 id。
 */
export async function selectWeeklyTopNews(
  db: Client,
  limit: number,
  excludeIds: number[],
): Promise<NewsItem[]> {
  const since7d = isoUtcMs(Date.now() - MS_WEEK);
  if (excludeIds.length === 0) {
    const result = await db.execute({
      sql: `SELECT id, title, title_zh, summary, category, url, created_at, source_id, source_name, tags, score
            FROM news
            WHERE created_at >= ?
            ORDER BY score DESC, created_at DESC
            LIMIT ?`,
      args: [since7d, limit],
    });
    return result.rows.map((row) => rowToNewsItem(row as Record<string, unknown>));
  }
  const placeholders = excludeIds.map(() => '?').join(',');
  const result = await db.execute({
    sql: `SELECT id, title, title_zh, summary, category, url, created_at, source_id, source_name, tags, score
          FROM news
          WHERE created_at >= ?
            AND id NOT IN (${placeholders})
          ORDER BY score DESC, created_at DESC
          LIMIT ?`,
    args: [since7d, ...excludeIds, limit],
  });
  return result.rows.map((row) => rowToNewsItem(row as Record<string, unknown>));
}
