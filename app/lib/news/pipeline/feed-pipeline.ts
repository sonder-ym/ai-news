import { fetchRawCuratedFeedItems, type RssStoryItem } from '@/app/lib/news/fetch/rss-fetch';
import { enrichHnFromFirebase } from '@/app/lib/news/fetch/hn-firebase';
import {
  shouldKeepItem,
  scoreAllItems,
  sortScoredByScoreThenTimeDesc,
  stratifiedPick,
  computeDynamicInsertLimit,
  type ScoredItem,
} from '@/app/lib/news/utils/scoring';
import { passesPaperCuratedFilter } from '@/app/lib/news/utils/paper-filter';

/** 打分后参与分层截断的池子大小（避免某一源刷屏） */
const STRATIFY_POOL_LIMIT = Number.parseInt(process.env.NEWS_STRATIFY_POOL_LIMIT ?? '48', 10) || 48;

/** 只保留 RSS 发布时间在近 N 小时内的条目再算分（默认 48，可用 `NEWS_RECENT_HOURS=24` 收紧） */
const RECENT_HOURS = Number.parseInt(process.env.NEWS_RECENT_HOURS ?? '48', 10) || 48;

function isPublishedWithinRecentHours(item: RssStoryItem): boolean {
  const ms = Date.parse(item.pubDateIso);
  if (Number.isNaN(ms)) return false;
  return Date.now() - ms <= RECENT_HOURS * 3600000;
}

export type FeedPipelineResult = {
  /** 分层截断后再按分数、发布时间排序的候选（供入库顺序与展示一致） */
  items: RssStoryItem[];
  /** 全量打分（降序），用于动态入库上限判断 */
  scoredSorted: ScoredItem[];
  /** 每条 `item_key` 对应的综合分，供入库持久化与列表排序 */
  scoreByItemKey: Map<string, number>;
  insertLimit: number;
};

function buildScoreByItemKey(scored: ScoredItem[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const s of scored) {
    m.set(s.item.itemKey, s.score);
  }
  return m;
}

/**
 * 拉取 → HN 增强 → 初筛 → 打分 → 分层截断 → 动态入库上限
 */
export async function runFeedPipeline(): Promise<FeedPipelineResult> {
  const raw = await fetchRawCuratedFeedItems();
  if (raw.length === 0) {
    return {
      items: [],
      scoredSorted: [],
      scoreByItemKey: new Map(),
      insertLimit: computeDynamicInsertLimit([]),
    };
  }

  await enrichHnFromFirebase(raw);

  const filtered = raw
    .filter(isPublishedWithinRecentHours)
    .filter(shouldKeepItem)
    .filter(passesPaperCuratedFilter);
  const scored = scoreAllItems(filtered);
  const scoredSorted = [...scored].sort(sortScoredByScoreThenTimeDesc);

  const scoreByItemKey = buildScoreByItemKey(scored);
  const preStratify = scoredSorted.slice(0, Math.min(120, scoredSorted.length));
  const picked = stratifiedPick(preStratify, STRATIFY_POOL_LIMIT);
  const pickedScored: ScoredItem[] = picked.map((item) => ({
    item,
    score: scoreByItemKey.get(item.itemKey) ?? 0,
  }));
  const items = [...pickedScored].sort(sortScoredByScoreThenTimeDesc).map((s) => s.item);

  const insertLimit = computeDynamicInsertLimit(scoredSorted);

  return {
    items,
    scoredSorted,
    scoreByItemKey,
    insertLimit,
  };
}
