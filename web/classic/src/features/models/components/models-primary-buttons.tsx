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
  Plus,
  MoreHorizontal,
  RefreshCw,
  List,
  Building2,
  AlertCircle,
  ArrowLeftRight,
  Loader2,
} from 'lucide-react'
import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { syncFromPricing } from '../api'
import { useModels } from './models-provider'

export function ModelsPrimaryButtons() {
  const { t } = useTranslation()
  const { setOpen, setCurrentRow } = useModels()
  const queryClient = useQueryClient()
  const [syncingPricing, setSyncingPricing] = useState(false)

  const handleCreateModel = () => {
    setCurrentRow(null)
    setOpen('create-model')
  }

  const handleMissingModels = () => {
    setOpen('missing-models')
  }

  const handleSync = () => {
    setOpen('sync-wizard')
  }

  const handleSyncFromPricing = async () => {
    setSyncingPricing(true)
    try {
      const res = await syncFromPricing()
      if (res.success) {
        const added = res.data?.added ?? 0
        if (added > 0) {
          toast.success(t('Synced {{count}} models from pricing', { count: added }))
          queryClient?.invalidateQueries({ queryKey: ['models'] })
        } else {
          toast.info(t('All pricing models already exist in metadata'))
        }
      } else {
        toast.error(res.message || t('Sync failed'))
      }
    } catch {
      toast.error(t('Sync failed'))
    } finally {
      setSyncingPricing(false)
    }
  }

  const handlePrefillGroups = () => {
    setOpen('prefill-groups')
  }

  const handleManageVendors = () => {
    setOpen('create-vendor') // Will be a separate vendors management dialog
  }

  return (
    <div className='flex items-center gap-2'>
      {/* Create Model */}
      <Button onClick={handleCreateModel} size='sm'>
        <Plus className='h-4 w-4' />
        {t('Add Model')}
      </Button>

      {/* More Actions */}
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant='outline' size='sm' />}>
          <MoreHorizontal className='h-4 w-4' />
        </DropdownMenuTrigger>
        <DropdownMenuContent align='end' className='w-56'>
          <DropdownMenuItem onClick={handleMissingModels}>
            {t('Missing Models')}
            <DropdownMenuShortcut>
              <AlertCircle className='h-4 w-4' />
            </DropdownMenuShortcut>
          </DropdownMenuItem>

          <DropdownMenuItem onClick={handleSync}>
            {t('Sync Upstream')}
            <DropdownMenuShortcut>
              <RefreshCw className='h-4 w-4' />
            </DropdownMenuShortcut>
          </DropdownMenuItem>

          <DropdownMenuItem onClick={handleSyncFromPricing} disabled={syncingPricing}>
            {syncingPricing ? t('Syncing...') : t('Sync from Pricing')}
            <DropdownMenuShortcut>
              {syncingPricing ? (
                <Loader2 className='h-4 w-4 animate-spin' />
              ) : (
                <ArrowLeftRight className='h-4 w-4' />
              )}
            </DropdownMenuShortcut>
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem onClick={handlePrefillGroups}>
            {t('Prefill Groups')}
            <DropdownMenuShortcut>
              <List className='h-4 w-4' />
            </DropdownMenuShortcut>
          </DropdownMenuItem>

          <DropdownMenuItem onClick={handleManageVendors}>
            {t('Manage Vendors')}
            <DropdownMenuShortcut>
              <Building2 className='h-4 w-4' />
            </DropdownMenuShortcut>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
