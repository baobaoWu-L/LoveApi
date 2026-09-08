import { useState } from 'react'
import { Loader2, Mail } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { loginByEmail, sendEmailVerification } from '@/features/auth/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface EmailCodeLoginProps {
  turnstileToken?: string
  onSuccess: (data: { id?: number } | null) => void
  onError?: (message?: string) => void
}

export function EmailCodeLogin({
  turnstileToken,
  onSuccess,
  onError,
}: EmailCodeLoginProps) {
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(0)

  async function handleSendCode() {
    if (!email) {
      toast.error(t('Please enter your email first'))
      return
    }
    setIsSending(true)
    try {
      const res = await sendEmailVerification(email, turnstileToken, 'login')
      if (res?.success) {
        toast.success(t('Verification email sent'))
        setSecondsLeft(60)
        const timer = setInterval(() => {
          setSecondsLeft((s) => {
            if (s <= 1) {
              clearInterval(timer)
              return 0
            }
            return s - 1
          })
        }, 1000)
      }
    } finally {
      setIsSending(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email || !code) {
      toast.error(t('Please enter your email and verification code'))
      return
    }
    setIsSubmitting(true)
    try {
      const res = await loginByEmail(email, code, turnstileToken)
      if (res?.success) {
        if (res.data && (res.data as { require_2fa?: boolean }).require_2fa) {
          toast.info(t('2FA required'))
          onSuccess(null)
          return
        }
        onSuccess(res.data as { id?: number } | null)
        toast.success(t('Welcome back!'))
      } else {
        toast.error(res?.message || t('Login failed'))
        onError?.(res?.message)
      }
    } catch {
      toast.error(t('Login failed'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className='grid gap-4'>
      <div className='grid gap-2'>
        <Label htmlFor='email-login-email'>{t('Email')}</Label>
        <Input
          id='email-login-email'
          type='email'
          autoComplete='email'
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder='name@example.com'
        />
      </div>

      <div className='grid gap-2'>
        <Label>{t('Verification code')}</Label>
        <div className='flex items-center gap-2'>
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder={t('Verification code')}
            autoComplete='one-time-code'
          />
          <Button
            type='button'
            variant='outline'
            disabled={isSending || secondsLeft > 0 || !email}
            onClick={handleSendCode}
          >
            {isSending ? (
              <Loader2 className='h-4 w-4 animate-spin' />
            ) : secondsLeft > 0 ? (
              `${secondsLeft}s`
            ) : (
              t('Send code')
            )}
          </Button>
        </div>
      </div>

      <Button
        type='submit'
        className='mt-2 w-full justify-center gap-2 rounded-md border-0 bg-neutral-900 text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200'
        disabled={isSubmitting}
      >
        {isSubmitting ? <Loader2 className='animate-spin' /> : <Mail className='h-4 w-4' />}
        {t('Sign in with code')}
      </Button>
    </form>
  )
}
