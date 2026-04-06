import type { Metadata } from 'next';

import { fetchNewsData } from '@/app/api/news/route';
import HomeContent from './Home';

export const metadata: Metadata = {
  title: 'AI Daily | 每日 AI 前沿资讯',
  description: '聚合全球 AI 论文、工具与行业动态',
};

export default async function Home() {
  const newsList = await fetchNewsData();
  return <HomeContent newsList={newsList} />;
}
