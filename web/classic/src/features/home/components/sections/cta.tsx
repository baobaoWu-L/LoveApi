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
import { ArrowRight, FileText } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { AnimateInView } from '@/components/animate-in-view'

interface CTAProps {
  className?: string
  isAuthenticated?: boolean
}

export function CTA(props: CTAProps) {
  const { t } = useTranslation()

  if (props.isAuthenticated) {
    return null
  }

  return (
    <section className='relative z-10 overflow-hidden border-t border-border/30 px-6 py-24 md:py-32'>
      {/* Full-width black bar decoration */}
      <div
        aria-hidden
        className='pointer-events-none absolute inset-x-0 top-0 h-px bg-foreground/5'
      />

      <AnimateInView
        className='mx-auto max-w-2xl text-center'
        animation='scale-in'
      >
        <h2 className='text-3xl leading-tight font-bold tracking-tight md:text-5xl'>
          {t('Ready to simplify')}
          <br />
          <span className='text-foreground/60 font-light'>
            {t('your AI integration?')}
          </span>
        </h2>
        <p className='text-muted-foreground/60 mx-auto mt-5 max-w-md text-sm leading-relaxed md:text-base'>
          {t(
            'Deploy your own gateway and start routing requests through your configured upstream services.'
          )}
        </p>
        <div className='mt-8 flex flex-wrap items-center justify-center gap-2'>
          <Button
            className='group rounded-full px-6'
            render={<Link to='/sign-up' />}
          >
            {t('Get Started')}
            <ArrowRight className='ml-1 size-3.5 transition-transform duration-200 group-hover:translate-x-0.5' />
          </Button>
          <Button
            variant='outline'
            className='rounded-full border-foreground/20 px-6 hover:bg-foreground/5 whitespace-nowrap'
            render={<Link to='/pricing' />}
          >
            {t('Model Square')}
          </Button>
          <Button
            variant='outline'
            className='rounded-full border-foreground/20 px-6 hover:bg-foreground/5 whitespace-nowrap'
            render={<Link to='/api-doc' />}
          >
            API 文档
          </Button>
        </div>
      </AnimateInView>
    </section>
  )
}
