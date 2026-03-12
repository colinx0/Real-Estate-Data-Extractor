/**
 * Core PDF utilities: worker configuration and shared extraction helpers
 */

import * as pdfjsLib from "pdfjs-dist";

const workerUrl = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

export function configureWorker() {
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
}

configureWorker()

export const ensureWorkerConfigured = () => {
  configureWorker();
};

export const getPdfLib = () => pdfjsLib

/**
 * Find intersection of row and column headers in a PDF table
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

    if (!rowHeaderY) {
      const foundTexts = Array.from(itemsByY.values()).flat().map(i => i.text).filter(t => t.length > 0)
      console.warn(`Row header "${rowHeader}" not found in search area. Found texts:`, foundTexts.slice(0, 20))
      return null
    }

    const targetColX = colHeaderLower === 'active' ? activeColX : totalColX

    if (!targetColX) {
      console.warn(`Column header "${colHeader}" not found in search area`)
      return null
    }

    const intersectionItems = []

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
      intersectionItems.sort((a, b) => {
        if (Math.abs(a.yFromTop - b.yFromTop) > rowTolerance) {
          return a.yFromTop - b.yFromTop
        }
        return a.x - b.x
      })

      let result = ''
      for (const entry of intersectionItems) {
        result += entry.item.str
      }

      return result.trim() || intersectionItems[0].item.str
    }

    return null
  } catch (error) {
    console.error('Error finding table intersection:', error)
    return null
  }
}

/**
 * Extract text from PDF at specific percentage coordinates
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

    itemsInArea.sort((a, b) => {
      const yA = pageHeight - a.transform[5]
      const yB = pageHeight - b.transform[5]
      if (Math.abs(yA - yB) > 3) {
        return yB - yA
      }
      return a.transform[4] - b.transform[4]
    })

    if (itemsInArea.length > 0) {
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
  } catch (error) {
    console.error('Error extracting text at coordinates:', error)
    return null
  }
}

/**
 * Extract number from text (removes commas and non-numeric characters)
 */
export const extractNumber = (text) => {
  if (!text) return null
  const cleaned = text.replace(/,/g, '').replace(/[^\d]/g, '')
  const number = parseInt(cleaned, 10)
  return isNaN(number) ? null : number
}
