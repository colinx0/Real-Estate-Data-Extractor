/**
 * Core PDF utilities: PDF.js worker setup and shared extraction helpers for table/cell data.
 */

import * as pdfjsLib from "pdfjs-dist";

const workerUrl = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

/** Set up PDF.js worker so parsing runs off the main thread. */
export function configureWorker() {
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
}

configureWorker()

export const ensureWorkerConfigured = () => {
  configureWorker();
};

export const getPdfLib = () => pdfjsLib

/**
 * Find the cell value at the intersection of a row header and column header in a PDF table.
 * Used by NWMLS to find "count" row × "active"/"total" column.
 */
export const findTableIntersection = async (page, rowHeader, colHeader, searchLeftPercent = 0, searchTopPercent = 0, searchWidthPercent = 100, searchHeightPercent = 100) => {
  try {
    const viewport = page.getViewport({ scale: 1.0 })
    const pageWidth = viewport.width
    const pageHeight = viewport.height

    const searchLeft = (searchLeftPercent / 100) * pageWidth
    const searchTop = (searchTopPercent / 100) * pageHeight
    const searchWidth = (searchWidthPercent / 100) * pageWidth
    const searchHeight = (searchHeightPercent / 100) * pageHeight

    const textContent = await page.getTextContent()
    const rowHeaderLower = rowHeader.toLowerCase()
    const colHeaderLower = colHeader.toLowerCase()
    let rowHeaderY = null
    const rowTolerance = 10
    let activeColX = null
    let totalColX = null
    const colTolerance = 30
    const itemsByY = new Map()

    // First pass: group text items by Y position (rounded to tolerance) and note column header X positions
    for (const item of textContent.items) {
      const transform = item.transform
      const x = transform[4]
      const y = transform[5]
      const yFromTop = pageHeight - y
      const text = item.str.toLowerCase().trim()

      if (x >= searchLeft && x <= searchLeft + searchWidth &&
          yFromTop >= searchTop && yFromTop <= searchTop + searchHeight) {
        const yKey = Math.round(yFromTop / rowTolerance) * rowTolerance
        if (!itemsByY.has(yKey)) {
          itemsByY.set(yKey, [])
        }
        itemsByY.get(yKey).push({ item, x, yFromTop, text })

        if (text === colHeaderLower) {
          if (colHeaderLower === 'active' && !activeColX) {
            activeColX = x
          } else if (colHeaderLower === 'total' && !totalColX) {
            totalColX = x
          }
        }
      }
    }

    // Second pass: find which Y bucket contains the row header (e.g. "count")
    for (const [yKey, items] of itemsByY.entries()) {
      const combinedText = items.map(i => i.text).join(' ').toLowerCase()

      if (combinedText.includes(rowHeaderLower)) {
        rowHeaderY = yKey
        break
      }

      for (const itemData of items) {
        if (itemData.text === rowHeaderLower || itemData.text.includes(rowHeaderLower)) {
          rowHeaderY = yKey
          break
        }
      }

      if (rowHeaderY) break
    }

    if (!rowHeaderY) return null

    // Pick the column X based on whether we want "active" or "total"
    const targetColX = colHeaderLower === 'active' ? activeColX : totalColX

    if (!targetColX) return null

    const intersectionItems = []

    // Third pass: collect items that sit at (rowHeaderY, targetColX) within tolerance
    for (const item of textContent.items) {
      const transform = item.transform
      const x = transform[4]
      const y = transform[5]
      const yFromTop = pageHeight - y

      if (Math.abs(yFromTop - rowHeaderY) <= rowTolerance) {
        if (Math.abs(x - targetColX) <= colTolerance) {
          intersectionItems.push({
            item,
            x,
            yFromTop,
            distance: Math.abs(x - targetColX)
          })
        }
      }
    }

    if (intersectionItems.length > 0) {
      // Sort by Y then X so we read left-to-right, top-to-bottom
      intersectionItems.sort((a, b) => {
        if (Math.abs(a.yFromTop - b.yFromTop) > rowTolerance) {
          return a.yFromTop - b.yFromTop
        }
        return a.x - b.x
      })

      // Concatenate all text in the cell (some cells have multiple fragments)
      let result = ''
      for (const entry of intersectionItems) {
        result += entry.item.str
      }

      return result.trim() || intersectionItems[0].item.str
    }

    return null
  } catch {
    return null
  }
}

/**
 * Extract text from a rectangular region of a PDF page. Coordinates are percentages of page size.
 * Used by NEWAMLS for fixed-position extractions (date, listings, sales).
 */
export const extractTextAtCoordinates = async (page, leftPercent, topPercent, widthPercent = 50, heightPercent = 10) => {
  try {
    const viewport = page.getViewport({ scale: 1.0 })
    const pageWidth = viewport.width
    const pageHeight = viewport.height

    const left = (leftPercent / 100) * pageWidth
    const top = (topPercent / 100) * pageHeight
    const width = (widthPercent / 100) * pageWidth
    const height = (heightPercent / 100) * pageHeight

    const textContent = await page.getTextContent()
    const tolerance = 2
    // Keep only items whose position falls inside the box
    const itemsInArea = textContent.items.filter(item => {
      const transform = item.transform
      const x = transform[4]
      const y = transform[5]
      const yFromTop = pageHeight - y

      return x >= (left - tolerance) &&
             x <= (left + width + tolerance) &&
             yFromTop >= (top - tolerance) &&
             yFromTop <= (top + height + tolerance)
    })

    // Sort top-to-bottom, then left-to-right
    itemsInArea.sort((a, b) => {
      const yA = pageHeight - a.transform[5]
      const yB = pageHeight - b.transform[5]
      if (Math.abs(yA - yB) > 3) {
        return yB - yA
      }
      return a.transform[4] - b.transform[4]
    })

    if (itemsInArea.length > 0) {
      // Prefer items on the top line and near the center (avoids headers/labels)
      const targetX = left + (width / 2)
      const sameLineItems = []
      const firstY = pageHeight - itemsInArea[0].transform[5]

      for (const item of itemsInArea) {
        const itemY = pageHeight - item.transform[5]
        const itemX = item.transform[4]

        if (Math.abs(itemY - firstY) <= 3) {
          const maxXDistance = pageWidth * 0.01
          if (Math.abs(itemX - targetX) <= maxXDistance) {
            sameLineItems.push(item)
          }
        }
      }

      sameLineItems.sort((a, b) => a.transform[4] - b.transform[4])
      return sameLineItems.map(item => item.str).join('')
    }

    return itemsInArea.map(item => item.str).join(' ')
  } catch {
    return null
  }
}

/**
 * Parse a number from text (e.g. "1,234" or "1,234 units"). Strips commas and non-digits.
 */
export const extractNumber = (text) => {
  if (!text) return null
  const cleaned = text.replace(/,/g, '').replace(/[^\d]/g, '')
  const number = parseInt(cleaned, 10)
  return isNaN(number) ? null : number
}
