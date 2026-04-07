'use client';

import { Modal, Space, Typography, Input, Button, message } from 'antd';
import { ThunderboltOutlined, CopyOutlined } from '@ant-design/icons';

const { Paragraph } = Typography;

type RssSubscribeModalProps = {
  open: boolean;
  feedUrl: string;
  onClose: () => void;
};

export function RssSubscribeModal({ open, feedUrl, onClose }: RssSubscribeModalProps) {
  const copyFeedUrl = async () => {
    try {
      await navigator.clipboard.writeText(feedUrl);
      message.success('订阅地址已复制');
    } catch {
      message.error('复制失败，请手动选择文本复制');
    }
  };

  return (
    <Modal
      title={
        <Space>
          <ThunderboltOutlined />
          <span>订阅 RSS</span>
        </Space>
      }
      open={open}
      onCancel={onClose}
      footer={[
        <Button key="close" onClick={onClose}>
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
  );
}
