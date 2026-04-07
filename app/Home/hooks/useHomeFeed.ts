import dayjs from 'dayjs';

import { useEffect, useMemo, useState } from 'react';

import type { NewsItem } from '@/app/types/news';
import { buildTopicCatalog, filterNewsList, slicePage, totalPages } from '@/app/Home/utils/filters';
import { DEFAULT_PAGE_SIZE } from '@/app/Home/constants';

export function useHomeFeed(
  newsList: NewsItem[],
  lastSyncedAt: number | null,
  hotExcludedIds: number[],
) {
  const [items, setItems] = useState<NewsItem[]>(newsList);
  const [topicFilter, setTopicFilter] = useState<'all' | string>('all');
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [timeTick, setTimeTick] = useState(0);

  useEffect(() => {
    setItems(newsList);
  }, [newsList]);

  useEffect(() => {
    const id = window.setInterval(() => setTimeTick((n) => n + 1), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const topicCatalog = useMemo(() => buildTopicCatalog(items), [items]);

  const hotExcluded = useMemo(() => new Set(hotExcludedIds), [hotExcludedIds]);

  /** 「全部主题」：右侧相对左侧热点做减法（不展示热点 id）；选中某一主题时从今日全量中筛，含热点（做加法、全显）。 */
  const filteredList = useMemo(() => {
    const base = topicFilter === 'all' ? items.filter((i) => !hotExcluded.has(i.id)) : items;
    return filterNewsList(base, 'all', topicFilter, keyword);
  }, [items, hotExcluded, topicFilter, keyword]);

  useEffect(() => {
    setPage(1);
  }, [topicFilter, keyword, hotExcludedIds]);

  const pagedList = useMemo(
    () => slicePage(filteredList, page, pageSize),
    [filteredList, page, pageSize],
  );

  const maxPage = totalPages(filteredList.length, pageSize);
  useEffect(() => {
    if (page > maxPage) setPage(maxPage);
  }, [maxPage, page]);

  const syncedHint = useMemo(() => {
    void timeTick;
    if (lastSyncedAt == null) {
      return '数据更新时间：暂无记录（未配置数据库或尚未同步）';
    }
    return `数据更新于 ${dayjs(lastSyncedAt).fromNow()}`;
  }, [lastSyncedAt, timeTick]);

  return {
    items,
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
  };
}
