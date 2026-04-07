import type { RssStoryItem } from '@/app/lib/news/fetch/rss-fetch';

/** 与 arXiv / HF 论文源对应的 feedId，用于精选过滤、降权与强制 Paper 分类 */
export const PAPER_FEED_IDS = new Set<string>(['arxiv-cs-ai', 'hf-papers']);

export function isPaperFeed(feedId: string): boolean {
  return PAPER_FEED_IDS.has(feedId);
}

/**
 * 学术源不全量入库：标题需命中「大厂模型 / SOTA 信号 / 综述」之一。
 * 引用量无法在 RSS 中可靠获取，综述仅用标题关键词近似。
 */
const CURATED_TITLE =
  /\b(gpt|gemini|claude|llama|openai|anthropic|deepmind|mistral|qwen|mixtral|deepseek)\b/i;

const SOTA_TITLE =
  /\b(state[-\s]of[-\s]the[-\s]art|sota|outperform(?:s|ed|ing)?|gpt[-\s]?4|gpt[-\s]?5)\b/i;

const SURVEY_TITLE = /\b(survey|review)\b/i;

const SURVEY_ZH = /综述/;

export function passesPaperCuratedFilter(item: RssStoryItem): boolean {
  if (!isPaperFeed(item.feedId)) return true;
  const t = item.title;
  if (CURATED_TITLE.test(t)) return true;
  if (SOTA_TITLE.test(t)) return true;
  if (SURVEY_TITLE.test(t) || SURVEY_ZH.test(t)) return true;
  return false;
}
