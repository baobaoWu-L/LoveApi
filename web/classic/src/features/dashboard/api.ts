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
import { api } from '@/lib/api'
import type { QuotaDataItem, UptimeGroupResult } from './types'

// ============================================================================
// Dashboard APIs
// ============================================================================

// ----------------------------------------------------------------------------
// Quota & Usage Data
// ----------------------------------------------------------------------------

// Get user quota data within a time range
// Admin users get all users' data by default (matching classic frontend behavior)
export async function getUserQuotaDates(
  params: {
    start_timestamp: number
    end_timestamp: number
    default_time?: string
    username?: string
  },
  isAdmin = false
) {
  const endpoint = isAdmin ? '/api/data' : '/api/data/self'
  const res = await api.get<{ success: boolean; data: QuotaDataItem[] }>(
    endpoint,
    { params }
  )
  return res.data
}

// Get all quota data from the beginning of the database history to now.
// Self-service users use a dedicated endpoint so the bounded monthly endpoint
// remains available for the heatmap request.
export async function getAllUserQuotaDates(
  params: { username?: string } = {},
  isAdmin = false
) {
  const endpoint = isAdmin ? '/api/data' : '/api/data/self/all'
  const res = await api.get<{ success: boolean; data: QuotaDataItem[] }>(
    endpoint,
    {
      params: {
        start_timestamp: 0,
        end_timestamp: Math.floor(Date.now() / 1000),
        ...params,
      },
    }
  )
  return res.data
}

// Get quota data for the current calendar year for the heatmap.
// This request stays independent from the dashboard chart filters.
export async function getCurrentYearQuotaDates(isAdmin = false) {
  const endpoint = isAdmin ? '/api/data' : '/api/data/self/year'
  const now = new Date()
  const start = new Date(now.getFullYear(), 0, 1)
  const res = await api.get<{ success: boolean; data: QuotaDataItem[] }>(
    endpoint,
    {
      params: {
        start_timestamp: Math.floor(start.getTime() / 1000),
        end_timestamp: Math.floor(now.getTime() / 1000),
      },
    }
  )
  return res.data
}

// ----------------------------------------------------------------------------
// System Monitoring
// ----------------------------------------------------------------------------

export async function getUserQuotaDataByUsers(params: {
  start_timestamp: number
  end_timestamp: number
}) {
  const res = await api.get<{ success: boolean; data: QuotaDataItem[] }>(
    '/api/data/users',
    { params }
  )
  return res.data
}

// Get uptime monitoring status for all services
export async function getUptimeStatus() {
  const res = await api.get<{ success: boolean; data: UptimeGroupResult[] }>(
    '/api/uptime/status'
  )
  return res.data
}
