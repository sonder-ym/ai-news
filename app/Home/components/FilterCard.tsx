'use client';

import { Card, Button, Typography, Tag } from 'antd';
import type { NewsItem } from '@/app/types/news';
import type { DailyTrendsResult } from '@/app/lib/trends';
import { TREND_TAG_COLORS } from '@/app/Home/constants';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/zh-cn';

dayjs.extend(relativeTime);
dayjs.locale('zh-cn');

const { Text, Paragraph } = Typography;

function displayZh(item: NewsItem): string {
  const z = item.titleZh?.trim();
  return z || item.title;
}

function rankNumberClass(idx: number): string {
  if (idx === 0) return 'text-red-500';
  if (idx === 1) return 'text-orange-500';
  if (idx === 2) return 'text-amber-500';
  return 'text-gray-400';
}

type HotTodayCardProps = {
  items: NewsItem[];
};

type WeeklyPicksCardProps = {
  items: NewsItem[];
};

type TrendsSignalCardProps = {
  trends: DailyTrendsResult;
};

type TopicTagsFilterCardProps = {
  topicCatalog: [string, number][];
  value: 'all' | string;
  onChange: (key: 'all' | string) => void;
};

function DenseSidebarList({ items }: { items: NewsItem[] }) {
  if (items.length === 0) {
    return (
      <Text type="secondary" className="!text-[11px] !block">
        暂无数据
      </Text>
    );
  }
  return (
    <ul className="m-0 list-none space-y-2 p-0">
      {items.map((item, idx) => (
        <li key={item.id} className="flex min-w-0 items-center gap-2">
          <span
            className={`w-4 shrink-0 text-right text-[15px] font-semibold tabular-nums leading-none ${rankNumberClass(idx)}`}
          >
            {idx + 1}
          </span>
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-w-0 flex-1 items-center gap-2 text-[12px] leading-snug text-neutral-800 no-underline hover:text-neutral-900 hover:no-underline"
          >
            <span className="min-w-0 flex-1 truncate">{displayZh(item)}</span>
            <span className="shrink-0 whitespace-nowrap text-[11px] text-gray-400">
              {dayjs(item.createdAt).fromNow()}
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
}

export function HotTodayCard({ items }: HotTodayCardProps) {
  return (
    <Card
      title="🔥 今日 AI 热点 (最近 24h)"
      variant="borderless"
      className="shadow-sm"
      size="small"
      styles={{
        header: { padding: '10px', margin: 0 },
        body: { padding: '15px 10px' },
      }}
    >
      <DenseSidebarList items={items} />
    </Card>
  );
}

export function WeeklyPicksCard({ items }: WeeklyPicksCardProps) {
  return (
    <Card
      title="📅 近期精选 (过去 7 天)"
      className="!mt-3 shadow-sm"
      variant="borderless"
      size="small"
      styles={{
        header: { padding: '10px', margin: 0 },
        body: { padding: '15px 10px' },
      }}
    >
      <DenseSidebarList items={items} />
    </Card>
  );
}

export function TopicTagsFilterCard({ topicCatalog, value, onChange }: TopicTagsFilterCardProps) {
  return (
    <div className="flex flex-wrap gap-2" role="tablist" aria-label="主题标签筛选">
      <Button
        type={value === 'all' ? 'primary' : 'default'}
        shape="round"
        size="small"
        color="red"
        className="!m-0 !px-2 !py-1"
        onClick={() => onChange('all')}
      >
        <span className="tabular-nums text-[12px]">全部主题</span>
      </Button>
      {topicCatalog.map(([label, count]) => (
        <Button
          key={label}
          type={value === label ? 'primary' : 'default'}
          shape="round"
          size="small"
          className="!m-0 max-w-[min(100%,18rem)] !px-2 !py-1"
          onClick={() => onChange(label)}
        >
          <span className="inline-flex min-w-0 max-w-full items-center gap-1">
            <span className="truncate text-[12px]">{label}</span>
            <span className="shrink-0 tabular-nums text-[12px] opacity-90">· {count}</span>
          </span>
        </Button>
      ))}
    </div>
  );
}

export function TrendsSignalCard({ trends }: TrendsSignalCardProps) {
  return (
    <Card
      title="💡 AI 趋势信号"
      className="!mt-3 shadow-sm"
      variant="borderless"
      size="small"
      styles={{
        header: { padding: '10px', margin: 0 },
        body: { padding: '15px 10px' },
      }}
    >
      <Paragraph className="!mb-3 !text-[13px] !leading-relaxed text-gray-700">
        {trends.signal}
      </Paragraph>
      {trends.count > 0 ? (
        <Text type="secondary" className="!mb-2 !block !text-[11px]">
          基于今日 {trends.count} 条标题
          {trends.source === 'llm' ? ' · 通义归纳' : ' · 规则摘要'}
        </Text>
      ) : null}
      {trends.topKeywords.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {trends.topKeywords.map((kw, i) => (
            <Tag
              key={`${kw}-${i}`}
              color={TREND_TAG_COLORS[i % TREND_TAG_COLORS.length]}
              variant="filled"
            >
              {kw}
            </Tag>
          ))}
        </div>
      ) : null}
    </Card>
  );
}
