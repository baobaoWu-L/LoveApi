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
  const { t } = useTranslation()

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
          {t('Copy')}
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
            {t('LoveAPI API documentation')}
          </h1>
          <p className='text-muted-foreground mx-auto max-w-2xl leading-relaxed'>
            {t('A unified AI model API gateway, fully compatible with the OpenAI protocol. One integration connects 40+ leading AI providers without separate adapters.')}
          </p>
        </div>

        {/* 1. 快速接入 */}
        <Section icon='🚀' title={t('Quick start')}>
          <p className='text-muted-foreground text-sm leading-relaxed'>
            {t('LoveAPI is fully compatible with the OpenAI API. Replace your existing Base URL and API key with your LoveAPI credentials to get started.')}
          </p>

          <Card className='border-primary/20 bg-primary/5 p-4 space-y-3'>
            <div className='flex items-center justify-between gap-4 flex-wrap'>
              <div className='space-y-1'>
                <div className='text-muted-foreground text-xs font-medium'>
                  {t('Base URL (server address)')}
                </div>
                <code className='bg-background text-primary inline-block rounded border px-3 py-1.5 text-sm font-semibold break-all'>
                  {serverAddress}
                </code>
              </div>
              <CopyButton value={serverAddress} />
            </div>
          </Card>

          <div className='bg-muted/50 border border-border/50 flex items-start gap-3 rounded-lg p-4 text-sm'>
            <span className='text-lg'>💡</span>
            <div className='text-muted-foreground space-y-1'>
              <strong className='text-foreground'>{t('Tip')}:</strong>
              {t('Include Authorization: Bearer <your_api_key> in the request header. You can find your API key in the console.')}
            </div>
          </div>
        </Section>

        {/* 2. 配置文件指南 */}
        <Section icon='⚙️' title={t('Configuration guide')}>
          <p className='text-muted-foreground text-sm leading-relaxed'>
            {t('LoveAPI is fully compatible with the OpenAI protocol, so you can use it with any client or framework that supports the OpenAI API. Here are configuration examples for common tools:')}
          </p>

          {/* .claude 配置 */}
          <h3 className='flex items-center gap-2 pt-4 text-base font-semibold'>
            📁 {t('.claude configuration')}
          </h3>
          <Card className='p-4 space-y-3'>
            <p className='text-muted-foreground text-sm'>
              {t('Create .claude/settings.json in your project root and configure LoveAPI as the Claude Code model provider:')}
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
              <p><strong>{t('Configuration notes')}:</strong></p>
              <p><code className='bg-muted px-1 rounded'>model</code> — {t('Model to use, such as claude-sonnet-4-20250514 or gpt-4o')}</p>
              <p><code className='bg-muted px-1 rounded'>provider.id</code> — {t('Provider identifier; you may customize it')}</p>
              <p><code className='bg-muted px-1 rounded'>provider.apiKey</code> — {t('Your LoveAPI token, available in the console')}</p>
              <p><code className='bg-muted px-1 rounded'>provider.baseUrl</code> — {t('LoveAPI service address')}</p>
            </div>
          </Card>

          {/* .codex 配置 */}
          <h3 className='flex items-center gap-2 pt-4 text-base font-semibold'>
            📁 {t('.codex configuration')}
          </h3>
          <Card className='p-4 space-y-3'>
            <p className='text-muted-foreground text-sm'>
              {t('Create or edit .codex/settings.json in your project root and configure LoveAPI as the Codex CLI model provider:')}
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
              <p><strong>{t('Configuration notes')}:</strong></p>
              <p><code className='bg-muted px-1 rounded'>provider</code> — {t('Set to "loveapi" to enable the LoveAPI provider')}</p>
              <p><code className='bg-muted px-1 rounded'>loveapi.apiKey</code> — {t('Your LoveAPI token')}</p>
              <p><code className='bg-muted px-1 rounded'>loveapi.baseUrl</code> — {t('LoveAPI service address')}</p>
              <p><code className='bg-muted px-1 rounded'>loveapi.models</code> — {t('Available models grouped into chat and reasoning')}</p>
              <p><code className='bg-muted px-1 rounded'>allowedTools</code> — {t('Tools that Codex CLI is allowed to use')}</p>
            </div>
          </Card>

          {/* CcSwitch 配置 */}
          <h3 className='flex items-center gap-2 pt-4 text-base font-semibold'>
            🔧 {t('CcSwitch configuration')}
          </h3>
          <Card className='p-4 space-y-3'>
            <p className='text-muted-foreground text-sm'>
              {t('CcSwitch dynamically switches between AI providers. The following example references LoveAPI through CcSwitch:')}
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
                <strong className='text-foreground'>{t('CcSwitch notes')}:</strong>
                {t('Use type: "openai-compatible" to declare LoveAPI as an OpenAI-compatible provider. The models field describes capabilities per model, while switchRules route model names with regular expressions.')}
              </div>
            </div>
          </Card>

          {/* 修改配置文件步骤 */}
          <h3 className='flex items-center gap-2 pt-4 text-base font-semibold'>
            📝 {t('Configuration steps')}
          </h3>
          <Card className='p-4 space-y-3'>
            <p className='text-muted-foreground text-sm'>
              {t('Follow these steps to update your configuration:')}
            </p>
            <ol className='space-y-3'>
              {[
                {
                  title: t('Locate the configuration file'),
                  desc: t('Find .claude/settings.json or .codex/settings.json in your project root, or create it if missing.'),
                },
                {
                  title: t('Update configuration values'),
                  desc: t('Use the examples above and replace apiKey with your LoveAPI token and baseUrl with the server address.'),
                },
                {
                  title: t('Choose a model'),
                  desc: t('Set the model field to the model name you want. Add other models from the admin console model management page.'),
                },
                {
                  title: t('Save and restart'),
                  desc: t('Save the file and restart Claude Code or Codex CLI for the changes to take effect.'),
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
        <Section icon='🧠' title={t('Supported models')}>
          <p className='text-muted-foreground text-sm leading-relaxed'>
            {t('LoveAPI supports the following model families. Names follow upstream conventions and can be used directly in requests.')}
          </p>

          <h3 className='pt-2 text-base font-semibold'>
              🤖 {t('ChatGPT (Codex) family')}
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
              🟢 {t('Default = general conversation')} &nbsp;&nbsp; 🟡 {t('Secondary = reasoning')}
            </p>
          </Card>

          <h3 className='pt-2 text-base font-semibold'>
              🗣️ {t('Claude family')}
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
              {t('All Claude models support streaming and thinking modes.')}
            </p>
          </Card>

          <div className='bg-muted/50 border border-border/50 flex items-start gap-3 rounded-lg p-4 text-sm'>
            <span className='text-base'>📌</span>
            <div className='text-muted-foreground text-sm leading-relaxed'>
              <strong className='text-foreground'>{t('Tip')}:</strong>
              {t('To add more models such as DeepSeek or Gemini, add the provider channel in the admin console, then add the model mapping. New models are available immediately without restarting the service.')}
            </div>
          </div>
        </Section>

        {/* 4. API 端点 */}
        <Section icon='📡' title={t('API endpoints')}>
          <p className='text-muted-foreground text-sm'>
            {t('All endpoints below use POST unless noted otherwise, and follow the OpenAI API request format.')}
          </p>

          <EndpointCard
            method='POST'
            path='/v1/chat/completions'
            desc={t('Chat completions (core endpoint)')}
            defaultOpen={true}
          >
            <h4 className='mb-2 text-xs font-semibold uppercase text-muted-foreground'>
              {t('Request example')}
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
              {t('Response example')}
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
              {t('Parameter details')}
            </h4>
            <div className='text-xs text-muted-foreground space-y-1'>
              <p><code className='bg-muted px-1 rounded'>model</code> — {t('Required model name, for example gpt-4o or claude-sonnet-4-20250514')}</p>
              <p><code className='bg-muted px-1 rounded'>messages</code> — {t('Required message list supporting system, user, and assistant roles')}</p>
              <p><code className='bg-muted px-1 rounded'>stream</code> — {t('Optional streaming output; defaults to false')}</p>
              <p><code className='bg-muted px-1 rounded'>temperature</code> — {t('Optional sampling temperature from 0 to 2; defaults to 1')}</p>
              <p><code className='bg-muted px-1 rounded'>max_tokens</code> — {t('Optional maximum output token count')}</p>
            </div>
          </EndpointCard>

          <EndpointCard
            method='POST'
            path='/v1/messages'
            desc={t('Messages endpoint (native Claude format)')}
          >
            <h4 className='mb-2 text-xs font-semibold uppercase text-muted-foreground'>
              {t('Request example')}
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
            desc={t('List available models')}
          >
            <h4 className='mb-2 text-xs font-semibold uppercase text-muted-foreground'>
              {t('Response example')}
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
            desc={t('Text embeddings')}
          >
            <h4 className='mb-2 text-xs font-semibold uppercase text-muted-foreground'>
              {t('Request example')}
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
            desc={t('Image generation (DALL-E)')}
          >
            <h4 className='mb-2 text-xs font-semibold uppercase text-muted-foreground'>
              {t('Request example')}
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

          <EndpointCard
            method='POST'
            path='/v1/videos'
            desc={t('Video generation (OpenAI format)')}
          >
            <h4 className='mb-2 text-xs font-semibold uppercase text-muted-foreground'>
              {t('Request example')}
            </h4>
            <CodeBlock
              code={JSON.stringify(
                {
                  model: 'grok-imagine-video',
                  prompt: 'A cinematic sunset over the ocean',
                  seconds: '5',
                  size: '1280x720',
                },
                null,
                2
              )}
            />
            <p className='text-muted-foreground mt-3 text-xs'>
              {t('After receiving a task ID, use GET /v1/videos/{task_id} to check status; when complete, download from /v1/videos/{task_id}/content.')}
            </p>
          </EndpointCard>

          <EndpointCard
            method='GET'
            path='/v1/videos/{task_id}'
            desc={t('Retrieve video generation task')}
          >
            <CodeBlock
              code={`curl ${serverAddress}/v1/videos/video_task_id \\\n+  -H "Authorization: Bearer <your-loveapi-key>"`}
              lang='bash'
            />
          </EndpointCard>
        </Section>

        {/* 5. 代码示例 */}
        <Section icon='💻' title={t('Code examples')}>
          <p className='text-muted-foreground text-sm'>
            {t('The examples below show how to call LoveAPI from different programming languages.')}
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
        <Section icon='⚠️' title={t('Error codes')}>
          <p className='text-muted-foreground text-sm'>
            {t('LoveAPI returns standard HTTP status codes and error messages when a request fails.')}
          </p>

          <div className='overflow-hidden rounded-lg border'>
            <table className='w-full text-sm'>
              <thead>
                <tr className='bg-muted/50'>
                  <th className='px-4 py-2 text-left font-medium'>{t('Status code')}</th>
                  <th className='px-4 py-2 text-left font-medium'>{t('Meaning')}</th>
                  <th className='px-4 py-2 text-left font-medium'>{t('Description')}</th>
                </tr>
              </thead>
              <tbody className='divide-y'>
                {[
                  { code: 200, label: t('Success'), desc: t('Request succeeded and returned data normally') },
                  { code: 400, label: t('Bad request'), desc: t('Invalid request parameters; check the request body format') },
                  { code: 401, label: t('Unauthorized'), desc: t('API key is invalid or missing; check the Authorization header') },
                  { code: 429, label: t('Too many requests'), desc: t('Rate limit exceeded or insufficient balance') },
                  { code: 500, label: t('Server error'), desc: t('Upstream provider or internal error; try again later') },
                  { code: 503, label: t('Service unavailable'), desc: t('All upstream channels are unavailable; try again later') },
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

          <h4 className='text-sm font-semibold'>{t('Error response format')}</h4>
          <CodeBlock
            code={JSON.stringify(
              {
                error: {
                  message: t('Insufficient balance'),
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
