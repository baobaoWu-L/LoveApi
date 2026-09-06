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
import { useRef, useState, useEffect } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { useRouterState } from '@tanstack/react-router'
import { cn } from '@/lib/utils'

gsap.registerPlugin(useGSAP)

// 行星轨道配置：不同半径与公转时长，模拟太阳系
const ORBITS = [
  { size: 104, dur: 3.4, dotSize: 8, dotClass: 'bg-rose-300' },
  { size: 150, dur: 5.6, dotSize: 6, dotClass: 'bg-rose-400' },
  { size: 194, dur: 8.2, dotSize: 5, dotClass: 'bg-rose-200' },
]

export function SolarLoader() {
  const ref = useRef<HTMLDivElement>(null)
  const state = useRouterState()
  const [visible, setVisible] = useState(false)

  // 导航进行中，且持续超过 250ms 才显示，避免快速切换闪烁
  const pending = state.status === 'pending'
  useEffect(() => {
    if (pending) {
      const t = window.setTimeout(() => setVisible(true), 250)
      return () => window.clearTimeout(t)
    }
    setVisible(false)
  }, [pending])

  useGSAP(
    () => {
      gsap.set('.orbit', { xPercent: -50, yPercent: -50 })
      gsap.to('.orbit', {
        rotation: '+=360',
        repeat: -1,
        ease: 'none',
        transformOrigin: 'center center',
        duration: 3,
        stagger: { each: 0.9, from: 'start' },
      })
      gsap.fromTo(
        '.solar-sun',
        { scale: 0.92 },
        {
          scale: 1,
          repeat: -1,
          yoyo: true,
          duration: 1.6,
          ease: 'sine.inOut',
        }
      )
    },
    { scope: ref }
  )

  return (
    <div
      aria-hidden='true'
      className={cn(
        'bg-background/70 fixed inset-0 z-[100] flex items-center justify-center backdrop-blur-sm transition-opacity duration-300',
        visible ? 'opacity-100' : 'pointer-events-none opacity-0'
      )}
    >
      <div ref={ref} className='relative flex h-56 w-56 items-center justify-center'>
        {ORBITS.map((o, i) => (
          <div
            key={i}
            className='orbit absolute rounded-full'
            style={{
              width: o.size,
              height: o.size,
              left: '50%',
              top: '50%',
              border: '1px dashed var(--border)',
            }}
          >
            <span
              className={cn('absolute rounded-full', o.dotClass)}
              style={{
                width: o.dotSize,
                height: o.dotSize,
                top: -o.dotSize / 2,
                left: '50%',
                transform: 'translateX(-50%)',
              }}
            />
          </div>
        ))}
        <img
          src='/LoveApi.png'
          alt=''
          className='solar-sun relative z-10 size-16 rounded-full object-cover shadow-md'
        />
      </div>
    </div>
  )
}
