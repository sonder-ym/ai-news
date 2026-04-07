'use client';

import { useMemo, useState } from 'react';
import type { NewsItem } from '@/app/types/news';
import type { DailyTrendsResult } from '@/app/lib/trends';
import { Layout, Row, Col } from 'antd';
import { useHomeFeed } from '@/app/Home/hooks/useHomeFeed';
import { HomeHeader } from '@/app/Home/components/HomeHeader';
import { HotTodayCard, WeeklyPicksCard, TrendsSignalCard } from '@/app/Home/components/FilterCard';
import { NewsFeedPanel } from '@/app/Home/components/NewsFeedPanel';
import { RssSubscribeModal } from '@/app/Home/components/RssSubscribeModal';
import { SITE_TITLE } from '@/app/Home/constants';

import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/zh-cn';

dayjs.extend(relativeTime);
dayjs.locale('zh-cn');

const { Content, Footer } = Layout;

export default function HomeContent({
  newsList,
  lastSyncedAt,
  trends,
  hot24h,
  weeklyPicks,
}: {
  newsList: NewsItem[];
  lastSyncedAt: number | null;
  trends: DailyTrendsResult;
  hot24h: NewsItem[];
  weeklyPicks: NewsItem[];
}) {
  const hotExcludedIds = useMemo(() => hot24h.map((item) => item.id), [hot24h]);
  const {
    topicFilter,
    setTopicFilter,
    keyword,
    setKeyword,
    page,
    setPage,
    pageSize,
    setPageSize,
    topicCatalog,
    filteredList,
    pagedList,
    syncedHint,
  } = useHomeFeed(newsList, lastSyncedAt, hotExcludedIds);

  const [rssOpen, setRssOpen] = useState(false);
  const [feedUrl, setFeedUrl] = useState('');

  const openRssModal = () => {
    setFeedUrl(`${window.location.origin}/api/rss`);
    setRssOpen(true);
  };

  return (
    <Layout className="min-h-screen" style={{ minHeight: '100vh' }}>
      <HomeHeader keyword={keyword} onKeywordChange={setKeyword} />

      <Content className="container mx-auto px-4 py-8">
        <Row gutter={[24, 24]}>
          <Col xs={24} md={6}>
            <HotTodayCard items={hot24h} />
            <TrendsSignalCard trends={trends} />
            <WeeklyPicksCard items={weeklyPicks} />
          </Col>

          <Col xs={24} md={18}>
            <NewsFeedPanel
              totalItems={filteredList.length}
              pagedList={pagedList}
              syncedHint={syncedHint}
              page={page}
              pageSize={pageSize}
              onPageChange={(p, ps) => {
                setPage(p);
                setPageSize(ps);
              }}
              onOpenRss={openRssModal}
              topicFilter={{
                topicCatalog,
                value: topicFilter,
                onChange: setTopicFilter,
              }}
            />
          </Col>
        </Row>
      </Content>

      <Footer className="mt-8 bg-gray-50 text-center">{SITE_TITLE} ©2026 Created by Yaml</Footer>

      <RssSubscribeModal open={rssOpen} feedUrl={feedUrl} onClose={() => setRssOpen(false)} />
    </Layout>
  );
}
