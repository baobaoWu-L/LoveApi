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
import { Card } from '@/components/ui/card'
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
    <div className='flex min-h-[40vh] items-center justify-center rounded-2xl border border-dashed p-8'>
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
  )
}

function PrivacySection() {
  const { t } = useTranslation()
  const currentYear = new Date().getFullYear()

  const items: Array<{ title: string; body: string }> = [
    {
      title: '信息收集',
      body: '我们可能收集您在注册、使用过程中提供的账号信息（如用户名、邮箱），以及服务运行所需的日志数据（如 API 调用记录、请求时间与模型名称），用于账户管理与服务维护。',
    },
    {
      title: '信息使用',
      body: '收集的信息仅用于提供、维护和改进本服务，包括身份验证、计数与计费、安全防护及使用统计。我们不会将您的个人信息用作其他用途。',
    },
    {
      title: '数据共享与转发',
      body: '当您发起模型请求时，请求内容会按需转发到您所选择的上游模型供应商以完成调用，这是提供服务所必需的。除此外我们不会向任何第三方出售或出租您的个人信息。',
    },
    {
      title: 'Cookie 与本地存储',
      body: '我们可能使用 Cookie 及浏览器本地存储来维持您的登录状态、偏好设置与页面体验。您可以随时通过浏览器设置清除这些数据。',
    },
    {
      title: '数据安全',
      body: '我们采取合理的技术与管理措施保护您的信息安全，包括传输加密、访问控制与密钥隔离。但请理解，任何互联网传输方式都无法保证绝对安全。',
    },
    {
      title: '您的权利',
      body: '您有权查询、更正或删除您的账户信息；如无必要，我们会在您注销后删除或匿名化相关数据。如需行使上述权利，请联系站点管理员。',
    },
    {
      title: '政策变更',
      body: '我们可能适时更新本隐私条款，更新后会在此页面公布。变更重大时，我们会以显著方式提示您。继续使用本服务即视为您接受更新后的条款。',
    },
    {
      title: '联系我们',
      body: '如您对本隐私条款有任何疑问，欢迎通过站点「模型广场」页脚提供的联系邮箱与我们取得联系。',
    },
  ]

  return (
    <section id='privacy' data-reveal className='pt-12'>
      <h2 className='flex items-center gap-2 text-2xl font-semibold tracking-tight'>
        <span className='text-xl'>🔒</span>
        隐私条款
      </h2>
      <p className='text-muted-foreground mt-2 text-sm leading-relaxed'>
        {t('Effective Date:')} {currentYear} 年 1 月 1 日
      </p>
      <div className='mt-6 grid gap-4 sm:grid-cols-2'>
        {items.map((item) => (
          <Card key={item.title} className='bg-background/50 p-5'>
            <h3 className='text-sm font-semibold'>{item.title}</h3>
            <p className='text-muted-foreground mt-1.5 text-[13px] leading-relaxed'>
              {item.body}
            </p>
          </Card>
        ))}
      </div>
    </section>
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
              About
            </span>
            <h1 className='mt-3 text-4xl font-bold tracking-tight sm:text-5xl'>
              {t('About Love Api')}
            </h1>
            <p className='text-muted-foreground mt-3 max-w-2xl leading-relaxed'>
              统一的大模型 API 网关，聚合多家上游供应商，提供稳定、高效、无缝的 API 转发体验。
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

          <PrivacySection />
        </GsapReveal>
      </div>
    </PublicLayout>
  )
}
