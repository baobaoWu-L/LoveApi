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
import axios from 'axios'
import { fetchActiveChatKey } from '@/features/chat/hooks/use-active-chat-key'
import type { GenerateImagePayload, GeneratedImage, ImageResponseData } from './types'

// 供前端门槛提示复用：无可用 API Key 时抛出，UI 据此提示「先创建 API Key」
export { fetchActiveChatKey as getGenerationKey }

/**
 * 通过 OpenAI 兼容端点调用生图。
 * 鉴权使用当前用户可用 API Key（Bearer sk-xxx），走 /v1 反代到后端 relay。
 */
export async function generateImage(
  payload: GenerateImagePayload,
  apiKey?: string,
  endpoint = '/v1/images/generations'
): Promise<ImageResponseData> {
  const key = apiKey || (await fetchActiveChatKey())
  const res = await axios.post<ImageResponseData>(endpoint, payload, {
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
  })
  return res.data
}

/**
 * OpenAI image edits requires multipart/form-data. The canvas keeps the
 * selected reference image as a data URL, so convert it back to a Blob and
 * send it using the standard `image` file field expected by the relay.
 */
export async function editImage(
  payload: GenerateImagePayload,
  referenceDataUrl: string,
  apiKey?: string
): Promise<ImageResponseData> {
  const key = apiKey || (await fetchActiveChatKey())
  const match = referenceDataUrl.match(/^data:([^;]+);base64,(.+)$/)
  if (!match) throw new Error('参考图格式无效，请重新上传图片')
  const binary = atob(match[2])
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
  const blob = new Blob([bytes], { type: match[1] || 'image/png' })
  const form = new FormData()
  form.append('model', payload.model)
  form.append('prompt', payload.prompt)
  if (payload.size) form.append('size', payload.size)
  if (payload.aspect_ratio) form.append('aspect_ratio', payload.aspect_ratio)
  if (payload.n != null) form.append('n', String(payload.n))
  if (payload.quality) form.append('quality', payload.quality)
  if (payload.response_format) form.append('response_format', payload.response_format)
  if (payload.format) {
    form.append('format', payload.format)
    form.append('output_format', payload.format)
  }
  if (payload.resolution) form.append('resolution', payload.resolution)
  if (payload.resolution_tier) form.append('resolution_tier', payload.resolution_tier)
  if (payload.input_fidelity) form.append('input_fidelity', payload.input_fidelity)
  form.append('image', blob, 'reference-image.png')
  const res = await axios.post<ImageResponseData>('/v1/images/edits', form, {
    headers: { Authorization: `Bearer ${key}` },
  })
  return res.data
}

/** Probe the authenticated model list without generating an image. */
export async function canUseImageModel(apiKey: string, model = 'gpt-image-2'): Promise<boolean> {
  const res = await axios.get<{ data?: Array<{ id?: string }> }>('/v1/models', {
    headers: { Authorization: `Bearer ${apiKey}` },
  })
  return Boolean(
    res.data?.data?.some(
      (item) => item.id?.toLowerCase() === model.toLowerCase()
    )
  )
}

export async function getCanvasHistory(): Promise<GeneratedImage[]> {
  const uid = typeof window !== 'undefined' ? window.localStorage.getItem('uid') || '' : ''
  const res = await axios.get<{ success?: boolean; data?: GeneratedImage[] }>('/api/canvas/history', {
    headers: uid ? { 'New-Api-User': uid } : undefined,
  })
  return Array.isArray(res.data?.data) ? res.data.data : []
}

export async function getCanvasHistoryImage(imageId: string): Promise<string> {
  const uid = typeof window !== 'undefined' ? window.localStorage.getItem('uid') || '' : ''
  const res = await axios.get(`/api/canvas/history/${encodeURIComponent(imageId)}/image`, {
    responseType: 'blob',
    headers: uid ? { 'New-Api-User': uid } : undefined,
  })
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error || new Error('读取历史图片失败'))
    reader.readAsDataURL(res.data)
  })
}

export async function saveCanvasHistory(items: GeneratedImage[]): Promise<void> {
  if (!items.length) return
  const uid = typeof window !== 'undefined' ? window.localStorage.getItem('uid') || '' : ''
  await axios.post('/api/canvas/history', { items }, {
    headers: uid ? { 'New-Api-User': uid } : undefined,
  })
}

export async function deleteCanvasHistory(): Promise<void> {
  const uid = typeof window !== 'undefined' ? window.localStorage.getItem('uid') || '' : ''
  await axios.delete('/api/canvas/history', {
    headers: uid ? { 'New-Api-User': uid } : undefined,
  })
}

/** 将上传的图片文件转成 data URL（base64），用于参考图/蒙版 */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}
