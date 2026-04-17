/**
 * Parse an integer from text (e.g. "1,234" or "1,234 units"). Strips commas and non-digits.
 */

export function extractNumberFromText(text) {
  if (!text) return null
  const cleaned = text.replace(/,/g, '').replace(/[^\d]/g, '')
  const number = parseInt(cleaned, 10)
  return isNaN(number) ? null : number
}
