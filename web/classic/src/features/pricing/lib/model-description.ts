import type { TFunction } from 'i18next'
import type { PricingModel } from '../types'

const FOCUS: Array<[RegExp, string[]]> = [
  [/claude|sonnet|opus|haiku/, ['Focused on nuanced writing, long-context analysis, and reliable tool use.', 'Balances careful reasoning with natural conversation for demanding work.', 'Designed for precise synthesis, instruction following, and dependable tool calls.', 'Handles complex context with clear, polished, and consistent responses.']],
  [/gpt|o[1-9]|chatgpt/, ['A general-purpose reasoning model for production assistants, coding, and structured workflows.', 'Combines strong coding ability with flexible reasoning for everyday automation.', 'Built for reliable tool use, structured outputs, and multi-step problem solving.', 'A versatile choice for fast assistance, analysis, and production applications.']],
  [/gemini/, ['Built for multimodal understanding, long context, and fast grounded responses.', 'Excels at combining text, images, and documents in a single workflow.', 'A responsive model for research, summarization, and context-rich analysis.', 'Well suited to broad-context tasks that need speed and multimodal awareness.']],
  [/deepseek/, ['Strong at code generation, technical reasoning, and cost-efficient high-volume workloads.', 'Focused on developer workflows, debugging, and practical mathematical reasoning.', 'Delivers efficient technical analysis for coding and automation pipelines.', 'A cost-conscious option for structured reasoning and software tasks.']],
  [/qwen|通义/, ['A versatile multilingual model family for Chinese content, coding, and enterprise automation.', 'Well suited to Chinese-language business writing, extraction, and workflow assistants.', 'Balances multilingual understanding with practical coding and tool integration.', 'Designed for enterprise tasks that mix Chinese context, reasoning, and structured output.']],
  [/doubao|seedance|豆包/, ['Designed for fast Chinese-language interaction and practical content generation.', 'A responsive choice for Chinese copywriting, ideation, and everyday assistants.', 'Optimized for quick-turn creative work and conversational product experiences.', 'Handles concise Chinese requests with a focus on speed and usability.']],
  [/kimi|moonshot/, ['Optimized for long documents, research synthesis, and Chinese-language reasoning.', 'Strong at reading extensive context and turning it into clear research notes.', 'Useful for document-heavy workflows, comparison, and knowledge extraction.', 'Built for long-form analysis where context retention matters most.']],
  [/minimax/, ['A balanced model for conversational products, creative generation, and agent workflows.', 'Combines expressive generation with practical planning for interactive agents.', 'A flexible foundation for chat experiences, content creation, and automation.', 'Designed to keep conversations natural while supporting multi-step tasks.']],
  [/glm|zhipu/, ['A capable Chinese-first model for business writing, reasoning, and tool-enabled agents.', 'Strong at Chinese analysis, structured writing, and enterprise knowledge tasks.', 'A practical assistant for planning, summarization, and tool-driven workflows.', 'Balances Chinese fluency with dependable reasoning and structured responses.']],
  [/mistral|mixtral/, ['An efficient open-weight family for low-latency assistants and developer workloads.', 'A compact, responsive option for self-hosted generation and coding tools.', 'Designed for efficient inference where latency and deployment control matter.', 'Useful for customizable assistants, extraction, and developer automation.']],
  [/llama|meta-llama/, ['An open model family suited to customizable, self-hosted, and research applications.', 'A flexible base for teams that need local control and domain adaptation.', 'Well suited to experimentation, fine-tuning, and private inference stacks.', 'Supports customizable deployments for research and specialized assistants.']],
  [/grok|xai/, ['A fast reasoning and conversation model for current-event-oriented workflows.', 'Built for direct answers, timely context, and engaging conversational experiences.', 'A responsive option for research, ideation, and up-to-date information tasks.', 'Combines quick interaction with broad reasoning for exploratory workflows.']],
]

export function getModelDescription(model: PricingModel, t: TFunction): string {
  const name = model.model_name || 'model'
  const variants = FOCUS.find(([pattern]) => pattern.test(name.toLowerCase()))?.[1] ?? [
    'A dependable model for everyday generation, analysis, and API-powered applications.',
    'A practical assistant for reliable generation, analysis, and API workflows.',
    'A balanced option for production applications, automation, and everyday tasks.',
    'A flexible model for clear answers, structured work, and general assistance.',
  ]
  const hash = [...name].reduce((sum, char) => sum + char.charCodeAt(0), 0)
  return t(variants[hash % variants.length])
}
