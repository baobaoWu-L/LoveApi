/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CopyButton } from '@/components/copy-button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { PublicLayout } from '@/components/layout'
import { useStatus } from '@/hooks/use-status'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'
import { ChevronDown, ChevronRight, Copy } from 'lucide-react'

// ===== 代码块组件 =====

function CodeBlock({ code, lang = 'json' }: { code: string; lang?: string }) {
  const { copyToClipboard } = useCopyToClipboard()

  return (
    <div className='overflow-hidden rounded-lg border'>
      <div className='flex items-center justify-between border-b bg-muted/30 px-4 py-2'>
        <span className='text-muted-foreground text-xs font-medium uppercase'>
          {lang}
        </span>
        <button
          onClick={() => copyToClipboard(code)}
          className='text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs transition-colors'
        >
          <Copy className='size-3' />
          复制
        </button>
      </div>
      <pre className='bg-[#1e1e2e] p-4 overflow-x-auto'>
        <code className='text-sm font-mono text-[#cdd6f4] leading-relaxed whitespace-pre'>
          {code}
        </code>
      </pre>
    </div>
  )
}

// ===== 端点折叠卡片 =====

function EndpointCard({
  method,
  path,
  desc,
  children,
  defaultOpen = false,
}: {
  method: string
  path: string
  desc: string
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)

  const methodColors: Record<string, string> = {
    POST: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    GET: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  }

  return (
    <Card className='overflow-hidden'>
      <button
        onClick={() => setOpen(!open)}
        className='flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50'
      >
        <span
          className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-bold uppercase ${methodColors[method] || 'bg-muted text-muted-foreground'}`}
        >
          {method}
        </span>
        <code className='flex-1 text-sm font-medium'>{path}</code>
        <span className='text-muted-foreground hidden text-xs sm:inline'>
          {desc}
        </span>
        {open ? (
          <ChevronDown className='text-muted-foreground size-4' />
        ) : (
          <ChevronRight className='text-muted-foreground size-4' />
        )}
      </button>
      {open && <div className='border-t px-4 py-4'>{children}</div>}
    </Card>
  )
}

// ===== 章节组件 =====

function Section({
  icon,
  title,
  children,
}: {
  icon: string
  title: string
  children: React.ReactNode
}) {
  return (
    <section className='space-y-4'>
      <h2 className='flex items-center gap-2 text-xl font-semibold'>
        <span className='text-lg'>{icon}</span>
        {title}
      </h2>
      {children}
    </section>
  )
}

// ===== 主页面 =====

export function ApiDoc() {
  const { t } = useTranslation()
  const { status } = useStatus()
  const serverAddress =
    (status?.server_address as string) ||
    (typeof window !== 'undefined' ? window.location.origin : '')

  return (
    <PublicLayout>
      <div className='mx-auto max-w-4xl px-4 py-12 space-y-16'>
        {/* 标题区 */}
        <div className='text-center space-y-4'>
          <h1 className='text-4xl font-bold tracking-tight'>
            LoveAPI 接口文档
          </h1>
          <p className='text-muted-foreground mx-auto max-w-2xl leading-relaxed'>
            统一的大模型 API 网关，完全兼容 OpenAI 协议格式。一套接口即可接入 40+ 主流 AI 供应商，无需为每个供应商单独适配。
          </p>
        </div>

        {/* 1. 快速接入 */}
        <Section icon='🚀' title='快速接入'>
          <p className='text-muted-foreground text-sm leading-relaxed'>
            LoveAPI 提供完全兼容 OpenAI API 的接口，您只需将原有 API 调用的 Base URL 和 API Key 替换为您的 LoveAPI 凭证即可使用。
          </p>

          <Card className='border-primary/20 bg-primary/5 p-4 space-y-3'>
            <div className='flex items-center justify-between gap-4 flex-wrap'>
              <div className='space-y-1'>
                <div className='text-muted-foreground text-xs font-medium'>
                  Base URL（服务器地址）
                </div>
                <code className='bg-background text-primary inline-block rounded border px-3 py-1.5 text-sm font-semibold break-all'>
                  {serverAddress}
                </code>
              </div>
              <CopyButton text={serverAddress} />
            </div>
          </Card>

          <div className='bg-muted/50 border border-border/50 flex items-start gap-3 rounded-lg p-4 text-sm'>
            <span className='text-lg'>💡</span>
            <div className='text-muted-foreground space-y-1'>
              <strong className='text-foreground'>提示：</strong>
              请求时需要在 Header 中添加 <code className='bg-muted px-1 rounded text-xs'>Authorization: Bearer &lt;your_api_key&gt;</code>。您可以在控制台中获取您的 API 密钥。
            </div>
          </div>
        </Section>

        {/* 2. 配置文件指南 */}
        <Section icon='⚙️' title='配置文件指南'>
          <p className='text-muted-foreground text-sm leading-relaxed'>
            LoveAPI 完全兼容 OpenAI 协议，因此您可以在任何支持 OpenAI API 的客户端或框架中直接使用。以下是常见工具的配置方法：
          </p>

          {/* .claude 配置 */}
          <h3 className='flex items-center gap-2 pt-4 text-base font-semibold'>
            📁 .claude 配置文件
          </h3>
          <Card className='p-4 space-y-3'>
            <p className='text-muted-foreground text-sm'>
              在项目根目录创建 <code className='bg-muted px-1 rounded text-xs'>.claude/settings.json</code> 文件，配置 LoveAPI 作为 Claude Code 的模型提供方：
            </p>
            <CodeBlock
              code={JSON.stringify(
                {
                  model: 'claude-sonnet-4-20250514',
                  provider: {
                    id: 'loveapi',
                    name: 'LoveAPI',
                    apiKey: '<your-loveapi-key>',
                    baseUrl: serverAddress,
                  },
                },
                null,
                2
              )}
            />
            <div className='text-xs text-muted-foreground space-y-1'>
              <p><strong>配置说明：</strong></p>
              <p><code className='bg-muted px-1 rounded'>model</code> — 指定使用的模型，如 claude-sonnet-4-20250514、gpt-4o 等</p>
              <p><code className='bg-muted px-1 rounded'>provider.id</code> — 供应商标识，可自定义</p>
              <p><code className='bg-muted px-1 rounded'>provider.apiKey</code> — 您的 LoveAPI 令牌，可在控制台中获取</p>
              <p><code className='bg-muted px-1 rounded'>provider.baseUrl</code> — LoveAPI 服务地址</p>
            </div>
          </Card>

          {/* .codex 配置 */}
          <h3 className='flex items-center gap-2 pt-4 text-base font-semibold'>
            📁 .codex 配置文件
          </h3>
          <Card className='p-4 space-y-3'>
            <p className='text-muted-foreground text-sm'>
              在项目根目录创建或修改 <code className='bg-muted px-1 rounded text-xs'>.codex/settings.json</code> 文件，配置 LoveAPI 作为 Codex CLI 的模型提供方：
            </p>
            <CodeBlock
              code={JSON.stringify(
                {
                  provider: 'loveapi',
                  loveapi: {
                    apiKey: '<your-loveapi-key>',
                    baseUrl: serverAddress,
                    models: {
                      chat: [
                        'gpt-4o',
                        'gpt-4o-mini',
                        'claude-sonnet-4-20250514',
                        'claude-3-5-haiku-20241022',
                      ],
                      reasoning: [
                        'o3-mini',
                        'claude-sonnet-4-20250514-thinking',
                      ],
                    },
                  },
                  allowedTools: [
                    'View',
                    'Read',
                    'Edit',
                    'Bash',
                    'Glob',
                    'Grep',
                    'WebSearch',
                    'WebFetch',
                  ],
                  language: 'zh-CN',
                },
                null,
                2
              )}
            />
            <div className='text-xs text-muted-foreground space-y-1'>
              <p><strong>配置说明：</strong></p>
              <p><code className='bg-muted px-1 rounded'>provider</code> — 设定为 "loveapi" 以启用 LoveAPI 提供方</p>
              <p><code className='bg-muted px-1 rounded'>loveapi.apiKey</code> — 您的 LoveAPI 令牌</p>
              <p><code className='bg-muted px-1 rounded'>loveapi.baseUrl</code> — LoveAPI 服务地址</p>
              <p><code className='bg-muted px-1 rounded'>loveapi.models</code> — 指定可用模型列表，分为 chat 和 reasoning 两类</p>
              <p><code className='bg-muted px-1 rounded'>allowedTools</code> — 允许 Codex CLI 使用的工具列表</p>
            </div>
          </Card>

          {/* CcSwitch 配置 */}
          <h3 className='flex items-center gap-2 pt-4 text-base font-semibold'>
            🔧 CcSwitch 配置引用
          </h3>
          <Card className='p-4 space-y-3'>
            <p className='text-muted-foreground text-sm'>
              CcSwitch 是一个模型路由切换工具，可在不同 AI 提供方之间做动态切换。以下是通过 CcSwitch 引用 LoveAPI 的配置：
            </p>
            <CodeBlock
              code={JSON.stringify(
                {
                  providers: {
                    loveapi: {
                      type: 'openai-compatible',
                      baseUrl: serverAddress,
                      apiKey: '<your-loveapi-key>',
                      models: {
                        'gpt-4o': {
                          maxTokens: 128000,
                          supportsStreaming: true,
                          supportsThinking: false,
                        },
                        'gpt-4o-mini': {
                          maxTokens: 128000,
                          supportsStreaming: true,
                          supportsThinking: false,
                        },
                        'claude-sonnet-4-20250514': {
                          maxTokens: 200000,
                          supportsStreaming: true,
                          supportsThinking: true,
                        },
                        'claude-3-5-haiku-20241022': {
                          maxTokens: 200000,
                          supportsStreaming: true,
                          supportsThinking: false,
                        },
                      },
                    },
                  },
                  defaultProvider: 'loveapi',
                  switchRules: [
                    { pattern: 'claude-.*', provider: 'loveapi' },
                    { pattern: 'gpt-.*|o3-.*', provider: 'loveapi' },
                  ],
                },
                null,
                2
              )}
            />
            <div className='bg-muted/50 border border-border/50 flex items-start gap-3 rounded-lg p-3 text-sm'>
              <span className='text-base'>📖</span>
              <div className='text-muted-foreground text-xs leading-relaxed'>
                <strong className='text-foreground'>CcSwitch 说明：</strong>
                通过 type: "openai-compatible" 声明 LoveAPI 为兼容 OpenAI 协议的提供方。models 字段可为每个模型设置能力标签（最大 Token、是否支持流式、是否支持思考等）。switchRules 定义路由规则，支持正则匹配模型名称来自动路由。
              </div>
            </div>
          </Card>

          {/* 修改配置文件步骤 */}
          <h3 className='flex items-center gap-2 pt-4 text-base font-semibold'>
            📝 修改 .claude 和 .codex 配置文件的步骤
          </h3>
          <Card className='p-4 space-y-3'>
            <p className='text-muted-foreground text-sm'>
              按照以下步骤操作来修改配置文件：
            </p>
            <ol className='space-y-3'>
              {[
                {
                  title: '找到配置文件',
                  desc: '在您项目的根目录中找到 .claude/settings.json 或 .codex/settings.json 文件。如果不存在，请手动创建。',
                },
                {
                  title: '修改配置内容',
                  desc: '参照上方示例，将配置中的 apiKey 替换为您的 LoveAPI 令牌密钥，baseUrl 替换为实际的服务器地址。',
                },
                {
                  title: '切换模型',
                  desc: '在配置的 model 字段中指定要使用的模型名称。LoveAPI 当前支持 ChatGPT（Codex）系列和 Claude 系列模型。如需使用其他模型，请在管理后台的"模型管理"中添加对应的渠道和模型映射。',
                },
                {
                  title: '保存并重启',
                  desc: '保存配置文件后，重启对应的 CLI 工具（Claude Code 或 Codex CLI），配置即可生效。',
                },
              ].map((step, i) => (
                <li key={i} className='flex gap-3'>
                  <span className='bg-primary text-primary-foreground inline-flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold'>
                    {i + 1}
                  </span>
                  <div className='text-sm'>
                    <strong className='text-foreground'>{step.title}</strong>
                    <span className='text-muted-foreground'>：{step.desc}</span>
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        </Section>

        {/* 3. 支持模型 */}
        <Section icon='🧠' title='支持模型'>
          <p className='text-muted-foreground text-sm leading-relaxed'>
            LoveAPI 当前支持以下模型系列。模型名称遵循上游供应商的命名规范，您可以在请求中直接使用。
          </p>

          <h3 className='pt-2 text-base font-semibold'>
            🤖 ChatGPT（Codex）系列
          </h3>
          <Card className='p-4'>
            <div className='flex flex-wrap gap-2'>
              {[
                { name: 'gpt-4o', variant: 'default' as const },
                { name: 'gpt-4o-mini', variant: 'default' as const },
                { name: 'gpt-4-turbo', variant: 'default' as const },
                { name: 'gpt-4', variant: 'default' as const },
                { name: 'gpt-3.5-turbo', variant: 'default' as const },
                { name: 'o3-mini', variant: 'secondary' as const },
                { name: 'o1-mini', variant: 'secondary' as const },
                { name: 'o1', variant: 'secondary' as const },
              ].map((m) => (
                <Badge
                  key={m.name}
                  variant={m.variant}
                  className='gap-1 py-1.5 text-xs'
                >
                  {m.name}
                </Badge>
              ))}
            </div>
            <p className='text-muted-foreground mt-2 text-xs'>
              🟢 默认 = 通用对话模型 &nbsp;&nbsp; 🟡 Secondary = 推理模型
            </p>
          </Card>

          <h3 className='pt-2 text-base font-semibold'>
            🗣️ Claude 系列
          </h3>
          <Card className='p-4'>
            <div className='flex flex-wrap gap-2'>
              {[
                'claude-sonnet-4-20250514',
                'claude-3-5-sonnet-20241022',
                'claude-3-5-haiku-20241022',
                'claude-3-opus-20240229',
                'claude-3-haiku-20240307',
              ].map((name) => (
                <Badge key={name} className='py-1.5 text-xs'>
                  {name}
                </Badge>
              ))}
            </div>
            <p className='text-muted-foreground mt-3 text-xs'>
              所有 Claude 模型均支持流式输出（Streaming）和思考（Thinking）模式。
            </p>
          </Card>

          <div className='bg-muted/50 border border-border/50 flex items-start gap-3 rounded-lg p-4 text-sm'>
            <span className='text-base'>📌</span>
            <div className='text-muted-foreground text-sm leading-relaxed'>
              <strong className='text-foreground'>提示：</strong>
              如需添加更多模型（如 DeepSeek、Gemini 等），请在管理后台 → 渠道管理 中添加对应的供应商渠道，然后在 模型管理 中添加对应的模型映射。添加后即可立即使用，无需重启服务。
            </div>
          </div>
        </Section>

        {/* 4. API 端点 */}
        <Section icon='📡' title='API 端点'>
          <p className='text-muted-foreground text-sm'>
            以下所有端点均使用 POST 方法（除非另有说明），请求格式与 OpenAI API 完全兼容。
          </p>

          <EndpointCard
            method='POST'
            path='/v1/chat/completions'
            desc='聊天补全（核心接口）'
            defaultOpen={true}
          >
            <h4 className='mb-2 text-xs font-semibold uppercase text-muted-foreground'>
              请求示例
            </h4>
            <CodeBlock
              code={JSON.stringify(
                {
                  model: 'gpt-4o',
                  messages: [
                    { role: 'system', content: 'You are a helpful assistant.' },
                    { role: 'user', content: 'Hello!' },
                  ],
                  temperature: 0.7,
                  max_tokens: 2048,
                  stream: false,
                },
                null,
                2
              )}
            />
            <h4 className='mb-2 mt-4 text-xs font-semibold uppercase text-muted-foreground'>
              响应示例
            </h4>
            <CodeBlock
              code={JSON.stringify(
                {
                  id: 'chatcmpl-123456789',
                  object: 'chat.completion',
                  created: 1712345678,
                  model: 'gpt-4o',
                  choices: [
                    {
                      index: 0,
                      message: {
                        role: 'assistant',
                        content: 'Hello! How can I help you today?',
                      },
                      finish_reason: 'stop',
                    },
                  ],
                  usage: {
                    prompt_tokens: 20,
                    completion_tokens: 10,
                    total_tokens: 30,
                  },
                },
                null,
                2
              )}
            />
            <h4 className='mb-2 mt-4 text-xs font-semibold uppercase text-muted-foreground'>
              参数说明
            </h4>
            <div className='text-xs text-muted-foreground space-y-1'>
              <p><code className='bg-muted px-1 rounded'>model</code> — 必填，模型名称，如 gpt-4o、claude-sonnet-4-20250514</p>
              <p><code className='bg-muted px-1 rounded'>messages</code> — 必填，消息列表，支持 system、user、assistant 角色</p>
              <p><code className='bg-muted px-1 rounded'>stream</code> — 可选，是否启用流式输出，默认 false</p>
              <p><code className='bg-muted px-1 rounded'>temperature</code> — 可选，采样温度，范围 0-2，默认 1</p>
              <p><code className='bg-muted px-1 rounded'>max_tokens</code> — 可选，最大输出 Token 数</p>
            </div>
          </EndpointCard>

          <EndpointCard
            method='POST'
            path='/v1/messages'
            desc='消息接口（Claude 原生格式）'
          >
            <h4 className='mb-2 text-xs font-semibold uppercase text-muted-foreground'>
              请求示例
            </h4>
            <CodeBlock
              code={JSON.stringify(
                {
                  model: 'claude-sonnet-4-20250514',
                  messages: [{ role: 'user', content: 'Hello!' }],
                  system: 'You are Claude, a helpful AI assistant.',
                  max_tokens: 2048,
                  stream: false,
                },
                null,
                2
              )}
            />
          </EndpointCard>

          <EndpointCard
            method='GET'
            path='/v1/models'
            desc='获取可用模型列表'
          >
            <h4 className='mb-2 text-xs font-semibold uppercase text-muted-foreground'>
              响应示例
            </h4>
            <CodeBlock
              code={JSON.stringify(
                {
                  object: 'list',
                  data: [
                    { id: 'gpt-4o', object: 'model', created: 1700000000, owned_by: 'system' },
                    { id: 'gpt-4o-mini', object: 'model', created: 1700000000, owned_by: 'system' },
                    { id: 'claude-sonnet-4-20250514', object: 'model', created: 1700000000, owned_by: 'system' },
                  ],
                },
                null,
                2
              )}
            />
          </EndpointCard>

          <EndpointCard
            method='POST'
            path='/v1/embeddings'
            desc='文本嵌入向量'
          >
            <h4 className='mb-2 text-xs font-semibold uppercase text-muted-foreground'>
              请求示例
            </h4>
            <CodeBlock
              code={JSON.stringify(
                {
                  model: 'text-embedding-3-small',
                  input: 'The quick brown fox jumps over the lazy dog',
                },
                null,
                2
              )}
            />
          </EndpointCard>

          <EndpointCard
            method='POST'
            path='/v1/images/generations'
            desc='图片生成（DALL-E）'
          >
            <h4 className='mb-2 text-xs font-semibold uppercase text-muted-foreground'>
              请求示例
            </h4>
            <CodeBlock
              code={JSON.stringify(
                {
                  model: 'dall-e-3',
                  prompt: 'A cute cat sitting on a chair, digital art',
                  n: 1,
                  size: '1024x1024',
                },
                null,
                2
              )}
            />
          </EndpointCard>
        </Section>

        {/* 5. 代码示例 */}
        <Section icon='💻' title='代码示例'>
          <p className='text-muted-foreground text-sm'>
            以下示例展示如何使用不同编程语言调用 LoveAPI。
          </p>

          <h3 className='text-sm font-semibold'>cURL</h3>
          <CodeBlock
            code={`curl ${serverAddress}/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer <your-loveapi-key>" \\
  -d '{
    "model": "gpt-4o",
    "messages": [
      {"role": "user", "content": "Hello!"}
    ]
  }'`}
            lang='bash'
          />

          <h3 className='pt-4 text-sm font-semibold'>Python</h3>
          <CodeBlock
            code={`from openai import OpenAI

client = OpenAI(
    api_key="<your-loveapi-key>",
    base_url="${serverAddress}"
)

response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Hello!"}]
)

print(response.choices[0].message.content)`}
            lang='python'
          />

          <h3 className='pt-4 text-sm font-semibold'>JavaScript</h3>
          <CodeBlock
            code={`import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: '<your-loveapi-key>',
  baseURL: '${serverAddress}'
});

const response = await client.chat.completions.create({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'Hello!' }]
});

console.log(response.choices[0].message.content);`}
            lang='javascript'
          />
        </Section>

        {/* 6. 错误码 */}
        <Section icon='⚠️' title='错误码说明'>
          <p className='text-muted-foreground text-sm'>
            LoveAPI 在遇到错误时会返回标准的 HTTP 状态码和错误信息。
          </p>

          <div className='overflow-hidden rounded-lg border'>
            <table className='w-full text-sm'>
              <thead>
                <tr className='bg-muted/50'>
                  <th className='px-4 py-2 text-left font-medium'>状态码</th>
                  <th className='px-4 py-2 text-left font-medium'>含义</th>
                  <th className='px-4 py-2 text-left font-medium'>说明</th>
                </tr>
              </thead>
              <tbody className='divide-y'>
                {[
                  { code: 200, label: '成功', desc: '请求成功，正常返回数据' },
                  { code: 400, label: '请求错误', desc: '请求参数有误，请检查请求体格式' },
                  { code: 401, label: '未授权', desc: 'API Key 无效或未提供，请检查 Authorization 头部' },
                  { code: 429, label: '请求过频', desc: '超出速率限制或额度不足' },
                  { code: 500, label: '服务器错误', desc: '上游供应商错误或内部错误，请稍后重试' },
                  { code: 503, label: '服务不可用', desc: '所有上游渠道均不可用，请稍后重试' },
                ].map((e) => (
                  <tr key={e.code} className='hover:bg-muted/30'>
                    <td className='px-4 py-2'>
                      <span
                        className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-bold ${
                          e.code < 300
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                            : e.code < 500
                              ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                              : 'bg-red-500/10 text-red-600 dark:text-red-400'
                        }`}
                      >
                        {e.code}
                      </span>
                    </td>
                    <td className='px-4 py-2 font-medium'>{e.label}</td>
                    <td className='text-muted-foreground px-4 py-2'>{e.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h4 className='text-sm font-semibold'>错误响应格式</h4>
          <CodeBlock
            code={JSON.stringify(
              {
                error: {
                  message: '余额不足',
                  type: 'insufficient_balance',
                  code: 429,
                },
              },
              null,
              2
            )}
          />
        </Section>
      </div>
    </PublicLayout>
  )
}
