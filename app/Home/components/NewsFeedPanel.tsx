'use client';

import { Card, Empty, Pagination, Space, Typography, Button } from 'antd';
import { ThunderboltOutlined } from '@ant-design/icons';
import type { NewsItem } from '@/app/types/news';
import { NewsFeedListItem } from '@/app/Home/components/NewsFeedListItem';
import { TopicTagsFilterCard } from '@/app/Home/components/FilterCard';

const { Title, Text } = Typography;

type NewsFeedPanelProps = {
  totalItems: number;
  pagedList: NewsItem[];
  syncedHint: string;
  page: number;
  pageSize: number;
  onPageChange: (page: number, pageSize: number) => void;
  onOpenRss: () => void;
  topicFilter: {
    topicCatalog: [string, number][];
    value: 'all' | string;
    onChange: (key: 'all' | string) => void;
  };
};

export function NewsFeedPanel({
  totalItems,
  pagedList,
  syncedHint,
  page,
  pageSize,
  onPageChange,
  onOpenRss,
  topicFilter,
}: NewsFeedPanelProps) {
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <Title level={4} className="!mb-0">
          今日精选
        </Title>
        <Space size="small" align="center">
          <Text type="secondary" className="!text-xs whitespace-nowrap md:!text-sm">
            {syncedHint}
          </Text>
          <Button type="text" icon={<ThunderboltOutlined />} onClick={onOpenRss}>
            订阅 RSS
          </Button>
        </Space>
      </div>
      <div className="mb-4">
        <TopicTagsFilterCard
          topicCatalog={topicFilter.topicCatalog}
          value={topicFilter.value}
          onChange={topicFilter.onChange}
        />
      </div>
      {totalItems === 0 ? (
        <Empty description="当前分类、主题或搜索条件下暂无资讯" />
      ) : (
        <Card
          size="small"
          variant="outlined"
          className="shadow-sm"
          styles={{ body: { padding: 0 } }}
        >
          <div className="divide-y divide-gray-100/90">
            {pagedList.map((item) => (
              <NewsFeedListItem key={item.id} item={item} />
            ))}
          </div>
          <div className="flex justify-end border-t border-gray-100/90 px-3 py-3 sm:px-4">
            <Pagination
              size="small"
              current={page}
              pageSize={pageSize}
              total={totalItems}
              pageSizeOptions={[10, 20, 50]}
              showSizeChanger
              showTotal={(total) => `共 ${total} 条`}
              onChange={onPageChange}
            />
          </div>
        </Card>
      )}
    </>
  );
}
