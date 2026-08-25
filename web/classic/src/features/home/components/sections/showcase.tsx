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
import { useCallback, useEffect, useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import {
  motion,
  useScroll,
  useTransform,
  useReducedMotion,
} from 'motion/react'
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  useCarousel,
  type CarouselApi,
} from '@/components/ui/carousel'
import { AnimateInView } from '@/components/animate-in-view'

const slides = [
  {
    id: 'unified',
    titleKey: 'Unified API Gateway',
    descKey:
      'A single endpoint for 50+ AI providers — OpenAI, Claude, Gemini, and more. No more juggling multiple SDKs.',
    metric: '50+',
    metricLabelKey: 'AI Providers',
    tags: ['OpenAI', 'Claude', 'Gemini', 'DeepSeek', 'Qwen'],
  },
  {
    id: 'billing',
    titleKey: 'Smart Billing Engine',
    descKey:
      'Real-time usage tracking, tiered pricing, and automated cost allocation across teams and projects.',
    metric: '99.9%',
    metricLabelKey: 'Billing Accuracy',
    tags: ['Real-time', 'Tiered', 'Multi-currency', 'Invoicing'],
  },
  {
    id: 'security',
    titleKey: 'Enterprise Security',
    descKey:
      'Role-based access control, audit logging, and end-to-end encryption for all your API traffic.',
    metric: 'SOC2',
    metricLabelKey: 'Compliant',
    tags: ['RBAC', 'Audit Log', 'Encryption', 'SSO'],
  },
  {
    id: 'scale',
    titleKey: 'Auto Scaling',
    descKey:
      'Elastic infrastructure that grows with your traffic. Load balancing, rate limiting, and failover built in.',
    metric: '100K+',
    metricLabelKey: 'RPS Supported',
    tags: ['Load Balance', 'Rate Limit', 'Failover', 'Global'],
  },
]

function ShowcaseSlide({
  slide,
  index,
}: {
  slide: (typeof slides)[0]
  index: number
}) {
  const { t } = useTranslation()

  return (
    <CarouselItem className='md:basis-1/2 lg:basis-1/3'>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-50px' }}
        transition={{
          duration: 0.5,
          delay: index * 0.1,
          ease: [0.16, 1, 0.3, 1],
        }}
        className='group relative h-full'
      >
        <div className='border-border/30 hover:border-foreground/30 bg-background hover:bg-foreground/[0.02] flex h-full flex-col rounded-none border p-6 transition-all duration-500 md:p-8'>
          {/* Metric badge */}
          <div className='mb-5'>
            <span className='text-foreground text-4xl font-light tracking-tight md:text-5xl'>
              {slide.metric}
            </span>
            <span className='text-muted-foreground/50 ml-2 text-[10px] font-medium uppercase tracking-widest'>
              {t(slide.metricLabelKey)}
            </span>
          </div>

          <h3 className='mb-3 text-base font-semibold tracking-tight md:text-lg'>
            {t(slide.titleKey)}
          </h3>
          <p className='text-muted-foreground/60 mb-6 text-sm leading-relaxed'>
            {t(slide.descKey)}
          </p>

          {/* Tags */}
          <div className='mt-auto flex flex-wrap gap-1.5'>
            {slide.tags.map((tag) => (
              <span
                key={tag}
                className='border-border/30 text-muted-foreground rounded-sm border px-2.5 py-1 text-[10px] font-medium tracking-wide uppercase'
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </motion.div>
    </CarouselItem>
  )
}

function CarouselDots({ count }: { count: number }) {
  const { api } = useCarousel()
  const [selected, setSelected] = useState(0)

  useEffect(() => {
    if (!api) return
    setSelected(api.selectedScrollSnap())
    api.on('select', () => setSelected(api.selectedScrollSnap()))
    return () => {
      api?.off('select', () => setSelected(api.selectedScrollSnap()))
    }
  }, [api])

  return (
    <div className='mt-10 flex items-center justify-center gap-3'>
      {Array.from({ length: count }).map((_, i) => (
        <button
          key={i}
          type='button'
          aria-label={`Go to slide ${i + 1}`}
          className={`h-1 rounded-full transition-all duration-500 ${
            i === selected
              ? 'bg-foreground w-10'
              : 'bg-foreground/20 hover:bg-foreground/40 w-3'
          }`}
          onClick={() => api?.scrollTo(i)}
        />
      ))}
    </div>
  )
}

export function Showcase() {
  const { t } = useTranslation()
  const sectionRef = useRef<HTMLDivElement>(null)
  const prefersReducedMotion = useReducedMotion()
  const [carouselApi, setCarouselApi] = useState<CarouselApi | null>(null)

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start end', 'end start'],
  })

  const opacity = useTransform(scrollYProgress, [0, 0.2, 0.8, 1], [0, 1, 1, 0])
  const y = useTransform(scrollYProgress, [0, 0.2, 0.8, 1], [40, 0, 0, -40])

  // Manual autoplay when carousel API is ready
  useEffect(() => {
    if (!carouselApi || prefersReducedMotion) return

    const interval = setInterval(() => {
      carouselApi.scrollNext()
    }, 4000)

    const handleInteraction = () => {
      clearInterval(interval)
    }

    carouselApi.on('pointerDown', handleInteraction)

    return () => {
      clearInterval(interval)
      carouselApi.off('pointerDown', handleInteraction)
    }
  }, [carouselApi, prefersReducedMotion])

  return (
    <motion.section
      ref={sectionRef}
      style={prefersReducedMotion ? {} : { opacity, y }}
      className='relative z-10 overflow-hidden px-6 py-24 md:py-32'
    >
      <div className='mx-auto max-w-6xl'>
        <AnimateInView className='mb-16 max-w-lg'>
          <p className='text-muted-foreground/50 mb-4 text-[11px] font-medium tracking-[0.2em] uppercase'>
            {t('Platform Overview')}
          </p>
          <h2 className='text-3xl leading-tight font-bold tracking-tight md:text-4xl'>
            {t('Everything you need,')}
            <br />
            <span className='text-foreground/60 font-light'>
              {t('nothing you dont')}
            </span>
          </h2>
        </AnimateInView>

        <Carousel
          opts={{
            align: 'start',
            loop: true,
            skipSnaps: false,
          }}
          setApi={setCarouselApi}
          className='-mx-1'
        >
          <CarouselContent className='-ml-4'>
            {slides.map((slide, i) => (
              <ShowcaseSlide key={slide.id} slide={slide} index={i} />
            ))}
          </CarouselContent>

          <CarouselDots count={slides.length} />
        </Carousel>
      </div>
    </motion.section>
  )
}
