/**
 * PDF.js worker configuration and library access for browser-side PDF parsing.
 */

import * as pdfjsLib from 'pdfjs-dist'

const workerUrl = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'

/** Set up PDF.js worker so parsing runs off the main thread. */
export function configureWorker() {
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl
}

configureWorker()

export const ensureWorkerConfigured = () => {
  configureWorker()
}

export const getPdfLib = () => pdfjsLib
