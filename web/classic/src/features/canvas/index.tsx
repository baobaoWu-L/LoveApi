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
import { Check, Download, ImagePlus, Loader2, RotateCcw, Sparkles, Trash2, X } from 'lucide-react'
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
import { canUseImageModel, editImage, fileToDataUrl, generateImage, getCanvasHistory, getCanvasHistoryImage, saveCanvasHistory, deleteCanvasHistory } from './api'
import { fetchTokenKey, getApiKeys } from '@/features/keys/api'
import { API_KEY_STATUS } from '@/features/keys/constants'
import { getPricing } from '@/features/pricing/api'
import { useAuthStore } from '@/stores/auth-store'
import { ROLE } from '@/lib/roles'
import type { ApiKey } from '@/features/keys/types'
import {
  CANVAS_DEFAULT_MODEL,
  CANVAS_IMAGE_MODELS,
  IMAGE_FORMATS,
  IMAGE_SIZE_PRESETS,
  MAX_IMAGE_COUNT,
  RESOLUTION_TIERS,
  SUPPORTED_IMAGE_TYPES,
} from './constants'
import type { GeneratedImage, GenerateImagePayload } from './types'

const HISTORY_KEY = 'canvas-history'
const GENERATION_STATE_KEY = 'canvas-generation-state'
const GENERATION_STATE_TTL_MS = 15 * 60 * 1000
const CURRENT_IMAGE_KEY = 'canvas-current-image'
// 历史保留上限。此前为 12 导致较早的生成历史被自动清理，这里提高到 500，
// 让用户的历史尽量全部保留（前端为按需加载缩略图，渲染压力可控）。
const HISTORY_LIMIT = 500
const IMAGE_KEY_CACHE_KEY = 'loveapi-canvas-image-keys-v1'
const IMAGE_KEY_CACHE_TTL_MS = 5 * 60 * 1000
const CUSTOM_SIZE_VALUE = 'custom'
const IMAGE_IDB_NAME = 'loveapi-canvas-history-v1'
const IMAGE_IDB_STORE = 'images'
const HISTORY_IDB_STORE = 'history'
const DRAFT_IDB_STORE = 'drafts'

function openImageDatabase(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null)
  return new Promise((resolve) => {
    const request = indexedDB.open(IMAGE_IDB_NAME, 2)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(IMAGE_IDB_STORE)) {
        request.result.createObjectStore(IMAGE_IDB_STORE)
      }
      if (!request.result.objectStoreNames.contains(HISTORY_IDB_STORE)) {
        request.result.createObjectStore(HISTORY_IDB_STORE)
      }
      if (!request.result.objectStoreNames.contains(DRAFT_IDB_STORE)) {
        request.result.createObjectStore(DRAFT_IDB_STORE)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => resolve(null)
  })
}

async function saveImageToIndexedDb(key: string, value: string): Promise<boolean> {
  const db = await openImageDatabase()
  if (!db) return false
  return new Promise((resolve) => {
    const tx = db.transaction(IMAGE_IDB_STORE, 'readwrite')
    tx.objectStore(IMAGE_IDB_STORE).put(value, key)
    tx.oncomplete = () => {
      db.close()
      resolve(true)
    }
    tx.onerror = () => {
      db.close()
      resolve(false)
    }
  })
}

async function readImageFromIndexedDb(key: string): Promise<string | null> {
  const db = await openImageDatabase()
  if (!db) return null
  return new Promise((resolve) => {
    const request = db.transaction(IMAGE_IDB_STORE, 'readonly').objectStore(IMAGE_IDB_STORE).get(key)
    request.onsuccess = () => {
      db.close()
      resolve(typeof request.result === 'string' ? request.result : null)
    }
    request.onerror = () => {
      db.close()
      resolve(null)
    }
  })
}

async function clearIndexedDbImages(keys: string[]): Promise<void> {
  const db = await openImageDatabase()
  if (!db) return
  await new Promise<void>((resolve) => {
    const tx = db.transaction(IMAGE_IDB_STORE, 'readwrite')
    const store = tx.objectStore(IMAGE_IDB_STORE)
    keys.forEach((key) => store.delete(key))
    tx.oncomplete = () => resolve()
    tx.onerror = () => resolve()
  })
  db.close()
}

async function saveHistoryToIndexedDb(key: string, history: GeneratedImage[]): Promise<boolean> {
  const db = await openImageDatabase()
  if (!db) return false
  return new Promise((resolve) => {
    const tx = db.transaction(HISTORY_IDB_STORE, 'readwrite')
    tx.objectStore(HISTORY_IDB_STORE).put(history, key)
    tx.oncomplete = () => {
      db.close()
      resolve(true)
    }
    tx.onerror = () => {
      db.close()
      resolve(false)
    }
  })
}

async function readHistoryFromIndexedDb(key: string): Promise<GeneratedImage[] | null> {
  const db = await openImageDatabase()
  if (!db) return null
  return new Promise((resolve) => {
    const request = db.transaction(HISTORY_IDB_STORE, 'readonly').objectStore(HISTORY_IDB_STORE).get(key)
    request.onsuccess = () => {
      db.close()
      resolve(Array.isArray(request.result) ? (request.result as GeneratedImage[]) : null)
    }
    request.onerror = () => {
      db.close()
      resolve(null)
    }
  })
}

async function deleteHistoryFromIndexedDb(key: string): Promise<void> {
  const db = await openImageDatabase()
  if (!db) return
  await new Promise<void>((resolve) => {
    const tx = db.transaction(HISTORY_IDB_STORE, 'readwrite')
    tx.objectStore(HISTORY_IDB_STORE).delete(key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => resolve()
  })
  db.close()
}

type CanvasDraft = {
  prompt: string
  referenceImage: string | null
  referenceRatio: number | null
  model: string
  resolutionTier: string
  size: string
  customWidth: string
  customHeight: string
  format: string
  count: number
  selectedKeyId: string
}

type CanvasEditorState = CanvasDraft

async function saveCanvasDraft(key: string, draft: CanvasDraft): Promise<void> {
  const db = await openImageDatabase()
  if (!db) return
  await new Promise<void>((resolve) => {
    const tx = db.transaction(DRAFT_IDB_STORE, 'readwrite')
    tx.objectStore(DRAFT_IDB_STORE).put(draft, key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => resolve()
  })
  db.close()
}

async function readCanvasDraft(key: string): Promise<CanvasDraft | null> {
  const db = await openImageDatabase()
  if (!db) return null
  return new Promise((resolve) => {
    const request = db.transaction(DRAFT_IDB_STORE, 'readonly').objectStore(DRAFT_IDB_STORE).get(key)
    request.onsuccess = () => {
      db.close()
      resolve(request.result && typeof request.result === 'object' ? (request.result as CanvasDraft) : null)
    }
    request.onerror = () => {
      db.close()
      resolve(null)
    }
  })
}

function getHistoryStorageKey(userId: number | null): string {
  // Keep each account's canvas history in a separate namespace. The legacy
  // unscoped key is intentionally ignored so one account can never inherit
  // another account's records after a login switch.
  return `${HISTORY_KEY}:${userId == null ? 'anonymous' : userId}`
}

function getGenerationStateKey(userId: number | null): string {
  return `${GENERATION_STATE_KEY}:${userId == null ? 'anonymous' : userId}`
}

function getCurrentImageStorageKey(userId: number | null): string {
  return `${CURRENT_IMAGE_KEY}:${userId == null ? 'anonymous' : userId}`
}

function saveCurrentImageMetadata(userId: number | null, image: GeneratedImage) {
  if (userId == null) return
  try {
    // Keep large payloads in IndexedDB; localStorage stores only the active
    // result metadata needed to restore the canvas quickly.
    localStorage.setItem(
      getCurrentImageStorageKey(userId),
      JSON.stringify({ ...image, b64_json: undefined })
    )
  } catch {
    /* optional persistence */
  }
}

type PersistedGenerationState = {
  startedAt: number
  model: string
}

function readGenerationState(userId: number | null): PersistedGenerationState | null {
  if (userId == null) return null
  try {
    const raw = localStorage.getItem(getGenerationStateKey(userId))
    if (!raw) return null
    const state = JSON.parse(raw) as PersistedGenerationState
    if (!state.startedAt || Date.now() - state.startedAt > GENERATION_STATE_TTL_MS) {
      localStorage.removeItem(getGenerationStateKey(userId))
      return null
    }
    return state
  } catch {
    return null
  }
}

function writeGenerationState(userId: number | null, model: string) {
  if (userId == null) return
  try {
    localStorage.setItem(
      getGenerationStateKey(userId),
      JSON.stringify({ startedAt: Date.now(), model } satisfies PersistedGenerationState)
    )
  } catch {
    /* optional persistence */
  }
}

function clearGenerationState(userId: number | null) {
  if (userId == null) return
  try {
    localStorage.removeItem(getGenerationStateKey(userId))
  } catch {
    /* optional persistence */
  }
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
  // http(s) 图片每次通过后端代理下载，不使用画布专用 Cache Storage。
  // 注意：要携带 New-Api-User 头 + cookie，否则后端 UserAuth 鉴权失败返回 401。
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

// 上游 gpt-image 常返回一次性签名/防盗链链接，浏览器 <img> 直接加载会 403。
// 这里经本地下载代理把图片转成 dataURL，确保右侧主区域一定能渲染出新图。
async function proxyImageToDataUrl(url: string): Promise<string | undefined> {
  if (!url || url.startsWith('data:')) return url
  try {
    const uid = typeof window !== 'undefined' ? window.localStorage.getItem('uid') || '' : ''
    const proxy = `/api/image/download?url=${encodeURIComponent(url)}`
    const res = await fetch(proxy, {
      credentials: 'include',
      headers: uid ? { 'New-Api-User': uid } : undefined,
    })
    if (!res.ok) return undefined
    const blob = await res.blob()
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => reject(reader.error || new Error('读取图片失败'))
      reader.readAsDataURL(blob)
    })
  } catch {
    return undefined
  }
}

// 上游返回的多为一次性 oss 链接（如 superaiapi.com），浏览器 <img> 直接加载会因
// QUIC/HTTP3 协议错误而失败。这里优先取本地保存的图；否则经本地下载代理拉回为
// dataURL（后端用非 QUIC 客户端下载），确保历史与主图都能显示。
async function hydrateLatestUrl(img: GeneratedImage): Promise<GeneratedImage> {
  if (img.b64_json) return img
  if (!img.url) return img
  try {
    if (img.id) {
      const b64 = await getCanvasHistoryImage(img.id)
      if (b64) return { ...img, b64_json: b64 }
    }
  } catch {
    /* fallthrough to proxy */
  }
  try {
    const b64 = await proxyImageToDataUrl(img.url)
    if (b64) return { ...img, b64_json: b64 }
  } catch {
    /* fallthrough */
  }
  return img
}

// 合并多份历史并按 id 去重。防止「以服务器子集覆盖本地累积」导致历史被误清空。
function mergeUniqueById(lists: (GeneratedImage[] | null | undefined)[]): GeneratedImage[] {
  const seen = new Set<string>()
  const out: GeneratedImage[] = []
  for (const list of lists) {
    if (!Array.isArray(list)) continue
    for (const item of list) {
      if (item && item.id && !seen.has(item.id)) {
        seen.add(item.id)
        out.push(item)
      }
    }
  }
  return out
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('load image failed'))
    img.src = url
  })
}

// 参考图过大（长边 > 2048px）时上游（尤其是参考图编辑）容易处理超时、被网关
// 返回 502。这里在保留宽高比的前提下自动缩小，显著降低上传体积与上游耗时。
async function compressReferenceImage(
  dataUrl: string,
  maxEdge = 2048,
  quality = 0.9
): Promise<{ url: string; width: number; height: number; compressed: boolean }> {
  const img = await loadImage(dataUrl)
  const w = img.naturalWidth || img.naturalHeight || maxEdge
  const h = img.naturalHeight || w
  if (w <= maxEdge && h <= maxEdge) {
    return { url: dataUrl, width: w, height: h, compressed: false }
  }
  const scale = maxEdge / Math.max(w, h)
  const nw = Math.max(1, Math.round(w * scale))
  const nh = Math.max(1, Math.round(h * scale))
  const canvas = document.createElement('canvas')
  canvas.width = nw
  canvas.height = nh
  const ctx = canvas.getContext('2d')
  if (!ctx) return { url: dataUrl, width: w, height: h, compressed: false }
  ctx.drawImage(img, 0, 0, nw, nh)
  // 保留原格式（PNG 保留透明通道），仅缩小尺寸以降低体积与上游耗时。
  const isPng = dataUrl.startsWith('data:image/png')
  const mime = isPng ? 'image/png' : 'image/jpeg'
  const url = canvas.toDataURL(mime, isPng ? undefined : quality)
  return { url, width: nw, height: nh, compressed: true }
}

export function Canvas() {
  const authUser = useAuthStore((state) => state.auth.user)
  const userId = authUser?.id ?? null
  const historyStorageKey = getHistoryStorageKey(userId)
  const [model, setModel] = useState(CANVAS_DEFAULT_MODEL)
  const imageKeyCacheKey = `${IMAGE_KEY_CACHE_KEY}:${userId == null ? 'anonymous' : userId}:${model}`
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
  const [customWidth, setCustomWidth] = useState('')
  const [customHeight, setCustomHeight] = useState('')
  const [format, setFormat] = useState('jpeg')
  const [count, setCount] = useState(1)
  const [generating, setGenerating] = useState(false)
  // 当前生成失败的错误信息。生成失败时右侧主区域优先展示错误，
  // 避免继续显示上一次成功生成的图片而误导用户。
  const [generationError, setGenerationError] = useState<string | null>(null)
  const [history, setHistory] = useState<GeneratedImage[]>([])
  const [apiKeyMissing, setApiKeyMissing] = useState(false)
  const [imageKeys, setImageKeys] = useState<ApiKey[]>([])
  const [selectedKeyId, setSelectedKeyId] = useState('')
  const [loadingKeys, setLoadingKeys] = useState(true)
  const [downloadingImageId, setDownloadingImageId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const draftHydratedRef = useRef(false)
  // Preserve the live editor while previewing historical parameters.
  const draftRestoreRef = useRef<CanvasEditorState | null>(null)
  const historicalPreviewRef = useRef(false)

  // Remove the legacy canvas Cache Storage namespace once. History is now
  // restored from IndexedDB/localStorage and URL-backed images are fetched by
  // the normal browser history path on each visit.
  useEffect(() => {
    if (typeof window !== 'undefined' && 'caches' in window) {
      void caches.delete('loveapi-canvas-images-v1')
    }
    try {
      localStorage.removeItem('loveapi-canvas-image-cache-meta-v1')
    } catch {
      /* optional cleanup */
    }
  }, [])

  useEffect(() => {
    draftRestoreRef.current = null
    historicalPreviewRef.current = false
  }, [userId])

  // A generation request continues while the route is unmounted. Keep its
  // per-user status in storage so returning to the canvas does not reset the
  // right-side progress state or expose another account's task.
  useEffect(() => {
    const state = readGenerationState(userId)
    setGenerating(Boolean(state))
    if (userId == null) return
    const onStorage = (event: StorageEvent) => {
      if (event.key !== getGenerationStateKey(userId)) return
      setGenerating(Boolean(readGenerationState(userId)))
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [userId])

  // Keep the canvas synchronized across route changes/tabs. The backend sends
  // only a user-scoped completion/failure event; image bytes are reloaded from
  // the user's IndexedDB history record (or the original URL).
  useEffect(() => {
    if (!authUser || typeof window === 'undefined' || !('WebSocket' in window)) return
    let closed = false
    let socket: WebSocket | null = null
    let retryTimer: number | undefined
    const refreshFromStorage = async () => {
      try {
        const remote = await getCanvasHistory()
        if (remote.length > 0) {
          const hydrated = await Promise.all(remote.map((img) => hydrateLatestUrl(img)))
          // 用 merge 而非整体替换：防止 WebSocket 在服务端尚未写入最新图时，
          // 用旧快照覆盖掉本地刚生成的最新结果（导致「生成后历史顶部退回到旧图」）。
          if (!closed) { setHistory((prev) => mergeUniqueById([hydrated, prev])) }
          return
        }
      } catch { /* fall back to the local migration store */ }
      let saved: GeneratedImage[] = []
      try {
        saved = JSON.parse(localStorage.getItem(historyStorageKey) || '[]')
      } catch {
        saved = []
      }
      if (saved.length === 0) saved = (await readHistoryFromIndexedDb(historyStorageKey)) || []
      if (closed || saved.length === 0) return
      const hydrated = await Promise.all(saved.map(async (img) => {
        if (img.b64_json) return img
        if (img.cache_key) {
          const stored = await readImageFromIndexedDb(img.cache_key)
          if (stored) return { ...img, b64_json: stored }
        }
        return img
      }))
      if (!closed) setHistory((prev) => mergeUniqueById([hydrated, prev]))
    }
    const onHistoryEvent = () => { void refreshFromStorage() }
    window.addEventListener('canvas-history-updated', onHistoryEvent)
    const connect = () => {
      if (closed) return
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      socket = new WebSocket(`${protocol}//${window.location.host}/api/canvas/ws`)
      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as { type?: string; message?: string }
          if (message.type === 'canvas_generation_completed') {
            setGenerating(false)
            setGenerationError(null)
            clearGenerationState(userId)
            window.setTimeout(() => window.dispatchEvent(new Event('canvas-history-updated')), 100)
          } else if (message.type === 'canvas_generation_failed') {
            setGenerating(false)
            // 后端 relay 失败时向下游同步错误，右侧主区域据此显示失败原因。
            setGenerationError(message.message || '生成失败，请重试')
            clearGenerationState(userId)
            window.setTimeout(() => window.dispatchEvent(new Event('canvas-history-updated')), 100)
          }
        } catch { /* ignore malformed notifications */ }
      }
      socket.onclose = () => {
        socket = null
        if (!closed) retryTimer = window.setTimeout(connect, 2000)
      }
      socket.onerror = () => socket?.close()
    }
    connect()
    return () => {
      closed = true
      window.removeEventListener('canvas-history-updated', onHistoryEvent)
      if (retryTimer) window.clearTimeout(retryTimer)
      socket?.close()
    }
  }, [authUser, historyStorageKey, userId])

  // 恢复生成历史（图片 base64 可能超过 localStorage 容量，失败时降级为内存）
  useEffect(() => {
    setHistory([])
    setCurrentImage(null)
    setViewingImage(null)
    // Wait until the auth store has resolved the current user. Removing or
    // migrating storage while the user is still null could discard the
    // administrator's legacy history before their profile finishes loading.
    if (!authUser) return
    let cancelled = false
    void (async () => {
      try {
        // The server is authoritative. Browser storage is only a migration
        // fallback for records created before server persistence was enabled.
        const remote = await getCanvasHistory()
        if (remote.length > 0) {
          const hydrated = await Promise.all(remote.map((img) => hydrateLatestUrl(img)))
          // 合并浏览器侧记录，尽可能找回尚未同步到服务器的旧历史，避免被误清空。
          const browser: GeneratedImage[] = []
          try {
            browser.push(...JSON.parse(localStorage.getItem(historyStorageKey) || '[]'))
          } catch {
            /* ignore */
          }
          const indexed = (await readHistoryFromIndexedDb(historyStorageKey)) || []
          if (!cancelled) {
            setHistory(mergeUniqueById([hydrated, browser, indexed]))
          }
          return
        }
        const scopedHistory = localStorage.getItem(historyStorageKey)
        const legacyHistory = localStorage.getItem(HISTORY_KEY)
        const parseHistory = (raw: string | null): GeneratedImage[] => {
          if (!raw) return []
          try {
            const parsed = JSON.parse(raw)
            return Array.isArray(parsed) ? (parsed as GeneratedImage[]) : []
          } catch {
            return []
          }
        }
        let restored = parseHistory(scopedHistory)
        const legacy = parseHistory(legacyHistory)

        // The old key was shared before per-user isolation. Only migrate it
        // into the authenticated administrator's namespace. Merge rather than
        // replace so an administrator's newer scoped records cannot hide the
        // older records that were created before isolation.
        if (authUser.role >= ROLE.ADMIN && legacy.length > 0) {
          const seen = new Set(restored.map((item) => item.id))
          restored = [...restored, ...legacy.filter((item) => !seen.has(item.id))].slice(0, HISTORY_LIMIT)
          try {
            localStorage.setItem(historyStorageKey, JSON.stringify(restored))
            localStorage.removeItem(HISTORY_KEY)
          } catch {
            // Keep the in-memory recovery even if storage is temporarily full.
          }
        } else if (authUser.role < ROLE.ADMIN) {
          // Never expose an ownerless legacy record to regular users.
          localStorage.removeItem(HISTORY_KEY)
        }

        if (restored.length > 0) {
          setHistory(restored)
        } else {
          let indexedHistory = await readHistoryFromIndexedDb(historyStorageKey)
          // Migrate the pre-isolation IndexedDB namespace for administrators.
          if (authUser.role >= ROLE.ADMIN) {
            const legacyIndexedHistory = await readHistoryFromIndexedDb(HISTORY_KEY)
            if (legacyIndexedHistory?.length) {
              const seen = new Set((indexedHistory || []).map((item) => item.id))
              indexedHistory = [...(indexedHistory || []), ...legacyIndexedHistory.filter((item) => !seen.has(item.id))].slice(0, HISTORY_LIMIT)
              await saveHistoryToIndexedDb(historyStorageKey, indexedHistory)
              await deleteHistoryFromIndexedDb(HISTORY_KEY)
            }
          }
          if (!cancelled && indexedHistory?.length) {
            setHistory(indexedHistory)
          }
          if (!cancelled && indexedHistory?.length) {
            try { await saveCanvasHistory(indexedHistory) } catch { /* retry on next generation */ }
          }
        }
      } catch {
        const indexedHistory = await readHistoryFromIndexedDb(historyStorageKey)
          if (!cancelled && indexedHistory?.length) {
            setHistory(indexedHistory)
          }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [authUser, historyStorageKey])

  // Keep all canvas inputs (including the reference image) across route changes.
  // IndexedDB is used because a data URL can exceed localStorage limits.
  useEffect(() => {
    let cancelled = false
    if (!authUser) {
      draftHydratedRef.current = false
      return () => {
        cancelled = true
      }
    }
    void (async () => {
      const draft = await readCanvasDraft(`canvas-draft:${authUser.id}`)
      if (cancelled || !draft) {
        if (!cancelled) draftHydratedRef.current = true
        return
      }
      setPrompt(draft.prompt || '')
      setReferenceImage(draft.referenceImage || null)
      setReferenceRatio(draft.referenceRatio ?? null)
      setModel(draft.model || CANVAS_DEFAULT_MODEL)
      setResolutionTier(draft.resolutionTier || '2k')
      setSize(draft.size || IMAGE_SIZE_PRESETS[0].value)
      setCustomWidth(draft.customWidth || '')
      setCustomHeight(draft.customHeight || '')
      setFormat(draft.format || 'jpeg')
      setCount(Number.isInteger(draft.count) ? draft.count : 1)
      setSelectedKeyId(draft.selectedKeyId || '')
      draftHydratedRef.current = true
    })()
    return () => {
      cancelled = true
    }
  }, [authUser])

  useEffect(() => {
    if (!authUser || !draftHydratedRef.current) return
    if (historicalPreviewRef.current) return
    void saveCanvasDraft(`canvas-draft:${authUser.id}`, {
      prompt,
      referenceImage,
      referenceRatio,
      model,
      resolutionTier,
      size,
      customWidth,
      customHeight,
      format,
      count,
      selectedKeyId,
    })
  }, [authUser, prompt, referenceImage, referenceRatio, model, resolutionTier, size, customWidth, customHeight, format, count, selectedKeyId])

  // 仅列出启用且具备当前生图模型权限的 API Key，避免选择后才失败。
  useEffect(() => {
    let cancelled = false
    const preferredKeyId = selectedKeyId
    setImageKeys([])
    if (!historicalPreviewRef.current) setSelectedKeyId('')
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
          setSelectedKeyId(
            cached.keys.some((key) => String(key.id) === preferredKeyId)
              ? preferredKeyId
              : String(cached.keys[0]?.id ?? '')
          )
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
          (item) => item.model_name.toLowerCase() === model.toLowerCase()
        )
        const allowedGroups = new Set(imageModel?.enable_groups ?? [])
        const filtered = (keysResult.data?.items ?? []).filter((key) => {
          if (key.status !== API_KEY_STATUS.ENABLED) return false
          if (key.model_limits_enabled) {
            const limits = (key.model_limits ?? '')
              .split(',')
              .map((item) => item.trim().toLowerCase())
              .filter(Boolean)
            if (!limits.includes(model.toLowerCase())) return false
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
                const usable = await canUseImageModel(`sk-${keyResult.data.key}`, model)
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
            verified.some((key) => String(key.id) === preferredKeyId)
              ? preferredKeyId
              : verified.some((key) => String(key.id) === current)
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
  }, [imageKeyCacheKey, model])

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
        const rawUrl = await fileToDataUrl(file)
        // 参考图过大时自动等比压缩，降低上游（尤其参考图编辑）处理超时导致的 502。
        const compressed = await compressReferenceImage(rawUrl)
        const ratio = compressed.width / (compressed.height || 1)
        setReferenceImage(compressed.url)
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
    // Generating is an explicit commit of the currently visible parameters.
    // A historical preview therefore becomes the new live editor state.
    historicalPreviewRef.current = false
    draftRestoreRef.current = null
    writeGenerationState(userId, model)
    setGenerating(true)
    setGenerationError(null)
    try {
      let finalWidth: number
      let finalHeight: number
      // The explicit canvas size selector is authoritative. Prompt text may
      // mention an example ratio, but must never silently rotate the output.
      if (size === CUSTOM_SIZE_VALUE) {
        finalWidth = Number(customWidth)
        finalHeight = Number(customHeight)
        if (!Number.isInteger(finalWidth) || !Number.isInteger(finalHeight) || finalWidth < 256 || finalHeight < 256 || finalWidth > 4096 || finalHeight > 4096) {
          throw new Error('自定义尺寸必须是 256 到 4096 之间的整数。')
        }
      } else {
        const preset = IMAGE_SIZE_PRESETS.find((item) => item.value === size) ?? IMAGE_SIZE_PRESETS[0]
        finalWidth = preset.width
        finalHeight = preset.height
      }
      const selectedPreset = IMAGE_SIZE_PRESETS.find(
        (item) => item.width === finalWidth && item.height === finalHeight
      )
      if (!selectedKeyId) {
        throw new Error(`没有可调用 ${model} 的 API Key，请先创建或调整 API Key 权限。`)
      }
      const keyResult = await fetchTokenKey(Number(selectedKeyId))
      if (!keyResult.success || !keyResult.data?.key) {
        throw new Error(keyResult.message || '无法读取所选 API Key')
      }
      const selectedApiKey = `sk-${keyResult.data.key}`
      const payload: GenerateImagePayload = {
        model,
        prompt: prompt.trim(),
        // GPT Image 2's upstream endpoint expects the ratio token in `size`
        // (for example `16:9`). The corresponding pixel dimensions are shown
        // in the selector and retained in history, but must not be sent as the
        // OpenAI size value or the provider falls back to 1:1.
        size: selectedPreset?.aspectRatio ?? `${finalWidth}x${finalHeight}`,
        // Keep the explicit ratio for compatible channels that accept it.
        ...(selectedPreset?.aspectRatio ? { aspect_ratio: selectedPreset.aspectRatio } : {}),
        n: count,
        format,
        resolution: resolutionTier === '4k' ? '4K' : resolutionTier.toUpperCase(),
        resolution_tier: resolutionTier,
        ...(referenceImage
          ? {
              images: [
                { image_url: referenceImage },
              ],
              // Preserve the uploaded reference as faithfully as the upstream
              // GPT Image endpoint allows. This is intentionally sent only
              // when a reference image is present.
              input_fidelity: 'high',
            }
          : {}),
      }
      const res: Awaited<ReturnType<typeof generateImage>> = referenceImage
        ? await editImage(payload, referenceImage, selectedApiKey)
        : await generateImage(payload, selectedApiKey, '/v1/images/generations')
      const created = Date.now()
      const imgs: GeneratedImage[] = (res.data ?? []).map((d, i) => {
        const id = `${created}-${i}`
        const cacheKey = (d.url || d.b64_json)
          ? `canvas-image:${userId == null ? 'anonymous' : userId}:${id}`
          : undefined
        return {
          id,
          url: d.url,
          cache_key: cacheKey,
          b64_json: d.b64_json,
          prompt: prompt.trim(),
          size: `${finalWidth}x${finalHeight}`,
          resolutionTier,
          format,
          created,
          referenceImage,
          referenceRatio,
          model,
          customWidth,
          customHeight,
          count,
          selectedKeyId,
        }
      })
      if (imgs.length === 0) {
        toast.error('未返回生成结果')
        return
      }
      const next = [...imgs, ...history].slice(0, HISTORY_LIMIT)
      setHistory(next)
      const newest = imgs[0] ?? null
      // 右上右侧主区域必须展示本次最新生成结果。先立即设置最新图；
      // 若上游只返回 url（多为一次性签名/防盗链链接，浏览器 <img> 直接
      // 加载会 403），再异步经本地下载代理转成 dataURL，确保能渲染出新图。
      setCurrentImage(newest)
      if (newest && newest.url && !newest.b64_json) {
        void proxyImageToDataUrl(newest.url).then((dataUrl) => {
          if (dataUrl) setCurrentImage((cur) => (cur?.id === newest.id ? { ...newest, b64_json: dataUrl } : cur))
        })
      }
      try {
        // 上传完整历史（含本地已有记录），避免服务器只存本次导致历史被覆盖清空。
        await saveCanvasHistory(next)
        const remote = await getCanvasHistory()
        const hydrated = await Promise.all(remote.map((image) => hydrateLatestUrl(image)))
        setHistory(mergeUniqueById([hydrated, next]))
      } catch (persistError) {
        toast.error(persistError instanceof Error ? `历史图片保存失败：${persistError.message}` : '历史图片保存失败')
      }
      // Publish metadata immediately so a WebSocket listener on a newly
      // mounted canvas can show the completed item without waiting for image
      // persistence to finish.
      try {
        localStorage.setItem(
          historyStorageKey,
          JSON.stringify(next.map((image) => ({ ...image, b64_json: undefined })))
        )
      } catch {
        /* IndexedDB persistence below remains authoritative. */
      }
      // Keep a browser copy only as a best-effort fast path. The server copy
      // above is authoritative and survives browser cache clearing.
      const persistedKeys = new Set<string>()
      await Promise.all(
        imgs.map(async (image) => {
          if (image.b64_json && image.cache_key) {
            if (await saveImageToIndexedDb(image.cache_key, image.b64_json)) {
              persistedKeys.add(image.cache_key)
            }
          }
        })
      )
      try {
        const persisted = next.map((image) =>
          image.b64_json && image.cache_key && persistedKeys.has(image.cache_key)
            ? { ...image, b64_json: undefined }
            : image
        )
        localStorage.setItem(historyStorageKey, JSON.stringify(persisted))
      } catch {
        /* 容量超限时仅保留内存历史 */
      }
      // IndexedDB keeps the complete metadata and image payload independent
      // of localStorage quotas, so a refresh can always reconstruct history.
      await saveHistoryToIndexedDb(historyStorageKey, next)
      saveCurrentImageMetadata(userId, imgs[0])
    } catch (error) {
      const rawMsg = error instanceof Error ? error.message : '生成失败'
      const status = (error as { response?: { status?: number } })?.response?.status
      let msg = rawMsg
      // 脱敏：上游/网关原始错误（Cloudflare origin、upstream、bad response status code 等）
      // 不展示给用户，改写为平台通用提示。
      if (
        status &&
        status >= 500 &&
        /cloudflare|origin web server|upstream|bad response status code|status_code=\d{3}/i.test(rawMsg)
      ) {
        msg = '服务繁忙，请稍后重试'
      }
      if (/api.?key|enabled api.?key|invalid.*key/i.test(msg)) {
        setApiKeyMissing(true)
      }
      // 生成失败时在右侧主区域展示错误，不再残留上次成功生成的图片。
      setGenerationError(msg)
      toast.error(msg)
    } finally {
      clearGenerationState(userId)
      setGenerating(false)
    }
  }

  const resolveImage = (img: GeneratedImage): string | undefined =>
    img.b64_json
      ? img.b64_json.startsWith('data:')
        ? img.b64_json
        : `data:image/${img.format === 'jpeg' ? 'jpeg' : img.format};base64,${img.b64_json}`
      : img.url

  const captureEditorState = (): CanvasEditorState => ({
    prompt,
    referenceImage,
    referenceRatio,
    model,
    resolutionTier,
    size,
    customWidth,
    customHeight,
    format,
    count,
    selectedKeyId,
  })

  const applyEditorState = (draft: CanvasEditorState) => {
    setPrompt(draft.prompt || '')
    setReferenceImage(draft.referenceImage || null)
    setReferenceRatio(draft.referenceRatio ?? null)
    setModel(draft.model || CANVAS_DEFAULT_MODEL)
    setResolutionTier(draft.resolutionTier || '2k')
    setSize(draft.size || IMAGE_SIZE_PRESETS[0].value)
    setCustomWidth(draft.customWidth || '')
    setCustomHeight(draft.customHeight || '')
    setFormat(draft.format || 'jpeg')
    setCount(Number.isInteger(draft.count) ? draft.count : 1)
    setSelectedKeyId(draft.selectedKeyId || '')
  }

  const restoreHistoricalDraft = (image: GeneratedImage) => {
    if (!draftRestoreRef.current) draftRestoreRef.current = captureEditorState()
    historicalPreviewRef.current = true
    applyEditorState({
      prompt: image.prompt || '',
      referenceImage: image.referenceImage ?? null,
      referenceRatio: image.referenceRatio ?? null,
      model: image.model || CANVAS_DEFAULT_MODEL,
      resolutionTier: image.resolutionTier || '2k',
      size: image.size || IMAGE_SIZE_PRESETS[0].value,
      customWidth: image.customWidth || '',
      customHeight: image.customHeight || '',
      format: image.format || 'jpeg',
      count: image.count || 1,
      selectedKeyId: image.selectedKeyId || '',
    })
    toast.success('已临时恢复该次生成参数，点击画布空白处可返回当前编辑状态')
  }

  const restoreCurrentDraft = () => {
    const backup = draftRestoreRef.current
    if (!backup) return
    draftRestoreRef.current = null
    historicalPreviewRef.current = false
    applyEditorState(backup)
    setViewingImage(null)
    toast('已返回当前编辑状态')
  }

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
              {CANVAS_IMAGE_MODELS.map((item) => (
                <SelectItem key={item} value={item}>{item}</SelectItem>
              ))}
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
                className='truncate'
                placeholder={loadingKeys ? '正在筛选可用 API Key…' : '选择 API Key'}
              >
                {imageKeys.find((key) => String(key.id) === selectedKeyId)?.name ||
                  '选择 API Key'}
              </SelectValue>
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
            仅显示已启用且允许调用 {model} 的 Key
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
                onClick={() => {
                  setReferenceImage(null)
                  setReferenceRatio(null)
                }}
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
              <SelectItem value={CUSTOM_SIZE_VALUE}>自定义尺寸</SelectItem>
            </SelectContent>
          </Select>
          {size === CUSTOM_SIZE_VALUE && (
            <div className='grid grid-cols-2 gap-2'>
              <Input type='number' min={256} max={4096} placeholder='宽度' value={customWidth} onChange={(e) => setCustomWidth(e.target.value)} />
              <Input type='number' min={256} max={4096} placeholder='高度' value={customHeight} onChange={(e) => setCustomHeight(e.target.value)} />
            </div>
          )}
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
        <div
          className='flex flex-1 items-center justify-center overflow-auto bg-black/90'
          onClick={(event) => {
            // Blank-canvas clicks exit historical preview; clicks on the
            // displayed image or controls remain ordinary interactions.
            const target = event.target as HTMLElement
            if (!target.closest('img,button')) restoreCurrentDraft()
          }}
        >
          {generating ? (
            <div className='flex flex-col items-center gap-3 text-muted-foreground'>
              <Loader2 className='size-8 animate-spin' />
              <span className='text-sm'>正在生成，请稍候…</span>
            </div>
          ) : generationError ? (
            <div className='flex max-w-[80%] flex-col items-center gap-3 rounded-lg border border-rose-500/40 bg-rose-500/10 px-6 py-5 text-center text-rose-400'>
              <X className='size-8' />
              <span className='text-sm font-medium'>生成失败</span>
              <span className='text-xs break-words whitespace-pre-wrap'>{generationError}</span>
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
                const keys = history.map((image) => image.cache_key).filter((key): key is string => Boolean(key))
                setHistory([])
                void clearIndexedDbImages(keys)
                void deleteHistoryFromIndexedDb(historyStorageKey)
                try {
                  localStorage.removeItem(historyStorageKey)
                } catch {
                  /* ignore */
                }
                void deleteCanvasHistory().catch(() => toast.error('清空服务器历史失败'))
              }}
            >
              <Trash2 className='size-3.5' />
              清空
            </Button>
          </div>
          <div className='flex gap-2 overflow-x-auto'>
            {/* 历史按生成时间排序：最左为最新生成，最右为最早生成 */}
            {[...history]
              .sort((a, b) => (b.created || 0) - (a.created || 0))
              .map((img) => {
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
                    <div className='absolute top-1 right-1 flex items-center gap-1'>
                      <button
                        type='button'
                        onClick={(e) => {
                          e.stopPropagation()
                          restoreHistoricalDraft(img)
                        }}
                        className='rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80'
                        aria-label='恢复草稿'
                        title='恢复此图生成参数'
                      >
                        <RotateCcw className='size-4' />
                      </button>
                      <button
                        type='button'
                        onClick={(e) => {
                          e.stopPropagation()
                          if (downloadingImageId === img.id) return
                          setDownloadingImageId(img.id)
                          void downloadImage(src).finally(() => setDownloadingImageId(null))
                        }}
                        className='rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80 disabled:cursor-wait disabled:opacity-70'
                        disabled={downloadingImageId === img.id}
                        aria-label='保存图片'
                        title='保存图片'
                      >
                        {downloadingImageId === img.id ? (
                          <Loader2 className='size-4 animate-spin' />
                        ) : (
                          <Download className='size-4' />
                        )}
                      </button>
                    </div>
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
