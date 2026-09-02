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
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Download,
  Maximize2,
  Image as ImageIcon,
  HardDrive,
} from 'lucide-react'
import { formatBillingCurrencyFromUSD } from '@/lib/currency'
import { formatLogQuota, formatTokens } from '@/lib/format'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import type { UsageLog } from '../data/schema'
import { parseLogOther, getImageBilling } from '../lib/format'
import type { LogOtherData } from '../types'
import { ImageDialog } from './dialogs/image-dialog'

// 与详情弹窗一致：图片经本地下载代理拉回，带 New-Api-User 头 + cookie，
// 避免上游一次性签名/防盗链链接在 <img> 中加载 403。
function imageProxyUrl(url: string): string {
  return `/api/image/download?url=${encodeURIComponent(url)}`
}

function currentUid(): string {
  return typeof window !== 'undefined' ? window.localStorage.getItem('uid') || '' : ''
}

async function fetchImageAsDataUrl(url: string): Promise<string> {
  if (!url) return ''
  if (url.startsWith('data:')) return url
  try {
    const res = await fetch(imageProxyUrl(url), {
      credentials: 'include',
      headers: { 'New-Api-User': currentUid() },
    })
    if (!res.ok) return ''
    const blob = await res.blob()
    return await new Promise<string>((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => resolve('')
      reader.readAsDataURL(blob)
    })
  } catch {
    return ''
  }
}

async function downloadGeneratedImage(url: string): Promise<boolean> {
  if (!url) return false
  if (url.startsWith('data:')) {
    const a = document.createElement('a')
    a.href = url
    a.download = 'generated-image.png'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    return true
  }
  try {
    const res = await fetch(imageProxyUrl(url), {
      credentials: 'include',
      headers: { 'New-Api-User': currentUid() },
    })
    if (!res.ok) throw new Error('download failed')
    const blob = await res.blob()
    const obj = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = obj
    a.download = 'generated-image.png'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.setTimeout(() => URL.revokeObjectURL(obj), 1000)
    return true
  } catch {
    window.open(url, '_blank', 'noopener')
    return false
  }
}

function InlineRow(props: {
  label: string
  value: React.ReactNode
  mono?: boolean
}) {
  return (
    <div className='grid min-w-0 grid-cols-[6rem_minmax(0,1fr)] gap-2 text-xs sm:grid-cols-[7rem_minmax(0,1fr)]'>
      <span className='text-muted-foreground min-w-0'>{props.label}</span>
      <span
        className={cn(
          'max-w-full min-w-0 break-all',
          props.mono && 'font-mono'
        )}
      >
        {props.value}
      </span>
    </div>
  )
}

// 行内展开详情：只展示「咱们平台」的数据，隐藏上游相关信息
// （不显示 计费来源/上游请求ID/渠道/重试链路）。
export function InlineLogDetails({ log }: { log: UsageLog }) {
  const { t } = useTranslation()
  const other = parseLogOther(log.other)
  const imageBilling = getImageBilling(other)
  const generatedUrl = imageBilling.resolvedUrl
  const [imageDataUrl, setImageDataUrl] = useState('')
  const [previewOpen, setPreviewOpen] = useState(false)
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    if (!generatedUrl) {
      setImageDataUrl('')
      return
    }
    let cancelled = false
    void fetchImageAsDataUrl(generatedUrl).then((dataUrl) => {
      if (!cancelled) setImageDataUrl(dataUrl)
    })
    return () => {
      cancelled = true
    }
  }, [generatedUrl])

  const priceOpts = { digitsLarge: 4, digitsSmall: 6, abbreviate: false }
  const fmtPrice = (usd: number) => formatBillingCurrencyFromUSD(usd, priceOpts)

  const effectiveGroupRatio =
    other?.user_group_ratio != null && other.user_group_ratio !== -1
      ? other.user_group_ratio
      : other?.group_ratio

  const shownOther: LogOtherData | null = other
  const isPerCall = shownOther?.model_price != null
  const promptTokens = log.prompt_tokens || 0
  const completionTokens = log.completion_tokens || 0
  const cacheRead = shownOther?.cache_tokens || 0
  const hasTokens =
    promptTokens > 0 || completionTokens > 0 || cacheRead > 0

  return (
    <div className='w-full min-w-0 space-y-3 px-4 py-3'>
      <div className='min-w-0 space-y-1'>
        {log.request_id && (
          <InlineRow label={t('Request ID')} value={log.request_id} mono />
        )}
        <InlineRow
          label={t('Execution Mode')}
          value={log.is_stream ? t('Streaming') : t('Synchronous')}
        />
        <InlineRow label={t('Usage')} value='API' />
        {log.token_name && (
          <InlineRow label={t('Token')} value={log.token_name} mono />
        )}
        {(log.group || shownOther?.group) && (
          <InlineRow
            label={t('Group')}
            value={log.group || shownOther?.group || ''}
            mono
          />
        )}
      </div>

      {(isPerCall || effectiveGroupRatio != null) && (
        <div className='min-w-0 space-y-1.5'>
          <Label className='text-xs font-semibold'>{t('Billing Details')}</Label>
          <div className='bg-muted/30 min-w-0 space-y-1 overflow-hidden rounded-md border p-2.5'>
            {isPerCall && shownOther?.model_price != null && (
              <InlineRow
                label={t('Model Price')}
                value={fmtPrice(shownOther.model_price)}
                mono
              />
            )}
            {effectiveGroupRatio != null && (
              <InlineRow
                label={t('Group Ratio')}
                value={`${effectiveGroupRatio}x`}
                mono
              />
            )}
            <InlineRow
              label={t('Total Cost')}
              value={formatLogQuota(log.quota)}
              mono
            />
          </div>
        </div>
      )}

      {hasTokens && (
        <div className='min-w-0 space-y-1.5'>
          <Label className='text-xs font-semibold'>{t('Token Breakdown')}</Label>
          <div className='bg-muted/30 min-w-0 space-y-1 overflow-hidden rounded-md border p-2.5'>
            {promptTokens > 0 && (
              <InlineRow
                label={t('Input Tokens')}
                value={promptTokens.toLocaleString()}
                mono
              />
            )}
            {completionTokens > 0 && (
              <InlineRow
                label={t('Output Tokens')}
                value={completionTokens.toLocaleString()}
                mono
              />
            )}
            {cacheRead > 0 && (
              <InlineRow
                label={t('Cache Read')}
                value={formatTokens(cacheRead)}
                mono
              />
            )}
            {shownOther?.image && shownOther?.image_output != null && (
              <InlineRow
                label={t('Image Tokens')}
                value={formatTokens(shownOther.image_output)}
                mono
              />
            )}
          </div>
        </div>
      )}

      {imageBilling.hasBilling && (
        <div className='min-w-0 space-y-1.5'>
          <Label className='flex items-center gap-1.5 text-xs font-semibold'>
            <ImageIcon className='size-3.5' aria-hidden='true' />
            {t('Image Generation Details')}
          </Label>
          <div className='bg-muted/30 min-w-0 space-y-1 overflow-hidden rounded-md border p-2.5'>
            {imageBilling.tier && (
              <InlineRow
                label={t('Resolution Tier')}
                value={imageBilling.tier.toUpperCase()}
                mono
              />
            )}
            {imageBilling.multiplier != null && (
              <InlineRow
                label={t('Resolution Multiplier')}
                value={`${imageBilling.multiplier}x`}
                mono
              />
            )}
            {imageBilling.count != null && (
              <InlineRow
                label={t('Image Count')}
                value={String(imageBilling.count)}
                mono
              />
            )}
            {imageBilling.unitPrice != null && (
              <InlineRow
                label={t('Per-image Price')}
                value={fmtPrice(imageBilling.unitPrice)}
                mono
              />
            )}
            {imageBilling.actualPriceUsd != null && (
              <InlineRow
                label={t('Actual Cost')}
                value={`${fmtPrice(imageBilling.actualPriceUsd)}（${t('Reference only')}）`}
                mono
              />
            )}
          </div>
        </div>
      )}

      {generatedUrl && (
        <div className='min-w-0 space-y-1.5'>
          <Label className='flex items-center gap-1.5 text-xs font-semibold'>
            <HardDrive className='size-3.5' aria-hidden='true' />
            {t('Generated Image')}
          </Label>
          <div className='bg-muted/30 min-w-0 space-y-2 overflow-hidden rounded-md border p-2.5'>
            <div className='bg-muted/40 relative flex max-h-48 items-center justify-center overflow-hidden rounded-md border'>
              <img
                src={imageDataUrl || imageProxyUrl(generatedUrl)}
                alt={t('Generated Image')}
                className='max-h-48 w-full object-contain'
                loading='lazy'
              />
            </div>
            <InlineRow
              label={t('Generated Image Link')}
              value={generatedUrl}
              mono
            />
            <div className='flex flex-wrap gap-2'>
              <Button
                variant='outline'
                size='sm'
                onClick={() => setPreviewOpen(true)}
              >
                <Maximize2 className='size-3.5' />
                {t('Preview')}
              </Button>
              <Button
                variant='outline'
                size='sm'
                disabled={downloading}
                onClick={() => {
                  setDownloading(true)
                  void downloadGeneratedImage(
                    imageDataUrl || generatedUrl
                  ).finally(() => setDownloading(false))
                }}
              >
                <Download className='size-3.5' />
                {t('Download')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {log.content && (
        <div className='min-w-0 space-y-1.5'>
          <Label className='text-xs font-semibold'>{t('Content')}</Label>
          <div className='bg-muted/30 min-w-0 rounded-md border p-2.5'>
            <p className='min-w-0 text-xs leading-relaxed break-all whitespace-pre-wrap'>
              {log.content}
            </p>
          </div>
        </div>
      )}

      <ImageDialog
        imageUrl={imageDataUrl || imageProxyUrl(generatedUrl)}
        open={previewOpen}
        onOpenChange={setPreviewOpen}
      />
    </div>
  )
}
