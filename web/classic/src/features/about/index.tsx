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
import { useQuery } from '@tanstack/react-query'
import { Construction } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Markdown } from '@/components/ui/markdown'
import { Skeleton } from '@/components/ui/skeleton'
import { PublicLayout } from '@/components/layout'
import { PastelBackdrop } from '@/components/pastel-backdrop'
import { GsapReveal } from '@/components/gsap-reveal'
import { getAboutContent } from './api'

function isValidUrl(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

function isLikelyHtml(value: string) {
  return /<\/?[a-z][\s\S]*>/i.test(value)
}

function EmptyAboutState() {
  const { t } = useTranslation()
  const currentYear = new Date().getFullYear()

  return (
    <div className='space-y-6'>
      <div className='flex min-h-[24vh] items-center justify-center rounded-2xl border border-dashed p-8'>
        <div className='max-w-2xl space-y-6 text-center'>
          <div className='flex justify-center'>
            <Construction className='text-muted-foreground h-20 w-20' />
          </div>
          <div className='space-y-2'>
            <h2 className='text-2xl font-bold'>{t('No About Content Set')}</h2>
            <p className='text-muted-foreground'>
              {t(
                'The administrator has not configured any about content yet. You can set it in the settings page, supporting HTML or URL.'
              )}
            </p>
          </div>
          <div className='space-y-4 text-sm'>
            <p>
              {t('Love API Project Repository:')}{' '}
              <a
                href='https://github.com/QuantumNous/new-api'
                target='_blank'
                rel='noopener noreferrer'
                className='text-primary hover:underline'
              >
                {t('https://github.com/QuantumNous/new-api')}
              </a>
            </p>
            <p className='text-muted-foreground'>
              {t('LoveAPI')} © {currentYear}{' '}
              <a
                href='https://github.com/QuantumNous'
                target='_blank'
                rel='noopener noreferrer'
                className='text-primary hover:underline'
              >
                {t('QuantumNous')}
              </a>{' '}
              {t('| Based on')}{' '}
              <a
                href='https://github.com/songquanpeng/one-api'
                target='_blank'
                rel='noopener noreferrer'
                className='text-primary hover:underline'
              >
                {t('One API')}
              </a>{' '}
              © 2023{' '}
              <a
                href='https://github.com/songquanpeng'
                target='_blank'
                rel='noopener noreferrer'
                className='text-primary hover:underline'
              >
                {t('JustSong')}
              </a>
            </p>
          </div>
        </div>
      </div>

    </div>
  )
}

export function About() {
  const { t } = useTranslation()
  const { data, isLoading } = useQuery({
    queryKey: ['about-content'],
    queryFn: getAboutContent,
  })
  const rawContent = data?.data?.trim() ?? ''
  const hasContent = rawContent.length > 0
  const isUrl = hasContent && isValidUrl(rawContent)
  const isHtml = hasContent && !isUrl && isLikelyHtml(rawContent)

  return (
    <PublicLayout showMainContainer={false}>
      <div className='relative'>
        <PastelBackdrop />
        <GsapReveal className='mx-auto w-full max-w-4xl px-4 pt-20 pb-16 md:px-6'>
          {/* 标题区 */}
          <header data-reveal className='mb-8 border-b border-border/40 pb-6'>
            <span className='text-primary inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold tracking-wide uppercase'>
              <span className='size-1.5 rounded-full bg-current' />
              {t('About')}
            </span>
            <h1 className='mt-3 text-4xl font-bold tracking-tight sm:text-5xl'>
              {t('About Love Api')}
            </h1>
            <p className='text-muted-foreground mt-3 max-w-2xl leading-relaxed'>
              {t(
                'Unified AI API gateway aggregating multiple upstream providers to deliver a stable, efficient, seamless API forwarding experience.'
              )}
            </p>
          </header>

          <div data-reveal className='min-w-0'>
            {isLoading ? (
              <div className='flex flex-col gap-4'>
                <Skeleton className='h-8 w-[45%]' />
                <Skeleton className='h-4 w-full' />
                <Skeleton className='h-4 w-[90%]' />
                <Skeleton className='h-4 w-[80%]' />
              </div>
            ) : !hasContent ? (
              <EmptyAboutState />
            ) : isUrl ? (
              <iframe
                src={rawContent}
                className='border-border h-[68vh] w-full rounded-2xl border'
                title={t('About')}
              />
            ) : isHtml ? (
              <div
                className='prose prose-neutral dark:prose-invert max-w-none'
                dangerouslySetInnerHTML={{ __html: rawContent }}
              />
            ) : (
              <Markdown className='prose-neutral dark:prose-invert max-w-none'>
                {rawContent}
              </Markdown>
            )}
          </div>

        </GsapReveal>
      </div>
    </PublicLayout>
  )
}
