import { createClient, type Client } from '@libsql/client';
import { NextResponse } from 'next/server';
import { maybeSyncNewsFeeds, selectAllNews } from '@/app/lib/news/news-sync';

export type { NewsItem } from '@/app/types/news';

let client: Client;

/** 兼容 Turso 文档中的 `TURSO_DATABASE_URL` 与项目里常用的 `TURSO_URL` */
function resolveTursoUrl() {
  return process.env.TURSO_URL ?? '';
}

function resolveTursoToken() {
  return process.env.TURSO_TOKEN;
}

export const getDbClient = () => {
  const url = resolveTursoUrl();
  if (!url) {
    throw new Error('TURSO_DATABASE_URL or TURSO_URL is not configured');
  }
  if (!client) {
    client = createClient({
      url,
      authToken: resolveTursoToken(),
    });
  }
  return client;
};

export const fetchNewsData = async () => {
  if (!resolveTursoUrl()) {
    return [];
  }
  const db = getDbClient();
  await maybeSyncNewsFeeds(db);
  return selectAllNews(db);
};

export async function GET() {
  try {
    const items = await fetchNewsData();
    return NextResponse.json(items);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to load news' }, { status: 500 });
  }
}
