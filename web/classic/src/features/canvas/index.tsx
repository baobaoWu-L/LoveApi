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
import { canUseImageModel, fileToDataUrl, generateImage } from './api'
import { fetchTokenKey, getApiKeys } from '@/features/keys/api'
import { API_KEY_STATUS } from '@/features/keys/constants'
import { getPricing } from '@/features/pricing/api'
import { useAuthStore } from '@/stores/auth-store'
import type { ApiKey } from '@/features/keys/types'
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
const IMAGE_CACHE_NAME = 'loveapi-canvas-images-v1'
const IMAGE_CACHE_META_KEY = 'loveapi-canvas-image-cache-meta-v1'
const IMAGE_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000
const IMAGE_CACHE_KEY_PREFIX = '/__loveapi-canvas-cache/'
const IMAGE_KEY_CACHE_KEY = 'loveapi-canvas-image-keys-v1'
const IMAGE_KEY_CACHE_TTL_MS = 5 * 60 * 1000

function getHistoryStorageKey(userId: number | null): string {
  // Keep each account's canvas history in a separate namespace. The legacy
  // unscoped key is intentionally ignored so one account can never inherit
  // another account's records after a login switch.
  return `${HISTORY_KEY}:${userId == null ? 'anonymous' : userId}`
}

function cacheMeta(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(IMAGE_CACHE_META_KEY) || '{}')
  } catch {
    return {}
  }
}

function saveCacheMeta(meta: Record<string, number>) {
  try {
    localStorage.setItem(IMAGE_CACHE_META_KEY, JSON.stringify(meta))
  } catch {
    /* optional metadata */
  }
}

async function getCachedImageBlob(url: string): Promise<Blob | null> {
  if (!url || url.startsWith('data:') || !('caches' in window)) return null
  try {
    const response = await (await caches.open(IMAGE_CACHE_NAME)).match(url)
    return response ? await response.blob() : null
  } catch {
    return null
  }
}

function isLocalCacheKey(url: string): boolean {
  if (typeof window === 'undefined') return false
  try {
    return new URL(url).origin === window.location.origin && new URL(url).pathname.startsWith(IMAGE_CACHE_KEY_PREFIX)
  } catch {
    return false
  }
}

async function cacheBase64Image(
  cacheKey: string,
  value: string,
  format: string
): Promise<void> {
  if (!('caches' in window)) return
  try {
    const dataUrl = value.startsWith('data:')
      ? value
      : `data:image/${format === 'jpeg' ? 'jpeg' : format};base64,${value}`
    const response = await fetch(dataUrl)
    const cache = await caches.open(IMAGE_CACHE_NAME)
    await cache.put(cacheKey, response.clone())
    const meta = cacheMeta()
    meta[cacheKey] = Date.now()
    saveCacheMeta(meta)
  } catch {
    /* keep the in-memory base64 fallback */
  }
}

async function refreshImageCache(url: string): Promise<Blob | null> {
  if (!url || url.startsWith('data:') || !('caches' in window)) return null
  if (typeof navigator !== 'undefined' && !navigator.onLine) return null
  const uid = localStorage.getItem('uid') || ''
  const requests = [
    () => fetch(url, { credentials: 'include' }),
    () =>
      fetch(`/api/image/download?url=${encodeURIComponent(url)}`, {
        credentials: 'include',
        headers: { 'New-Api-User': uid },
      }),
  ]
  for (const request of requests) {
    try {
      const response = await request()
      if (!response.ok) continue
      const cache = await caches.open(IMAGE_CACHE_NAME)
      await cache.put(url, response.clone())
      const meta = cacheMeta()
      meta[url] = Date.now()
      saveCacheMeta(meta)
      return await response.blob()
    } catch {
      /* try the authenticated proxy */
    }
  }
  return null
}

async function getImageBlob(url: string): Promise<Blob | null> {
  const cached = await getCachedImageBlob(url)
  if (!cached) return refreshImageCache(url)

  const meta = cacheMeta()
  const fresh = Boolean(meta[url] && Date.now() - meta[url] <= IMAGE_CACHE_TTL_MS)
  if (fresh) return cached

  if (isLocalCacheKey(url)) return cached

  // Stale-while-revalidate: keep the old image usable immediately (including
  // offline), while an online session refreshes it in the background.
  if (typeof navigator === 'undefined' || navigator.onLine) {
    void refreshImageCache(url)
  }
  return cached
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Failed to read cached image'))
    reader.readAsDataURL(blob)
  })
}

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

async function downloadImage(url: string): Promise<boolean> {
  if (!url) return false
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
    return true
  }
  // http(s) 跨域图片走后端代理下载（服务端 fetch 不受浏览器 CORS 限制，历史图也能直接保存）。
  // 注意：要用 fetch 携带 New-Api-User 头 + cookie，否则后端 UserAuth 鉴权失败返回 401。
  try {
    const cached = await getImageBlob(url)
    if (cached) {
      const obj = URL.createObjectURL(cached)
      const a = document.createElement('a')
      a.href = obj
      a.download = name
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.setTimeout(() => URL.revokeObjectURL(obj), 1000)
      return true
    }
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
    try {
      const cache = await caches.open(IMAGE_CACHE_NAME)
      await cache.put(url, new Response(blob, { headers: { 'Content-Type': blob.type } }))
      const meta = cacheMeta()
      meta[url] = Date.now()
      saveCacheMeta(meta)
    } catch {
      /* download still succeeds without Cache Storage */
    }
    const obj = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = obj
    a.download = name
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    // Keep the object URL alive for the browser's download dispatch.
    window.setTimeout(() => URL.revokeObjectURL(obj), 1000)
    return true
  } catch {
    window.open(url, '_blank', 'noopener')
    return false
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
  const userId = useAuthStore((state) => state.auth.user?.id ?? null)
  const historyStorageKey = getHistoryStorageKey(userId)
  const imageKeyCacheKey = `${IMAGE_KEY_CACHE_KEY}:${userId == null ? 'anonymous' : userId}`
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
  const [resolutionTier, setResolutionTier] = useState('2k')
  const [size, setSize] = useState(IMAGE_SIZE_PRESETS[0].value)
  const [format, setFormat] = useState('jpeg')
  const [count, setCount] = useState(1)
  const [generating, setGenerating] = useState(false)
  const [history, setHistory] = useState<GeneratedImage[]>([])
  const [apiKeyMissing, setApiKeyMissing] = useState(false)
  const [imageKeys, setImageKeys] = useState<ApiKey[]>([])
  const [selectedKeyId, setSelectedKeyId] = useState('')
  const [loadingKeys, setLoadingKeys] = useState(true)
  const [downloadingImageId, setDownloadingImageId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 恢复生成历史（图片 base64 可能超过 localStorage 容量，失败时降级为内存）
  useEffect(() => {
    setHistory([])
    setCurrentImage(null)
    setViewingImage(null)
    try {
      // The legacy unscoped key has no reliable owner. Remove it instead of
      // assigning those records to whichever account logs in next.
      localStorage.removeItem(HISTORY_KEY)
      const raw = localStorage.getItem(historyStorageKey)
      if (raw) setHistory(JSON.parse(raw) as GeneratedImage[])
    } catch {
      /* ignore */
    }
  }, [historyStorageKey])

  // Restore URL-only history from the browser cache without blocking first paint.
  useEffect(() => {
    let cancelled = false
    const hydrate = async () => {
      let saved: GeneratedImage[]
      try {
        saved = JSON.parse(localStorage.getItem(historyStorageKey) || '[]')
      } catch {
        return
      }
      const hydrated = await Promise.all(
        saved.map(async (img) => {
          if (img.b64_json) return img
          const source = img.cache_key || img.url
          if (!source) return img
          const blob = await getImageBlob(source)
          if (!blob) return img
          try {
            return { ...img, b64_json: await blobToDataUrl(blob) }
          } catch {
            return img
          }
        })
      )
      if (cancelled || !hydrated.some((img, i) => img.b64_json !== saved[i].b64_json)) return
      setHistory(hydrated)
      try {
        localStorage.setItem(historyStorageKey, JSON.stringify(hydrated))
      } catch {
        /* keep hydrated memory state */
      }
    }
    void hydrate()
    return () => {
      cancelled = true
    }
  }, [historyStorageKey])

  // 仅列出启用且具备 gpt-image-2 权限的 API Key，避免选择后才失败。
  useEffect(() => {
    let cancelled = false
    setImageKeys([])
    setSelectedKeyId('')
    setLoadingKeys(true)
    ;(async () => {
      try {
        const cached = JSON.parse(
          sessionStorage.getItem(imageKeyCacheKey) || 'null'
        ) as { at?: number; keys?: ApiKey[] } | null
        if (
          cached?.at &&
          cached.keys &&
          Date.now() - cached.at < IMAGE_KEY_CACHE_TTL_MS
        ) {
          setImageKeys(cached.keys)
          setSelectedKeyId(String(cached.keys[0]?.id ?? ''))
          setApiKeyMissing(cached.keys.length === 0)
          setLoadingKeys(false)
          return
        }
      } catch {
        /* refresh the verification cache below */
      }
      try {
        const [keysResult, pricing] = await Promise.all([
          getApiKeys({ p: 1, size: 100 }),
          getPricing(),
        ])
        const imageModel = pricing.data?.find(
          (item) => item.model_name.toLowerCase() === 'gpt-image-2'
        )
        const allowedGroups = new Set(imageModel?.enable_groups ?? [])
        const filtered = (keysResult.data?.items ?? []).filter((key) => {
          if (key.status !== API_KEY_STATUS.ENABLED) return false
          if (key.model_limits_enabled) {
            const limits = key.model_limits
              .split(',')
              .map((item) => item.trim().toLowerCase())
              .filter(Boolean)
            if (!limits.includes('gpt-image-2')) return false
          }
          if (key.group && allowedGroups.size > 0 && !allowedGroups.has(key.group)) {
            return false
          }
          return true
        })
        const verified = (
          await Promise.all(
            filtered.map(async (key) => {
              try {
                const keyResult = await fetchTokenKey(key.id)
                if (!keyResult.success || !keyResult.data?.key) return null
                const usable = await canUseImageModel(`sk-${keyResult.data.key}`)
                return usable ? key : null
              } catch {
                return null
              }
            })
          )
        ).filter((key): key is ApiKey => key !== null)
        if (!cancelled) {
          setImageKeys(verified)
          setSelectedKeyId((current) =>
            verified.some((key) => String(key.id) === current)
              ? current
              : String(verified[0]?.id ?? '')
          )
          setApiKeyMissing(verified.length === 0)
          try {
            sessionStorage.setItem(
              imageKeyCacheKey,
              JSON.stringify({ at: Date.now(), keys: verified })
            )
          } catch {
            /* optional session cache */
          }
        }
      } catch {
        if (!cancelled) {
          setImageKeys([])
          setSelectedKeyId('')
          setApiKeyMissing(true)
        }
      } finally {
        if (!cancelled) setLoadingKeys(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [imageKeyCacheKey])

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!SUPPORTED_IMAGE_TYPES.includes(file.type)) {
      toast.error('仅支持 png / jpg / webp')
      return
    }
    // 先同步显示 loading，随后异步读取文件；不人为延迟，让预览尽快出现。
    setUploadStatus('loading')
    setUploadMsg('')
    void (async () => {
      try {
        const url = await fileToDataUrl(file)
        const ratio = await getImageAspectRatio(url)
        setReferenceImage(url)
        setReferenceRatio(ratio)
        setUploadStatus('success')
        window.setTimeout(() => setUploadStatus('idle'), 900)
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
      if (!selectedKeyId) {
        throw new Error('没有可调用 gpt-image-2 的 API Key，请先创建或调整 API Key 权限。')
      }
      const keyResult = await fetchTokenKey(Number(selectedKeyId))
      if (!keyResult.success || !keyResult.data?.key) {
        throw new Error(keyResult.message || '无法读取所选 API Key')
      }
      const selectedApiKey = `sk-${keyResult.data.key}`
      const payload: GenerateImagePayload = {
        model,
        prompt: prompt.trim(),
        size,
        n: count,
        // 生成时直接返回 base64，前端即可直接保存，避免跨域 url 无法下载
        response_format: 'b64_json',
        resolution_tier: resolutionTier,
        output_format: format,
        ...(referenceImage
          ? {
              images: [
                { type: 'image_url' as const, image_url: { url: referenceImage } },
              ],
            }
          : {}),
      }
      const res = await generateImage(payload, selectedApiKey)
      const created = Date.now()
      const imgs: GeneratedImage[] = (res.data ?? []).map((d, i) => {
        const id = `${created}-${i}`
        const cacheKey =
          !d.url && d.b64_json && typeof window !== 'undefined'
            ? `${window.location.origin}${IMAGE_CACHE_KEY_PREFIX}${id}`
            : undefined
        if (cacheKey && d.b64_json) void cacheBase64Image(cacheKey, d.b64_json, format)
        return {
          id,
          url: d.url,
          cache_key: cacheKey,
          b64_json: d.b64_json,
          prompt: prompt.trim(),
          size,
          resolutionTier,
          format,
          created,
        }
      })
      if (imgs.length === 0) {
        toast.error('未返回生成结果')
        return
      }
      const next = [...imgs, ...history].slice(0, HISTORY_LIMIT)
      setHistory(next)
      setCurrentImage(imgs[0] ?? null)
      imgs.forEach((image) => {
        if (image.url) void refreshImageCache(image.url)
      })
      try {
        const persisted = next.map((image) =>
          image.b64_json && image.cache_key
            ? { ...image, b64_json: undefined }
            : image
        )
        localStorage.setItem(historyStorageKey, JSON.stringify(persisted))
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
    img.b64_json
      ? img.b64_json.startsWith('data:')
        ? img.b64_json
        : `data:image/${img.format === 'jpeg' ? 'jpeg' : img.format};base64,${img.b64_json}`
      : img.url

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
            API Key
            <span className='text-[10px] font-normal text-rose-500'>必填</span>
          </Label>
          <Select
            value={selectedKeyId}
            onValueChange={(v) => setSelectedKeyId(v ?? '')}
            disabled={loadingKeys || imageKeys.length === 0}
          >
            <SelectTrigger className='w-full'>
              <SelectValue
                placeholder={loadingKeys ? '正在筛选可用 API Key…' : '选择 API Key'}
              />
            </SelectTrigger>
            <SelectContent>
              {imageKeys.map((key) => (
                <SelectItem key={key.id} value={String(key.id)}>
                  {key.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className='text-muted-foreground text-[10px]'>
            仅显示已启用且允许调用 gpt-image-2 的 Key
          </p>
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
                  {t.label}（${t.price < 0.01 ? t.price.toFixed(3) : t.price.toFixed(2)}/张）
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
                  localStorage.removeItem(historyStorageKey)
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
                        if (downloadingImageId === img.id) return
                        setDownloadingImageId(img.id)
                        void downloadImage(src).finally(() => setDownloadingImageId(null))
                      }}
                      className='absolute top-1 right-1 rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80 disabled:cursor-wait disabled:opacity-70'
                      disabled={downloadingImageId === img.id}
                      aria-label='保存图片'
                    >
                      {downloadingImageId === img.id ? (
                        <Loader2 className='size-4 animate-spin' />
                      ) : (
                        <Download className='size-4' />
                      )}
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
