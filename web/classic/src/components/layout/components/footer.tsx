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
import { useMemo } from 'react'
import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { DEFAULT_LOGO } from '@/lib/constants'
import { useSystemConfig } from '@/hooks/use-system-config'

interface FooterLink {
  text: string
  href: string
}

interface FooterColumnProps {
  title: string
  links: FooterLink[]
}

interface FooterProps {
  logo?: string
  name?: string
  columns?: FooterColumnProps[]
  copyright?: string
  className?: string
}

function FooterLinkItem(props: { link: FooterLink }) {
  const { t } = useTranslation()
  const isExternal = props.link.href.startsWith('http')
  const label = t(props.link.text)

  if (isExternal) {
    return (
      <a
        href={props.link.href}
        target='_blank'
        rel='noopener noreferrer'
        className='text-muted-foreground/50 hover:text-foreground text-sm transition-colors duration-200'
      >
        {label}
      </a>
    )
  }

  return (
    <Link
      to={props.link.href}
      className='text-muted-foreground/50 hover:text-foreground text-sm transition-colors duration-200'
    >
      {label}
    </Link>
  )
}

export function Footer(props: FooterProps) {
  const { t } = useTranslation()
  const {
    systemName,
    logo: systemLogo,
    footerHtml,
    demoSiteEnabled,
  } = useSystemConfig()

  const displayLogo = systemLogo || props.logo || DEFAULT_LOGO
  const displayName = systemName || props.name || 'LovebreakerApi'
  const isDemoSiteMode = Boolean(demoSiteEnabled)
  const currentYear = new Date().getFullYear()

  const fallbackColumns = useMemo<FooterColumnProps[]>(
    () => [
      {
        title: t('footer.columns.about.title'),
        links: [
          {
            text: t('footer.columns.about.links.aboutProject'),
            href: '/about',
          },
          {
            text: t('footer.columns.about.links.contact'),
            href: '/about',
          },
        ],
      },
      {
        title: t('footer.columns.docs.title'),
        links: [
          {
            text: t('footer.columns.docs.links.quickStart'),
            href: '/about',
          },
        ],
      },
    ],
    [t]
  )

  const displayColumns = props.columns ?? fallbackColumns

  if (footerHtml) {
    return (
      <footer
        className={cn(
          'border-border/30 relative z-10 border-t',
          props.className
        )}
      >
        <div className='mx-auto w-full max-w-6xl px-6 py-5'>
          <div className='flex flex-col items-center justify-between gap-4 border border-foreground/10 px-4 py-4 sm:flex-row sm:px-5'>
            <div
              className='custom-footer text-muted-foreground/60 min-w-0 text-center text-sm sm:text-left'
              dangerouslySetInnerHTML={{ __html: footerHtml }}
            />
          </div>
        </div>
      </footer>
    )
  }

  return (
    <footer
      className={cn('border-border/30 relative z-10 border-t', props.className)}
    >
      <div className='mx-auto max-w-6xl px-6 py-10 md:py-14'>
        <div className='flex flex-col justify-between gap-8 md:flex-row md:items-start'>
          {/* Brand column */}
          <div className='shrink-0'>
            <Link to='/' className='group inline-flex items-center gap-2.5'>
              <img
                src={displayLogo}
                alt={displayName}
                className='size-6 rounded object-contain'
              />
              <span className='text-sm font-semibold tracking-tight'>
                {displayName}
              </span>
            </Link>
            <p className='text-muted-foreground/40 mt-2 max-w-[200px] text-xs leading-relaxed'>
              {t('Powerful API Management Platform')}
            </p>
          </div>

          {/* Links */}
          {isDemoSiteMode && (
            <div className='flex gap-10 md:gap-16'>
              {displayColumns.map((column, index) => (
                <div key={index}>
                  <p className='text-muted-foreground/40 mb-3 text-[11px] font-medium tracking-widest uppercase'>
                    {t(column.title)}
                  </p>
                  <ul className='space-y-2'>
                    {column.links.map((link, linkIndex) => (
                      <li key={linkIndex}>
                        <FooterLinkItem link={link} />
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Bottom section */}
        <div className='border-border/20 mt-10 flex flex-col items-center justify-between gap-2 border-t pt-5 sm:flex-row'>
          <p className='text-muted-foreground/35 text-xs'>
            &copy; {currentYear} {displayName}.{' '}
            {props.copyright ?? t('footer.defaultCopyright')}
          </p>
          <a
            href='mailto:LoveBreakerApi@outlook.com'
            className='text-muted-foreground/45 hover:text-foreground text-xs transition-colors'
          >
            {t('Contact administrator')}: LoveBreakerApi@outlook.com
          </a>
        </div>
      </div>
    </footer>
  )
}
