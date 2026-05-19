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
import { useRef, useMemo } from 'react'
import { motion, useReducedMotion } from 'motion/react'

interface Particle {
  x: number
  y: number
  size: number
  duration: number
  delay: number
  driftX: number
  driftY: number
}

export function FloatingParticles({ count = 40 }: { count?: number }) {
  const prefersReducedMotion = useReducedMotion()
  const particles = useRef(
    useMemo<Particle[]>(() => {
      return Array.from({ length: count }, (_, i) => ({
        x: ((i * 29.7 + 13.3) % 100),
        y: ((i * 7.3 + 41.9) % 100),
        size: 1 + (i % 4) * 0.5,
        duration: 6 + (i % 11) * 2,
        delay: (i * 0.43) % 8,
        driftX: ((i % 7) - 3) * 1.5,
        driftY: ((i % 5) - 2) * 1.5,
      }))
    }, [count])
  )

  if (prefersReducedMotion) return null

  return (
    <div aria-hidden className='pointer-events-none absolute inset-0 -z-5 overflow-hidden'>
      {particles.current.map((p, i) => (
        <motion.div
          key={i}
          className='absolute rounded-full bg-foreground/15 dark:bg-foreground/10'
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
          }}
          animate={{
            y: [0, p.driftY * 8, p.driftY * -4, p.driftY * 6, 0],
            x: [0, p.driftX * 6, p.driftX * -3, p.driftX * 5, 0],
            opacity: [0.15, 0.4, 0.2, 0.35, 0.15],
            scale: [1, 1.5, 0.8, 1.2, 1],
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      ))}
      {/* Larger floating rings */}
      {[0, 1, 2].map((i) => (
        <motion.div
          key={`ring-${i}`}
          className='absolute rounded-full border border-foreground/8 dark:border-foreground/6'
          style={{
            left: `${25 + i * 25}%`,
            top: `${30 + (i % 2) * 30}%`,
            width: 60 + i * 40,
            height: 60 + i * 40,
          }}
          animate={{
            y: [0, -20, 0, 15, 0],
            x: [0, 10, -5, 8, 0],
            opacity: [0.1, 0.25, 0.1, 0.2, 0.1],
            scale: [1, 1.05, 0.98, 1.02, 1],
          }}
          transition={{
            duration: 12 + i * 4,
            delay: i * 2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  )
}
