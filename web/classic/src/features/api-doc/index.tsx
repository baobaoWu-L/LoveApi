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
import { useTranslation } from 'react-i18next'
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
  intro: 'Introduction',
  'quick-start': 'Quick start',
  codex: 'Codex (ChatGPT) configuration',
  claude: 'Claude configuration',
  deepseek: 'DeepSeek configuration',
  qwen: 'Qwen configuration',
  ccswitch: 'CC Switch integration',
  models: 'Supported models',
  endpoints: 'API endpoints',
  examples: 'Code examples',
  errors: 'Error codes',
}

type NavItem = { id: SectionId; label: string; icon: string }
type NavGroup = { title: string; items: NavItem[] }

const NAV_GROUPS: NavGroup[] = [
  {
    title: 'Getting started',
    items: [
      { id: 'intro', label: 'Introduction', icon: '📖' },
      { id: 'quick-start', label: 'Quick start', icon: '🚀' },
    ],
  },
  {
    title: 'Model configuration',
    items: [
      { id: 'codex', label: 'Codex (ChatGPT)', icon: '🤖' },
      { id: 'claude', label: 'Claude', icon: '🗣️' },
      { id: 'deepseek', label: 'DeepSeek', icon: '🐋' },
      { id: 'qwen', label: 'Qwen', icon: '💫' },
      { id: 'ccswitch', label: 'CC Switch integration', icon: '🔧' },
    ],
  },
  {
    title: 'Reference',
    items: [
      { id: 'models', label: 'Supported models', icon: '🧠' },
      { id: 'endpoints', label: 'API endpoints', icon: '📡' },
      { id: 'examples', label: 'Code examples', icon: '💻' },
      { id: 'errors', label: 'Error codes', icon: '⚠️' },
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
  const { t } = useTranslation()

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
          {t('Copy')}
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

// ===== Codex 子模型锁定注意事项（模型广场同款，统一格式）=====

function CodexSubagentNote() {
  const { t } = useTranslation()
  return (
    <div className='rounded-lg border border-rose-300/70 bg-rose-50/70 p-3 text-xs leading-relaxed text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300'>
      <strong>⚠️ {t('Codex integration note')}:</strong> {t('Without the lock settings below, the main conversation uses your selected model, but Codex agents may call a different submodel. Check Console → Usage logs for details.')}{' '}
      {t('To use the same model (gpt-5.6-sol) for the main conversation and subagents, write the following to')}{' '}
      <code className='bg-muted rounded px-1 py-0.5 font-mono text-[10px]'>~/.codex/config.toml</code>{' '}
      {t('and start with')}{' '}
      <code className='bg-muted rounded px-1 py-0.5 font-mono text-[10px]'>codex -p loveapi</code>{' '}
      :
      <pre className='mt-2 overflow-x-auto rounded-md bg-rose-50 p-2 font-mono text-[10px] leading-relaxed text-rose-800 dark:bg-rose-950/40 dark:text-rose-100'>
{`model = "gpt-5.6-sol"
review_model = "gpt-5.6-sol"
[agents]
default_subagent_model = "gpt-5.6-sol"

[profiles.loveapi]
model = "gpt-5.6-sol"
model_provider = "loveapi"`}
      </pre>
      <span>{t('Replace every gpt-5.6-sol above with your chosen model name; model, review_model, default_subagent_model, and profiles.loveapi.model must match.')}</span>
      <br />
      <span>{t('Billing always follows the model actually called; each request consumes the corresponding model quota.')}</span>
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

// ===== 主页面 =====

export function ApiDoc() {
  const { t } = useTranslation()
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
            {mobileOpen ? t('Close contents') : t('Document contents')}
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
                  {t(item.label)}
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
                      placeholder={t('Search documentation...')}
                      className='bg-background/50 border-border/50 ps-9'
                    />
                  </div>

                  <nav className='space-y-4'>
                    {filteredGroups.map((group) => (
                      <div key={group.title}>
                        <div className='text-muted-foreground pb-1.5 text-xs font-semibold tracking-wider uppercase'>
                          {t(group.title)}
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
                          {t(item.label)}
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
                      {t('LoveAPI API documentation')}
                    </h1>
                    <p className='text-muted-foreground max-w-2xl leading-relaxed'>
                      {t('A unified AI model API gateway, fully compatible with the OpenAI protocol. One integration connects leading OpenAI, Anthropic (Claude), DeepSeek, and Qwen models without separate adapters.')}
                    </p>
                  </header>

                  {/* 1. 引言 */}
                  <Section id='intro' icon='📖' title={t(SECTION_TITLES.intro)}>
                    <p className='text-muted-foreground text-sm leading-relaxed'>
                      {t('LoveAPI provides an OpenAI-compatible API. Replace your client Base URL and API key to call multiple models through one protocol with automatic channel routing.')}
                    </p>
                    <div className='grid gap-3 sm:grid-cols-3'>
                      {[
                        { t: t('Open compatibility'), d: t('Compatible with OpenAI and Anthropic protocols') },
                        { t: t('Unified management'), d: t('Unified quota, billing, and keys') },
                        { t: t('Automatic routing'), d: t('Multi-channel load balancing and failover') },
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
                      {t('Replace the Base URL and Authorization header in your existing API calls with your LoveAPI credentials.')}
                    </p>
                    <Card className='border-primary/20 bg-primary/5 p-4 space-y-3'>
                      <div className='flex flex-wrap items-center justify-between gap-4'>
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
                    <div className='bg-muted/50 border-border/50 flex items-start gap-3 rounded-lg p-4 text-sm'>
                      <span className='text-lg'>💡</span>
                      <div className='text-muted-foreground space-y-1'>
                        <strong className='text-foreground'>{t('Tip')}:</strong>{' '}
                        {t('Include Authorization: Bearer <your_api_key> in the request header. Find your key in the console under API keys.')}{' '}
                        <code className='bg-muted rounded px-1 text-xs'>
                          Authorization: Bearer &lt;your_api_key&gt;
                        </code>
                      </div>
                    </div>
                  </Section>

                  {/* 3. Codex 配置 */}
                  <Section
                    id='codex'
                    icon='🤖'
                    title={t(SECTION_TITLES.codex)}
                  >
                    <p className='text-muted-foreground text-sm leading-relaxed'>
                      {t('Configure LoveAPI as the Codex (ChatGPT) desktop or CLI provider in')}{' '}
                      <code className='bg-muted rounded px-1 text-xs'>~/.codex/config.toml</code>{' '}
                      {t('and')}{' '}
                      <code className='bg-muted rounded px-1 text-xs'>~/.codex/auth.json</code>{' '}
                      {t('(create an sk- token in Console → API keys)')}:
                    </p>
                    <div className='text-xs font-semibold text-muted-foreground'>
                      {t('① Model provider and runtime configuration')}
                    </div>
                    <CodeBlock
                      code={`# 切换模型无需改此文件：直接在 Codex 桌面端选择，选中哪个就用哪个（不会自动路由到其它模型）
# 下面 model 仅为默认值
model = "gpt-5.6-sol"
model_provider = "loveapi"
model_reasoning_effort = "medium"

# --- 关键：把子任务模型也固定为同一个，避免 Codex 调用其它模型（如 gpt-5.6-terra）---
# /review（代码审查）用的模型，默认可能与主模型不同、独立生效
review_model = "gpt-5.6-sol"
# 多代理 / 子代理（explorer、worker 等）的默认模型，不跟随上面的 model
[agents]
default_subagent_model = "gpt-5.6-sol"
default_subagent_reasoning_effort = "medium"

# --- 缓存优化配置 ---
cache_size_mb = 512
cache_ttl = "30m"
smart_cache = true
cache_compression = true

[model_providers.loveapi]
name = "Love API"
base_url = "${serverAddress}/v1"
wire_api = "responses"
requires_openai_auth = true
web_search = "live"

[features]
collaboration_modes = true
unified_exec = false
multi_agent = true
search_tool = true
steer = true

# --- 固定只用一个模型：用 codex -p loveapi 启用 ---
[profiles.loveapi]
model = "gpt-5.6-sol"
model_provider = "loveapi"`}
                      lang='toml'
                    />
                    <div className='text-xs font-semibold text-muted-foreground'>
                      {t('② Credential file: ~/.codex/auth.json')}
                    </div>
                    <CodeBlock
                      code={JSON.stringify(
                        {
                          OPENAI_API_KEY: 'sk-your-loveapi-key',
                        },
                        null,
                        2
                      )}
                      lang='json'
                    />
                    <p className='text-xs leading-relaxed text-muted-foreground'>
                      <code className='bg-muted rounded px-1 text-xs'>~/.codex/auth.json</code>{' '}
                      {t('in')}{' '}
                      <code className='bg-muted rounded px-1 text-xs'>OPENAI_API_KEY</code>{' '}
                      {t('Replace it with the real token from Console → API keys')}{' '}
                      <code className='bg-muted rounded px-1 text-xs'>sk-</code>{' '}
                      {t('starting with sk-, otherwise authentication will fail.')}
                    </p>
                    <div className='rounded-lg border border-amber-200/70 bg-amber-50/70 p-3 text-xs leading-relaxed text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300'>
                      <strong>{t('Use one fixed model:')}</strong>
                      {t('The main conversation uses')}{' '}
                      <code className='bg-muted mx-1 rounded px-1'>[profiles.loveapi]</code>{' '}
                      {t('to pin the model and start with')}{' '}
                      <code className='bg-muted mx-1 rounded px-1'>codex -p loveapi</code>{' '}
                      {t('. Also pin')}{' '}
                      <code className='bg-muted mx-1 rounded px-1'>review_model</code>{' '}
                      {t('and')}{' '}
                      <code className='bg-muted mx-1 rounded px-1'>agents.default_subagent_model</code>{' '}
                      {t('to the same model')}{' '}
                      <code className='bg-muted mx-1 rounded px-1'>gpt-5.6-sol</code>{' '}
                      {t('(otherwise /review and subagent tasks may call other models, such as')}{' '}
                      <code className='bg-muted mx-1 rounded px-1'>gpt-5.6-terra</code>){' '}{t('Keep these three settings identical to prevent cross-model calls.')}
                      <br />
                      <span>{t('Billing uses the price of the model actually called; each request consumes the matching model quota.')}</span>
                    </div>
                    <div className='text-xs text-muted-foreground space-y-1'>
                      <ConfigField
                        code='base_url'
                        text={t('LoveAPI OpenAI-compatible endpoint; append /v1')}
                      />
                      <ConfigField
                        code='wire_api'
                        text={t('Set to "responses" for the Codex / ChatGPT protocol')}
                      />
                      <ConfigField
                        code='requires_openai_auth'
                        text={t('Reads OPENAI_API_KEY from auth.json for authentication')}
                      />
                      <ConfigField
                        code='config.toml'
                        text={t('Configuration file: ~/.codex/config.toml')}
                      />
                      <ConfigField
                        code='auth.json'
                        text={t('Credential file: ~/.codex/auth.json')}
                      />
                    </div>
                    <div className='mt-3'>
                      <CodexSubagentNote />
                    </div>
                  </Section>

                  {/* 4. Claude 配置 */}
                  <Section
                    id='claude'
                    icon='🗣️'
                    title={t(SECTION_TITLES.claude)}
                  >
                    <p className='text-muted-foreground text-sm leading-relaxed'>
                      {t('Point Claude Code to LoveAPI through environment variables in')}{' '}
                      <code className='bg-muted rounded px-1 text-xs'>~/.claude/settings.json</code>:
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
                        text={t('LoveAPI service address without the /v1 suffix')}
                      />
                      <ConfigField
                        code='ANTHROPIC_AUTH_TOKEN'
                        text={t('Your LoveAPI key')}
                      />
                      <ConfigField
                        code='ANTHROPIC_MODEL'
                        text={t('Primary model; replace with any Claude model name')}
                      />
                    </div>
                  </Section>

                  {/* 5. DeepSeek 配置 */}
                  <Section
                    id='deepseek'
                    icon='🐋'
                    title={t(SECTION_TITLES.deepseek)}
                  >
                    <p className='text-muted-foreground text-sm leading-relaxed'>
                      {t('DeepSeek uses the OpenAI-compatible protocol; point the official SDK at LoveAPI:')}
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
                        text={t('Must end with /v1')}
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
                    title={t(SECTION_TITLES.qwen)}
                  >
                    <p className='text-muted-foreground text-sm leading-relaxed'>
                      {t('Qwen is also compatible with the OpenAI protocol:')}
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
                        text={t('Use qwen-max, qwen-plus, or qwen-turbo as needed')}
                      />
                    </div>
                  </Section>

                  {/* 7. CC Switch 接入 */}
                  <Section
                    id='ccswitch'
                    icon='🔧'
                    title={t(SECTION_TITLES.ccswitch)}
                  >
                    <p className='text-muted-foreground text-sm leading-relaxed'>
                      {t('CC Switch is a model routing tool with one-click provider import. Use the deep link below to add LoveAPI as a Codex provider')}
                      ({t('for app=codex the endpoint must include')}{' '}
                      <code className='bg-muted rounded px-1 text-xs'>/v1</code>). {t('The deep link only imports the provider; to pin one model, paste step ② into')}{' '}
                      <code className='bg-muted rounded px-1 text-xs'>~/.codex/config.toml</code>{' '}
                      {t('and launch it with step ③:')}
                    </p>
                    <CodeBlock
                      code={`# ① 一键导入 Love Api 为 Codex 提供方（endpoint 需带 /v1）
ccswitch://v1/import?resource=provider&app=codex&name=LoveApi&endpoint=${serverAddress}/v1&apiKey=sk-your-loveapi-key&model=gpt-5.6-sol&homepage=${serverAddress}&enabled=true`}
                      lang='text'
                    />
                    <CodeBlock
                      code={`# ② 粘贴到 ~/.codex/config.toml，固化单一模型（含主模型 /review 审查 / 子代理三处）
model = "gpt-5.6-sol"
review_model = "gpt-5.6-sol"
[agents]
default_subagent_model = "gpt-5.6-sol"

# ③ 用它启动，只使用上面这一个模型
[profiles.loveapi]
model = "gpt-5.6-sol"
model_provider = "loveapi"`}
                      lang='toml'
                    />
                    <div className='overflow-hidden rounded-lg border'>
                      <table className='w-full text-sm'>
                        <thead>
                          <tr className='bg-muted/30 text-left'>
                            <th className='px-4 py-2 font-medium'>{t('Parameter')}</th>
                            <th className='px-4 py-2 font-medium'>{t('Description')}</th>
                          </tr>
                        </thead>
                        <tbody className='divide-y'>
                          {[
                            ['app', 'claude / codex / gemini'],
                            ['name', t('Provider display name in CC Switch')],
                            ['endpoint', t('Codex requires /v1; other apps use the server address')],
                            ['apiKey', t('Your LoveAPI key')],
                            ['model', t('Optional primary model name')],
                            [
                              'homepage',
                              t('Client homepage URL used for a follow-up redirect'),
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
                    <div className='mt-3'>
                      <CodexSubagentNote />
                    </div>
                  </Section>

                  {/* 8. 支持模型 */}
                  <Section id='models' icon='🧠' title={t(SECTION_TITLES.models)}>
                    <p className='text-muted-foreground text-sm leading-relaxed'>
                      {t('LoveAPI supports the following model families. Names follow upstream conventions and can be used directly in requests.')}
                    </p>
                    <h3 className='pt-2 text-base font-semibold'>
                      🤖 {t('ChatGPT (Codex) family')}
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
                      🗣️ {t('Claude family')}
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
                    <h3 className='pt-2 text-base font-semibold'>🐋 {t('DeepSeek family')}</h3>
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
                      💫 {t('Qwen family')}
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
                    title={t(SECTION_TITLES.endpoints)}
                  >
                    <p className='text-muted-foreground text-sm'>
                      {t('All endpoints below use POST unless noted otherwise, and follow the OpenAI API request format.')}
                    </p>
                    <EndpointCard
                      method='POST'
                      path='/v1/chat/completions'
                      desc={t('Chat completions (core endpoint)')}
                      defaultOpen={true}
                    >
                      <h4 className='text-muted-foreground mb-2 text-xs font-semibold uppercase'>
                        {t('Request example')}
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
                        {t('Parameter details')}
                      </h4>
                      <div className='text-muted-foreground space-y-1 text-xs'>
                        <ConfigField code='model' text={t('Required model name')} />
                        <ConfigField
                          code='messages'
                          text={t('Required message list supporting system, user, and assistant')}
                        />
                        <ConfigField
                          code='stream'
                          text={t('Optional streaming output; defaults to false')}
                        />
                      </div>
                    </EndpointCard>
                    <EndpointCard
                      method='POST'
                      path='/v1/messages'
                      desc={t('Messages endpoint (native Claude format)')}
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
                      desc={t('List available models')}
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
                    <EndpointCard
                      method='POST'
                      path='/v1/videos'
                      desc={t('Video generation (OpenAI format)')}
                    >
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
                        {t('After receiving a task ID, use GET /v1/videos/{task_id} to check status and download from /v1/videos/{task_id}/content when complete.')}
                      </p>
                    </EndpointCard>
                    <EndpointCard
                      method='GET'
                      path='/v1/videos/{task_id}'
                      desc={t('Retrieve video generation task')}
                    >
                      <CodeBlock
                        code={`curl ${serverAddress}/v1/videos/video_task_id \\\n+  -H "Authorization: Bearer sk-your-loveapi-key"`}
                        lang='bash'
                      />
                    </EndpointCard>
                  </Section>

                  {/* 10. 代码示例 */}
                  <Section
                    id='examples'
                    icon='💻'
                    title={t(SECTION_TITLES.examples)}
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
                    title={t(SECTION_TITLES.errors)}
                  >
                    <div className='overflow-hidden rounded-lg border'>
                      <table className='w-full text-sm'>
                        <thead>
                          <tr className='bg-muted/30 text-left'>
                            <th className='px-4 py-2 font-medium'>{t('Status code')}</th>
                            <th className='px-4 py-2 font-medium'>{t('Meaning')}</th>
                          </tr>
                        </thead>
                        <tbody className='divide-y'>
                          {[
                            [200, t('Success'), 'bg-emerald-500/10 text-emerald-600'],
                            [400, t('Bad request'), 'bg-amber-500/10 text-amber-600'],
                            [401, t('Unauthorized'), 'bg-amber-500/10 text-amber-600'],
                            [429, t('Too many requests'), 'bg-amber-500/10 text-amber-600'],
                            [500, t('Server error'), 'bg-red-500/10 text-red-600'],
                            [503, t('Service unavailable'), 'bg-red-500/10 text-red-600'],
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
                    {t('On this page')}
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
                          {t(SECTION_TITLES[id])}
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
