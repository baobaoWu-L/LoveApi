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
import { useState, useEffect, useMemo } from 'react'
import { CopyButton } from '@/components/copy-button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { PublicLayout } from '@/components/layout'
import { PastelBackdrop } from '@/components/pastel-backdrop'
import { GsapReveal } from '@/components/gsap-reveal'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'
import { cn } from '@/lib/utils'
import { ChevronDown, ChevronRight, Copy, Search, List } from 'lucide-react'

// ===== 章节与菜单数据 =====

type SectionId =
  | 'intro'
  | 'quick-start'
  | 'codex'
  | 'claude'
  | 'deepseek'
  | 'qwen'
  | 'ccswitch'
  | 'models'
  | 'endpoints'
  | 'examples'
  | 'errors'

const SECTION_IDS: SectionId[] = [
  'intro',
  'quick-start',
  'codex',
  'claude',
  'deepseek',
  'qwen',
  'ccswitch',
  'models',
  'endpoints',
  'examples',
  'errors',
]

const SECTION_TITLES: Record<SectionId, string> = {
  intro: '引言',
  'quick-start': '快速接入',
  codex: 'Codex（ChatGPT）配置',
  claude: 'Claude 配置',
  deepseek: 'DeepSeek 配置',
  qwen: 'Qwen（通义千问）配置',
  ccswitch: 'CC Switch 接入',
  models: '支持模型',
  endpoints: 'API 端点',
  examples: '代码示例',
  errors: '错误码说明',
}

type NavItem = { id: SectionId; label: string; icon: string }
type NavGroup = { title: string; items: NavItem[] }

const NAV_GROUPS: NavGroup[] = [
  {
    title: '开始',
    items: [
      { id: 'intro', label: '引言', icon: '📖' },
      { id: 'quick-start', label: '快速接入', icon: '🚀' },
    ],
  },
  {
    title: '模型配置',
    items: [
      { id: 'codex', label: 'Codex（ChatGPT）', icon: '🤖' },
      { id: 'claude', label: 'Claude', icon: '🗣️' },
      { id: 'deepseek', label: 'DeepSeek', icon: '🐋' },
      { id: 'qwen', label: 'Qwen（通义千问）', icon: '💫' },
      { id: 'ccswitch', label: 'CC Switch 接入', icon: '🔧' },
    ],
  },
  {
    title: '参考',
    items: [
      { id: 'models', label: '支持模型', icon: '🧠' },
      { id: 'endpoints', label: 'API 端点', icon: '📡' },
      { id: 'examples', label: '代码示例', icon: '💻' },
      { id: 'errors', label: '错误码说明', icon: '⚠️' },
    ],
  },
]

// ===== 滚动定位：当前高亮章节 =====

function useActiveSection(ids: readonly string[]) {
  const [active, setActive] = useState<string>(ids[0])

  useEffect(() => {
    const onScroll = () => {
      const offset = 150
      let current = ids[0]
      for (const id of ids) {
        const el = document.getElementById(id)
        if (el && el.getBoundingClientRect().top <= offset) current = id
      }
      if (current !== active) setActive(current)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [ids, active])

  return active
}

// ===== 代码块组件 =====

function CodeBlock({ code, lang = 'json' }: { code: string; lang?: string }) {
  const { copyToClipboard } = useCopyToClipboard()

  return (
    <div className='overflow-hidden rounded-lg border'>
      <div className='bg-muted/30 flex items-center justify-between border-b px-4 py-2'>
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
      <pre className='bg-muted/40 overflow-x-auto rounded-md border p-4'>
        <code className='text-foreground font-mono text-sm leading-relaxed whitespace-pre'>
          {code}
        </code>
      </pre>
    </div>
  )
}

// ===== 章节组件 =====

function Section({
  id,
  title,
  children,
}: {
  id: SectionId
  icon?: string
  title: string
  children: React.ReactNode
}) {
  return (
    <section
      id={id}
      data-reveal
      className='scroll-mt-28 space-y-4 border-b border-border/40 py-10 last:border-0'
    >
      <h2 className='flex items-center gap-2 text-2xl font-semibold tracking-tight'>
        {title}
      </h2>
      {children}
    </section>
  )
}

function ConfigField({ code, text }: { code: string; text: string }) {
  return (
    <p>
      <code className='bg-muted rounded px-1 py-0.5 text-xs'>{code}</code>
      <span className='text-muted-foreground'> — {text}</span>
    </p>
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

// ===== 主页面 =====

export function ApiDoc() {
  const [query, setQuery] = useState('')
  const [mobileOpen, setMobileOpen] = useState(false)
  const active = useActiveSection(SECTION_IDS)

  // 中转站对外地址：文档中的所有配置示例都指向这个真实可接入的地址
  const serverAddress = 'https://api.LoveFulfiller.cn'

  const filteredGroups = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return NAV_GROUPS
    return NAV_GROUPS.map((group) => ({
      ...group,
      items: group.items.filter(
        (item) =>
          item.label.toLowerCase().includes(q) ||
          item.id.toLowerCase().includes(q)
      ),
    })).filter((group) => group.items.length > 0)
  }, [query])

  return (
    <PublicLayout showMainContainer={false}>
      <div className='relative'>
        <PastelBackdrop />

        {/* 移动端菜单按钮 */}
        <div className='sticky top-16 z-30 px-4 pt-2 md:hidden'>
          <button
            onClick={() => setMobileOpen((v) => !v)}
            className='bg-background/80 border-border/40 text-muted-foreground focus-visible:ring-ring inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium backdrop-blur-xl transition-colors focus-visible:ring-1'
          >
            <List className='size-4' />
            {mobileOpen ? '收起目录' : '文档目录'}
          </button>
          {mobileOpen && (
            <div className='bg-background/90 border-border/40 mt-2 max-h-[70dvh] overflow-y-auto rounded-2xl border p-3 backdrop-blur-xl'>
              {NAV_GROUPS.flatMap((g) => g.items).map((item) => (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    'text-muted-foreground hover:text-foreground flex items-center gap-2 rounded-lg px-3 py-2 text-sm',
                    active === item.id && 'text-foreground bg-muted/50 font-medium'
                  )}
                >
                  {item.label}
                </a>
              ))}
            </div>
          )}
        </div>

        <div className='mx-auto w-full max-w-[1400px] px-4 pt-8 pb-16 md:px-6 lg:px-8'>
          <GsapReveal>
            <div className='grid gap-10 lg:grid-cols-[250px_minmax(0,1fr)] xl:grid-cols-[250px_minmax(0,1fr)_200px]'>
              {/* 左侧菜单栏 */}
              <aside data-reveal className='hidden lg:block'>
                <div className='sticky top-24 max-h-[calc(100dvh-7rem)] space-y-4 overflow-y-auto pr-2'>
                  <div className='flex items-center gap-2'>
                    <div className='from-primary ring-primary/20 bg-gradient-to-br to-rose-400 flex size-8 items-center justify-center rounded-xl text-white ring-1'>
                      <span className='text-sm font-bold'>L</span>
                    </div>
                    <span className='text-sm font-semibold tracking-tight'>
                      Use Guide
                    </span>
                  </div>

                  <div className='relative'>
                    <Search className='text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2' />
                    <Input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder='搜索文档...'
                      className='bg-background/50 border-border/50 ps-9'
                    />
                  </div>

                  <nav className='space-y-4'>
                    {filteredGroups.map((group) => (
                      <div key={group.title}>
                        <div className='text-muted-foreground pb-1.5 text-xs font-semibold tracking-wider uppercase'>
                          {group.title}
                        </div>
                        <ul className='space-y-0.5'>
                          {group.items.map((item) => (
                            <li key={item.id}>
                              <a
                                href={`#${item.id}`}
                                className={cn(
                                  'hover:bg-muted/60 text-muted-foreground hover:text-foreground flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors',
                                  active === item.id &&
                                    'text-foreground bg-muted/70 font-medium'
                                )}
                              >
                                {item.label}
                              </a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </nav>
                </div>
              </aside>

              {/* 正文 */}
              <main className='min-w-0'>
                <div className='mx-auto max-w-3xl'>
                  {/* 标题区 */}
                  <header
                    data-reveal
                    className='space-y-4 border-b border-border/40 pb-8'
                  >
                    <span className='text-primary inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold tracking-wide uppercase'>
                      <span className='size-1.5 rounded-full bg-current' />
                      API Reference
                    </span>
                    <h1 className='text-4xl leading-tight font-bold tracking-tight sm:text-5xl'>
                      Love Api 接口文档
                    </h1>
                    <p className='text-muted-foreground max-w-2xl leading-relaxed'>
                      统一的大模型 API 网关，完全兼容 OpenAI 协议格式。一套接口即可接入 OpenAI、Anthropic（Claude）、DeepSeek、Qwen 等主流大模型，无需为每个供应商单独适配。
                    </p>
                  </header>

                  {/* 1. 引言 */}
                  <Section id='intro' icon='📖' title={SECTION_TITLES.intro}>
                    <p className='text-muted-foreground text-sm leading-relaxed'>
                      Love Api 提供了与 OpenAI 完全兼容的接口，您只需把原有客户端的 Base URL 和 API Key 替换为 Love Api 的凭证，即可用同一套协议调用多家大模型，并在渠道间自动路由。
                    </p>
                    <div className='grid gap-3 sm:grid-cols-3'>
                      {[
                        { t: '开放性', d: '兼容 OpenAI / Anthropic 协议' },
                        { t: '一体化', d: '统一配额、计费与密钥' },
                        { t: '自动路由', d: '多渠道负载均衡与容灾' },
                      ].map((c) => (
                        <div
                          key={c.t}
                          className='bg-background/40 border-border/40 rounded-xl border p-4'
                        >
                          <div className='text-sm font-semibold'>{c.t}</div>
                          <div className='text-muted-foreground mt-1 text-xs'>
                            {c.d}
                          </div>
                        </div>
                      ))}
                    </div>
                  </Section>

                  {/* 2. 快速接入 */}
                  <Section
                    id='quick-start'
                    icon='🚀'
                    title={SECTION_TITLES['quick-start']}
                  >
                    <p className='text-muted-foreground text-sm leading-relaxed'>
                      将原有 API 调用的 Base URL 和 Authorization 头部替换成 Love Api 的凭证即可。
                    </p>
                    <Card className='border-primary/20 bg-primary/5 p-4 space-y-3'>
                      <div className='flex flex-wrap items-center justify-between gap-4'>
                        <div className='space-y-1'>
                          <div className='text-muted-foreground text-xs font-medium'>
                            Base URL（服务器地址）
                          </div>
                          <code className='bg-background text-primary inline-block rounded border px-3 py-1.5 text-sm font-semibold break-all'>
                            {serverAddress}
                          </code>
                        </div>
                        <CopyButton value={serverAddress} />
                      </div>
                    </Card>
                    <div className='bg-muted/50 border-border/50 flex items-start gap-3 rounded-lg p-4 text-sm'>
                      <span className='text-lg'>💡</span>
                      <div className='text-muted-foreground space-y-1'>
                        <strong className='text-foreground'>提示：</strong>
                        请求时需要在 Header 中添加{' '}
                        <code className='bg-muted rounded px-1 text-xs'>
                          Authorization: Bearer &lt;your_api_key&gt;
                        </code>
                        。您可以在控制台 → API 密钥 中获取您的密钥。
                      </div>
                    </div>
                  </Section>

                  {/* 3. Codex 配置 */}
                  <Section
                    id='codex'
                    icon='🤖'
                    title={SECTION_TITLES.codex}
                  >
                    <p className='text-muted-foreground text-sm leading-relaxed'>
                      在 <code className='bg-muted rounded px-1 text-xs'>~/.codex/config.toml</code>{' '}
                      中配置 Love Api 作为 Codex CLI 的模型提供方：
                    </p>
                    <CodeBlock
                      code={`# 切换模型无需改此文件：直接在 Codex 桌面端选择，选中哪个就用哪个（不会自动路由到其它模型）
# 下面 model 仅为默认值
model = "gpt-5.6-sol"
model_provider = "loveapi"

[model_providers.loveapi]
name = "Love API"
base_url = "${serverAddress}/v1"
env_key = "LOVEAPI_API_KEY"
wire_api = "chat"`}
                      lang='toml'
                    />
                    <div className='rounded-lg border border-amber-200/70 bg-amber-50/70 p-3 text-xs leading-relaxed text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300'>
                      <strong>模型切换：</strong>
                      直接在你的 Codex 桌面端切换模型即可，选中哪个就用哪个，**无需修改此文件**。
                      Codex 默认会在多个模型间自动切换（例如有的任务会去调用
                      <code className='bg-muted mx-1 rounded px-1'>gpt-5.6-terra</code>
                      等）；要「选哪个模型、就用哪个模型」，只需保持上面
                      <em>只有一个</em>
                      <code className='bg-muted mx-1 rounded px-1'>model</code>
                      和
                      <code className='bg-muted mx-1 rounded px-1'>model_provider</code>
                      （不添加其它模型/模型提供方），Codex 就会只使用你选定的模型。
                    </div>
                    <div className='bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground'>
                      然后在环境变量中设置对应的密钥：
                      <CodeBlock
                        code={`export LOVEAPI_API_KEY=sk-your-loveapi-key`}
                        lang='bash'
                      />
                    </div>
                    <div className='text-xs text-muted-foreground space-y-1'>
                      <ConfigField
                        code='base_url'
                        text='Love Api 的 OpenAI 兼容端点，末尾需要 /v1'
                      />
                      <ConfigField
                        code='env_key'
                        text='读取 API Key 的环境变量名'
                      />
                      <ConfigField code='wire_api' text='固定为 "chat"' />
                    </div>
                  </Section>

                  {/* 4. Claude 配置 */}
                  <Section
                    id='claude'
                    icon='🗣️'
                    title={SECTION_TITLES.claude}
                  >
                    <p className='text-muted-foreground text-sm leading-relaxed'>
                      在 <code className='bg-muted rounded px-1 text-xs'>~/.claude/settings.json</code>{' '}
                      中通过环境变量指向 Love Api（Claude Code 原生支持自定义端点）：
                    </p>
                    <CodeBlock
                      code={JSON.stringify(
                        {
                          env: {
                            ANTHROPIC_BASE_URL: serverAddress,
                            ANTHROPIC_AUTH_TOKEN: 'sk-your-loveapi-key',
                            ANTHROPIC_MODEL: 'claude-sonnet-4-20250514',
                            ANTHROPIC_SMALL_FAST_MODEL:
                              'claude-3-5-haiku-20241022',
                          },
                        },
                        null,
                        2
                      )}
                    />
                    <div className='text-xs text-muted-foreground space-y-1'>
                      <ConfigField
                        code='ANTHROPIC_BASE_URL'
                        text='Love Api 服务地址（无 /v1 后缀）'
                      />
                      <ConfigField
                        code='ANTHROPIC_AUTH_TOKEN'
                        text='您的 Love Api 密钥'
                      />
                      <ConfigField
                        code='ANTHROPIC_MODEL'
                        text='主模型，可替换为任意 Claude 模型名'
                      />
                    </div>
                  </Section>

                  {/* 5. DeepSeek 配置 */}
                  <Section
                    id='deepseek'
                    icon='🐋'
                    title={SECTION_TITLES.deepseek}
                  >
                    <p className='text-muted-foreground text-sm leading-relaxed'>
                      DeepSeek 走 OpenAI 兼容协议，直接用官方 SDK 指向 Love Api 即可：
                    </p>
                    <CodeBlock
                      code={`from openai import OpenAI

client = OpenAI(
    api_key="sk-your-loveapi-key",
    base_url="${serverAddress}/v1",
)

resp = client.chat.completions.create(
    model="deepseek-chat",        # 推理用 deepseek-reasoner / deepseek-r1
    messages=[{"role": "user", "content": "Hello!"}],
)
print(resp.choices[0].message.content)`}
                      lang='python'
                    />
                    <div className='text-xs text-muted-foreground space-y-1'>
                      <ConfigField
                        code='base_url'
                        text='末尾需带 /v1'
                      />
                      <ConfigField
                        code='model'
                        text='deepseek-chat / deepseek-reasoner / deepseek-r1'
                      />
                    </div>
                  </Section>

                  {/* 6. Qwen 配置 */}
                  <Section
                    id='qwen'
                    icon='💫'
                    title={SECTION_TITLES.qwen}
                  >
                    <p className='text-muted-foreground text-sm leading-relaxed'>
                      Qwen（通义千问）同样兼容 OpenAI 协议：
                    </p>
                    <CodeBlock
                      code={`from openai import OpenAI

client = OpenAI(
    api_key="sk-your-loveapi-key",
    base_url="${serverAddress}/v1",
)

resp = client.chat.completions.create(
    model="qwen-max",             # qwen-plus / qwen-turbo / qwen2.5-72b-instruct
    messages=[{"role": "user", "content": "Hello!"}],
)
print(resp.choices[0].message.content)`}
                      lang='python'
                    />
                    <div className='text-xs text-muted-foreground space-y-1'>
                      <ConfigField
                        code='model'
                        text='按需使用 qwen-max / qwen-plus / qwen-turbo'
                      />
                    </div>
                  </Section>

                  {/* 7. CC Switch 接入 */}
                  <Section
                    id='ccswitch'
                    icon='🔧'
                    title={SECTION_TITLES.ccswitch}
                  >
                    <p className='text-muted-foreground text-sm leading-relaxed'>
                      CC Switch 是一个模型路由切换工具，支持一键导入 provider。点击下面任意深链即可把 Love Api
                      添加为 Claude / Codex / Gemini 的提供方（<code className='bg-muted rounded px-1 text-xs'>app=codex</code>{' '}
                      时端点需带 <code className='bg-muted rounded px-1 text-xs'>/v1</code>）：
                    </p>
                    <CodeBlock
                      code={`ccswitch://v1/import?resource=provider&app=claude&name=LoveApi&endpoint=${serverAddress}&apiKey=sk-your-loveapi-key&model=claude-sonnet-4-20250514&homepage=${serverAddress}&enabled=true`}
                      lang='text'
                    />
                    <p className='text-muted-foreground text-sm'>
                      Codex 示例（注意 endpoint 加{' '}
                      <code className='bg-muted rounded px-1 text-xs'>/v1</code>）：
                    </p>
                    <CodeBlock
                      code={`ccswitch://v1/import?resource=provider&app=codex&name=LoveApi&endpoint=${serverAddress}/v1&apiKey=sk-your-loveapi-key&model=gpt-5.6-sol&homepage=${serverAddress}&enabled=true`}
                      lang='text'
                    />
                    <p className='text-muted-foreground text-xs leading-relaxed'>
                      切换模型直接在 Codex / Claude 桌面端选择即可，无需改此文件；这里的
                      <code className='bg-muted mx-1 rounded px-1'>model</code>
                      仅为导入时的默认值（也可省略）。
                    </p>
                    <div className='overflow-hidden rounded-lg border'>
                      <table className='w-full text-sm'>
                        <thead>
                          <tr className='bg-muted/30 text-left'>
                            <th className='px-4 py-2 font-medium'>参数</th>
                            <th className='px-4 py-2 font-medium'>说明</th>
                          </tr>
                        </thead>
                        <tbody className='divide-y'>
                          {[
                            ['app', 'claude / codex / gemini'],
                            ['name', '提供方在 CC Switch 中的显示名称'],
                            ['endpoint', 'codex 需带 /v1，其余为服务器地址'],
                            ['apiKey', '您的 Love Api 密钥'],
                            ['model', '主模型名，可选'],
                            [
                              'homepage',
                              '回填到客户端主页地址，用于二次跳转',
                            ],
                          ].map(([k, v]) => (
                            <tr key={k}>
                              <td className='px-4 py-2'>
                                <code className='bg-muted rounded px-1 text-xs'>
                                  {k}
                                </code>
                              </td>
                              <td className='text-muted-foreground px-4 py-2'>
                                {v}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Section>

                  {/* 8. 支持模型 */}
                  <Section id='models' icon='🧠' title={SECTION_TITLES.models}>
                    <p className='text-muted-foreground text-sm leading-relaxed'>
                      Love Api 支持以下模型系列。模型名称遵循上游供应商命名规范，可直接在请求中使用。
                    </p>
                    <h3 className='pt-2 text-base font-semibold'>
                      🤖 ChatGPT（Codex）系列
                    </h3>
                    <Card className='p-4'>
                      <div className='flex flex-wrap gap-2'>
                        {[
                          'gpt-4o',
                          'gpt-4o-mini',
                          'gpt-4-turbo',
                          'gpt-4',
                          'gpt-3.5-turbo',
                        ].map((m) => (
                          <Badge key={m} className='py-1.5 text-xs'>
                            {m}
                          </Badge>
                        ))}
                        {['o3-mini', 'o1-mini', 'o1'].map((m) => (
                          <Badge key={m} variant='secondary' className='py-1.5 text-xs'>
                            {m}
                          </Badge>
                        ))}
                      </div>
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
                        ].map((m) => (
                          <Badge key={m} className='py-1.5 text-xs'>
                            {m}
                          </Badge>
                        ))}
                      </div>
                    </Card>
                    <h3 className='pt-2 text-base font-semibold'>🐋 DeepSeek 系列</h3>
                    <Card className='p-4'>
                      <div className='flex flex-wrap gap-2'>
                        {['deepseek-chat', 'deepseek-reasoner', 'deepseek-v3', 'deepseek-r1'].map(
                          (m) => (
                            <Badge key={m} className='py-1.5 text-xs'>
                              {m}
                            </Badge>
                          )
                        )}
                      </div>
                    </Card>
                    <h3 className='pt-2 text-base font-semibold'>
                      💫 Qwen（通义千问）系列
                    </h3>
                    <Card className='p-4'>
                      <div className='flex flex-wrap gap-2'>
                        {['qwen-max', 'qwen-plus', 'qwen-turbo', 'qwen2.5-72b-instruct'].map(
                          (m) => (
                            <Badge key={m} className='py-1.5 text-xs'>
                              {m}
                            </Badge>
                          )
                        )}
                      </div>
                    </Card>
                  </Section>

                  {/* 9. API 端点 */}
                  <Section
                    id='endpoints'
                    icon='📡'
                    title={SECTION_TITLES.endpoints}
                  >
                    <p className='text-muted-foreground text-sm'>
                      以下所有端点均使用 POST 方法（除非另有说明），请求格式与 OpenAI API 完全兼容。
                    </p>
                    <EndpointCard
                      method='POST'
                      path='/v1/chat/completions'
                      desc='聊天补全（核心接口）'
                      defaultOpen={true}
                    >
                      <h4 className='text-muted-foreground mb-2 text-xs font-semibold uppercase'>
                        请求示例
                      </h4>
                      <CodeBlock
                        code={JSON.stringify(
                          {
                            model: 'gpt-4o',
                            messages: [
                              {
                                role: 'system',
                                content: 'You are a helpful assistant.',
                              },
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
                      <h4 className='text-muted-foreground mt-4 mb-2 text-xs font-semibold uppercase'>
                        参数说明
                      </h4>
                      <div className='text-muted-foreground space-y-1 text-xs'>
                        <ConfigField code='model' text='必填，模型名称' />
                        <ConfigField
                          code='messages'
                          text='必填，消息列表，支持 system/user/assistant'
                        />
                        <ConfigField
                          code='stream'
                          text='可选，是否流式输出，默认 false'
                        />
                      </div>
                    </EndpointCard>
                    <EndpointCard
                      method='POST'
                      path='/v1/messages'
                      desc='消息接口（Claude 原生格式）'
                    >
                      <CodeBlock
                        code={JSON.stringify(
                          {
                            model: 'claude-sonnet-4-20250514',
                            messages: [{ role: 'user', content: 'Hello!' }],
                            system: 'You are Claude, a helpful AI assistant.',
                            max_tokens: 2048,
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
                      <CodeBlock
                        code={JSON.stringify(
                          {
                            object: 'list',
                            data: [
                              {
                                id: 'gpt-4o',
                                object: 'model',
                                created: 1700000000,
                                owned_by: 'system',
                              },
                              {
                                id: 'claude-sonnet-4-20250514',
                                object: 'model',
                                created: 1700000000,
                                owned_by: 'system',
                              },
                            ],
                          },
                          null,
                          2
                        )}
                      />
                    </EndpointCard>
                  </Section>

                  {/* 10. 代码示例 */}
                  <Section
                    id='examples'
                    icon='💻'
                    title={SECTION_TITLES.examples}
                  >
                    <h3 className='text-sm font-semibold'>cURL</h3>
                    <CodeBlock
                      code={`curl ${serverAddress}/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer sk-your-loveapi-key" \\
  -d '{
    "model": "gpt-4o",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'`}
                      lang='bash'
                    />
                    <h3 className='pt-4 text-sm font-semibold'>JavaScript</h3>
                    <CodeBlock
                      code={`import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: '<your-loveapi-key>',
  baseURL: '${serverAddress}/v1'
});

const resp = await client.chat.completions.create({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'Hello!' }]
});

console.log(resp.choices[0].message.content);`}
                      lang='javascript'
                    />
                  </Section>

                  {/* 11. 错误码 */}
                  <Section
                    id='errors'
                    icon='⚠️'
                    title={SECTION_TITLES.errors}
                  >
                    <div className='overflow-hidden rounded-lg border'>
                      <table className='w-full text-sm'>
                        <thead>
                          <tr className='bg-muted/30 text-left'>
                            <th className='px-4 py-2 font-medium'>状态码</th>
                            <th className='px-4 py-2 font-medium'>含义</th>
                          </tr>
                        </thead>
                        <tbody className='divide-y'>
                          {[
                            [200, '成功', 'bg-emerald-500/10 text-emerald-600'],
                            [400, '请求错误', 'bg-amber-500/10 text-amber-600'],
                            [401, '未授权', 'bg-amber-500/10 text-amber-600'],
                            [429, '请求过频', 'bg-amber-500/10 text-amber-600'],
                            [500, '服务器错误', 'bg-red-500/10 text-red-600'],
                            [503, '服务不可用', 'bg-red-500/10 text-red-600'],
                          ].map(([code, label, cls]) => (
                            <tr key={code}>
                              <td className='px-4 py-2'>
                                <span
                                  className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-bold ${cls}`}
                                >
                                  {code}
                                </span>
                              </td>
                              <td className='text-muted-foreground px-4 py-2'>
                                {label}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Section>
                </div>
              </main>

              {/* 右侧本页目录 */}
              <aside data-reveal className='hidden xl:block'>
                <div className='sticky top-24 space-y-3'>
                  <div className='text-muted-foreground text-xs font-semibold tracking-wider uppercase'>
                    本页目录
                  </div>
                  <ul className='space-y-1'>
                    {SECTION_IDS.map((id) => (
                      <li key={id}>
                        <a
                          href={`#${id}`}
                          className={cn(
                            'text-muted-foreground hover:text-foreground block border-l-2 py-1 pl-3 text-[13px] transition-colors',
                            active === id
                              ? 'text-foreground border-primary font-medium'
                              : 'border-transparent'
                          )}
                        >
                          {SECTION_TITLES[id]}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              </aside>
            </div>
          </GsapReveal>
        </div>
      </div>
    </PublicLayout>
  )
}
