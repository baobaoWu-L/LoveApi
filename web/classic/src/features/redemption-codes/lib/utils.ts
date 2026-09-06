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
/**
 * Utility functions for redemption codes
 */

/**
 * Check if a Unix timestamp (in seconds) is expired
 * @param timestamp - Unix timestamp in seconds (0 means never expires)
 * @returns true if the timestamp is in the past
 */
export function isTimestampExpired(
  timestamp: number | string | null | undefined
): boolean {
  if (timestamp == null || timestamp === 0 || timestamp === '') return false
  if (typeof timestamp === 'string') {
    const ms = Date.parse(timestamp)
    if (Number.isNaN(ms)) return false
    return ms < Date.now()
  }
  // unix 秒（兼容旧数据）
  return timestamp < Date.now() / 1000
}

/**
 * Check if redemption code is expired based on business logic
 * Only enabled redemption codes (status === 1) can be considered expired
 * @returns true if the code is expired
 */
export function isRedemptionExpired(
  expired_time: number | string | null | undefined,
  status: number
): boolean {
  return status === 1 && isTimestampExpired(expired_time)
}
