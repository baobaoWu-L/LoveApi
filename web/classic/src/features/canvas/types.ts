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

export type ImageInput = {
  type: 'image_url'
  image_url: { url: string }
}

// POST /v1/images/generations 请求体
export type GenerateImagePayload = {
  model: string
  prompt: string
  // 上游「宽高比 · 尺寸」字符串，如 "16:9 · 1672x941"
  size?: string
  n?: number
  images?: ImageInput[]
  mask?: ImageInput
  response_format?: string
  output_format?: string
  // 分辨率档位（前端用于展示预期价格，后端据此/按 size 计量）
  resolution_tier?: string
}

// 生成的单张图片
export type GeneratedImage = {
  id: string
  url?: string
  cache_key?: string
  b64_json?: string
  prompt: string
  size: string
  resolutionTier: string
  format: string
  created: number
}

// 后端 OpenAI 图片响应
export type ImageResponseData = {
  data?: Array<{ url?: string; b64_json?: string }>
}
