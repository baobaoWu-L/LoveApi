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
import { Link } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { motion } from 'motion/react'
import { Button } from '@/components/ui/button'
import { HeroTerminalDemo } from '../hero-terminal-demo'
import { FloatingParticles } from '../floating-particles'

interface HeroProps {
  className?: string
  isAuthenticated?: boolean
}

export function Hero(props: HeroProps) {
  const { t } = useTranslation()

  return (
    <section className='relative z-10 flex flex-col items-center overflow-hidden px-6 pt-28 pb-16 md:pt-40 md:pb-28'>
      {/* Floating particles */}
      <FloatingParticles />

      {/* Full-width black stripe */}
      <div
        aria-hidden
        className='pointer-events-none absolute top-0 left-1/2 -z-10 h-[600px] w-[200vw] -translate-x-1/2 bg-[radial-gradient(ellipse_50%_30%_at_50%_20%,oklch(0_0_0/0.03)_0%,transparent_70%)] dark:bg-[radial-gradient(ellipse_50%_30%_at_50%_20%,oklch(1_0_0/0.03)_0%,transparent_70%)]'
      />

      {/* Top accent line */}
      <div className='absolute top-0 left-1/2 h-px w-32 -translate-x-1/2 bg-foreground/10' />

      <div className='flex max-w-4xl flex-col items-center text-center'>
        {/* Eyebrow label */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className='mb-6 inline-flex items-center gap-2 rounded-full border border-foreground/10 bg-foreground/[0.03] px-4 py-1.5 text-[11px] font-medium tracking-widest uppercase text-foreground/50'
        >
          <span className='inline-block size-1.5 rounded-full bg-foreground/30' />
          {t('Universal API Gateway')}
        </motion.div>

        <h1
          className='landing-animate-fade-up text-[clamp(2.5rem,7vw,4.5rem)] leading-[1.08] font-bold tracking-tight'
          style={{ animationDelay: '0ms' }}
        >
          <span className='text-foreground/40 font-light'>{t('One gateway')}</span>
          <br />
          <span className='text-foreground'>{t('for every AI model')}</span>
        </h1>
        <p
          className='landing-animate-fade-up text-muted-foreground/70 mt-6 max-w-lg text-base leading-relaxed opacity-0 md:text-lg'
          style={{ animationDelay: '80ms' }}
        >
          {t('Power AI applications, manage digital assets, connect the Future')}
        </p>
        <div
          className='landing-animate-fade-up mt-8 flex items-center gap-3 opacity-0'
          style={{ animationDelay: '160ms' }}
        >
          {props.isAuthenticated ? (
            <Button
              className='group rounded-full px-6'
              render={<Link to='/dashboard' />}
            >
              {t('Go to Dashboard')}
              <ArrowRight className='ml-1 size-3.5 transition-transform duration-200 group-hover:translate-x-0.5' />
            </Button>
          ) : (
            <>
              <Button
                className='group rounded-full px-6'
                render={<Link to='/sign-up' />}
              >
                {t('Get Started')}
                <ArrowRight className='ml-1 size-3.5 transition-transform duration-200 group-hover:translate-x-0.5' />
              </Button>
              <Button
                variant='outline'
                className='rounded-full border-foreground/20 px-6 hover:bg-foreground/5'
                render={<Link to='/pricing' />}
              >
                {t('View Pricing')}
              </Button>
            </>
          )}
        </div>
      </div>

      <motion.div
        className='landing-animate-fade-up mt-16 w-full max-w-3xl opacity-0'
        style={{ animationDelay: '300ms' }}
        whileHover={{ scale: 1.01 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      >
        <HeroTerminalDemo />
      </motion.div>
    </section>
  )
}
