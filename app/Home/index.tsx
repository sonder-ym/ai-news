'use client';

import { useEffect, useMemo, useState } from 'react';
import type { NewsItem } from '@/app/types/news';
import {
  Layout,
  Typography,
  Card,
  Row,
  Col,
  Tag,
  Button,
  Space,
  Input,
  Empty,
  Modal,
  message,
} from 'antd';
import {
  SearchOutlined,
  RobotOutlined,
  ThunderboltOutlined,
  CopyOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';

const SITE_TITLE = 'AI Daily | 每日 AI 前沿资讯';
const SITE_DESCRIPTION = '聚合全球 AI 论文、工具与行业动态';

const { Header, Content, Footer } = Layout;
const { Title, Text, Paragraph } = Typography;

function categoryTagColor(cat: NewsItem['category']) {
  if (cat === 'Paper') return 'purple';
  if (cat === 'Tool') return 'orange';
  return 'blue';
}

type FeedFilter = 'all' | 'paper' | 'oss' | 'tool';

const CATEGORY_ITEMS: {
  key: FeedFilter;
  label: string;
  hint: string;
}[] = [
  { key: 'all', label: '全部', hint: 'All Feeds' },
  { key: 'paper', label: '前沿论文', hint: 'Paper / arXiv' },
  { key: 'oss', label: '开源项目', hint: '社区与开源' },
  { key: 'tool', label: '新工具', hint: '产品与工具' },
];

function filterByCategory(list: NewsItem[], key: FeedFilter): NewsItem[] {
  if (key === 'all') return list;
  if (key === 'paper') return list.filter((i) => i.category === 'Paper');
  if (key === 'tool') return list.filter((i) => i.category === 'Tool');
  return list.filter((i) => i.category === 'News');
}

export default function HomeContent({ newsList }: { newsList: NewsItem[] }) {
  const [items, setItems] = useState<NewsItem[]>(newsList);
  const [filter, setFilter] = useState<FeedFilter>('all');
  const [keyword, setKeyword] = useState('');
  const [rssOpen, setRssOpen] = useState(false);
  const [feedUrl, setFeedUrl] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    setItems(newsList);
  }, [newsList]);

  const filteredList = useMemo(() => {
    const byCat = filterByCategory(items, filter);
    const q = keyword.trim().toLowerCase();
    if (!q) return byCat;
    return byCat.filter(
      (i) =>
        i.title.toLowerCase().includes(q) ||
        i.titleZh.toLowerCase().includes(q) ||
        i.summary.toLowerCase().includes(q),
    );
  }, [items, filter, keyword]);

  const refreshNewsDebug = async () => {
    setRefreshing(true);
    try {
      const res = await fetch('/api/news', { cache: 'no-store' });
      const data: unknown = await res.json();
      if (!res.ok || !Array.isArray(data)) {
        message.error('刷新失败，请稍后重试');
        return;
      }
      setItems(data as NewsItem[]);
      message.success('已拉取最新资讯');
    } catch {
      message.error('网络异常，刷新失败');
    } finally {
      setRefreshing(false);
    }
  };

  const openRssModal = () => {
    setFeedUrl(`${window.location.origin}/api/rss`);
    setRssOpen(true);
  };

  const copyFeedUrl = async () => {
    try {
      await navigator.clipboard.writeText(feedUrl);
      message.success('订阅地址已复制');
    } catch {
      message.error('复制失败，请手动选择文本复制');
    }
  };

  return (
    <Layout className="min-h-screen" style={{ minHeight: '100vh' }}>
      <Header
        className="flex items-center justify-between border-b border-gray-100 px-6 !bg-white shadow-sm z-10"
        style={{ background: '#ffffff' }}
      >
        <div className="flex items-center gap-2">
          <RobotOutlined className="text-2xl text-blue-600" />
          <Title level={3} className="!mb-0 !text-xl font-bold">
            {SITE_TITLE}
          </Title>
          <Text type="secondary" className="!text-sm font-normal">
            {SITE_DESCRIPTION}
          </Text>
        </div>
        <Space size="middle">
          <Input
            prefix={<SearchOutlined className="text-gray-400" />}
            placeholder="搜索论文/工具..."
            className="w-64 hidden md:block"
            variant="filled"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            allowClear
          />
        </Space>
      </Header>

      <Content className="container mx-auto px-4 py-8">
        <Row gutter={[24, 24]}>
          <Col xs={24} md={6}>
            <Card title="🔥 热门分类" variant="borderless" className="shadow-sm">
              <Space orientation="vertical" className="w-full" size="small">
                {CATEGORY_ITEMS.map((c) => (
                  <Button
                    key={c.key}
                    type={filter === c.key ? 'primary' : 'default'}
                    block
                    className="!h-auto !py-2 !px-3"
                    onClick={() => setFilter(c.key)}
                  >
                    <div className="flex w-full items-center justify-between gap-2 text-left">
                      <span>{c.label}</span>
                      <Text
                        type={filter === c.key ? undefined : 'secondary'}
                        className={`!text-xs !mb-0 shrink-0 ${filter === c.key ? '!text-white' : ''}`}
                      >
                        {c.hint}
                      </Text>
                    </div>
                  </Button>
                ))}
              </Space>
            </Card>

            <Card title="💡 AI 趋势信号" className="mt-6 shadow-sm" variant="borderless">
              <div className="flex flex-wrap gap-2">
                <Tag color="green" variant="filled">
                  Sora API 落地
                </Tag>
                <Tag color="orange" variant="filled">
                  端侧模型
                </Tag>
                <Tag color="purple" variant="filled">
                  RAG 优化
                </Tag>
              </div>
            </Card>
          </Col>

          <Col xs={24} md={18}>
            <div className="mb-4 flex justify-between items-center">
              <Title level={4} className="!mb-0">
                今日精选 ({filteredList.length}
                {filteredList.length !== items.length ? ` / ${items.length}` : ''})
              </Title>
              <Space size="small">
                <Button
                  type="text"
                  icon={<ReloadOutlined />}
                  loading={refreshing}
                  onClick={refreshNewsDebug}
                >
                  刷新调试
                </Button>
                <Button type="text" icon={<ThunderboltOutlined />} onClick={openRssModal}>
                  订阅 RSS
                </Button>
              </Space>
            </div>
            {filteredList.length === 0 ? (
              <Empty description="当前分类或搜索条件下暂无资讯" />
            ) : (
              <Card
                size="small"
                variant="outlined"
                className="shadow-sm"
                styles={{ body: { padding: 0 } }}
              >
                <ul className="m-0 list-none divide-y divide-gray-100/90 p-0" role="list">
                  {filteredList.map((item) => (
                    <li
                      key={item.id}
                      className="flex flex-col gap-2 !px-3 !py-3.5 transition-colors hover:bg-gray-50/80 sm:!px-5 sm:!py-4"
                    >
                      <div className="flex items-start gap-2">
                        <Tag
                          variant="filled"
                          className="!m-0 !mt-0.5 !h-fit !shrink-0 !px-1.5 !py-0.5 !text-[11px] !leading-4"
                          color={categoryTagColor(item.category)}
                        >
                          {item.category}
                        </Tag>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <a
                              href={item.url}
                              target="_blank"
                              rel="noreferrer"
                              className="min-w-0 flex-1 font-semibold text-[15px] leading-snug text-gray-900 [overflow-wrap:anywhere] hover:text-blue-600"
                            >
                              {item.title}
                            </a>
                            <div className="flex shrink-0 items-center gap-2">
                              <Text
                                type="secondary"
                                className="!mb-0 text-[11px] tabular-nums whitespace-nowrap"
                              >
                                {dayjs(item.createdAt).format('YYYY-MM-DD')}
                              </Text>
                            </div>
                          </div>
                          {item.titleZh ? (
                            <Text
                              className="!mt-1 !mb-0 block !text-[12px] !leading-snug text-gray-500"
                              title={item.titleZh}
                            >
                              {item.titleZh}
                            </Text>
                          ) : null}
                        </div>
                      </div>
                      <Paragraph
                        ellipsis={{ rows: 2, tooltip: item.summary }}
                        className="!mb-0 !mt-1 !text-[13px] !leading-relaxed text-gray-500"
                      >
                        {item.summary}
                      </Paragraph>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </Col>
        </Row>
      </Content>

      <Footer className="text-center bg-gray-50 mt-8">AI Daily ©2026 Created by Yaml</Footer>

      <Modal
        title={
          <Space>
            <ThunderboltOutlined />
            <span>订阅 RSS</span>
          </Space>
        }
        open={rssOpen}
        onCancel={() => setRssOpen(false)}
        footer={[
          <Button key="close" onClick={() => setRssOpen(false)}>
            关闭
          </Button>,
          <Button key="open" href={feedUrl || '/api/rss'} target="_blank">
            在新窗口打开 Feed
          </Button>,
        ]}
      >
        <Paragraph className="!mb-3">
          将下方地址粘贴到 Feedly、Inoreader、邮件客户端等支持 RSS 的阅读器中即可订阅。
        </Paragraph>
        <Space.Compact className="w-full">
          <Input readOnly value={feedUrl} placeholder="/api/rss" />
          <Button type="primary" icon={<CopyOutlined />} onClick={copyFeedUrl}>
            复制
          </Button>
        </Space.Compact>
      </Modal>
    </Layout>
  );
}
