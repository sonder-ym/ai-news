import type { NewsItem } from '@/app/types/news';

/** 侧栏主题标签的稳定排序（与 `deriveTopicTags` 产出一致） */
const TAG_ORDER = [
  '模型与厂商',
  '论文预印本',
  '开发者社区',
  '中文科技',
  '学术',
  '工具与开源',
  '行业资讯',
] as const;

const ORDER_INDEX = new Map<string, number>(TAG_ORDER.map((t, i) => [t, i]));

/**
 * 根据 RSS 源与最终分类生成主题标签（规则、可预期、无需额外 LLM）。
 * 用于归档筛选与列表展示。
 */
export function deriveTopicTags(input: {
  feedId: string;
  category: NewsItem['category'];
}): string[] {
  const { feedId, category } = input;
  const tags = new Set<string>();

  if (feedId === 'openai-blog' || feedId === 'deepmind' || feedId === 'anthropic-news') {
    tags.add('模型与厂商');
  }
  if (feedId === 'arxiv-cs-ai' || feedId === 'hf-papers') {
    tags.add('论文预印本');
  }
  if (feedId.startsWith('hnrss')) {
    tags.add('开发者社区');
  }
  if (feedId === 'sspai' || feedId === 'ruanyifeng' || feedId === 'solidot') {
    tags.add('中文科技');
  }

  if (category === 'Paper') tags.add('学术');
  if (category === 'Tool') tags.add('工具与开源');
  if (category === 'News') tags.add('行业资讯');

  return sortTagsForDisplay([...tags]);
}

export function sortTagsForDisplay(tags: string[]): string[] {
  return [...tags].sort((a, b) => {
    const ia = ORDER_INDEX.get(a) ?? 99;
    const ib = ORDER_INDEX.get(b) ?? 99;
    if (ia !== ib) return ia - ib;
    return a.localeCompare(b, 'zh-CN');
  });
}
