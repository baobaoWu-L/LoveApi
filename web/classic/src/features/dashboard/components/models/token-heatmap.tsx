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
import { useTranslation } from 'react-i18next'
import dayjs from '@/lib/dayjs'
import { cn } from '@/lib/utils'
import { formatQuotaWithCurrency } from '@/lib/currency'
import { formatTokens } from '@/lib/format'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { QuotaDataItem } from '../../types'

// Timestamps from quota_data can be seconds, milliseconds, numeric strings, or ISO dates.
function toDayjs(value: number | string): dayjs.Dayjs | null {
  if (typeof value === 'number') {
    const sec = value > 1e12 ? Math.floor(value / 1000) : value
    const d = dayjs.unix(sec)
    return d.isValid() ? d : null
  }
  const v = String(value).trim()
  if (/^\d+(\.\d+)?$/.test(v)) {
    const num = Number(v)
    const sec = num > 1e12 ? Math.floor(num / 1000) : num
    const d = dayjs.unix(sec)
    return d.isValid() ? d : null
  }
  const ms = Date.parse(v)
  if (Number.isNaN(ms)) return null
  const d = dayjs.unix(Math.floor(ms / 1000))
  return d.isValid() ? d : null
}

type ModelAgg = { tokens: number; quota: number }
type DayAgg = { tokens: number; quota: number; models: Record<string, ModelAgg> }

function buildDayMap(data: QuotaDataItem[]): Map<string, DayAgg> {
  const map = new Map<string, DayAgg>()
  for (const item of data) {
    if (item.created_at == null) continue
    const d = toDayjs(item.created_at)
    if (!d) continue

    const date = d.format('YYYY-MM-DD')
    const model = item.model_name || 'Unknown'
    const tokens = Math.max(0, Number(item.token_used ?? 0))
    const quota = Math.max(0, Number(item.quota ?? 0))
    const agg = map.get(date) ?? { tokens: 0, quota: 0, models: {} }
    const modelAgg = agg.models[model] ?? { tokens: 0, quota: 0 }
    agg.tokens += tokens
    agg.quota += quota
    modelAgg.tokens += tokens
    modelAgg.quota += quota
    agg.models[model] = modelAgg
    map.set(date, agg)
  }
  return map
}

function usageLevel(value: number, max: number): number {
  if (value <= 0) return 0
  if (max <= 0) return 1
  const ratio = value / max
  if (ratio <= 0.25) return 1
  if (ratio <= 0.5) return 2
  if (ratio <= 0.75) return 3
  return 4
}

interface DayCell {
  date: string
  inYear: boolean
  isFuture: boolean
}

function DayTooltip({
  date,
  agg,
  t,
}: {
  date: string
  agg: DayAgg
  t: (key: string) => string
}) {
  const models = Object.entries(agg.models)
    .filter(([, value]) => value.tokens > 0)
    .sort(([, a], [, b]) => b.tokens - a.tokens)

  return (
    <div className='w-56 space-y-2'>
      <div className='border-border/60 flex items-start justify-between gap-3 border-b pb-1.5'>
        <span className='font-medium'>{date}</span>
        <span className='text-right font-mono tabular-nums'>
          {formatQuotaWithCurrency(agg.quota, {
            digitsLarge: 4,
            digitsSmall: 6,
            abbreviate: false,
          })}
          <span className='text-background/60 block text-[10px]'>
            {formatTokens(agg.tokens)} {t('tokens')}
          </span>
        </span>
      </div>
      {models.length > 0 ? (
        <div className='space-y-1'>
          {models.map(([model, value]) => (
            <div
              key={model}
              className='flex items-center justify-between gap-3 text-[11px]'
            >
              <span className='min-w-0 truncate'>{model}</span>
              <span className='shrink-0 font-mono tabular-nums'>
                {formatQuotaWithCurrency(value.quota, {
                  digitsLarge: 4,
                  digitsSmall: 6,
                  abbreviate: false,
                })}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <span className='text-background/60 text-[11px]'>{t('No usage')}</span>
      )}
    </div>
  )
}

export function TokenHeatmap({ data }: { data: QuotaDataItem[] }) {
  const { t, i18n } = useTranslation()

  const {
    weeks,
    maxTokens,
    totalQuota,
    currentYearLabel,
    monthLabels,
    dayMap,
  } = useMemo(
    () => {
      const dayMap = buildDayMap(data)
      const today = dayjs().startOf('day')
      const yearStart = today.startOf('year')
      const yearEnd = today.endOf('year')
      const gridStart = yearStart.startOf('week')
      const gridEnd = yearEnd.endOf('week')
      const days: DayCell[] = []
      let max = 0
      let totalQuota = 0
      let cursor = gridStart.clone()

      while (cursor.isBefore(gridEnd) || cursor.isSame(gridEnd, 'day')) {
        const date = cursor.format('YYYY-MM-DD')
        const inYear = cursor.isSame(today, 'year')
        const isFuture = cursor.isAfter(today, 'day')
        const agg = dayMap.get(date)
        if (inYear && !isFuture) {
          max = Math.max(max, agg?.tokens ?? 0)
          totalQuota += agg?.quota ?? 0
        }
        days.push({ date, inYear, isFuture })
        cursor = cursor.add(1, 'day')
      }

      const weekColumns: DayCell[][] = []
      for (let i = 0; i < days.length; i += 7) {
        weekColumns.push(days.slice(i, i + 7))
      }

      const monthLabels = Array.from({ length: 12 }, (_, month) => {
        const monthStart = yearStart.month(month)
        return {
          column: Math.floor(monthStart.diff(gridStart, 'day') / 7),
          date: monthStart.toDate(),
        }
      })

      return {
        weeks: weekColumns,
        maxTokens: max,
        totalQuota,
        currentYearLabel: today.format('YYYY'),
        monthLabels,
        dayMap,
      }
    },
    [data]
  )

  const monthFormatter = new Intl.DateTimeFormat(i18n.language, {
    month: 'short',
  })

  const levels = [1, 2, 3, 4]
  const fmtQuota = (quota: number) =>
    formatQuotaWithCurrency(quota, {
      digitsLarge: 4,
      digitsSmall: 6,
      abbreviate: false,
    })

  return (
    <div className='border-border/60 bg-card rounded-lg border p-4'>
      <div className='mb-3 flex items-center justify-between gap-2'>
        <h3 className='text-sm font-semibold'>{t('Token Usage')}</h3>
        <span className='text-muted-foreground text-xs'>
          {currentYearLabel} · {fmtQuota(totalQuota)}
        </span>
      </div>

      <div className='w-full overflow-x-auto'>
        <div className='mx-auto w-max min-w-[790px]'>
          <div className='relative mb-1 ml-8 h-4'>
            {monthLabels.map(({ column, date }) => (
              <span
                key={date.toISOString()}
                className='text-muted-foreground absolute text-[9px]'
                style={{ left: column * 15 }}
              >
                {monthFormatter.format(date)}
              </span>
            ))}
          </div>

          <TooltipProvider delay={100}>
            <div className='flex'>
              <div className='text-muted-foreground mr-1 grid w-7 shrink-0 grid-rows-7 gap-[3px] text-[9px]'>
                <span />
                <span className='leading-3'>{t('Mon')}</span>
                <span />
                <span className='leading-3'>{t('Wed')}</span>
                <span />
                <span className='leading-3'>{t('Fri')}</span>
                <span />
              </div>

              <div className='flex' style={{ gap: 3 }}>
                {weeks.map((col, ci) => (
                  <div key={ci} className='flex flex-col' style={{ gap: 3 }}>
                    {col.map((cell) => {
                      const agg = dayMap.get(cell.date)
                      const active = cell.inYear && !cell.isFuture
                      const tokens = active ? agg?.tokens ?? 0 : 0
                      const level = usageLevel(tokens, maxTokens)
                      const cellClass = cn(
                        'size-3 shrink-0 rounded-[2px] transition-colors',
                        !cell.inYear && 'bg-transparent',
                        cell.inYear &&
                          'border-border/40 border bg-rose-100/70 dark:bg-rose-950/40',
                        cell.inYear &&
                          cell.isFuture &&
                          'bg-rose-50/60 dark:bg-rose-950/20',
                        active &&
                          level === 0 &&
                          'bg-rose-100/70 dark:bg-rose-950/40',
                        active && level === 1 && 'bg-rose-200 dark:bg-rose-900',
                        active && level === 2 && 'bg-rose-300 dark:bg-rose-700',
                        active && level === 3 && 'bg-rose-400 dark:bg-rose-500',
                        active && level === 4 && 'bg-rose-500 dark:bg-rose-400'
                      )

                      if (!active || !agg || agg.tokens <= 0) {
                        return <div key={cell.date} className={cellClass} />
                      }

                      return (
                        <Tooltip key={cell.date}>
                          <TooltipTrigger
                            render={
                              <div
                                role='gridcell'
                                tabIndex={0}
                                aria-label={`${cell.date}: ${formatTokens(agg.tokens)} ${t('tokens')}`}
                                className={cellClass}
                              />
                            }
                          />
                          <TooltipContent side='top' align='center'>
                            <DayTooltip date={cell.date} agg={agg} t={t} />
                          </TooltipContent>
                        </Tooltip>
                      )
                    })}
                  </div>
                ))}
              </div>
            </div>
          </TooltipProvider>
        </div>
      </div>

      <div className='mt-3 flex flex-wrap items-center justify-between gap-2'>
        <span className='text-muted-foreground text-xs'>
          {t('Darker squares mean more tokens used')}
        </span>
        <div className='flex items-center gap-1 text-[10px]'>
          <span className='text-muted-foreground'>{t('Less')}</span>
          {levels.map((lv) => (
            <div
              key={lv}
              className={cn(
                'size-3 rounded-[2px]',
                lv === 1 && 'bg-rose-200 dark:bg-rose-900',
                lv === 2 && 'bg-rose-300 dark:bg-rose-700',
                lv === 3 && 'bg-rose-400 dark:bg-rose-500',
                lv === 4 && 'bg-rose-500 dark:bg-rose-400'
              )}
            />
          ))}
          <span className='text-muted-foreground'>{t('More')}</span>
        </div>
      </div>
    </div>
  )
}
