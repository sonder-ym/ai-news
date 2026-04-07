/**
 * 精选 RSS：以 AI / 前沿技术为主，控制数量避免「大锅烩」。
 *
 * **内容策略（约 70 / 30）**：约 70% 产品与动态（OpenAI、Anthropic、DeepMind、HN 等），
 * 约 30% 精选论文（arXiv cs.AI + Hugging Face Daily Papers API），论文经 `utils/paper-filter` 标题筛选、
 * 打分降权，并固定为 `Paper` 分类，避免与新闻混排刷屏。
 *
 * - **arXiv cs.AI**：官方 RSS；`maxItems` 仅控制原始抓取量，入库前仍走精选关键词。
 * - **Anthropic**：官网无稳定直连 RSS，使用 [Olshansk/rss-feeds](https://github.com/Olshansk/rss-feeds) 镜像。
 * - **Hugging Face Daily Papers**：在 `fetch/rss-fetch` 中走 `https://huggingface.co/api/daily_papers` JSON，非 RSS。
 * - 中文源选自 [top-rss-list](https://github.com/weekend-project-space/top-rss-list) 中可 **直连**、长期可用的订阅。
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
    id: 'anthropic-news',
    name: 'Anthropic News',
    url: 'https://raw.githubusercontent.com/Olshansk/rss-feeds/main/feeds/feed_anthropic_news.xml',
    maxItems: 8,
  },
  {
    id: 'arxiv-cs-ai',
    name: 'arXiv cs.AI',
    url: 'https://arxiv.org/rss/cs.AI',
    maxItems: 5,
  },
  {
    id: 'hnrss-frontpage',
    name: 'Hacker News',
    url: 'https://hnrss.org/frontpage',
    maxItems: 8,
  },
  {
    id: 'hnrss-ai',
    name: 'HN · AI',
    url: 'https://hnrss.org/newest?q=AI',
    maxItems: 6,
  },
  {
    id: 'sspai',
    name: '少数派',
    url: 'https://sspai.com/feed',
    maxItems: 6,
  },
  {
    id: 'ruanyifeng',
    name: '阮一峰周刊',
    url: 'https://www.ruanyifeng.com/blog/atom.xml',
    maxItems: 5,
  },
  {
    id: 'solidot',
    name: 'Solidot 奇客',
    url: 'https://www.solidot.org/index.rss',
    maxItems: 6,
  },
] as const;

export type CuratedFeedId = (typeof CURATED_RSS_FEEDS)[number]['id'];
