/**
 * County parsing helpers shared across processors.
 */

/**
 * Extract county from text like: County is "King" / County is 'King'
 */
export const parseCountyIsQuoted = (text) => {
  if (!text) return null
  const countyPattern = /County is\s+['"]([^'"]+)['"]/i
  const match = text.match(countyPattern)
  if (!match) return null
  return match[1].trim()
}
