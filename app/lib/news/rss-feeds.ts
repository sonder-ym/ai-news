/**
 * 精选 RSS：偏 AI / 技术前沿与社区，来源稳定、信噪比较高。
 * arXiv 使用官方 rss（cs.AI）；你提供的 `rss.arxiv.org/.../cs.AIarXiv` 为笔误，已改为标准地址。
 */
export const CURATED_RSS_FEEDS = [
  {
    id: 'openai-blog',
    name: 'OpenAI Blog',
    url: 'https://openai.com/blog/rss.xml',
    maxItems: 8,
  },
  {
    id: 'deepmind',
    name: 'Google DeepMind',
    url: 'https://deepmind.google/blog/rss.xml',
    maxItems: 8,
  },
  {
    id: 'arxiv-cs-ai',
    name: 'arXiv cs.AI',
    url: 'https://arxiv.org/rss/cs.AI',
    maxItems: 10,
  },
  {
    id: 'hnrss-frontpage',
    name: 'Hacker News',
    url: 'https://hnrss.org/frontpage',
    maxItems: 10,
  },
  {
    id: 'hnrss-ai',
    name: 'HN · AI',
    url: 'https://hnrss.org/newest?q=AI',
    maxItems: 8,
  },
  {
    id: 'sspai',
    name: '少数派',
    url: 'https://sspai.com/feed',
    maxItems: 8,
  },
] as const;

export type CuratedFeedId = (typeof CURATED_RSS_FEEDS)[number]['id'];
