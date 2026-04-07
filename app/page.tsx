import type { Metadata } from 'next';

import { fetchNewsPageData } from '@/app/api/news/route';
import { getDailyTrends } from '@/app/lib/trends';
import HomeContent from './Home';

export const metadata: Metadata = {
  title: 'AI Daily | 每日 AI 前沿资讯',
  description: '聚合全球 AI 论文、工具与行业动态',
};

export default async function Home() {
  const { newsList, lastSyncedAt, hot24h, weeklyPicks } = await fetchNewsPageData();
  const trends = await getDailyTrends();
  return (
    <HomeContent
      newsList={newsList}
      lastSyncedAt={lastSyncedAt}
      trends={trends}
      hot24h={hot24h}
      weeklyPicks={weeklyPicks}
    />
  );
}
