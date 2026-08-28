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
// 无限画布：模型与参数预设
// size 取值沿用上游「宽高比 · 尺寸」格式，后端透传解析。

export const CANVAS_DEFAULT_MODEL = 'gpt-image-2'

// 宽高比预设（下拉不允许手输）。
// label 给用户看（「宽高比 · 参考像素」），value 是传给上游的 size（必须为纯宽高比，
// 上游按 aspect ratio 校验，形式如 "1:1 · 1254x1254" 会被拒绝导致 500）。
export const IMAGE_SIZE_PRESETS: { label: string; value: string }[] = [
  { label: '1:1 · 1254x1254', value: '1:1' },
  { label: '4:3 · 1448x1086', value: '4:3' },
  { label: '3:2 · 1536x1024', value: '3:2' },
  { label: '3:4 · 1086x1448', value: '3:4' },
  { label: '2:3 · 1024x1536', value: '2:3' },
  { label: '16:9 · 1672x941', value: '16:9' },
  { label: '9:16 · 941x1672', value: '9:16' },
  { label: '21:9 · 1915x821', value: '21:9' },
  { label: '9:21 · 821x1915', value: '9:21' },
  { label: '5:4 · 1402x1122', value: '5:4' },
  { label: '4:5 · 1122x1402', value: '4:5' },
]

// 分辨率档位：决定按次计费价格（2K 默认 $0.07，4K $0.30）
export const RESOLUTION_TIERS: {
  label: string
  value: string
  price: number
}[] = [
  { label: '默认', value: 'default', price: 0.07 },
  { label: '2K', value: '2k', price: 0.07 },
  { label: '4K', value: '4k', price: 0.3 },
]

// 输出格式
export const IMAGE_FORMATS: { label: string; value: string }[] = [
  { label: 'jpeg', value: 'jpeg' },
  { label: 'png', value: 'png' },
  { label: 'webp', value: 'webp' },
]

// 允许的参考图/蒙版文件类型
export const SUPPORTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp']

// 数量上限：用户可输入，最大 20
export const MAX_IMAGE_COUNT = 20
