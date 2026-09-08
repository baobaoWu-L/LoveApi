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
import { useMemo, useState } from 'react'
import {
  ExternalLink,
  Gauge,
  KeyRound,
  ScrollText,
  ShieldCheck,
  Sigma,
  Zap,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useStatus } from '@/hooks/use-status'
import type { BundledLanguage } from 'shiki/bundle/web'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  CodeBlock,
  CodeBlockCopyButton,
} from '@/components/ai-elements/code-block'
import {
  buildRateLimits,
  buildSupportedParameters,
  formatRateLimit,
  type SupportedParameter,
} from '../lib/mock-stats'
import { replaceModelInPath } from '../lib/model-helpers'
import { inferApiInfo } from '../lib/model-metadata'
import type { PricingModel } from '../types'

// ---------------------------------------------------------------------------
// Code-sample registry
// ---------------------------------------------------------------------------
//
// Each sample is keyed by language and endpoint type. The endpoint type comes
// from the model's `supported_endpoint_types`; we render samples only for the
// types the model actually supports. This keeps copy-pasted code accurate and
// provider-shaped (OpenAI vs Anthropic vs Gemini, etc.).

type Lang = 'curl' | 'python' | 'typescript' | 'javascript'

const LANG_LABELS: Record<Lang, string> = {
  curl: 'cURL',
  python: 'Python',
  typescript: 'TypeScript',
  javascript: 'JavaScript',
}

const LANG_HIGHLIGHT: Record<Lang, BundledLanguage> = {
  curl: 'bash',
  python: 'python',
  typescript: 'typescript',
  javascript: 'javascript',
}

type SampleContext = {
  baseUrl: string
  apiKeyEnv: string
  modelName: string
  endpointType: string
  endpointPath: string
  isChinese: boolean
}

function buildChatSample(lang: Lang, ctx: SampleContext): string {
  const url = `${ctx.baseUrl}${ctx.endpointPath}`
  const isResponses = ctx.endpointType === 'openai-response'
  const isReasoning = /^o[1-4]|reasoning|thinking|deepseek-r/i.test(
    ctx.modelName
  )
  const userMessage = 'Explain quantum entanglement in one paragraph.'

  const bodyJson = isResponses
    ? JSON.stringify({ model: ctx.modelName, input: userMessage }, null, 2)
    : JSON.stringify(
        {
          model: ctx.modelName,
          messages: [{ role: 'user', content: userMessage }],
          ...(isReasoning ? {} : { temperature: 0.7 }),
        },
        null,
        2
      )

  const fnCall = isResponses ? 'responses.create' : 'chat.completions.create'

  if (lang === 'curl') {
    return [
      `curl ${url} \\`,
      `  -H "Authorization: Bearer $${ctx.apiKeyEnv}" \\`,
      `  -H "Content-Type: application/json" \\`,
      `  -d '${bodyJson.replace(/\n/g, '\n     ')}'`,
    ].join('\n')
  }

  if (lang === 'python') {
    return [
      'from openai import OpenAI',
      '',
      'client = OpenAI(',
      `    base_url="${ctx.baseUrl}/v1",`,
      `    api_key="<YOUR_API_KEY>",`,
      ')',
      '',
      isResponses
        ? `response = client.${fnCall}(\n    model="${ctx.modelName}",\n    input="${userMessage}",\n)\n\nprint(response.output_text)`
        : `completion = client.${fnCall}(\n    model="${ctx.modelName}",\n    messages=[\n        {"role": "user", "content": "${userMessage}"}\n    ],\n)\n\nprint(completion.choices[0].message.content)`,
    ].join('\n')
  }

  if (lang === 'typescript') {
    return [
      `import OpenAI from 'openai'`,
      '',
      `const client = new OpenAI({`,
      `  baseURL: '${ctx.baseUrl}/v1',`,
      `  apiKey: process.env.${ctx.apiKeyEnv},`,
      `})`,
      '',
      isResponses
        ? `const response = await client.${fnCall}({\n  model: '${ctx.modelName}',\n  input: '${userMessage}',\n})\n\nconsole.log(response.output_text)`
        : `const completion = await client.${fnCall}({\n  model: '${ctx.modelName}',\n  messages: [{ role: 'user', content: '${userMessage}' }],\n})\n\nconsole.log(completion.choices[0].message.content)`,
    ].join('\n')
  }

  return [
    `const response = await fetch('${url}', {`,
    `  method: 'POST',`,
    `  headers: {`,
    `    Authorization: \`Bearer \${process.env.${ctx.apiKeyEnv}}\`,`,
    `    'Content-Type': 'application/json',`,
    `  },`,
    `  body: JSON.stringify(${bodyJson}),`,
    `})`,
    '',
    `const data = await response.json()`,
    `console.log(data)`,
  ].join('\n')
}

function buildAnthropicSample(lang: Lang, ctx: SampleContext): string {
  const url = `${ctx.baseUrl}${ctx.endpointPath}`
  const userMessage = 'Explain quantum entanglement in one paragraph.'

  if (lang === 'curl') {
    const body = JSON.stringify(
      {
        model: ctx.modelName,
        max_tokens: 1024,
        messages: [{ role: 'user', content: userMessage }],
      },
      null,
      2
    )
    return [
      `curl ${url} \\`,
      `  -H "x-api-key: $${ctx.apiKeyEnv}" \\`,
      `  -H "anthropic-version: 2023-06-01" \\`,
      `  -H "Content-Type: application/json" \\`,
      `  -d '${body.replace(/\n/g, '\n     ')}'`,
    ].join('\n')
  }
  if (lang === 'python') {
    return [
      'import anthropic',
      '',
      'client = anthropic.Anthropic(',
      `    base_url="${ctx.baseUrl}",`,
      `    api_key="<YOUR_API_KEY>",`,
      ')',
      '',
      `message = client.messages.create(`,
      `    model="${ctx.modelName}",`,
      `    max_tokens=1024,`,
      `    messages=[{"role": "user", "content": "${userMessage}"}],`,
      ')',
      '',
      'print(message.content[0].text)',
    ].join('\n')
  }
  if (lang === 'typescript') {
    return [
      `import Anthropic from '@anthropic-ai/sdk'`,
      '',
      `const client = new Anthropic({`,
      `  baseURL: '${ctx.baseUrl}',`,
      `  apiKey: process.env.${ctx.apiKeyEnv},`,
      `})`,
      '',
      `const message = await client.messages.create({`,
      `  model: '${ctx.modelName}',`,
      `  max_tokens: 1024,`,
      `  messages: [{ role: 'user', content: '${userMessage}' }],`,
      `})`,
      '',
      `console.log(message.content[0].text)`,
    ].join('\n')
  }
  return [
    `const response = await fetch('${url}', {`,
    `  method: 'POST',`,
    `  headers: {`,
    `    'x-api-key': process.env.${ctx.apiKeyEnv},`,
    `    'anthropic-version': '2023-06-01',`,
    `    'Content-Type': 'application/json',`,
    `  },`,
    `  body: JSON.stringify({`,
    `    model: '${ctx.modelName}',`,
    `    max_tokens: 1024,`,
    `    messages: [{ role: 'user', content: '${userMessage}' }],`,
    `  }),`,
    `})`,
    '',
    `const data = await response.json()`,
    `console.log(data.content[0].text)`,
  ].join('\n')
}

function buildGeminiSample(lang: Lang, ctx: SampleContext): string {
  const url = `${ctx.baseUrl}${ctx.endpointPath}?key=$${ctx.apiKeyEnv}`
  const userMessage = 'Explain quantum entanglement in one paragraph.'

  if (lang === 'curl') {
    const body = JSON.stringify(
      { contents: [{ parts: [{ text: userMessage }] }] },
      null,
      2
    )
    return [
      `curl '${url}' \\`,
      `  -H 'Content-Type: application/json' \\`,
      `  -d '${body.replace(/\n/g, '\n     ')}'`,
    ].join('\n')
  }
  if (lang === 'python') {
    return [
      'import requests',
      '',
      `url = "${url.replace(`$${ctx.apiKeyEnv}`, '<YOUR_API_KEY>')}"`,
      '',
      'response = requests.post(',
      '    url,',
      `    json={"contents": [{"parts": [{"text": "${userMessage}"}]}]},`,
      '    timeout=120,',
      ')',
      '',
      'print(response.json())',
    ].join('\n')
  }
  if (lang === 'typescript') {
    return [
      `const url = \`${url.replace(`$${ctx.apiKeyEnv}`, '${process.env.' + ctx.apiKeyEnv + '}')}\``,
      '',
      `const response = await fetch(url, {`,
      `  method: 'POST',`,
      `  headers: { 'Content-Type': 'application/json' },`,
      `  body: JSON.stringify({ contents: [{ parts: [{ text: '${userMessage}' }] }] }),`,
      `})`,
      '',
      `console.log(await response.json())`,
    ].join('\n')
  }
  return [
    `const response = await fetch('${url}', {`,
    `  method: 'POST',`,
    `  headers: { 'Content-Type': 'application/json' },`,
    `  body: JSON.stringify({`,
    `    contents: [{ parts: [{ text: '${userMessage}' }] }],`,
    `  }),`,
    `})`,
    '',
    `const data = await response.json()`,
    `console.log(data.candidates?.[0]?.content?.parts?.[0]?.text ?? data)`,
  ].join('\n')
}

function buildEmbeddingSample(lang: Lang, ctx: SampleContext): string {
  const url = `${ctx.baseUrl}${ctx.endpointPath}`
  const text = 'The food was delicious and the waiter…'

  if (lang === 'curl') {
    const body = JSON.stringify({ model: ctx.modelName, input: text }, null, 2)
    return [
      `curl ${url} \\`,
      `  -H "Authorization: Bearer $${ctx.apiKeyEnv}" \\`,
      `  -H "Content-Type: application/json" \\`,
      `  -d '${body.replace(/\n/g, '\n     ')}'`,
    ].join('\n')
  }
  if (lang === 'python') {
    return [
      'from openai import OpenAI',
      '',
      `client = OpenAI(base_url="${ctx.baseUrl}/v1", api_key="<YOUR_API_KEY>")`,
      '',
      'response = client.embeddings.create(',
      `    model="${ctx.modelName}",`,
      `    input="${text}",`,
      ')',
      '',
      'print(response.data[0].embedding[:8])',
    ].join('\n')
  }
  if (lang === 'typescript') {
    return [
      `import OpenAI from 'openai'`,
      '',
      `const client = new OpenAI({`,
      `  baseURL: '${ctx.baseUrl}/v1',`,
      `  apiKey: process.env.${ctx.apiKeyEnv},`,
      `})`,
      '',
      `const response = await client.embeddings.create({`,
      `  model: '${ctx.modelName}',`,
      `  input: '${text}',`,
      `})`,
      '',
      `console.log(response.data[0].embedding.slice(0, 8))`,
    ].join('\n')
  }
  return [
    `const response = await fetch('${url}', {`,
    `  method: 'POST',`,
    `  headers: {`,
    `    Authorization: \`Bearer \${process.env.${ctx.apiKeyEnv}}\`,`,
    `    'Content-Type': 'application/json',`,
    `  },`,
    `  body: JSON.stringify({`,
    `    model: '${ctx.modelName}',`,
    `    input: '${text}',`,
    `  }),`,
    `})`,
    '',
    `const data = await response.json()`,
    `console.log(data.data[0].embedding.slice(0, 8))`,
  ].join('\n')
}

function buildImageSample(lang: Lang, ctx: SampleContext): string {
  const url = `${ctx.baseUrl}${ctx.endpointPath}`
  const prompt = 'A serene koi pond at sunset, ukiyo-e style.'

  if (lang === 'curl') {
    const body = JSON.stringify(
      { model: ctx.modelName, prompt, size: '1024x1024', n: 1 },
      null,
      2
    )
    return [
      `curl ${url} \\`,
      `  -H "Authorization: Bearer $${ctx.apiKeyEnv}" \\`,
      `  -H "Content-Type: application/json" \\`,
      `  -d '${body.replace(/\n/g, '\n     ')}'`,
    ].join('\n')
  }
  if (lang === 'python') {
    return [
      'from openai import OpenAI',
      '',
      `client = OpenAI(base_url="${ctx.baseUrl}/v1", api_key="<YOUR_API_KEY>")`,
      '',
      'response = client.images.generate(',
      `    model="${ctx.modelName}",`,
      `    prompt="${prompt}",`,
      `    size="1024x1024",`,
      `    n=1,`,
      ')',
      '',
      'print(response.data[0].url or response.data[0].b64_json)',
    ].join('\n')
  }
  if (lang === 'typescript') {
    return [
      `import OpenAI from 'openai'`,
      '',
      `const client = new OpenAI({`,
      `  baseURL: '${ctx.baseUrl}/v1',`,
      `  apiKey: process.env.${ctx.apiKeyEnv},`,
      `})`,
      '',
      `const response = await client.images.generate({`,
      `  model: '${ctx.modelName}',`,
      `  prompt: '${prompt}',`,
      `  size: '1024x1024',`,
      `  n: 1,`,
      `})`,
      '',
      `console.log(response.data[0].url ?? response.data[0].b64_json)`,
    ].join('\n')
  }
  return [
    `const response = await fetch('${url}', {`,
    `  method: 'POST',`,
    `  headers: {`,
    `    Authorization: \`Bearer \${process.env.${ctx.apiKeyEnv}}\`,`,
    `    'Content-Type': 'application/json',`,
    `  },`,
    `  body: JSON.stringify({`,
    `    model: '${ctx.modelName}',`,
    `    prompt: '${prompt}',`,
    `    size: '1024x1024',`,
    `    n: 1,`,
    `  }),`,
    `})`,
    '',
    `const data = await response.json()`,
    `console.log(data.data[0].url ?? data.data[0].b64_json)`,
  ].join('\n')
}

function buildOpenAIResponseSample(lang: Lang, ctx: SampleContext): string {
  const url = `${ctx.baseUrl}${ctx.endpointPath}`
  const input = 'Explain quantum entanglement in one paragraph.'
  const body = JSON.stringify({ model: ctx.modelName, input }, null, 2)
  if (lang === 'curl') {
    return [
      `curl ${url} \\`,
      `  -H "Authorization: Bearer $${ctx.apiKeyEnv}" \\`,
      `  -H "Content-Type: application/json" \\`,
      `  -d '${body.replace(/\n/g, '\n     ')}'`,
    ].join('\n')
  }
  if (lang === 'python') {
    return [
      'from openai import OpenAI',
      '',
      `client = OpenAI(base_url="${ctx.baseUrl}/v1", api_key="<YOUR_API_KEY>")`,
      '',
      'response = client.responses.create(',
      `    model="${ctx.modelName}",`,
      `    input="${input}",`,
      ')',
      '',
      'print(response.output_text)',
    ].join('\n')
  }
  if (lang === 'typescript') {
    return [
      `import OpenAI from 'openai'`,
      '',
      'const client = new OpenAI({',
      `  baseURL: '${ctx.baseUrl}/v1',`,
      `  apiKey: process.env.${ctx.apiKeyEnv},`,
      '})',
      '',
      'const response = await client.responses.create({',
      `  model: '${ctx.modelName}',`,
      `  input: '${input}',`,
      '})',
      '',
      'console.log(response.output_text)',
    ].join('\n')
  }
  return [
    `const response = await fetch('${url}', {`,
    `  method: 'POST',`,
    `  headers: {`,
    `    'Authorization': \`Bearer \${process.env.${ctx.apiKeyEnv}}\`,`,
    `    'Content-Type': 'application/json',`,
    `  },`,
    `  body: JSON.stringify(${body}),`,
    `})`,
    `console.log(await response.json())`,
  ].join('\n')
}

// Resolve the endpoint path, falling back to the platform endpoint when needed.
function protoPath(
  endpointMap: Record<string, { path?: string; method?: string }>,
  type: string,
  fallback: string,
  modelName: string
): string {
  const info = endpointMap[type] || {}
  let p = info.path || fallback
  if (p && p.includes('{model}')) {
    p = replaceModelInPath(p, modelName)
  }
  return p
}

// Render only protocols declared by the backend for this model.
// If no endpoint metadata is available, fall back to the OpenAI chat endpoint.
const FALLBACK_PATH: Record<string, string> = {
  openai: '/v1/chat/completions',
  'openai-response': '/v1/responses',
  anthropic: '/v1/messages',
  gemini: '/v1beta/models/{model}:generateContent',
  'image-generation': '/v1/images/generations',
  'images-edits': '/v1/images/edits',
  embeddings: '/v1/embeddings',
  'jina-rerank': '/v1/rerank',
  'openai-video': '/v1/videos',
}

const ENDPOINT_ORDER: string[] = [
  'openai',
  'anthropic',
  'openai-response',
  'gemini',
  'image-generation',
  'images-edits',
  'embeddings',
  'jina-rerank',
  'openai-video',
]

function resolveModelProtocols(
  model: PricingModel,
  endpointMap: Record<string, { path?: string; method?: string }>
): { type: string; path: string }[] {
  const declaredTypes = model.supported_endpoint_types ?? []
  const modelName = model.model_name || ''
  const types = declaredTypes
  // Do not generate examples for undeclared endpoints.
  if (types.length === 0) {
    return []
  }
  return ENDPOINT_ORDER.filter((t) => types.includes(t)).map((t) => ({
    type: t,
    path: protoPath(
      endpointMap,
      t,
      FALLBACK_PATH[t] ?? '/v1/chat/completions',
      modelName
    ),
  }))
}

function buildVideoSample(lang: Lang, ctx: SampleContext): string {
  const url = `${ctx.baseUrl}${ctx.endpointPath}`
  const body = JSON.stringify({ model: ctx.modelName, prompt: 'A cinematic sunset over the ocean', seconds: '5', size: '1280x720' }, null, 2)
  if (lang === 'curl') return `curl ${url} -H "Authorization: Bearer $${ctx.apiKeyEnv}" -H "Content-Type: application/json" -d '${body}'`
  if (lang === 'python') return ['from openai import OpenAI', '', `client = OpenAI(base_url="${ctx.baseUrl}/v1", api_key="<YOUR_API_KEY>")`, '', 'video = client.videos.create(', `    model="${ctx.modelName}",`, '    prompt="A cinematic sunset over the ocean",', '    seconds="5",', '    size="1280x720",', ')', '', 'print(video.id)'].join('\n')
  if (lang === 'typescript') return [`import OpenAI from 'openai'`, '', `const client = new OpenAI({ baseURL: '${ctx.baseUrl}/v1', apiKey: process.env.${ctx.apiKeyEnv} })`, '', `const video = await client.videos.create({ model: '${ctx.modelName}', prompt: 'A cinematic sunset over the ocean', seconds: '5', size: '1280x720' })`, 'console.log(video.id)'].join('\n')
  return [`const response = await fetch('${url}', {`, "  method: 'POST',", '  headers: {', `    Authorization: \`Bearer \${process.env.${ctx.apiKeyEnv}}\`,` , "    'Content-Type': 'application/json',", '  },', `  body: JSON.stringify(${body}),`, '})', '', 'console.log(await response.json())'].join('\n')
}

function buildSample(
  lang: Lang,
  endpointType: string,
  ctx: SampleContext
): string {
  if (endpointType === 'ccswitch') return buildCcSwitchSample(ctx)
  if (endpointType === 'openai-response') return buildOpenAIResponseSample(lang, ctx)
  if (endpointType === 'gemini') return buildGeminiSample(lang, ctx)
  if (endpointType === 'embeddings' || endpointType === 'jina-rerank')
    return buildEmbeddingSample(lang, ctx)
  if (endpointType === 'image-generation' || endpointType === 'images-edits')
    return buildImageSample(lang, ctx)
  if (endpointType === 'openai-video') return buildVideoSample(lang, ctx)
  if (endpointType === 'anthropic') return buildAnthropicSample(lang, ctx) // Kept for compatibility.
  return buildChatSample(lang, ctx)
}

// Build CC Switch provider configuration links and complete reference blocks.
// The selected model is embedded so the imported configuration calls that model.
function buildCcSwitchSample(ctx: SampleContext): string {
  const m = ctx.modelName || 'gpt-5.6-sol'

  const codexToml = [
    `model = "${m}"`,
    `model_provider = "loveapi"`,
    `model_reasoning_effort = "medium"`,
    `review_model = "${m}"`,
    `[agents]`,
    `default_subagent_model = "${m}"`,
    `default_subagent_reasoning_effort = "medium"`,
    ``,
    `[model_providers.loveapi]`,
    `name = "LovebreakerApi"`,
    `base_url = "${ctx.baseUrl}/v1"`,
    `wire_api = "responses"`,
    `requires_openai_auth = true`,
    ``,
    `[profiles.loveapi]`,
    `model = "${m}"`,
    `model_provider = "loveapi"`,
  ].join('\n')

  const claudeSettings = JSON.stringify(
    {
      env: {
        ANTHROPIC_BASE_URL: ctx.baseUrl,
        ANTHROPIC_AUTH_TOKEN: '<YOUR_API_KEY>',
        ANTHROPIC_MODEL: m,
        ANTHROPIC_SMALL_FAST_MODEL: m,
      },
    },
    null,
    2
  )

  const codexCcsUrl = [
    `ccswitch://v1/import?resource=provider&app=codex&name=LovebreakerApi`,
    `endpoint=${ctx.baseUrl}/v1`,
    `apiKey=<YOUR_API_KEY>`,
    `model=${m}`,
    `homepage=${ctx.baseUrl}`,
    `enabled=true`,
    `extraConfig=${encodeURIComponent(codexToml)}`,
  ].join('&')

  const claudeCcsUrl = [
    `ccswitch://v1/import?resource=provider&app=claude&name=LovebreakerApi`,
    `endpoint=${ctx.baseUrl}`,
    `apiKey=<YOUR_API_KEY>`,
    `model=${m}`,
    `homepage=${ctx.baseUrl}`,
    `enabled=true`,
    `extraConfig=${encodeURIComponent(claudeSettings)}`,
  ].join('&')

  return [
    ctx.isChinese
      ? `# ① 一键接入 Codex（endpoint 需带 /v1）`
      : `# ① One-click import Codex (endpoint must include /v1)`,
    codexCcsUrl,
    ``,
    ctx.isChinese
      ? `# ② Codex 完整配置参考（粘贴到 ~/.codex/config.toml，用 codex -p loveapi 启动）`
      : `# ② Codex full config reference (paste into ~/.codex/config.toml and start with codex -p loveapi)`,
    codexToml,
    ``,
    ctx.isChinese
      ? `# ③ 一键接入 Claude Code（endpoint 不带 /v1）`
      : `# ③ One-click import Claude Code (endpoint must not include /v1)`,
    claudeCcsUrl,
    ``,
    ctx.isChinese
      ? `# ④ Claude Code 完整配置参考（粘贴到 ~/.claude/settings.json）`
      : `# ④ Claude Code full config reference (paste into ~/.claude/settings.json)`,
    claudeSettings,
  ].join('\n')
}

// ---------------------------------------------------------------------------
// Codex subagent lock note
// ---------------------------------------------------------------------------

// Codex integration note: the main conversation and subagents may use different models.
// Pin both to one model through ~/.codex/config.toml when needed.
function CodexSubagentNote(props: { modelName: string }) {
  const { t } = useTranslation()
  const m = props.modelName || 'gpt-5.6-sol'
  const cfg = [
    `model = "${m}"`,
    `review_model = "${m}"`,
    `[agents]`,
    `default_subagent_model = "${m}"`,
    ``,
    `[profiles.loveapi]`,
    `model = "${m}"`,
    `model_provider = "loveapi"`,
  ].join('\n')
  return (
    <div className='mt-3 rounded-lg border border-rose-300/70 bg-rose-50/70 p-3 text-xs leading-relaxed text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300'>
      <strong> {t('Codex (ChatGPT) integration note')}:</strong>{' '}
      {t('Without the lock settings below, the main conversation uses your selected model, but Codex agents may call a different submodel. Check Console → Usage logs for details.')}
      <br />
      {t('To use the same model ({{model}}) for the main conversation and subagents, write the following to', { model: m })}{' '}
      <code className='bg-muted rounded px-1 py-0.5 font-mono text-[10px]'>~/.codex/config.toml</code>{' '}
      {t('and start with')}{' '}
      <code className='bg-muted rounded px-1 py-0.5 font-mono text-[10px]'>codex -p loveapi</code>:
      <pre className='mt-2 overflow-x-auto rounded-md bg-rose-50 p-2 font-mono text-[11px] leading-relaxed text-rose-800 dark:bg-rose-950/40 dark:text-rose-100'>
{cfg}
      </pre>
      <p className='text-rose-700/90 mt-2 dark:text-rose-300/90'>
        {t('Replace every {{model}} above with your chosen model name; model, review_model, default_subagent_model, and profiles.loveapi.model must match.', { model: m })}
      </p>
      <p className='text-rose-700/90 mt-2 dark:text-rose-300/90'>
        {t('Billing uses the price of the model actually called; each request consumes the matching model quota.')}
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Code samples section
// ---------------------------------------------------------------------------

function CodeSamplesSection(props: {
  model: PricingModel
  endpointMap: Record<string, { path?: string; method?: string }>
}) {
  const { t, i18n } = useTranslation()
  const { status } = useStatus()
  const isChinese = (i18n.resolvedLanguage || i18n.language || '').startsWith('zh')

  // Resolve the public gateway address instead of using an admin localhost URL.
  const baseUrl =
    (status?.server_address as string) ||
    (typeof window !== 'undefined' ? window.location.origin : '')

  const endpoints = useMemo(() => {
    // Render backend-declared protocols and include CC Switch import options.
    const protocols = resolveModelProtocols(props.model, props.endpointMap)
    return [...protocols, { type: 'ccswitch', path: '' }]
  }, [props.model, props.endpointMap])

  const [endpointType, setEndpointType] = useState<string>(
    endpoints[0]?.type ?? ''
  )
  const [lang, setLang] = useState<Lang>('curl')

  const activeEndpoint = useMemo(() => {
    return endpoints.find((e) => e.type === endpointType) ?? endpoints[0]
  }, [endpointType, endpoints])

  if (endpoints.length === 0 || !activeEndpoint) {
    return null
  }

  const code = buildSample(lang, activeEndpoint.type, {
    baseUrl,
    apiKeyEnv: 'LovebreakerApi_Key',
    modelName: props.model.model_name || '',
    endpointType: activeEndpoint.type,
    endpointPath: activeEndpoint.path,
    isChinese,
  })

  return (
    <section>
      <SectionTitle icon={ScrollText}>{t('Code samples')}</SectionTitle>

      <div className='flex flex-wrap items-center gap-2'>
        {endpoints.length > 1 && (
          <Tabs value={endpointType} onValueChange={setEndpointType}>
            <TabsList className='bg-muted/40 h-8 p-0.5'>
              {endpoints.map((ep) => (
                <TabsTrigger
                  key={ep.type}
                  value={ep.type}
                  className='h-7 px-2.5 text-xs'
                >
                  {ep.type}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        )}

        <Tabs
          value={lang}
          onValueChange={(v) => setLang(v as Lang)}
          className='ml-auto'
        >
          <TabsList className='bg-muted/40 h-8 p-0.5'>
            {(Object.keys(LANG_LABELS) as Lang[]).map((l) => (
              <TabsTrigger key={l} value={l} className='h-7 px-2.5 text-xs'>
                {LANG_LABELS[l]}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <div className='mt-3'>
        <CodeBlock code={code} language={LANG_HIGHLIGHT[lang]}>
          <CodeBlockCopyButton />
        </CodeBlock>
      </div>

      <p className='text-muted-foreground mt-2 text-xs'>
        {t('Replace')}{' '}
        <code className='bg-muted rounded px-1 py-0.5 font-mono text-[11px]'>
          {'<YOUR_API_KEY>'}
        </code>{' '}
        {t('with the API key from your token settings.')}
      </p>

      {activeEndpoint.type === 'openai' && (
        <p className='mt-2 rounded-md border border-sky-300/70 bg-sky-50/70 p-2.5 text-xs leading-relaxed text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-300'>
          ℹ {t('This model uses the')} <strong>{t('OpenAI-compatible protocol')}</strong> ({' '}
          <code className='bg-muted rounded px-1 py-0.5 font-mono text-[10px]'>
            {activeEndpoint.path}
          </code>{' '}
          ) {t('Use the')} <code className='bg-muted rounded px-1 py-0.5 font-mono text-[10px]'>openai</code>{' '}
          {t('SDK to call it directly. For the native Anthropic protocol, switch to a compatible endpoint if available.')}
        </p>
      )}

      {(activeEndpoint.type === 'openai' ||
        activeEndpoint.type === 'openai-response') && (
        <CodexSubagentNote modelName={props.model.model_name || ''} />
      )}
    </section>
  )
}

// ---------------------------------------------------------------------------
// Supported parameters table
// ---------------------------------------------------------------------------

function SupportedParametersSection(props: { model: PricingModel }) {
  const { t } = useTranslation()
  const params = useMemo(
    () => buildSupportedParameters(props.model),
    [props.model]
  )

  if (params.length === 0) return null

  return (
    <section>
      <SectionTitle icon={Sigma}>{t('Supported parameters')}</SectionTitle>
      <div className='border-border/60 overflow-hidden rounded-lg border'>
        <Table>
          <TableHeader>
            <TableRow className='bg-muted/30 hover:bg-muted/30'>
              <TableHead className='h-9 w-44 text-xs'>
                {t('Parameter')}
              </TableHead>
              <TableHead className='h-9 w-24 text-xs'>{t('Type')}</TableHead>
              <TableHead className='h-9 w-32 text-xs'>
                {t('Default / range')}
              </TableHead>
              <TableHead className='h-9 text-xs'>{t('Description')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {params.map((p) => (
              <TableRow key={p.name} className='hover:bg-muted/20'>
                <TableCell className='py-2 align-top'>
                  <div className='flex items-center gap-1.5'>
                    <code className='font-mono text-xs font-medium'>
                      {p.name}
                    </code>
                    {p.required && (
                      <Badge
                        variant='outline'
                        className='h-4 border-rose-500/40 px-1 text-[9px] text-rose-600 dark:text-rose-400'
                      >
                        {t('required')}
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className='py-2 align-top'>
                  <Badge
                    variant='secondary'
                    className='h-5 rounded-sm px-1.5 font-mono text-[10px] font-normal'
                  >
                    {p.type}
                  </Badge>
                </TableCell>
                <TableCell className='py-2 align-top'>
                  <ParamRangeCell param={p} />
                </TableCell>
                <TableCell className='text-muted-foreground py-2 align-top text-xs'>
                  {t(p.descriptionKey)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  )
}

function ParamRangeCell(props: { param: SupportedParameter }) {
  const { defaultValue, range, enumValues } = props.param
  if (defaultValue !== undefined) {
    return (
      <div className='flex flex-wrap items-center gap-1'>
        <span className='text-muted-foreground text-[11px]'>=</span>
        <code className='bg-muted rounded px-1 py-0.5 font-mono text-[11px]'>
          {String(defaultValue)}
        </code>
        {range && (
          <span className='text-muted-foreground text-[11px]'>{range}</span>
        )}
      </div>
    )
  }
  if (range) {
    return (
      <span className='text-muted-foreground font-mono text-[11px]'>
        {range}
      </span>
    )
  }
  if (enumValues && enumValues.length > 0) {
    return (
      <div className='flex flex-wrap gap-0.5'>
        {enumValues.map((v) => (
          <code
            key={v}
            className='bg-muted text-muted-foreground rounded px-1 py-0.5 font-mono text-[10px]'
          >
            {v}
          </code>
        ))}
      </div>
    )
  }
  return <span className='text-muted-foreground/60 text-[11px]'>—</span>
}

// ---------------------------------------------------------------------------
// Rate-limits table
// ---------------------------------------------------------------------------

function RateLimitsSection(props: { model: PricingModel }) {
  const { t } = useTranslation()
  const limits = useMemo(() => buildRateLimits(props.model), [props.model])

  if (limits.length === 0) {
    return (
      <section>
        <SectionTitle icon={Gauge}>{t('Rate limits')}</SectionTitle>
        <div className='border-border/60 bg-muted/20 rounded-lg border p-3 text-xs leading-relaxed text-muted-foreground'>
          {t(
            'No per-model rate limits are published. Token and user-level limits still apply.'
          )}
        </div>
      </section>
    )
  }

  return (
    <section>
      <SectionTitle icon={Gauge}>{t('Rate limits')}</SectionTitle>
      <div className='border-border/60 overflow-hidden rounded-lg border'>
        <Table>
          <TableHeader>
            <TableRow className='bg-muted/30 hover:bg-muted/30'>
              <TableHead className='h-9 text-xs'>{t('Group')}</TableHead>
              <TableHead className='h-9 text-right text-xs'>RPM</TableHead>
              <TableHead className='h-9 text-right text-xs'>TPM</TableHead>
              <TableHead className='h-9 text-right text-xs'>RPD</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {limits.map((l) => (
              <TableRow key={l.group} className='hover:bg-muted/20'>
                <TableCell className='py-2 font-mono text-xs'>
                  {l.group}
                </TableCell>
                <TableCell className='py-2 text-right font-mono text-xs'>
                  {formatRateLimit(l.rpm)}
                </TableCell>
                <TableCell className='py-2 text-right font-mono text-xs'>
                  {formatRateLimit(l.tpm)}
                </TableCell>
                <TableCell className='py-2 text-right font-mono text-xs'>
                  {formatRateLimit(l.rpd)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className='text-muted-foreground mt-2 text-[11px] leading-relaxed'>
        {t(
          'RPM = requests per minute, TPM = tokens per minute, RPD = requests per day. Limits apply per token group.'
        )}
      </p>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Provider info card (vendor / tokenizer / license / privacy)
// ---------------------------------------------------------------------------
//
// Exported separately so the Overview tab can render it alongside capabilities
// and modalities (i.e. "what is this model?" rather than "how do I call it?").

export function ModelDetailsProviderInfo(props: { model: PricingModel }) {
  const { t } = useTranslation()
  const info = useMemo(() => inferApiInfo(props.model), [props.model])

  return (
    <section>
      <SectionTitle icon={ShieldCheck}>
        {t('Provider & data privacy')}
      </SectionTitle>

      <div className='border-border/60 bg-border/60 grid grid-cols-1 gap-px overflow-hidden rounded-lg border sm:grid-cols-2'>
        <InfoCell label={t('Provider')}>
          <div className='flex items-center gap-1.5'>
            <span className='text-sm font-medium'>{info.vendor_label}</span>
            {info.homepage && (
              <a
                href={info.homepage}
                target='_blank'
                rel='noopener noreferrer'
                className='text-muted-foreground hover:text-foreground inline-flex items-center gap-0.5 text-[11px]'
              >
                {t('Docs')}
                <ExternalLink className='size-3' />
              </a>
            )}
          </div>
        </InfoCell>

        <InfoCell label={t('Tokenizer')}>
          <div className='flex flex-col gap-0.5'>
            <code className='font-mono text-xs'>{info.tokenizer}</code>
            {info.tokenizer_note && (
              <span className='text-muted-foreground text-[10px]'>
                {info.tokenizer_note}
              </span>
            )}
          </div>
        </InfoCell>

        <InfoCell label={t('License')}>
          <div className='flex flex-col gap-1'>
            <span className='text-sm'>{info.license}</span>
            <Badge
              variant='outline'
              className={cn(
                'h-4 w-fit px-1.5 text-[9px] font-medium',
                info.license_kind === 'open' &&
                  'border-emerald-500/40 text-emerald-600 dark:text-emerald-400',
                info.license_kind === 'open-weight' &&
                  'border-sky-500/40 text-sky-600 dark:text-sky-400',
                info.license_kind === 'proprietary' &&
                  'border-amber-500/40 text-amber-600 dark:text-amber-400'
              )}
            >
              {info.license_kind === 'open'
                ? t('Open source')
                : info.license_kind === 'open-weight'
                  ? t('Open weights')
                  : info.license_kind === 'proprietary'
                    ? t('Proprietary')
                    : t('Unknown')}
            </Badge>
          </div>
        </InfoCell>

        <InfoCell label={t('Data retention')}>
          <span className='text-sm'>
            {info.data_retention_days === 0
              ? t('Zero retention')
              : `${info.data_retention_days} ${t('days')}`}
          </span>
          <span className='text-muted-foreground text-[10px]'>
            {info.training_opt_out
              ? t('Not used for upstream training by default')
              : t('May be used for training by upstream provider')}
          </span>
        </InfoCell>
      </div>
    </section>
  )
}

function InfoCell(props: { label: string; children: React.ReactNode }) {
  return (
    <div className='bg-card flex flex-col gap-1 px-3 py-2.5'>
      <span className='text-muted-foreground text-[10px] font-medium tracking-wider uppercase'>
        {props.label}
      </span>
      {props.children}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Authentication preview
// ---------------------------------------------------------------------------

function AuthSection(props: { model: PricingModel }) {
  const { t } = useTranslation()
  const types = props.model.supported_endpoint_types ?? []
  const hasOpenAI =
    types.includes('openai') ||
    (!types.includes('anthropic') && !types.includes('gemini'))
  const hasAnthropic = types.includes('anthropic')
  const hasGemini = types.includes('gemini')

  const rows: { label: string; code: string }[] = []
  if (hasOpenAI)
    rows.push({
      label: t('OpenAI / compatible'),
      code: 'Authorization: Bearer <TOKEN>',
    })
  if (hasAnthropic)
    rows.push({ label: t('Anthropic'), code: 'x-api-key: <TOKEN>' })
  if (hasGemini)
    rows.push({ label: t('Gemini'), code: 'x-goog-api-key: <API_KEY>' })

  return (
    <section>
      <SectionTitle icon={KeyRound}>{t('Authentication')}</SectionTitle>
      <div className='border-border/60 bg-muted/20 rounded-lg border p-3'>
        {rows.map((row) => (
          <div key={row.label} className='mb-2.5 last:mb-0'>
            <span className='text-muted-foreground text-[10px] font-medium tracking-wider uppercase'>
              {row.label}
            </span>
            <code className='bg-muted mt-1 block rounded px-1.5 py-0.5 font-mono text-[11px]'>
              {row.code}
            </code>
          </div>
        ))}
        <p className='text-muted-foreground mt-2.5 text-xs'>
          {t(
            'Generate tokens from the Tokens page; you can scope them to specific models, groups, IPs, and rate-limits.'
          )}
        </p>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Composite API tab
// ---------------------------------------------------------------------------

export function ModelDetailsApi(props: {
  model: PricingModel
  endpointMap: Record<string, { path?: string; method?: string }>
}) {
  return (
    <div className='space-y-6'>
      <CodeSamplesSection model={props.model} endpointMap={props.endpointMap} />
      <AuthSection model={props.model} />
      <SupportedParametersSection model={props.model} />
      <RateLimitsSection model={props.model} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Local UI helpers
// ---------------------------------------------------------------------------

function SectionTitle(props: {
  children: React.ReactNode
  icon?: React.ComponentType<{ className?: string }>
}) {
  // Keep the heading text-only as required by the design.
  return (
    <h3 className='text-foreground mb-3 text-sm font-semibold'>{props.children}</h3>
  )
}

// Re-export so the parent can keep its own SectionTitle if it wants:
export { Zap as ApiTabIcon }
