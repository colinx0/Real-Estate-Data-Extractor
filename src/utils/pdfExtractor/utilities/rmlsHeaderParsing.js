/**
 * RMLS: county and report month from page header text items.
 */

import { MONTHS } from './dateParsing.js'

export const parseRmlsCountyFromHeader = (items) => {
  for (const item of items.filter((i) => i.y < 120).sort((a, b) => a.y - b.y)) {
    const match = item.text.match(/^(.+?)\s+County\s+Washington/i)
    if (match) return match[1].trim()
  }
  return null
}

export const parseRmlsDateFromHeader = (items) => {
  for (const item of items.filter((i) => i.y < 100)) {
    const m = item.text.match(/(\w+)\s+(\d{4})/)
    if (m && MONTHS[m[1].toLowerCase()]) {
      return { month: MONTHS[m[1].toLowerCase()], year: parseInt(m[2], 10) }
    }
  }
  return null
}
