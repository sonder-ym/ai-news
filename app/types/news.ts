export interface NewsItem {
  id: number;
  title: string;
  /** 通义生成的中文标题，旧数据可能为空 */
  titleZh: string;
  summary: string;
  category: 'Paper' | 'Tool' | 'News';
  url: string;
  createdAt: string;
  /** RSS 源 id，如 openai-blog、hnrss-frontpage */
  sourceId: string;
  /** 人类可读信源名，用于列表展示 */
  sourceName: string;
  /** 主题标签，用于归档筛选（与分类正交） */
  tags: string[];
  /** 聚合流水线综合分（入库时快照）；列表按分优先、时间次之排序 */
  score: number;
}
