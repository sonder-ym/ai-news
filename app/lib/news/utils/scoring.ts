import type { RssStoryItem } from '@/app/lib/news/fetch/rss-fetch';
import { maxHnEngagementInBatch } from '@/app/lib/news/fetch/hn-firebase';
import { isPaperFeed } from './paper-filter';

/** 来源层级 —— 「出身论」：按文章落地 URL 的站点判定 */
export const SOURCE_TIERS = {
  T0_OFFICIAL: 1000,
  T1_PREMIUM: 800,
  T2_NEWS: 500,
  T3_COMMUNITY: 300,
  T4_SPAM: 0,
} as const;

export type SourceTierKey = keyof typeof SOURCE_TIERS;

/** 已知营销 / 低质域名（可扩展） */
const SPAM_HOSTS: string[] = [];

const T0_HOSTS = [
  'openai.com',
  'anthropic.com',
  'deepmind.google',
  'ai.google',
  'blog.google',
  'meta.ai',
  'ai.meta.com',
  'llama.meta.com',
  'research.facebook.com',
];

const T1_PATH = /arxiv\.org/i;
const T1_HOSTS = [
  'huggingface.co',
  'papers.neurips.cc',
  'proceedings.neurips.cc',
  'aclanthology.org',
];

const T2_HOSTS = [
  'techcrunch.com',
  'theverge.com',
  'wired.com',
  'jiqizhixin.com',
  'syncedreview.com',
  '36kr.com',
  'ithome.com',
  'sspai.com',
  'solidot.org',
  'ruanyifeng.com',
  'wallstreetcn.com',
  'bloomberg.com',
  'reuters.com',
];

const T3_HOSTS = [
  'reddit.com',
  'news.ycombinator.com',
  'medium.com',
  'substack.com',
  'dev.to',
  'linux.do',
  'v2ex.com',
];

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return '';
  }
}

function hostMatches(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`);
}

/** 仅根据 URL 判定层级（不含 RSS feedId 回退） */
export function getSourceTier(url: string): SourceTierKey {
  const host = hostnameOf(url);
  const href = url.toLowerCase();

  if (SPAM_HOSTS.some((d) => hostMatches(host, d))) return 'T4_SPAM';

  for (const d of T0_HOSTS) {
    if (hostMatches(host, d)) return 'T0_OFFICIAL';
  }

  if (T1_PATH.test(href)) return 'T1_PREMIUM';
  for (const d of T1_HOSTS) {
    if (hostMatches(host, d)) return 'T1_PREMIUM';
  }

  for (const d of T2_HOSTS) {
    if (hostMatches(host, d)) return 'T2_NEWS';
  }

  for (const d of T3_HOSTS) {
    if (hostMatches(host, d)) return 'T3_COMMUNITY';
  }

  return 'T3_COMMUNITY';
}

/** RSS 源与 URL 不一致时，用 feedId 抬升权威（例如条目仍属官方信源） */
const FEED_TIER_FALLBACK: Partial<Record<string, SourceTierKey>> = {
  'openai-blog': 'T0_OFFICIAL',
  deepmind: 'T0_OFFICIAL',
  'anthropic-news': 'T0_OFFICIAL',
  'arxiv-cs-ai': 'T1_PREMIUM',
  'hf-papers': 'T1_PREMIUM',
};

/**
 * 最终用于加分的来源分：优先 URL 层级；泛社区域时可用 feedId 回退。
 */
export function getSourceTierScore(item: RssStoryItem): number {
  const key = getSourceTier(item.link);
  if (key !== 'T3_COMMUNITY') return SOURCE_TIERS[key];
  const fb = FEED_TIER_FALLBACK[item.feedId];
  if (fb) return SOURCE_TIERS[fb];
  return SOURCE_TIERS.T3_COMMUNITY;
}

const HOT_ZH = [
  '发布',
  '重磅',
  '首次',
  '融资',
  '收购',
  '开源',
  '推出',
  '面世',
  '登顶',
  '官宣',
  '亮相',
];
const HOT_EN = [
  'gpt-5',
  'gpt-4',
  'sora',
  'launch',
  'release',
  'major',
  'breakthrough',
  'announcing',
  'introducing',
];
const MINOR_ZH = ['修复', '更新', '周报', '例行'];
const MINOR_EN = ['changelog', 'patch', 'minor', 'bugfix', 'weekly', 'v1.0.1', 'v1.', 'v2.'];

const KEYWORD_HOT_CAP = 350;
const KEYWORD_MINOR_FLOOR = -120;

/** 标题语义信号：关键词加权（无 RSS 热度时的重要补充） */
export function getKeywordScore(title: string): number {
  let score = 0;
  const t = title;
  const lower = t.toLowerCase();

  for (const k of HOT_ZH) {
    if (t.includes(k)) score += 50;
  }
  for (const k of HOT_EN) {
    if (lower.includes(k.toLowerCase())) score += 50;
  }
  for (const k of MINOR_ZH) {
    if (t.includes(k)) score -= 20;
  }
  for (const k of MINOR_EN) {
    if (lower.includes(k.toLowerCase())) score -= 20;
  }

  return Math.max(KEYWORD_MINOR_FLOOR, Math.min(KEYWORD_HOT_CAP, score));
}

export type RoughBucket = 'paper' | 'tool' | 'news';

const DROP_TITLE =
  /\b(we are hiring|we're hiring|is hiring|hiring:|hiring now|job opening|careers?\s+at|实习生招聘|内推(?:专用)?|诚聘|招聘\s*[:：]|带货|赞助位)\b/i;

const DROP_URL = /\/(jobs?|careers?|hiring)\b/i;

export function roughBucket(item: RssStoryItem): RoughBucket {
  if (isPaperFeed(item.feedId)) return 'paper';
  const u = item.link.toLowerCase();
  const t = item.title.toLowerCase();
  if (u.includes('arxiv.org') || /\barxiv\b/.test(t)) return 'paper';
  if (
    u.includes('github.com') ||
    u.includes('gitlab.com') ||
    /^show hn:/.test(t.trim()) ||
    /\bgithub\.com\b/.test(u)
  ) {
    return 'tool';
  }
  return 'news';
}

export function shouldKeepItem(item: RssStoryItem): boolean {
  if (DROP_TITLE.test(item.title)) return false;
  if (DROP_URL.test(item.link)) return false;
  if (getSourceTier(item.link) === 'T4_SPAM' && SPAM_HOSTS.length > 0) return false;
  return true;
}

/** 时间衰减：越新越高，作微调（相对来源千分档） */
export function timeDecayPoints(pubDateIso: string): number {
  const ms = Date.parse(pubDateIso);
  if (Number.isNaN(ms)) return 40;
  const hours = Math.max(0, (Date.now() - ms) / 3600000);
  return 80 * Math.exp(-hours / 72);
}

/** HN 有官方分时：批次内归一化到 0～80 */
export function hnHeatPoints(item: RssStoryItem, batchMaxEngagement: number): number {
  if (item.hnItemId == null) return 0;
  const raw = (item.hnScore ?? 0) + (item.hnDescendants ?? 0) * 0.5;
  if (raw <= 0 || batchMaxEngagement <= 0) return 0;
  return Math.min(80, 80 * (raw / batchMaxEngagement));
}

/** 学术源（arXiv / HF）整体降权，避免与产品与动态抢头条 */
const PAPER_FEED_SCORE_MULT = 0.78;

/**
 * Score = 来源层级分 + 时间衰减 + HN 热度（若有）+ 标题关键词；论文源再乘系数压低排序。
 */
export function computeItemScore(item: RssStoryItem, batchMaxEngagement: number): number {
  const source = getSourceTierScore(item);
  const tw = timeDecayPoints(item.pubDateIso);
  const hw = hnHeatPoints(item, batchMaxEngagement);
  const kw = getKeywordScore(item.title);
  let score = source + tw + hw + kw;
  if (isPaperFeed(item.feedId)) score *= PAPER_FEED_SCORE_MULT;
  return score;
}

export type ScoredItem = { item: RssStoryItem; score: number };

/** 综合分降序，同分按发布时间降序（越新越靠前） */
export function sortScoredByScoreThenTimeDesc(a: ScoredItem, b: ScoredItem): number {
  if (b.score !== a.score) return b.score - a.score;
  const tb = Date.parse(b.item.pubDateIso);
  const ta = Date.parse(a.item.pubDateIso);
  if (Number.isNaN(tb) && Number.isNaN(ta)) return 0;
  if (Number.isNaN(tb)) return -1;
  if (Number.isNaN(ta)) return 1;
  return tb - ta;
}

export function scoreAllItems(items: RssStoryItem[]): ScoredItem[] {
  const maxE = maxHnEngagementInBatch(items);
  return items.map((item) => ({
    item,
    score: computeItemScore(item, maxE),
  }));
}

/** 分层截断：按粗分类配额取条，不足则从全局高分补齐 */
export function stratifiedPick(scored: ScoredItem[], totalLimit: number): RssStoryItem[] {
  if (totalLimit <= 0 || scored.length === 0) return [];

  const sorted = [...scored].sort(sortScoredByScoreThenTimeDesc);
  const byBucket: Record<RoughBucket, ScoredItem[]> = {
    paper: [],
    tool: [],
    news: [],
  };
  for (const s of sorted) {
    byBucket[roughBucket(s.item)].push(s);
  }

  /** 约 70% 非论文（news + tool）、约 22% paper 槽位，与「产品与动态优先」一致 */
  const qp = Math.max(1, Math.round(totalLimit * 0.22));
  const qt = Math.max(1, Math.round(totalLimit * 0.26));
  let qn = totalLimit - qp - qt;
  if (qn < 1) qn = 1;

  const picked = new Set<string>();
  const out: RssStoryItem[] = [];

  const take = (bucket: RoughBucket, n: number) => {
    for (const s of byBucket[bucket]) {
      if (out.length >= totalLimit) return;
      if (n <= 0) return;
      if (picked.has(s.item.itemKey)) continue;
      picked.add(s.item.itemKey);
      out.push(s.item);
      n -= 1;
    }
  };

  take('paper', qp);
  take('tool', qt);
  take('news', qn);

  for (const s of sorted) {
    if (out.length >= totalLimit) break;
    if (picked.has(s.item.itemKey)) continue;
    picked.add(s.item.itemKey);
    out.push(s.item);
  }

  return out.slice(0, totalLimit);
}

const DEFAULT_INSERT_MIN = Math.max(
  1,
  Number.parseInt(process.env.NEWS_SYNC_MAX_ITEMS ?? '8', 10) || 8,
);
const DEFAULT_INSERT_CAP = Math.max(
  DEFAULT_INSERT_MIN,
  Number.parseInt(process.env.NEWS_SYNC_MAX_ITEMS_CAP ?? '36', 10) || 36,
);

/**
 * 突发重磅时提高单次入库上限（阈值与「来源千分 + 关键词」量级对齐）
 */
export function computeDynamicInsertLimit(scoredSorted: ScoredItem[]): number {
  if (scoredSorted.length === 0) return DEFAULT_INSERT_MIN;
  const top = scoredSorted[0].score;
  const top5 = scoredSorted.slice(0, 5);
  const avg5 = top5.reduce((a, s) => a + s.score, 0) / top5.length;
  const highCount = scoredSorted.filter((s) => s.score >= 900).length;

  let n = DEFAULT_INSERT_MIN;
  if (top >= 1450 || (top >= 1150 && highCount >= 4)) n = Math.min(DEFAULT_INSERT_CAP, 36);
  else if (top >= 1150 || avg5 >= 1000) n = Math.min(DEFAULT_INSERT_CAP, 28);
  else if (top >= 950 || avg5 >= 850) n = Math.min(DEFAULT_INSERT_CAP, 20);
  else if (top >= 800) n = Math.min(DEFAULT_INSERT_CAP, 14);

  return Math.max(DEFAULT_INSERT_MIN, Math.min(DEFAULT_INSERT_CAP, n));
}
