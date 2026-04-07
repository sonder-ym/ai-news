import type { Client } from '@libsql/client';
import { startOfLocalDayMs } from '@/app/lib/news/utils/local-day';
import { getDbClient, resolveTursoUrl } from '@/app/lib/turso-client';

const DASHSCOPE_COMPAT = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';

export type DailyTrendsSource = 'llm' | 'rules';

export type DailyTrendsResult = {
  /** 一句话趋势描述 */
  signal: string;
  /** 关键词标签（最多约 5 个） */
  topKeywords: string[];
  /** 参与统计的今日条数 */
  count: number;
  source: DailyTrendsSource;
};

type NewsRow = {
  title: string;
  title_zh: string;
  category: string;
};

function displayTitle(row: NewsRow): string {
  const zh = row.title_zh?.trim();
  if (zh) return zh;
  return row.title?.trim() || '';
}

function parseTopKeywordsJson(raw: unknown): string[] {
  if (raw == null || raw === '') return [];
  try {
    const p = JSON.parse(String(raw));
    return Array.isArray(p) ? p.map(String).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function ruleBasedSignal(rows: NewsRow[]): { signal: string; topKeywords: string[] } {
  const categoryCount: Record<string, number> = {};
  for (const r of rows) {
    const c = r.category || 'News';
    categoryCount[c] = (categoryCount[c] ?? 0) + 1;
  }

  const paper = categoryCount['Paper'] ?? 0;
  const tool = categoryCount['Tool'] ?? 0;
  const news = categoryCount['News'] ?? 0;

  let signal = '今日资讯结构均衡，覆盖论文、工具与行业动态。';
  if (paper >= 8 && paper >= tool && paper >= news) {
    signal = '📚 今日学术向内容占比较高，新论文与研究方向集中出现。';
  } else if (tool >= 8 && tool >= paper && tool >= news) {
    signal = '🛠️ 今日工具与开源项目更新较多，开发者向内容活跃。';
  } else if (news >= 8 && news >= paper && news >= tool) {
    signal = '📰 今日行业与公司动态占比较高，新闻类资讯密集。';
  }
  if (paper > 12) signal = '📚 学术爆发日：大量新论文与预印本进入视野。';
  if (tool > 12) signal = '🛠️ 工具井喷：开源与产品类更新集中。';

  const titles = rows.map(displayTitle).join(' ');
  const hot = [
    'GPT',
    'RAG',
    'Sora',
    'Agent',
    'LLM',
    '开源',
    '模型',
    'Claude',
    'OpenAI',
    '多模态',
    '推理',
    '对齐',
  ];
  const topKeywords: string[] = [];
  const lower = titles.toLowerCase();
  for (const k of hot) {
    if (titles.includes(k) || lower.includes(k.toLowerCase())) {
      topKeywords.push(k);
      if (topKeywords.length >= 5) break;
    }
  }

  return { signal, topKeywords };
}

function parseTrendJson(text: string): { trend_signal: string; keywords: string[] } | null {
  const trimmed = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '');
  try {
    const o = JSON.parse(trimmed) as {
      trend_signal?: string;
      keywords?: unknown;
    };
    const trend_signal = String(o.trend_signal ?? '').trim();
    const raw = o.keywords;
    const keywords = Array.isArray(raw)
      ? raw
          .map((x) => String(x).trim())
          .filter(Boolean)
          .slice(0, 5)
      : [];
    if (!trend_signal) return null;
    return { trend_signal, keywords };
  } catch {
    return null;
  }
}

function isDashScopeQuotaOrFreeTierError(status: number, body: string): boolean {
  if (status !== 403) return false;
  return (
    body.includes('AllocationQuota.FreeTierOnly') ||
    body.includes('FreeTierOnly') ||
    body.includes('free tier')
  );
}

async function analyzeTrendsWithQwen(
  titleLines: string[],
): Promise<{ trend_signal: string; keywords: string[] } | null> {
  const apiKey = process.env.DASHSCOPE_API_KEY;
  if (!apiKey || titleLines.length === 0) return null;

  const primary = process.env.DASHSCOPE_MODEL ?? 'qwen-turbo';
  const fallback = process.env.DASHSCOPE_MODEL_FALLBACK?.trim();
  const models = [...new Set([primary, fallback].filter((m): m is string => Boolean(m)))];

  const lines = titleLines.slice(0, 20).join('\n');

  const userContent = `你是一名 AI 行业分析师。以下是今日收录的资讯标题（每行一条，最多 24 条）：
${lines}

请阅读这些标题，归纳 1～2 个主要趋势或信号（例如：是否集中讨论某类模型、某家公司、某条技术路线）。
仅输出一个 JSON 对象，不要其它文字，格式严格为：
{"trend_signal":"一句中文趋势概括","keywords":["关键词1","关键词2","关键词3"]}
keywords 最多 5 个，简短名词为主。`;

  let sawQuotaError = false;

  for (const model of models) {
    const res = await fetch(DASHSCOPE_COMPAT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content: 'You output only valid JSON with trend_signal and keywords array.',
          },
          { role: 'user', content: userContent },
        ],
        temperature: 0.35,
        max_tokens: 512,
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      if (isDashScopeQuotaOrFreeTierError(res.status, errText)) {
        sawQuotaError = true;
        continue;
      }
      console.error('[trends] DashScope error', res.status, errText);
      return null;
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = data.choices?.[0]?.message?.content?.trim() ?? '';
    if (!text) continue;
    const parsed = parseTrendJson(text);
    if (parsed) return parsed;
  }

  if (sawQuotaError) {
    console.warn(
      '[trends] DashScope 当前模型不可用（免费额度用尽或账号为「仅免费」）。趋势已用规则写入缓存；若需 LLM，请在控制台关闭「仅使用免费额度」或配置 DASHSCOPE_MODEL / DASHSCOPE_MODEL_FALLBACK。',
    );
  }
  return null;
}

async function upsertTrendsCache(
  db: Client,
  payload: {
    signal: string;
    topKeywordsJson: string;
    source: DailyTrendsSource;
    count: number;
    alignsSyncAt: number;
  },
) {
  await db.execute({
    sql: `INSERT INTO news_trends_cache (id, signal, top_keywords, source, count, aligns_sync_at)
          VALUES (1, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            signal = excluded.signal,
            top_keywords = excluded.top_keywords,
            source = excluded.source,
            count = excluded.count,
            aligns_sync_at = excluded.aligns_sync_at`,
    args: [
      payload.signal,
      payload.topKeywordsJson,
      payload.source,
      payload.count,
      payload.alignsSyncAt,
    ],
  });
}

async function loadTodayNewsRows(db: Client): Promise<NewsRow[]> {
  const dayStart = startOfLocalDayMs();
  const result = await db.execute({
    sql: `SELECT title, title_zh, category FROM news
          WHERE db_synced_at >= ?
          ORDER BY score DESC, created_at DESC
          LIMIT 40`,
    args: [dayStart],
  });
  return result.rows as unknown as NewsRow[];
}

/**
 * 在 RSS 同步成功并写入 `last_sync_at` 之后调用：用与列表相同的今日条目快照算趋势并落库（含可选 LLM），
 * 首页读取缓存即可，无需每次打开页面都打模型。
 */
export async function refreshTrendsCache(db: Client, syncAtMs: number): Promise<void> {
  const rows = await loadTodayNewsRows(db);

  if (rows.length === 0) {
    await upsertTrendsCache(db, {
      signal: '今日尚无收录，同步 RSS 后将更新趋势解读。',
      topKeywordsJson: '[]',
      source: 'rules',
      count: 0,
      alignsSyncAt: syncAtMs,
    });
    return;
  }

  const titleLines = rows.map(displayTitle).filter(Boolean);
  const llm = await analyzeTrendsWithQwen(titleLines);
  if (llm) {
    const topKeywords = llm.keywords.length > 0 ? llm.keywords : ruleBasedSignal(rows).topKeywords;
    await upsertTrendsCache(db, {
      signal: llm.trend_signal,
      topKeywordsJson: JSON.stringify(topKeywords),
      source: 'llm',
      count: rows.length,
      alignsSyncAt: syncAtMs,
    });
    return;
  }

  const { signal, topKeywords } = ruleBasedSignal(rows);
  await upsertTrendsCache(db, {
    signal,
    topKeywordsJson: JSON.stringify(topKeywords),
    source: 'rules',
    count: rows.length,
    alignsSyncAt: syncAtMs,
  });
}

/**
 * 读取与当前 `last_sync_at` 对齐的趋势缓存（与文章列表同源快照）；无缓存或版本不一致时用规则即时从库推导，不调用 LLM。
 */
export async function getDailyTrends(): Promise<DailyTrendsResult> {
  if (!resolveTursoUrl()) {
    return {
      signal: '未配置数据库，无法生成趋势。',
      topKeywords: [],
      count: 0,
      source: 'rules',
    };
  }

  const db = getDbClient();
  const lastRow = await db.execute({
    sql: 'SELECT last_sync_at FROM news_sync_meta WHERE id = 1',
    args: [],
  });
  const lastSync =
    lastRow.rows[0] != null
      ? Number((lastRow.rows[0] as Record<string, unknown>).last_sync_at)
      : null;

  const cacheRes = await db.execute({
    sql: 'SELECT signal, top_keywords, source, count, aligns_sync_at FROM news_trends_cache WHERE id = 1',
    args: [],
  });

  if (cacheRes.rows[0] != null && lastSync != null) {
    const c = cacheRes.rows[0] as Record<string, unknown>;
    if (Number(c.aligns_sync_at) === lastSync) {
      return {
        signal: String(c.signal ?? ''),
        topKeywords: parseTopKeywordsJson(c.top_keywords),
        count: Number(c.count ?? 0),
        source: c.source === 'llm' ? 'llm' : 'rules',
      };
    }
  }

  const rows = await loadTodayNewsRows(db);
  if (rows.length === 0) {
    return {
      signal: '今日尚无收录，同步 RSS 后将更新趋势解读。',
      topKeywords: [],
      count: 0,
      source: 'rules',
    };
  }

  const { signal, topKeywords } = ruleBasedSignal(rows);
  return {
    signal,
    topKeywords,
    count: rows.length,
    source: 'rules',
  };
}
