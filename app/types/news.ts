export interface NewsItem {
  id: number;
  title: string;
  /** 通义生成的中文标题，旧数据可能为空 */
  titleZh: string;
  summary: string;
  category: 'Paper' | 'Tool' | 'News';
  url: string;
  createdAt: string;
}
