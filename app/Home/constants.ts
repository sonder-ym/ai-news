import type { FeedFilter } from './utils/filters';

export const SITE_TITLE = 'AI Daily';
export const SITE_DESCRIPTION = '聚合全球 AI 论文、工具与行业动态';

export const CATEGORY_ITEMS: {
  key: FeedFilter;
  label: string;
  hint: string;
}[] = [
  { key: 'all', label: '全部', hint: 'All Feeds' },
  { key: 'tool', label: '新工具', hint: '产品与工具' },
  { key: 'oss', label: '开源项目', hint: '社区与开源' },
  { key: 'paper', label: '前沿论文', hint: 'Paper / arXiv' },
];

export const TREND_TAG_COLORS = ['green', 'orange', 'purple', 'blue', 'cyan'] as const;

export const TOPIC_TAG_COLORS = [
  'geekblue',
  'cyan',
  'lime',
  'gold',
  'magenta',
  'volcano',
  'blue',
] as const;

export const DEFAULT_PAGE_SIZE = 20;
