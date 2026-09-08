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
import { formatBillingCurrencyFromUSD } from '@/lib/currency'
import { TOKEN_UNIT_DIVISORS } from '../constants'
import type { PricingModel, TokenUnit } from '../types'
import {
  BILLING_PRICING_VARS,
  parseTiersFromExpr,
  splitBillingExprAndRequestRules,
  tryParseRequestRuleExpr,
  type BillingVar,
  type ParsedTier,
} from './billing-expr'

type DynamicPriceOptions = {
  tokenUnit: TokenUnit
  showRechargePrice?: boolean
  priceRate?: number
  usdExchangeRate?: number
  groupRatioMultiplier?: number
}

export type DynamicPriceEntry = {
  key: string
  field: string
  label: string
  shortLabel: string
  value: number
  formatted: string
  variable: BillingVar
}

export type DynamicPricingSummary = {
  tiers: ParsedTier[]
  tier: ParsedTier | null
  tierCount: number
  hasRequestRules: boolean
  isSpecialExpression: boolean
  rawExpression: string
  entries: DynamicPriceEntry[]
  primaryEntries: DynamicPriceEntry[]
  secondaryEntries: DynamicPriceEntry[]
}

const PRIMARY_DYNAMIC_FIELDS = new Set(['inputPrice', 'outputPrice'])

export function isDynamicPricingModel(model: PricingModel): boolean {
  return (
    (model.pricing_tiers?.length ?? 0) > 0 ||
    (model.billing_mode === 'tiered_expr' && Boolean(model.billing_expr)) ||
    Object.values(model.billing_expr_by_group || {}).some(Boolean)
  )
}

function getDynamicExpression(model: PricingModel, group?: string): string {
  if (group) {
    const grouped = model.billing_expr_by_group?.[group]
    if (grouped) return grouped
  }
  if (model.billing_expr) return model.billing_expr
  return Object.values(model.billing_expr_by_group || {}).find(Boolean) || ''
}

export function getDynamicDisplayGroupRatio(model: PricingModel): number {
  const groups = Array.isArray(model.enable_groups) ? model.enable_groups : []
  const ratios = model.group_ratio || {}
  if (groups.length === 0) return 1

  let minRatio = Number.POSITIVE_INFINITY
  for (const group of groups) {
    const ratio = ratios[group]
    if (ratio !== undefined && ratio < minRatio) {
      minRatio = ratio
    }
  }

  return minRatio === Number.POSITIVE_INFINITY ? 1 : minRatio
}

export function getDynamicGroupRatio(
  model: PricingModel,
  selectedGroup: string
): number {
  const ratios = model.group_ratio || {}
  return ratios[selectedGroup] ?? 1
}

function applyRechargeRate(
  price: number,
  showWithRecharge: boolean,
  priceRate: number,
  usdExchangeRate: number
): number {
  if (!showWithRecharge) return price
  return (price * priceRate) / usdExchangeRate
}

export function formatDynamicUnitPrice(
  valuePerMillionTokens: number,
  options: DynamicPriceOptions
): string {
  const groupRatio = options.groupRatioMultiplier ?? 1
  const priceRate = options.priceRate ?? 1
  const usdExchangeRate = options.usdExchangeRate ?? 1
  const priceUSD =
    (valuePerMillionTokens * groupRatio) /
    TOKEN_UNIT_DIVISORS[options.tokenUnit]
  const displayPrice = applyRechargeRate(
    priceUSD,
    options.showRechargePrice ?? false,
    priceRate,
    usdExchangeRate
  )

  return formatBillingCurrencyFromUSD(displayPrice, {
    digitsLarge: 5,
    digitsSmall: 5,
    abbreviate: false,
  })
}

export function getDynamicPricingTiers(model: PricingModel, group?: string): ParsedTier[] {
  if (!isDynamicPricingModel(model)) return []
  if (model.pricing_tiers?.length) {
    return model.pricing_tiers.map((tier) => ({
      label: tier.label,
      conditions: (tier.conditions || []).map((condition) => ({
        var: condition.variable as 'p' | 'c' | 'len',
        op: condition.operator as '<' | '<=' | '>' | '>=',
        value: condition.value,
      })),
      inputPrice: tier.input_price,
      outputPrice: tier.output_price,
      cacheReadPrice: tier.cache_read_price ?? 0,
      cacheCreatePrice: tier.cache_write_price ?? 0,
      cacheCreate1hPrice: tier.cache_write_1h_price ?? 0,
      imagePrice: tier.image_price ?? 0,
      imageOutputPrice: tier.image_output_price ?? 0,
      audioInputPrice: tier.audio_input_price ?? 0,
      audioOutputPrice: tier.audio_output_price ?? 0,
    }))
  }
  const expression = getDynamicExpression(model, group)
  const { billingExpr } = splitBillingExprAndRequestRules(
    expression
  )
  return parseTiersFromExpr(billingExpr)
}

export function hasDynamicRequestRules(model: PricingModel): boolean {
  if (!isDynamicPricingModel(model)) return false
  const { requestRuleExpr } = splitBillingExprAndRequestRules(
    getDynamicExpression(model)
  )
  return Boolean(tryParseRequestRuleExpr(requestRuleExpr || '')?.length)
}

export function getDynamicPriceEntries(
  tier: ParsedTier | null,
  options: DynamicPriceOptions
): DynamicPriceEntry[] {
  if (!tier) return []

  return BILLING_PRICING_VARS.flatMap((variable) => {
    if (!variable.field) return []
    const value = Number(tier[variable.field])
    if (!Number.isFinite(value) || value <= 0) return []

    return [
      {
        key: variable.key,
        field: variable.field,
        label: variable.label,
        shortLabel: variable.shortLabel,
        value,
        formatted: formatDynamicUnitPrice(value, options),
        variable,
      },
    ]
  }).sort((a, b) => {
    const aPrimary = PRIMARY_DYNAMIC_FIELDS.has(a.field)
    const bPrimary = PRIMARY_DYNAMIC_FIELDS.has(b.field)
    if (aPrimary !== bPrimary) return aPrimary ? -1 : 1
    return 0
  })
}

export function getDynamicPricingSummary(
  model: PricingModel,
  options: DynamicPriceOptions,
  group?: string
): DynamicPricingSummary | null {
  if (!isDynamicPricingModel(model)) return null

  const tiers = getDynamicPricingTiers(model, group)
  const tier = tiers[0] || null
  const entries = getDynamicPriceEntries(tier, options)
  const rawExpression = getDynamicExpression(model, group)

  return {
    tiers,
    tier,
    tierCount: tiers.length,
    hasRequestRules: hasDynamicRequestRules(model),
    isSpecialExpression: rawExpression.trim().length > 0 && tiers.length === 0,
    rawExpression,
    entries,
    primaryEntries: entries.filter((entry) =>
      PRIMARY_DYNAMIC_FIELDS.has(entry.field)
    ),
    secondaryEntries: entries.filter(
      (entry) => !PRIMARY_DYNAMIC_FIELDS.has(entry.field)
    ),
  }
}
