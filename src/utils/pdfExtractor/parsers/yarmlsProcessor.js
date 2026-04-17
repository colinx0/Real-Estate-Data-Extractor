/**
 * YARMLS PDF processor — flexmls Price Range Report format.
 */

import { parseDateFromText, getQuarter } from '../utilities/dateParsing.js'
import { ensureWorkerConfigured, getPdfLib } from '../utilities/pdfJsSetup.js'
import { getFullPageText } from '../utilities/fullPageText.js'
import { extractYarmlsFlexmlsTotals } from '../utilities/yarmlsFlexmlsTotals.js'

export const processYARMLSPDF = async (file) => {
  try {
    ensureWorkerConfigured()
    const pdfjsLib = getPdfLib()
    const getDocument = pdfjsLib.getDocument ?? pdfjsLib.default?.getDocument
    if (!getDocument || typeof getDocument !== 'function') {
      throw new Error('PDF.js getDocument function not available')
    }

    const arrayBuffer = await file.arrayBuffer()
    const pdf = await getDocument({ data: arrayBuffer }).promise
    const page = await pdf.getPage(1)

    const allText = await getFullPageText(page)
    const dateInfo = parseDateFromText(allText)
    if (!dateInfo) return null

    const { month, year } = dateInfo
    const quarter = getQuarter(month)

    const data = await extractYarmlsFlexmlsTotals(page)
    if (!data) return null

    const county = 'Yakima'
    const mls = 'YARMLS'

    const rows = [
      {
        Year: year,
        Month: month,
        Quarter: quarter,
        'House Type': 'Residential',
        County: county,
        MLS: mls,
        'Total Listings': data.residentialListings,
        'Total Sales': data.residentialSales
      },
      {
        Year: year,
        Month: month,
        Quarter: quarter,
        'House Type': 'Condos',
        County: county,
        MLS: mls,
        'Total Listings': data.condoListings,
        'Total Sales': data.condoSales
      },
      {
        Year: year,
        Month: month,
        Quarter: quarter,
        'House Type': 'Total',
        County: county,
        MLS: mls,
        'Total Listings': (data.residentialListings || 0) + (data.condoListings || 0),
        'Total Sales': (data.residentialSales || 0) + (data.condoSales || 0)
      }
    ]

    return { fileName: file.name, rows }
  } catch {
    return null
  }
}
