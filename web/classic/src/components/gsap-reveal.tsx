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
import { useRef, type ReactNode } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { cn } from '@/lib/utils'

gsap.registerPlugin(useGSAP, ScrollTrigger)

interface GsapRevealProps {
  children: ReactNode
  className?: string
  /** 动画整体延迟（秒） */
  delay?: number
  /** 子元素之间错开的时长（秒） */
  stagger?: number
  /** 初始下移距离（px） */
  from?: number
  /** 触发方式：mount 首屏依次入场；scroll 滚动进入视口时触发 */
  trigger?: 'mount' | 'scroll'
}

/**
 * GSAP 入场动效容器：包一层后，内部的 [data-reveal] 子元素会以
 * 淡入 + 上移的方式依次入场。默认首屏（mount）触发。
 */
export function GsapReveal({
  children,
  className,
  delay = 0,
  stagger = 0.08,
  from = 26,
  trigger = 'mount',
}: GsapRevealProps) {
  const ref = useRef<HTMLDivElement>(null)

  useGSAP(
    () => {
      const els = ref.current?.querySelectorAll('[data-reveal]')
      if (!els?.length) return

      const targets = Array.from(els) as HTMLElement[]
      const tween = () => {
        gsap.fromTo(
          targets,
          { y: from, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.72,
            ease: 'power3.out',
            stagger,
            delay,
            overwrite: true,
          }
        )
      }

      if (trigger === 'scroll') {
        gsap.fromTo(
          targets,
          { y: from, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.72,
            ease: 'power3.out',
            stagger,
            delay,
            overwrite: true,
            scrollTrigger: {
              trigger: ref.current,
              start: 'top 80%',
            },
          }
        )
      } else {
        tween()
      }
    },
    { scope: ref }
  )

  return (
    <div ref={ref} className={cn(className)}>
      {children}
    </div>
  )
}

export default GsapReveal
