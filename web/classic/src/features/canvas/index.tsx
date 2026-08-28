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
import { useEffect, useRef, useState } from 'react'
import { Check, Download, ImagePlus, Loader2, Sparkles, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { fileToDataUrl, generateImage, getGenerationKey } from './api'
import {
  CANVAS_DEFAULT_MODEL,
  IMAGE_FORMATS,
  IMAGE_SIZE_PRESETS,
  MAX_IMAGE_COUNT,
  RESOLUTION_TIERS,
  SUPPORTED_IMAGE_TYPES,
} from './constants'
import type { GeneratedImage, GenerateImagePayload } from './types'

const HISTORY_KEY = 'canvas-history'
const HISTORY_LIMIT = 12

// 读取图片的宽高比例（宽/高），用于参考图按上传尺寸显示
function getImageAspectRatio(url: string): Promise<number> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const h = img.naturalHeight || 1
      const w = img.naturalWidth || h
      resolve(w / h)
    }
    img.onerror = () => resolve(1)
    img.src = url
  })
}

async function downloadImage(url: string) {
  if (!url) return
  // 固定以 LoveApi 命名，避免用提示词长串当文件名
  const ext = inferImageExtension(url)
  const name = `LoveApi${ext}`
  if (url.startsWith('data:')) {
    const a = document.createElement('a')
    a.href = url
    a.download = name
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    return
  }
  // http(s) 跨域图片走后端代理下载（服务端 fetch 不受浏览器 CORS 限制，历史图也能直接保存）。
  // 注意：要用 fetch 携带 New-Api-User 头 + cookie，否则后端 UserAuth 鉴权失败返回 401。
  try {
    const proxy = `/api/image/download?url=${encodeURIComponent(url)}`
    const res = await fetch(proxy, {
      credentials: 'include',
      headers: {
        'New-Api-User':
          (typeof window !== 'undefined' && window.localStorage.getItem('uid')) || '',
      },
    })
    if (!res.ok) throw new Error(`download failed ${res.status}`)
    const blob = await res.blob()
    const obj = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = obj
    a.download = name
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(obj)
  } catch {
    window.open(url, '_blank', 'noopener')
  }
}

function inferImageExtension(url: string): string {
  if (url.startsWith('data:')) {
    if (url.includes('image/jpeg')) return '.jpg'
    if (url.includes('image/webp')) return '.webp'
    return '.png'
  }
  const m = url.match(/\.(png|jpe?g|webp|gif)(?:\?|$)/i)
  if (m) return `.${m[1].toLowerCase().replace('jpeg', 'jpg')}`
  return '.png'
}

export function Canvas() {
  const [model, setModel] = useState(CANVAS_DEFAULT_MODEL)
  const [prompt, setPrompt] = useState('')
  const [referenceImage, setReferenceImage] = useState<string | null>(null)
  const [referenceRatio, setReferenceRatio] = useState<number | null>(null)
  const [viewingImage, setViewingImage] = useState<GeneratedImage | null>(null)
  const [currentImage, setCurrentImage] = useState<GeneratedImage | null>(null)
  const [uploadStatus, setUploadStatus] = useState<
    'idle' | 'loading' | 'success' | 'error'
  >('idle')
  const [uploadMsg, setUploadMsg] = useState('')
  const [resolutionTier, setResolutionTier] = useState('default')
  const [size, setSize] = useState(IMAGE_SIZE_PRESETS[0].value)
  const [format, setFormat] = useState('jpeg')
  const [count, setCount] = useState(1)
  const [generating, setGenerating] = useState(false)
  const [history, setHistory] = useState<GeneratedImage[]>([])
  const [apiKeyMissing, setApiKeyMissing] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 恢复生成历史（图片 base64 可能超过 localStorage 容量，失败时降级为内存）
  useEffect(() => {
    try {
      const raw = localStorage.getItem(HISTORY_KEY)
      if (raw) setHistory(JSON.parse(raw) as GeneratedImage[])
    } catch {
      /* ignore */
    }
  }, [])

  // 进入页面即探测是否具备可用 API Key（无则提示「先创建 API Key」）
  useEffect(() => {
    let cancelled = false
    getGenerationKey()
      .then(() => {
        if (!cancelled) setApiKeyMissing(false)
      })
      .catch(() => {
        if (!cancelled) setApiKeyMissing(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!SUPPORTED_IMAGE_TYPES.includes(file.type)) {
      toast.error('仅支持 png / jpg / webp')
      return
    }
    // 用户点击系统「打开」后立即在右下角显示「正在加载图片」弹窗并保持可视化。
    // 先同步置 loading（确保 React 渲染第一帧），再延迟读取本地图；
    // 即使读取极快，也保证加载弹窗至少出现约 600ms，避免"没反应/一闪而过"。
    setUploadStatus('loading')
    setUploadMsg('')
    // 立即开始读取（无延迟），并保证「正在加载」弹窗至少可见约 600ms，避免一闪而过
    void (async () => {
      const start = Date.now()
      try {
        const url = await fileToDataUrl(file)
        const ratio = await getImageAspectRatio(url)
        const elapsed = Date.now() - start
        if (elapsed < 600) {
          await new Promise((r) => setTimeout(r, 600 - elapsed))
        }
        setReferenceImage(url)
        setReferenceRatio(ratio)
        setUploadStatus('success')
        setTimeout(() => setUploadStatus('idle'), 1200)
      } catch (error) {
        setUploadStatus('error')
        setUploadMsg(error instanceof Error ? error.message : '读取失败')
      }
    })()
  }

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error('请输入提示词')
      return
    }
    setGenerating(true)
    try {
      const payload: GenerateImagePayload = {
        model,
        prompt: prompt.trim(),
        size,
        n: count,
        // 生成时直接返回 base64，前端即可直接保存，避免跨域 url 无法下载
        response_format: 'b64_json',
        resolution_tier: resolutionTier,
        ...(referenceImage
          ? {
              images: [
                { type: 'image_url' as const, image_url: { url: referenceImage } },
              ],
            }
          : {}),
      }
      const res = await generateImage(payload)
      const imgs: GeneratedImage[] = (res.data ?? []).map((d, i) => ({
        id: `${Date.now()}-${i}`,
        url: d.url,
        b64_json: d.b64_json,
        prompt: prompt.trim(),
        size,
        resolutionTier,
        format,
        created: Date.now(),
      }))
      if (imgs.length === 0) {
        toast.error('未返回生成结果')
        return
      }
      const next = [...imgs, ...history].slice(0, HISTORY_LIMIT)
      setHistory(next)
      setCurrentImage(imgs[0] ?? null)
      try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(next))
      } catch {
        /* 容量超限时仅保留内存历史 */
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : '生成失败'
      if (/api.?key|enabled api.?key|invalid.*key/i.test(msg)) {
        setApiKeyMissing(true)
      }
      toast.error(msg)
    } finally {
      setGenerating(false)
    }
  }

  const resolveImage = (img: GeneratedImage): string | undefined =>
    img.b64_json ? `data:image/${img.format};base64,${img.b64_json}` : img.url

  const latest = currentImage
  const latestSrc = latest ? resolveImage(latest) : undefined

  const fieldClass = 'space-y-1.5'

  return (
    <div className='flex h-full flex-col'>
      <div className='flex min-h-0 flex-1'>
      {/* 左侧参数面板 */}
      <aside className='hidden w-[26rem] shrink-0 gap-4 overflow-y-auto border-r p-4 md:flex md:flex-col'>
        <div className={fieldClass}>
          <Label>
            模型
            <span className='text-[10px] font-normal text-rose-500'>必填</span>
          </Label>
          <Select value={model} onValueChange={(v) => setModel(v ?? '')}>
            <SelectTrigger className='w-full'>
              <SelectValue placeholder='选择模型' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='gpt-image-2'>gpt-image-2</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className={fieldClass}>
          <Label>
            提示词
            <span className='text-[10px] font-normal text-rose-500'>必填</span>
          </Label>
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder='描述画面、风格、主体、镜头约束…'
            rows={6}
          />
        </div>

        <div className='relative space-y-1.5'>
          <Label>
            参考图
            <span className='text-[10px] font-normal text-muted-foreground'>
              选填
            </span>
          </Label>
          {referenceImage ? (
            <div
              className='bg-background relative max-h-[20rem] w-full overflow-hidden rounded-lg border'
              style={
                referenceRatio
                  ? { aspectRatio: String(referenceRatio) }
                  : undefined
              }
            >
              {/* 按上传图片比例完整显示（等比缩放），不裁切不拉伸 */}
              <img
                src={referenceImage}
                alt='参考图'
                className='bg-muted/30 h-full w-full object-contain'
              />
              <button
                type='button'
                onClick={() => setReferenceImage(null)}
                className='absolute top-1.5 right-1.5 rounded-full bg-black/60 p-1 text-white'
                aria-label='移除参考图'
              >
                <X className='size-3.5' />
              </button>
            </div>
          ) : (
            <button
              type='button'
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadStatus === 'loading'}
              className='flex w-full items-center justify-center gap-2 rounded-lg border border-dashed px-3 py-4 text-sm text-muted-foreground transition-colors hover:bg-muted/40 disabled:opacity-70'
            >
              <ImagePlus className='size-4' />
              本地上传（png / jpg / webp，可留空）
            </button>
          )}
          <input
            ref={fileInputRef}
            type='file'
            accept='image/png,image/jpeg,image/webp'
            className='hidden'
            onChange={handleFileUpload}
          />
        </div>

        <div className={fieldClass}>
          <Label>
            分辨率档位
            <span className='text-[10px] font-normal text-muted-foreground'>
              选填
            </span>
          </Label>
          <Select
            value={resolutionTier}
            onValueChange={(v) => setResolutionTier(v ?? '')}
          >
            <SelectTrigger className='w-full'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RESOLUTION_TIERS.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}（${t.price.toFixed(2)}/次）
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className={fieldClass}>
          <Label>
            尺寸
            <span className='text-[10px] font-normal text-muted-foreground'>
              选填
            </span>
          </Label>
          <Select value={size} onValueChange={(v) => setSize(v ?? '')}>
            <SelectTrigger className='w-full'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {IMAGE_SIZE_PRESETS.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className={fieldClass}>
          <Label>
            格式
            <span className='text-[10px] font-normal text-muted-foreground'>
              选填
            </span>
          </Label>
          <Select value={format} onValueChange={(v) => setFormat(v ?? '')}>
            <SelectTrigger className='w-full'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {IMAGE_FORMATS.map((f) => (
                <SelectItem key={f.value} value={f.value}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className={fieldClass}>
          <Label>
            数量
            <span className='text-[10px] font-normal text-muted-foreground'>
              选填
            </span>
          </Label>
          <Input
            type='number'
            min={1}
            max={MAX_IMAGE_COUNT}
            value={count}
            onChange={(e) => {
              const v = Number(e.target.value)
              setCount(
                Number.isFinite(v)
                  ? Math.min(Math.max(1, Math.floor(v)), MAX_IMAGE_COUNT)
                  : 1
              )
            }}
          />
        </div>

        {apiKeyMissing && (
          <p className='rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300'>
            请先创建并启用 API Key，再开始生成。
          </p>
        )}

        <Button
          className='w-full'
          onClick={handleGenerate}
          disabled={generating}
        >
          {generating ? (
            <Loader2 className='size-4 animate-spin' />
          ) : (
            <Sparkles className='size-4' />
          )}
          生成图片
        </Button>
      </aside>

      {/* 右侧生成画布 */}
      <main className='flex flex-1 flex-col overflow-hidden'>
        <div className='flex flex-1 items-center justify-center overflow-auto bg-black/90'>
          {generating ? (
            <div className='flex flex-col items-center gap-3 text-muted-foreground'>
              <Loader2 className='size-8 animate-spin' />
              <span className='text-sm'>正在生成，请稍候…</span>
            </div>
          ) : latestSrc ? (
            <img
              src={latestSrc}
              alt={latest?.prompt ?? '生成结果'}
              className='max-h-[78%] max-w-[78%] object-contain'
            />
          ) : (
            <div className='flex flex-col items-center gap-3 text-muted-foreground'>
              <ImagePlus className='size-10 opacity-60' />
              <span className='text-sm'>生成图片将在这里显示</span>
            </div>
          )}
        </div>
      </main>
      </div>

      {history.length > 0 && (
        <div className='shrink-0 border-t p-3'>
          <div className='mb-2 flex items-center justify-between'>
            <span className='text-xs font-medium text-muted-foreground'>
              生成历史（{history.length}）
            </span>
            <Button
              variant='ghost'
              size='sm'
              onClick={() => {
                setHistory([])
                try {
                  localStorage.removeItem(HISTORY_KEY)
                } catch {
                  /* ignore */
                }
              }}
            >
              <Trash2 className='size-3.5' />
              清空
            </Button>
          </div>
          <div className='flex gap-2 overflow-x-auto'>
            {history.map((img) => {
              const src = resolveImage(img)
              if (!src) return null
              const isSelected = viewingImage?.id === img.id
              return (
                <div key={img.id} className='relative shrink-0'>
                  <button
                    type='button'
                    onClick={() => setViewingImage(isSelected ? null : img)}
                    className={
                      isSelected
                        ? 'block rounded-md'
                        : 'block h-16 w-16 overflow-hidden rounded-md border'
                    }
                    title={img.prompt}
                  >
                    <img
                      src={src}
                      alt={img.prompt}
                      className={
                        isSelected
                          ? 'max-h-96 w-auto rounded-md object-contain'
                          : 'h-full w-full object-cover'
                      }
                    />
                  </button>
                  {isSelected && (
                    <button
                      type='button'
                      onClick={(e) => {
                        e.stopPropagation()
                        downloadImage(src)
                      }}
                      className='absolute top-1 right-1 rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80'
                      aria-label='保存图片'
                    >
                      <Download className='size-4' />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
      {uploadStatus !== 'idle' && (
        <div className='fixed right-4 bottom-4 z-50 w-72 rounded-lg border bg-card p-3 shadow-lg'>
          {uploadStatus === 'loading' && (
            <div className='flex items-center gap-2 text-sm'>
              <Loader2 className='size-4 animate-spin' />
              正在加载图片…
            </div>
          )}
          {uploadStatus === 'success' && (
            <div className='flex items-center gap-2 text-sm text-emerald-600'>
              <Check className='size-4' />
              图片已加载
            </div>
          )}
          {uploadStatus === 'error' && (
            <div className='text-sm text-rose-600'>
              <div className='flex items-center gap-2'>
                <X className='size-4' />
                图片加载失败
              </div>
              {uploadMsg && (
                <div className='text-muted-foreground mt-1 text-xs'>
                  错误码：{uploadMsg}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
