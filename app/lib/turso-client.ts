import { createClient, type Client } from '@libsql/client';

/** 兼容 Turso 文档中的 `TURSO_DATABASE_URL` 与项目里常用的 `TURSO_URL` */
export function resolveTursoUrl() {
  return process.env.TURSO_DATABASE_URL ?? process.env.TURSO_URL ?? '';
}

export function resolveTursoToken() {
  return process.env.TURSO_TOKEN;
}

let client: Client | undefined;

export function getDbClient(): Client {
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
}
