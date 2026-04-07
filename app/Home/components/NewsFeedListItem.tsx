'use client';
import { Flex, Typography, Tag, Space } from 'antd';
import dayjs from 'dayjs';
import type { NewsItem } from '@/app/types/news';
import { TOPIC_TAG_COLORS } from '@/app/Home/constants';

const { Text, Paragraph } = Typography;

type NewsFeedListItemProps = {
  item: NewsItem;
};

export function NewsFeedListItem({ item }: NewsFeedListItemProps) {
  return (
    <Flex
      align="flex-start"
      justify="space-between"
      vertical
      gap="small"
      className="!cursor-pointer !px-3 !py-2 transition-colors hover:!bg-gray-50/80 sm:!px-4"
      onClick={() => window.open(item.url, '_blank')}
    >
      <Flex justify="space-between" className="w-full">
        <Flex vertical gap={4} className="min-w-0 flex-1">
          <a
            href={item.url}
            target="_blank"
            rel="noreferrer"
            className="text-[14px] leading-snug text-gray-900 [overflow-wrap:anywhere] hover:text-blue-500"
            onClick={(e) => e.stopPropagation()}
          >
            {item.title}
          </a>
          <div className="flex gap-2">
            {item.titleZh ? (
              <Text
                type="secondary"
                className="!mt-1 block !text-[11px] !leading-snug text-gray-500"
                title={item.titleZh}
              >
                {item.titleZh}
              </Text>
            ) : null}
            {item.tags.length > 0 ? (
              <Space wrap size={[4, 4]} onClick={(e) => e.stopPropagation()}>
                {item.tags.map((t, ti) => (
                  <Tag
                    key={`${item.id}-${t}`}
                    color={TOPIC_TAG_COLORS[ti % TOPIC_TAG_COLORS.length]}
                    className="!m-0 !text-[11px] !leading-4"
                  >
                    {t}
                  </Tag>
                ))}
              </Space>
            ) : null}
          </div>
        </Flex>
        <div className="flex shrink-0 min-w-[120px] flex-col items-end sm:min-w-[150px]">
          <Text type="secondary" className="text-[11px] tabular-nums whitespace-nowrap">
            {dayjs(item.createdAt).format('MM-DD')}
          </Text>
          {item.sourceName ? (
            <Text
              type="secondary"
              className="mt-0.5 block max-w-[140px] text-right !text-[11px] !leading-snug text-gray-400 sm:max-w-[180px]"
            >
              来源：{item.sourceName}
            </Text>
          ) : null}
        </div>
      </Flex>
      <Paragraph
        ellipsis={{ rows: 2 }}
        className="!mb-0 !text-[13px] !leading-relaxed text-gray-500"
      >
        {item.summary}
      </Paragraph>
    </Flex>
  );
}
