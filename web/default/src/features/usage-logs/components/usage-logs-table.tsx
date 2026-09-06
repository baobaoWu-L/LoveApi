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
import { Fragment, useEffect, useState, type MouseEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { useMediaQuery } from '@/hooks'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useIsAdmin } from '@/hooks/use-admin'
import { useTableUrlState } from '@/hooks/use-table-url-state'
import { TableCell, TableRow } from '@/components/ui/table'
import { DataTablePage } from '@/components/data-table'
import { DEFAULT_LOGS_DATA, LOG_TYPE_ENUM } from '../constants'
import { useColumnsByCategory } from '../lib/columns'
import { fetchLogsByCategory } from '../lib/utils'
import type { LogCategory } from '../types'
import type { UsageLog } from '../data/schema'
import type { TaskLog } from '../types'
import { CommonLogsFilterBar } from './common-logs-filter-bar'
import { TaskLogsFilterBar } from './task-logs-filter-bar'
import { InlineLogDetails, InlineTaskDetails } from './dialogs/details-dialog'

const route = getRouteApi('/_authenticated/usage-logs/$section')

const logTypeRowTint: Record<number, string> = {
  [LOG_TYPE_ENUM.ERROR]: 'bg-rose-50/40 dark:bg-rose-950/20',
  [LOG_TYPE_ENUM.REFUND]: 'bg-blue-50/30 dark:bg-blue-950/15',
}

interface UsageLogsTableProps {
  logCategory: LogCategory
}

export function UsageLogsTable({ logCategory }: UsageLogsTableProps) {
  const { t } = useTranslation()
  const isAdmin = useIsAdmin()
  const isMobile = useMediaQuery('(max-width: 640px)')
  const searchParams = route.useSearch()

  const {
    columnFilters,
    onColumnFiltersChange,
    pagination,
    onPaginationChange,
    ensurePageInRange,
  } = useTableUrlState({
    search: route.useSearch(),
    navigate: route.useNavigate(),
    pagination: { defaultPage: 1, defaultPageSize: isMobile ? 20 : 100 },
    globalFilter: { enabled: false },
    columnFilters: [
      { columnId: 'created_at', searchKey: 'type', type: 'array' as const },
      { columnId: 'model_name', searchKey: 'model', type: 'string' as const },
      { columnId: 'token_name', searchKey: 'token', type: 'string' as const },
      { columnId: 'group', searchKey: 'group', type: 'string' as const },
      ...(isAdmin
        ? [
            {
              columnId: 'channel',
              searchKey: 'channel',
              type: 'string' as const,
            },
            {
              columnId: 'username',
              searchKey: 'username',
              type: 'string' as const,
            },
          ]
        : []),
    ],
  })

  const { data, isLoading, isFetching } = useQuery({
    queryKey: [
      'logs',
      logCategory,
      isAdmin,
      pagination.pageIndex + 1,
      pagination.pageSize,
      columnFilters,
      searchParams,
      t,
    ],
    queryFn: async () => {
      const result = await fetchLogsByCategory({
        logCategory,
        isAdmin,
        page: pagination.pageIndex + 1,
        pageSize: pagination.pageSize,
        searchParams,
        columnFilters,
      })

      if (!result?.success) {
        toast.error(result?.message || t('Failed to load logs'))
        return DEFAULT_LOGS_DATA
      }

      return result.data || DEFAULT_LOGS_DATA
    },
    placeholderData: (previousData, previousQuery) => {
      if (previousQuery?.queryKey[1] === logCategory) {
        return previousData
      }
      return undefined
    },
  })

  const logs = data?.items || []
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null)
  const columns = useColumnsByCategory(logCategory, isAdmin)
  const isLoadingData = isLoading || (isFetching && !data)

  const table = useReactTable({
    data: logs as Record<string, unknown>[],
    columns: columns as ColumnDef<Record<string, unknown>>[],
    state: {
      columnFilters,
      pagination,
    },
    enableRowSelection: false,
    onPaginationChange,
    onColumnFiltersChange,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    manualPagination: true,
    pageCount: Math.ceil((data?.total || 0) / pagination.pageSize),
  })

  const pageCount = table.getPageCount()
  useEffect(() => {
    ensurePageInRange(pageCount)
  }, [pageCount, ensurePageInRange])

  useEffect(() => {
    setExpandedLogId(null)
  }, [logCategory, pagination.pageIndex, columnFilters])

  const isCommon = logCategory === 'common'
  const getLogKey = (row: { original: Record<string, unknown>; id: string }) =>
    `${logCategory}:${String(row.original.id ?? row.original.task_id ?? row.id)}`

  return (
    <DataTablePage
      table={table}
      columns={columns as ColumnDef<Record<string, unknown>>[]}
      isLoading={isLoadingData}
      isFetching={isFetching}
      emptyTitle={t('No Logs Found')}
      emptyDescription={t(
        'No usage logs available. Logs will appear here once API calls are made.'
      )}
      skeletonKeyPrefix='usage-log-skeleton'
      tableClassName='max-h-[calc(100dvh-13rem)] overflow-auto sm:max-h-[calc(100dvh-14rem)]'
      tableHeaderClassName='bg-muted/30 sticky top-0 z-10'
      toolbar={
        isCommon ? (
          <CommonLogsFilterBar table={table} />
        ) : (
          <TaskLogsFilterBar table={table} logCategory={logCategory} />
        )
      }
      renderRow={(row) => {
        const logType = (row.original as Record<string, unknown>).type as
          | number
          | undefined
        const tintClass =
          isCommon && logType != null ? (logTypeRowTint[logType] ?? '') : ''

        const log = row.original as Record<string, unknown>
        const logId = getLogKey(row)
        const isExpanded = expandedLogId === logId
        const toggleExpanded = () => {
          if (!logId) return
          setExpandedLogId((current) => (current === logId ? null : logId))
        }
        const handleRowClick = (event: MouseEvent<HTMLTableRowElement>) => {
          const target = event.target as HTMLElement
          if (target.closest('button, a, input, textarea, select, [role="button"]')) return
          toggleExpanded()
        }

        return (
          <Fragment key={row.id}>
            <TableRow
              className={cn(
                'cursor-pointer transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
                tintClass
              )}
              tabIndex={0}
              aria-expanded={isExpanded}
              onClick={handleRowClick}
              onKeyDown={
                (event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    toggleExpanded()
                  }
                }
              }
            >
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id} className={isCommon ? 'py-2' : 'py-3.5'}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
            {isExpanded && (
              <TableRow className={tintClass}>
                <TableCell colSpan={row.getVisibleCells().length} className='p-0'>
                  {isCommon ? (
                    <InlineLogDetails log={log as UsageLog} />
                  ) : (
                    <InlineTaskDetails log={log as TaskLog} />
                  )}
                </TableCell>
              </TableRow>
            )}
          </Fragment>
        )
      }}
      mobileProps={{
        getRowKey: getLogKey,
        expandedRowKey: expandedLogId,
        onRowClick: (row) => setExpandedLogId((current) => {
          const key = getLogKey(row)
          return current === key ? null : key
        }),
        onRowKeyDown: (row, event) => {
          if (event.key !== 'Enter' && event.key !== ' ') return
          event.preventDefault()
          const key = getLogKey(row)
          setExpandedLogId((current) => (current === key ? null : key))
        },
        renderExpandedRow: (row) => {
          const log = row.original as Record<string, unknown>
          return isCommon ? (
            <InlineLogDetails log={log as UsageLog} />
          ) : (
            <InlineTaskDetails log={log as TaskLog} />
          )
        },
      }}
    />
  )
}
