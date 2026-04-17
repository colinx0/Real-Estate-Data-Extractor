/**
 * Extract text from a rectangular region of a PDF page. Coordinates are percentages of page size.
 */

export async function extractTextAtCoordinates(
  page,
  leftPercent,
  topPercent,
  widthPercent = 50,
  heightPercent = 10
) {
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
    const itemsInArea = textContent.items.filter((item) => {
      const transform = item.transform
      const x = transform[4]
      const y = transform[5]
      const yFromTop = pageHeight - y

      return (
        x >= left - tolerance &&
        x <= left + width + tolerance &&
        yFromTop >= top - tolerance &&
        yFromTop <= top + height + tolerance
      )
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
      const targetX = left + width / 2
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
      return sameLineItems.map((item) => item.str).join('')
    }

    return itemsInArea.map((item) => item.str).join(' ')
  } catch {
    return null
  }
}
