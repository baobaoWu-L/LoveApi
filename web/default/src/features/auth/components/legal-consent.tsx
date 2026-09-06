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
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import type { SystemStatus } from '../types'

interface LegalConsentProps {
  status: SystemStatus | null
  checked?: boolean
  onCheckedChange?: (nextValue: boolean) => void
  agreementChecked?: boolean
  privacyChecked?: boolean
  onAgreementChange?: (nextValue: boolean) => void
  onPrivacyChange?: (nextValue: boolean) => void
  className?: string
}

export function LegalConsent({
  status,
  checked,
  onCheckedChange,
  agreementChecked,
  privacyChecked,
  onAgreementChange,
  onPrivacyChange,
  className,
}: LegalConsentProps) {
  const { t } = useTranslation()
  const hasUserAgreement = Boolean(status?.user_agreement_enabled)
  const hasPrivacyPolicy = Boolean(status?.privacy_policy_enabled)

  if (!hasUserAgreement && !hasPrivacyPolicy) {
    return null
  }

  const isSeparate =
    agreementChecked !== undefined &&
    privacyChecked !== undefined &&
    onAgreementChange &&
    onPrivacyChange

  if (isSeparate) {
    return (
      <div className={cn('border-border/60 bg-muted/40 space-y-3 rounded-md border p-3', className)}>
        {hasUserAgreement && (
          <div className='flex items-start gap-3'>
            <Checkbox
              id='legal-user-agreement'
              checked={agreementChecked}
              onCheckedChange={(value) => onAgreementChange(value === true)}
              className='mt-0.5'
            />
            <Label htmlFor='legal-user-agreement' className='text-muted-foreground text-left text-xs leading-5 font-normal'>
              {t('I have read and agree to the')}{' '}
              <a href='/user-agreement' target='_blank' rel='noopener noreferrer' className='text-foreground/70 hover:text-foreground underline'>
                {t('User Agreement')}
              </a>
            </Label>
          </div>
        )}
        {hasPrivacyPolicy && (
          <div className='flex items-start gap-3'>
            <Checkbox
              id='legal-privacy-policy'
              checked={privacyChecked}
              onCheckedChange={(value) => onPrivacyChange(value === true)}
              className='mt-0.5'
            />
            <Label htmlFor='legal-privacy-policy' className='text-muted-foreground text-left text-xs leading-5 font-normal'>
              {t('I have read and agree to the')}{' '}
              <a href='/privacy-policy' target='_blank' rel='noopener noreferrer' className='text-foreground/70 hover:text-foreground underline'>
                {t('Privacy Policy')}
              </a>
            </Label>
          </div>
        )}
      </div>
    )
  }

  const handleChange = (value: boolean) => {
    onCheckedChange?.(value === true)
  }

  return (
    <div
      className={cn(
        'border-border/60 bg-muted/40 flex items-start gap-3 rounded-md border p-3',
        className
      )}
    >
      <Checkbox
        id='legal-consent'
        checked={checked}
        onCheckedChange={handleChange}
        className='mt-0.5'
      />
      <Label
        htmlFor='legal-consent'
        className='text-muted-foreground items-start gap-1 text-left text-xs leading-5 font-normal'
      >
        <span>
          {t('I have read and agree to the')}{' '}
          {hasUserAgreement && (
            <a
              href='/user-agreement'
              target='_blank'
              rel='noopener noreferrer'
              className='text-foreground/70 hover:text-foreground underline'
            >
              {t('User Agreement')}
            </a>
          )}
          {hasUserAgreement && hasPrivacyPolicy && ' and the '}
          {hasPrivacyPolicy && (
            <a
              href='/privacy-policy'
              target='_blank'
              rel='noopener noreferrer'
              className='text-foreground/70 hover:text-foreground underline'
            >
              {t('Privacy Policy')}
            </a>
          )}
          .
        </span>
      </Label>
    </div>
  )
}
