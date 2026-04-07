'use client';

import { Layout, Typography, Space, Input } from 'antd';
import { SearchOutlined, RobotOutlined } from '@ant-design/icons';
import { SITE_TITLE, SITE_DESCRIPTION } from '@/app/Home/constants';

const { Header } = Layout;
const { Title, Text } = Typography;

type HomeHeaderProps = {
  keyword: string;
  onKeywordChange: (value: string) => void;
};

export function HomeHeader({ keyword, onKeywordChange }: HomeHeaderProps) {
  return (
    <Header
      className="flex items-center justify-between border-b border-gray-100 px-6 !bg-white shadow-sm z-10"
      style={{ background: '#ffffff' }}
    >
      <div className="flex flex-col">
        <div className="flex items-center gap-2">
          <RobotOutlined className="text-2xl text-blue-600" />
          <Title level={3} className="!mb-0 !text-xl font-bold">
            {SITE_TITLE}
          </Title>
        </div>
        <Text type="secondary" className="!text-[12px]">
          {SITE_DESCRIPTION}
        </Text>
      </div>
      <Input
        prefix={<SearchOutlined className="text-gray-400" />}
        placeholder="搜索论文/工具..."
        className="max-w-[280px] hidden md:block"
        variant="filled"
        value={keyword}
        onChange={(e) => onKeywordChange(e.target.value)}
        allowClear
      />
    </Header>
  );
}
