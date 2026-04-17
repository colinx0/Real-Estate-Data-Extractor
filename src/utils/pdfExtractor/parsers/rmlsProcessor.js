/**
 * RMLS PDF processor — multi-county sales and active/pending pages.
 */

import { getQuarter } from '../utilities/dateParsing.js'
import { ensureWorkerConfigured, getPdfLib } from '../utilities/pdfJsSetup.js'
import { getFullPageText } from '../utilities/fullPageText.js'
import { getRmlsPageItems } from '../utilities/rmlsPageItems.js'
import {
  parseRmlsCountyFromHeader,
  parseRmlsDateFromHeader
} from '../utilities/rmlsHeaderParsing.js'
import {
  extractRmlsSalesFromTotalRow,
  extractRmlsActiveFromTotalRow
} from '../utilities/rmlsTotalRows.js'

export const processRMLSPDF = async (file) => {
  try {
    ensureWorkerConfigured()
    const pdfjsLib = getPdfLib()
    const getDocument = pdfjsLib.getDocument ?? pdfjsLib.default?.getDocument
    if (!getDocument || typeof getDocument !== 'function') {
      throw new Error('PDF.js getDocument function not available')
    }

    const arrayBuffer = await file.arrayBuffer()
    const pdf = await getDocument({ data: arrayBuffer }).promise

    const countyData = new Map()
    let dateInfo = null

    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p)
      const text = await getFullPageText(page)
      const items = await getRmlsPageItems(page)

      if (!dateInfo) dateInfo = parseRmlsDateFromHeader(items)

      const isSalesPage = text.includes('Home Sales Report: Total Residential')
      const isActivePage = text.includes('Home Active/Pending Report')
      if (!isSalesPage && !isActivePage) continue

      const county = parseRmlsCountyFromHeader(items)
      if (!county) continue

      if (!countyData.has(county)) {
        countyData.set(county, { sales: null, active: null })
      }

      if (isSalesPage) {
        countyData.get(county).sales = extractRmlsSalesFromTotalRow(items)
      } else if (isActivePage) {
        countyData.get(county).active = extractRmlsActiveFromTotalRow(items)
      }
    }

    if (!dateInfo) return null

    const { month, year } = dateInfo
    const quarter = getQuarter(month)
    const mls = 'RMLS'
    const allRows = []

    for (const [county, data] of countyData.entries()) {
      const resListings = data.active?.residentialListings ?? null
      const condoListings = data.active?.condoListings ?? null
      const resSales = data.sales?.residentialSales ?? null
      const condoSales = data.sales?.condoSales ?? null

      allRows.push(
        {
          Year: year,
          Month: month,
          Quarter: quarter,
          'House Type': 'Residential',
          County: county,
          MLS: mls,
          'Total Listings': resListings,
          'Total Sales': resSales
        },
        {
          Year: year,
          Month: month,
          Quarter: quarter,
          'House Type': 'Condos',
          County: county,
          MLS: mls,
          'Total Listings': condoListings,
          'Total Sales': condoSales
        },
        {
          Year: year,
          Month: month,
          Quarter: quarter,
          'House Type': 'Total',
          County: county,
          MLS: mls,
          'Total Listings': (resListings || 0) + (condoListings || 0),
          'Total Sales': (resSales || 0) + (condoSales || 0)
        }
      )
    }

    return { fileName: file.name, rows: allRows }
  } catch {
    return null
  }
}
