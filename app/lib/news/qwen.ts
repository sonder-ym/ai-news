import type { NewsItem } from '@/app/types/news';

const DASHSCOPE_COMPAT = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';

export type SummarizeResult = {
  titleZh: string;
  summary: string;
  category: NewsItem['category'];
};

function parseJsonFromModel(text: string): SummarizeResult {
  const trimmed = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '');
  try {
    const o = JSON.parse(trimmed) as {
      summary?: string;
      category?: string;
      zh_title?: string;
      title_zh?: string;
    };
    const cat = o.category as string;
    const category: NewsItem['category'] =
      cat === 'Paper' || cat === 'Tool' || cat === 'News' ? cat : 'News';
    const summary = String(o.summary ?? '').trim();
    const titleZh = String(o.zh_title ?? o.title_zh ?? '').trim();
    return {
      titleZh,
      summary: summary || trimmed.slice(0, 800),
      category,
    };
  } catch {
    return { titleZh: '', summary: trimmed.slice(0, 800), category: 'News' };
  }
}

const getPrompt = (title: string, excerpt: string) => {
  const userContent = `### 角色
  AI 资讯编辑
  
  ### 任务
  根据输入生成 JSON：{"zh_title": "...", "summary": "...", "pub_date": "...", "category": "..."}
  
  ### 规则
  1. zh_title: 中文标题，保留关键英文术语（如 GPT-4, RAG），客观专业。
  2. summary: 1-3 句中文摘要，概括核心要点。
  3. pub_date: 提取发布日期，严格格式化为 "YYYY-MM-DD"。若无法识别具体日期，返回 null。
  4. category: 仅限以下三者之一
     - Paper (学术论文/arXiv)
     - Tool (开源/产品/代码)
     - News (行业/公司/活动)
  
  ### 约束
  - 仅输出纯 JSON 字符串，无 Markdown 标记，无额外解释。
  
  ### 输入
  标题：${title}
  正文：${excerpt || '无'}`;
  return userContent;
};

/**
 * 使用通义千问根据标题与正文摘录生成中文摘要，并给出分类。
 */
export async function summarizeWithQwen(title: string, excerpt: string): Promise<SummarizeResult> {
  const apiKey = process.env.DASHSCOPE_API_KEY;
  if (!apiKey) {
    return {
      titleZh: '',
      summary: title,
      category: 'News',
    };
  }

  const model = process.env.DASHSCOPE_MODEL ?? 'qwen-turbo';

  const userContent = getPrompt(title, excerpt);

  const res = await fetch(DASHSCOPE_COMPAT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'system',
          content:
            'You output only valid JSON with keys zh_title (Chinese title), summary (Chinese), category.',
        },
        { role: 'user', content: userContent },
      ],
      temperature: 0.3,
      max_tokens: 512,
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    console.error('DashScope error', res.status, errText);
    return { titleZh: '', summary: title, category: 'News' };
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = data.choices?.[0]?.message?.content?.trim() ?? '';
  if (!text) return { titleZh: '', summary: title, category: 'News' };
  return parseJsonFromModel(text);
}
