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
import type { GenerateImagePayload, ImageResponseData } from './types'

// 供前端门槛提示复用：无可用 API Key 时抛出，UI 据此提示「先创建 API Key」
export { fetchActiveChatKey as getGenerationKey }

/**
 * 通过 OpenAI 兼容端点调用生图。
 * 鉴权使用当前用户可用 API Key（Bearer sk-xxx），走 /v1 反代到后端 relay。
 */
export async function generateImage(
  payload: GenerateImagePayload
): Promise<ImageResponseData> {
  const key = await fetchActiveChatKey()
  const res = await axios.post<ImageResponseData>('/v1/images/generations', payload, {
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
  })
  return res.data
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
