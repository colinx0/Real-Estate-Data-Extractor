/**
 * NWMLS PDF processor
 */

import { getQuarter } from '../utilities/dateParsing.js'
import { parseCountyIsQuoted } from '../utilities/countyParsing.js'
import { ensureWorkerConfigured, getPdfLib } from '../utilities/pdfJsSetup.js'
import { getFullPageText } from '../utilities/fullPageText.js'
import { findPageByContent } from '../utilities/findPageByContent.js'
import { extractNWMLSDateFromPage } from '../utilities/nwmlsDateFromPage.js'
import { extractNWMLSTableData } from '../utilities/nwmlsTableData.js'

export const processNWMLSPDF = async (file) => {
  try {
    ensureWorkerConfigured()

    const pdfjsLib = getPdfLib()
    const getDocument = pdfjsLib.getDocument ?? pdfjsLib.default?.getDocument
    if (!getDocument || typeof getDocument !== 'function') {
      throw new Error('PDF.js getDocument function not available')
    }

    const arrayBuffer = await file.arrayBuffer()
    const pdf = await getDocument({ data: arrayBuffer }).promise

    const page1 = await pdf.getPage(1)
    const dateInfo = await extractNWMLSDateFromPage(page1)
    if (!dateInfo) return null

    const { month, year } = dateInfo
    const quarter = getQuarter(month)
    const mls = 'NWMLS'

    const residentialPage = await findPageByContent(pdf, 'Residential Totals')
    const condoPage = await findPageByContent(pdf, 'Condominium Totals')
    const summaryPage = await findPageByContent(pdf, 'Summary of All Properties')

    let county = null
    for (let p = pdf.numPages; p >= 1 && !county; p--) {
      const page = await pdf.getPage(p)
      const text = await getFullPageText(page)
      county = parseCountyIsQuoted(text)
    }

    if (!county) return null

    const residential = residentialPage ? await extractNWMLSTableData(residentialPage) : { listings: null, sales: null }
    const condo = condoPage ? await extractNWMLSTableData(condoPage) : { listings: null, sales: null }
    const total = summaryPage ? await extractNWMLSTableData(summaryPage) : { listings: null, sales: null }

    const rows = [
      {
        Year: year,
        Month: month,
        Quarter: quarter,
        'House Type': 'Residential',
        County: county,
        MLS: mls,
        'Total Listings': residential.listings,
        'Total Sales': residential.sales
      },
      {
        Year: year,
        Month: month,
        Quarter: quarter,
        'House Type': 'Condos',
        County: county,
        MLS: mls,
        'Total Listings': condo.listings,
        'Total Sales': condo.sales
      },
      {
        Year: year,
        Month: month,
        Quarter: quarter,
        'House Type': 'Total',
        County: county,
        MLS: mls,
        'Total Listings': total.listings,
        'Total Sales': total.sales
      }
    ]

    return { fileName: file.name, rows }
  } catch {
    return null
  }
}
