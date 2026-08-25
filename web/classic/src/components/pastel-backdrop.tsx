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
import { cn } from '@/lib/utils'

/**
 * 暖色渐变背景 —— 桃粉、奶油、淡紫、浅黄的柔和渐变大色块。
 * 作为页面氛围层使用（绝对定位 + -z-10），不会影响内容交互。
 */
export function PastelBackdrop({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        'pointer-events-none absolute inset-0 -z-10 overflow-hidden',
        className
      )}
    >
      {/* 基底线性渐变 */}
      <div
        className='absolute inset-0'
        style={{
          background:
            'linear-gradient(160deg, #fffbf5 0%, #fff0ec 42%, #eef0fb 100%)',
        }}
      />
      {/* 顶部左侧 桃粉 */}
      <div
        className='absolute -top-24 -left-16 size-[460px] rounded-full blur-3xl'
        style={{
          background: 'radial-gradient(circle, #ffd9c2 0%, transparent 68%)',
        }}
      />
      {/* 顶部右侧 玫粉 */}
      <div
        className='absolute -top-20 right-0 size-[480px] rounded-full blur-3xl'
        style={{
          background: 'radial-gradient(circle, #ffc9d8 0%, transparent 68%)',
        }}
      />
      {/* 中部左侧 淡紫 */}
      <div
        className='absolute top-1/3 -left-24 size-[460px] rounded-full blur-3xl'
        style={{
          background: 'radial-gradient(circle, #d9ccff 0%, transparent 68%)',
        }}
      />
      {/* 底部右侧 奶油黄 */}
      <div
        className='absolute -bottom-24 right-1/4 size-[460px] rounded-full blur-3xl'
        style={{
          background: 'radial-gradient(circle, #fff2c2 0%, transparent 68%)',
        }}
      />
    </div>
  )
}
