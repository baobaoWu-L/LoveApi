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
import {
  Zap,
  Shield,
  Globe,
  Code,
  Gauge,
  DollarSign,
  Users,
  HeartHandshake,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { AnimateInView } from '@/components/animate-in-view'

interface FeaturesProps {
  className?: string
}

export function Features(_props: FeaturesProps) {
  const { t } = useTranslation()

  const features = [
    {
      id: 'fast',
      title: t('Lightning Fast'),
      desc: t(
        'Optimized network architecture ensures millisecond response times'
      ),
      icon: <Zap className='size-5' strokeWidth={1.5} />,
    },
    {
      id: 'secure',
      title: t('Secure & Reliable'),
      desc: t(
        'Enterprise-grade security with comprehensive permission management'
      ),
      icon: <Shield className='size-5' strokeWidth={1.5} />,
    },
    {
      id: 'global',
      title: t('Global Coverage'),
      desc: t('Multi-region deployment for stable global access'),
      icon: <Globe className='size-5' strokeWidth={1.5} />,
    },
    {
      id: 'developer',
      title: t('Developer Friendly'),
      desc: t('Compatible API routes for common AI application workflows'),
      icon: <Code className='size-5' strokeWidth={1.5} />,
    },
    {
      id: 'performance',
      title: t('High Performance'),
      desc: t('Support for high concurrency with automatic load balancing'),
      icon: <Gauge className='size-5' strokeWidth={1.5} />,
    },
    {
      id: 'billing',
      title: t('Transparent Billing'),
      desc: t('Pay-as-you-go with real-time usage monitoring'),
      icon: <DollarSign className='size-5' strokeWidth={1.5} />,
    },
    {
      id: 'team',
      title: t('Team Collaboration'),
      desc: t('Multi-user management with flexible permission allocation'),
      icon: <Users className='size-5' strokeWidth={1.5} />,
    },
    {
      id: 'opensource',
      title: t('Open Source'),
      desc: t('Community driven, self-hosted, and extensible'),
      icon: <HeartHandshake className='size-5' strokeWidth={1.5} />,
    },
  ]

  return (
    <section className='relative z-10 px-6 py-24 md:py-32'>
      <div className='mx-auto max-w-6xl'>
        <AnimateInView className='mb-16 max-w-lg'>
          <p className='text-muted-foreground/50 mb-4 text-[11px] font-medium tracking-[0.2em] uppercase'>
            {t('Core Features')}
          </p>
          <h2 className='text-3xl leading-tight font-bold tracking-tight md:text-4xl'>
            {t('Built for developers,')}
            <br />
            <span className='text-foreground/60 font-light'>
              {t('designed for scale')}
            </span>
          </h2>
        </AnimateInView>

        {/* Minimal grid */}
        <div className='grid gap-px overflow-hidden md:grid-cols-4'>
          {features.map((f, i) => (
            <AnimateInView
              key={f.id}
              delay={i * 60}
              animation='fade-up'
              className='group border-border/30 border-b md:border-r md:[&:nth-child(4n)]:border-r-0 md:[&:nth-last-child(-n+4)]:border-b-0 [&:last-child]:border-b-0'
            >
              <div className='p-6 transition-colors duration-300 md:p-8'>
                <div className='text-muted-foreground group-hover:text-foreground mb-4 flex size-10 items-center justify-center rounded-sm border border-foreground/10 transition-colors duration-300'>
                  {f.icon}
                </div>
                <h3 className='mb-2 text-sm font-semibold'>{f.title}</h3>
                <p className='text-muted-foreground/60 text-sm leading-relaxed'>
                  {f.desc}
                </p>
              </div>
            </AnimateInView>
          ))}
        </div>
      </div>
    </section>
  )
}
