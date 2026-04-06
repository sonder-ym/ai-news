import { NextResponse } from 'next/server';
import { fetchNewsData } from '@/app/api/news/route';

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function rfc822(isoDate: string): string {
  const t = Date.parse(isoDate);
  return Number.isNaN(t) ? new Date().toUTCString() : new Date(t).toUTCString();
}

export async function GET(request: Request) {
  const items = await fetchNewsData();
  const { origin } = new URL(request.url);

  const itemXml = items
    .map((item) => {
      const link = item.url.startsWith('http')
        ? item.url
        : `${origin}${item.url === '#' ? '/' : item.url}`;
      const guid = `${origin}/#item-${item.id}`;
      return `
    <item>
      <title>${escapeXml(item.title)}</title>
      <link>${escapeXml(link || origin)}</link>
      <guid isPermaLink="false">${escapeXml(guid)}</guid>
      <description>${escapeXml(item.summary)}</description>
      <category>${escapeXml(item.category)}</category>
      <pubDate>${rfc822(item.createdAt)}</pubDate>
    </item>`;
    })
    .join('');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>AI Daily</title>
    <link>${escapeXml(origin)}</link>
    <description>AI Daily 精选资讯</description>
    <language>zh-CN</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${escapeXml(`${origin}/api/rss`)}" rel="self" type="application/rss+xml" />
    ${itemXml}
  </channel>
</rss>`;

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60',
    },
  });
}
