/**
 * Main app: folder selection, MLS classification, and PDF/XLSX data extraction.
 * Users pick folders; the app looks for nested folders that exactly match one of the five MLS types.
 */

import React, { useState } from 'react'
import pLimit from 'p-limit'
import './App.css'
import { processNEWAMLSPDF } from './utils/pdfExtractor/parsers/newamlsProcessor'
import { processNWMLSPDF } from './utils/pdfExtractor/parsers/nwmlsProcessor'
import { processYARMLSPDF } from './utils/pdfExtractor/parsers/yarmlsProcessor'
import { processRMLSPDF } from './utils/pdfExtractor/parsers/rmlsProcessor'
import { processOlympicMLSXLSX } from './utils/pdfExtractor/parsers/olympicMlsProcessor'

const MLS_TYPES = ['NEWAMLS', 'NWMLS', 'Olympic MLS', 'RMLS', 'YARMLS']
const MAX_CONCURRENCY = 6
const DEFAULT_CONCURRENCY = 3
const FOLDER_SEARCH_TIME_LIMIT = 3000

const processorMap = {
  'NEWAMLS': processNEWAMLSPDF,
  'NWMLS': processNWMLSPDF,
  'YARMLS': processYARMLSPDF,
  'RMLS': processRMLSPDF,
  'Olympic MLS': processOlympicMLSXLSX
}

function App() {
  const [selectedFolders, setSelectedFolders] = useState([])
  const [classifications, setClassifications] = useState([])
  const [extractedData, setExtractedData] = useState([])
  const [processing, setProcessing] = useState(false)
  const [concurrency, setConcurrency] = useState(DEFAULT_CONCURRENCY)
  const [folderSearchWarning, setFolderSearchWarning] = useState('')

  const csvEscape = (value) => {
    if (value === null || value === undefined) return ''
    const s = String(value)
    const needsQuotes = /[",\n\r]/.test(s)
    const escaped = s.replace(/"/g, '""')
    return needsQuotes ? `"${escaped}"` : escaped
  }

  const buildCsv = (headers, rows) => {
    return [
      headers.map(csvEscape).join(','),
      ...rows.map((r) => headers.map((h) => csvEscape(r[h])).join(','))
    ].join('\n')
  }

  const downloadCsvFile = (fileName, csv) => {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = fileName
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  // Match folder name to an MLS type (case-insensitive exact match). Returns null if no match.
  const classifyFolder = (folderName) => {
    const normalizedName = folderName.trim()
    const matchedType = MLS_TYPES.find(type =>
      normalizedName.toLowerCase() === type.toLowerCase()
    )
    return matchedType || null
  }

  // For "Parent/2026/NWMLS/Jan/report.pdf" returns "NWMLS" (deepest matching folder).
  const findNearestMlsFolderInPath = (webkitRelativePath) => {
    const parts = webkitRelativePath.split('/').filter(Boolean)
    for (let i = parts.length - 2; i >= 0; i--) {
      const match = classifyFolder(parts[i])
      if (match) return match
    }
    return null
  }

  const handleFolderSelection = async (event) => {
    const files = Array.from(event.target.files)
    if (files.length === 0) return

    setProcessing(true)
    setExtractedData([])
    setFolderSearchWarning('')

    // Build a map: folder name -> list of files in that folder
    const folderMap = new Map()
    const start = performance.now()
    for (const file of files) {
      if (performance.now() - start > FOLDER_SEARCH_TIME_LIMIT) break
      if (!file.webkitRelativePath) continue

      const mlsFolder = findNearestMlsFolderInPath(file.webkitRelativePath)
      if (!mlsFolder) continue

      if (!folderMap.has(mlsFolder)) folderMap.set(mlsFolder, [])
      folderMap.get(mlsFolder).push(file)
    }

    if (performance.now() - start > FOLDER_SEARCH_TIME_LIMIT) {
      setFolderSearchWarning(
        `Stopped searching for nested MLS folders after ${Math.round(FOLDER_SEARCH_TIME_LIMIT / 1000)}s. ` +
        'If some files were skipped, try selecting a smaller folder or reduce nesting depth.'
      )
    }

    const newClassifications = []
    const tasks = []

    //classify files and create tasks
    for (const [folderName, pdfFiles] of folderMap.entries()) {
      const pdfs = pdfFiles.filter(file =>
        file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf') ||
        file.name.toLowerCase().endsWith('.xlsx')
      )

      if (pdfs.length === 0) continue

      const classification = classifyFolder(folderName)
      newClassifications.push({ folderName, classification, pdfCount: pdfs.length })

      if (!classification || !processorMap[classification]) continue

      const processor = processorMap[classification]
      for (const file of pdfs) {
        tasks.push({ folderName, file, processor })
      }
    }

    //process all files
    const limit = pLimit(concurrency)
    const allExtractedRows = []
    const results = await Promise.all(
      tasks.map(({ folderName, file, processor }) =>
        limit(async () => {
          const extracted = await processor(file)
          if (!extracted?.rows) return []
          return extracted.rows.map(row => ({
            ...row,
            sourceFile: extracted.fileName,
            sourceFolder: folderName
          }))
        })
      )
    )
    results.flat().forEach(row => allExtractedRows.push(row))

    setClassifications(newClassifications)
    setSelectedFolders(Array.from(folderMap.keys()))
    setExtractedData(allExtractedRows)
    setProcessing(false)
  }

  return (
    <div className="app">
      <div className="container">
        <h1>RE Extractor - PDF Folder Classifier</h1>
        <p className="subtitle">
          Select folders containing PDFs to classify them as one of five MLS types
        </p>

        <div className="concurrency-section">
          <label className="concurrency-label">
            <span>Concurrent processors: {concurrency}</span>
            <input
              type="range"
              min={1}
              max={MAX_CONCURRENCY}
              value={concurrency}
              onChange={(e) => setConcurrency(Number(e.target.value))}
              disabled={processing}
              className="concurrency-slider"
            />
          </label>
          <p className="concurrency-note">
            This is the number of files processed at the same time. Using a higher value can speed up extraction,
            but may slow down other applications and the browser while processing, and can lead to a sluggish or
            unresponsive page.
          </p>
          {folderSearchWarning && (
            <p className="folder-search-warning">{folderSearchWarning}</p>
          )}
        </div>
        
        <div className="upload-section">
          <label htmlFor="folder-input" className="upload-label">
            <input
              id="folder-input"
              type="file"
              webkitdirectory=""
              directory=""
              multiple
              onChange={handleFolderSelection}
              style={{ display: 'none' }}
              disabled={processing}
            />
            <div className={`upload-button ${processing ? 'processing' : ''}`}>
              {processing ? '⏳ Processing PDFs...' : '📁 Select Folders with PDFs'}
            </div>
          </label>
        </div>

        {classifications.length > 0 && (
          <div className="results-section">
            <h2>Classification Results</h2>
            <div className="results-grid">
              {classifications.map((result, index) => (
                <div 
                  key={index} 
                  className={`result-card ${result.classification ? 'classified' : 'unknown'}`}
                >
                  <div className="folder-name">{result.folderName}</div>
                  <div className="classification">
                    {result.classification || 'UNKNOWN'}
                  </div>
                  <div className="pdf-count">{result.pdfCount} PDF(s)</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {extractedData.length > 0 && (
          <div className="extracted-data-section">
            <h2>Extracted Data (Google Sheets Format)</h2>
            <p className="data-info">
              {extractedData.length} row(s) extracted from {new Set(extractedData.map(d => d.sourceFile)).size} PDF(s)
            </p>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Year</th>
                    <th>Month</th>
                    <th>Quarter</th>
                    <th>House Type</th>
                    <th>County</th>
                    <th>MLS</th>
                    <th>Total Listings</th>
                    <th>Total Sales</th>
                    <th>Source File</th>
                  </tr>
                </thead>
                <tbody>
                  {extractedData.map((row, index) => (
                    <tr key={index}>
                      <td>{row.Year}</td>
                      <td>{row.Month}</td>
                      <td>{row.Quarter}</td>
                      <td>{row['House Type']}</td>
                      <td>{row.County}</td>
                      <td>{row.MLS}</td>
                      <td>{row['Total Listings'] ?? 0}</td>
                      <td>{row['Total Sales'] ?? 0}</td>
                      <td className="source-file">{row.sourceFile}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="csv-actions">
              <button 
                className="copy-button"
                onClick={() => {
                  // Build CSV string and copy to clipboard for pasting into Sheets/Excel
                  const headers = ['Year', 'Month', 'Quarter', 'House Type', 'County', 'MLS', 'Total Listings', 'Total Sales']
                  const csv = [
                    headers.join(','),
                    ...extractedData.map(row => [
                      row.Year,
                      row.Month,
                      row.Quarter,
                      `"${row['House Type']}"`,
                      `"${row.County}"`,
                      row.MLS,
                      row['Total Listings'] ?? 0,
                      row['Total Sales'] ?? 0
                    ].join(','))
                  ].join('\n')

                  navigator.clipboard.writeText(csv).then(() => {
                    alert('CSV data copied to clipboard!')
                  }).catch(() => {})
                }}
              >
                📋 Copy CSV to Clipboard
              </button>
              <button
                className="copy-button"
                onClick={() => {
                  const headers = [
                    'Year',
                    'Month',
                    'Quarter',
                    'House Type',
                    'County',
                    'MLS',
                    'Total Listings',
                    'Total Sales',
                    'sourceFile',
                    'sourceFolder'
                  ]
                  const csv = buildCsv(headers, extractedData)
                  const ts = new Date().toISOString().replace(/[:.]/g, '-')
                  downloadCsvFile(`re-extractor-full-${ts}.csv`, csv)
                }}
              >
                💾 Download full CSV (includes source file/folder)
              </button>
            </div>

            {(() => {
              const groups = new Map()
              for (const row of extractedData) {
                const key = `${row.Year}|${row.Month}|${row.MLS}`
                if (!groups.has(key)) {
                  groups.set(key, {
                    Year: row.Year,
                    Month: row.Month,
                    Quarter: row.Quarter,
                    MLS: row.MLS,
                    sourceFiles: new Set(),
                    counties: new Set()
                  })
                }
                const g = groups.get(key)
                if (row.sourceFile) g.sourceFiles.add(row.sourceFile)
                if (row.County) g.counties.add(row.County)
              }

              const summary = Array.from(groups.values()).map((g) => ({
                ...g,
                sourceFiles: Array.from(g.sourceFiles).sort(),
                counties: Array.from(g.counties).sort()
              }))

              summary.sort((a, b) => {
                if (a.Year !== b.Year) return a.Year - b.Year
                if (a.Month !== b.Month) return a.Month - b.Month
                return String(a.MLS).localeCompare(String(b.MLS))
              })

              return (
                <div className="extracted-data-section">
                  <h2>Source PDFs by Year + Month + MLS</h2>
                  <p className="data-info">
                    {summary.length} group(s). Each group lists all processed PDFs and counties included.
                  </p>
                  <div className="pdf-group-list">
                    {summary.map((g, idx) => (
                      <div key={idx} className="pdf-group-card">
                        <div className="pdf-group-title">
                          {g.Year} / {g.Month} / {g.MLS}
                        </div>
                        <div className="pdf-group-meta">
                          Counties: {g.counties.length > 0 ? g.counties.join(', ') : 'None'}
                        </div>
                        <ul className="pdf-file-list">
                          {g.sourceFiles.map((fileName) => (
                            <li key={fileName} className="pdf-file-item">{fileName}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })()}
          </div>
        )}

        <div className="info-section">
          <h3>How to name your folders</h3>
          <p>
            The app looks for folders named <strong>exactly</strong> as one of the five MLS types below (case-insensitive).
            You can upload a parent folder; nested folders are scanned for these exact names (up to a 3 second scan limit).
          </p>
          <ul>
            <li><strong>NEWAMLS</strong> – PDF files only</li>
            <li><strong>NWMLS</strong> – PDF files only</li>
            <li><strong>Olympic MLS</strong> – XLSX files only (Excel format)</li>
            <li><strong>RMLS</strong> – PDF files only</li>
            <li><strong>YARMLS</strong> – PDF files only</li>
          </ul>
          <p>
            Only files inside one of these folders will be processed.
          </p>
        </div>

        <footer className="icon-credit">
          <a target="_blank" rel="noopener noreferrer" href="https://icons8.com/icon/86315/house">House</a> icon by <a target="_blank" rel="noopener noreferrer" href="https://icons8.com">Icons8</a>
        </footer>
      </div>
    </div>
  )
}

export default App

