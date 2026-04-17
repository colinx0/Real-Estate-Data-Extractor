/**
 * Find the cell value at the intersection of a row header and column header in a PDF table.
 */

export async function findTableIntersection(
  page,
  rowHeader,
  colHeader,
  searchLeftPercent = 0,
  searchTopPercent = 0,
  searchWidthPercent = 100,
  searchHeightPercent = 100
) {
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

      if (
        x >= searchLeft &&
        x <= searchLeft + searchWidth &&
        yFromTop >= searchTop &&
        yFromTop <= searchTop + searchHeight
      ) {
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
      const combinedText = items.map((i) => i.text).join(' ').toLowerCase()

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

    const targetColX = colHeaderLower === 'active' ? activeColX : totalColX

    if (!targetColX) return null

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
  } catch {
    return null
  }
}
