/**
 * Date parsing utilities for real estate PDF formats
 */

export const MONTHS = {
  'january': 1, 'february': 2, 'march': 3, 'april': 4, 'may': 5, 'june': 6,
  'july': 7, 'august': 8, 'september': 9, 'october': 10, 'november': 11, 'december': 12
}

/**
 * Get quarter from month number
 * Months 7,8,9 are Quarter 3
 */
export const getQuarter = (month) => {
  if (month >= 1 && month <= 3) return 1
  if (month >= 4 && month <= 6) return 2
  if (month >= 7 && month <= 9) return 3
  if (month >= 10 && month <= 12) return 4
  return null
}

/**
 * Parse date from NEWAMLS format text
 * Example: "Prepared by Northeast Washington Association of REALTORS® on Tuesday, October 21, 2025 10:47 AM."
 * Returns: { month: 10, year: 2025 }
 */
export const parseDateFromText = (text) => {
  if (!text) return null

  const patterns = [
    // Standard format: "October 21, 2025"
    /(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),\s+(\d{4})/i,
    // Without comma: "October 21 2025"
    /(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})\s+(\d{4})/i,
    // With day name: "Tuesday, October 21, 2025"
    /(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(\d{4})/i
  ]

  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match) {
      const monthName = match[1] ? match[1].toLowerCase() : (match[2] ? match[2].toLowerCase() : null)
      const day = parseInt(match[2] || match[3] || 1, 10)
      const year = parseInt(match[3] || match[4] || match[2], 10)

      if (monthName && MONTHS[monthName]) {
        const month = MONTHS[monthName]
        return { month, year, day }
      }
    }
  }

  return null
}

/**
 * Parse date from NWMLS format text
 * Example: "Listings as of 10/1/2025 at 7:40:24AM"
 * Returns: { month: 10, year: 2025 }
 */
export const parseNWMLSDate = (text) => {
  if (!text) return null

  const datePattern = /(\d{1,2})\/(\d{1,2})\/(\d{4})/
  const match = text.match(datePattern)
  if (!match) return null

  const month = parseInt(match[1], 10)
  const day = parseInt(match[2], 10)
  const year = parseInt(match[3], 10)

  if (month < 1 || month > 12) return null

  return { month, year, day }
}
