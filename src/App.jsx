import React, { useState } from 'react'
import './App.css'
import { processNEWAMLSPDF, processNWMLSPDF, processYARMLSPDF, processRMLSPDF, processOlympicMLSXLSX } from './utils/pdfExtractor'

const MLS_TYPES = ['NEWAMLS', 'NWMLS', 'Olympic MLS', 'RMLS', 'YARMLS']

function App() {
  const [selectedFolders, setSelectedFolders] = useState([])
  const [classifications, setClassifications] = useState([])
  const [extractedData, setExtractedData] = useState([])
  const [processing, setProcessing] = useState(false)

  const classifyFolder = (folderName) => {
    // Normalize folder name for comparison (case-insensitive, trim whitespace)
    const normalizedName = folderName.trim()
    
    // Check for exact match (case-insensitive)
    const matchedType = MLS_TYPES.find(type => 
      type.toLowerCase() === normalizedName.toLowerCase()
    )
    
    return matchedType || null
  }

  const handleFolderSelection = async (event) => {
    const files = Array.from(event.target.files)
    
    if (files.length === 0) return

    setProcessing(true)
    setExtractedData([])

    // Group files by their folder path
    const folderMap = new Map()
    
    files.forEach(file => {
      // Extract folder name from webkitRelativePath
      // Format: "folderName/file.pdf"
      const pathParts = file.webkitRelativePath.split('/')
      if (pathParts.length > 1) {
        const folderName = pathParts[0]
        if (!folderMap.has(folderName)) {
          folderMap.set(folderName, [])
        }
        folderMap.get(folderName).push(file)
      }
    })

    const newClassifications = []
    const allExtractedRows = []
    
    for (const [folderName, pdfFiles] of folderMap.entries()) {
      // Filter to only PDF files
      const pdfs = pdfFiles.filter(file => 
        file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf') ||
        file.name.toLowerCase().endsWith('.xlsx')
      )
      
      if (pdfs.length > 0) {
        const classification = classifyFolder(folderName)
        const result = {
          folderName,
          classification,
          pdfCount: pdfs.length
        }
        
        newClassifications.push(result)
        
        // Print to console as requested
        if (classification) {
          console.log(`Folder: ${folderName} -> Type: ${classification}`)
        } else {
          console.log(`Folder: ${folderName} -> Type: UNKNOWN (not one of the five types)`)
        }

        // Process PDFs based on classification
        if (classification === 'NEWAMLS') {
          console.log(`\nProcessing ${pdfs.length} PDF(s) from ${folderName}...`)
          
          for (const pdf of pdfs) {
            const extracted = await processNEWAMLSPDF(pdf)
            if (extracted && extracted.rows) {
              // Add rows to the collection
              extracted.rows.forEach(row => {
                allExtractedRows.push({
                  ...row,
                  sourceFile: extracted.fileName,
                  sourceFolder: folderName
                })
              })
              
              // Log to console
              console.log(`\nExtracted data from ${extracted.fileName}:`)
              extracted.rows.forEach((row, index) => {
                console.log(`Row ${index + 1}:`, row)
              })
            } else {
              console.warn(`Failed to extract data from ${pdf.name}`)
            }
          }
        } else if (classification === 'NWMLS' || classification === 'YARMLS' || classification === 'RMLS' || classification === 'Olympic MLS') {
          console.log(`\nProcessing ${pdfs.length} file(s) from ${folderName} (${classification})...`)
          
          const processorMap = {
            'NWMLS': processNWMLSPDF,
            'YARMLS': processYARMLSPDF,
            'RMLS': processRMLSPDF,
            'Olympic MLS': processOlympicMLSXLSX
          }
          const processor = processorMap[classification]
          
          for (const pdf of pdfs) {
            const extracted = await processor(pdf)
            if (extracted && extracted.rows) {
              extracted.rows.forEach(row => {
                allExtractedRows.push({
                  ...row,
                  sourceFile: extracted.fileName,
                  sourceFolder: folderName
                })
              })
              console.log(`\nExtracted data from ${extracted.fileName}:`)
              extracted.rows.forEach((row, index) => {
                console.log(`Row ${index + 1}:`, row)
              })
            } else {
              console.warn(`Failed to extract data from ${pdf.name}`)
            }
          }
        }
      }
    }

    setClassifications(newClassifications)
    setSelectedFolders(Array.from(folderMap.keys()))
    setExtractedData(allExtractedRows)
    setProcessing(false)

    // Log all rows in Google Sheets format
    if (allExtractedRows.length > 0) {
      console.log('\n=== Google Sheets Output (CSV format) ===')
      const headers = ['Year', 'Month', 'Quarter', 'House Type', 'County', 'MLS', 'Total Listings', 'Total Sales']
      console.log(headers.join(','))
      allExtractedRows.forEach(row => {
        const values = [
          row.Year,
          row.Month,
          row.Quarter,
          row['House Type'],
          row.County,
          row.MLS,
          row['Total Listings'],
          row['Total Sales']
        ]
        console.log(values.join(','))
      })
    }
  }

  return (
    <div className="app">
      <div className="container">
        <h1>RE Extractor - PDF Folder Classifier</h1>
        <p className="subtitle">
          Select folders containing PDFs to classify them as one of five MLS types
        </p>
        
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
            <p className="console-note">
              💡 Check the browser console to see the classification output
            </p>
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
                      <td>{row['Total Listings'] ?? 'N/A'}</td>
                      <td>{row['Total Sales'] ?? 'N/A'}</td>
                      <td className="source-file">{row.sourceFile}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button 
              className="copy-button"
              onClick={() => {
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
                    row['Total Listings'] ?? '',
                    row['Total Sales'] ?? ''
                  ].join(','))
                ].join('\n')
                
                navigator.clipboard.writeText(csv).then(() => {
                  alert('CSV data copied to clipboard!')
                }).catch(err => {
                  console.error('Failed to copy:', err)
                })
              }}
            >
              📋 Copy CSV to Clipboard
            </button>
          </div>
        )}

        <div className="info-section">
          <h3>Supported MLS Types:</h3>
          <ul>
            {MLS_TYPES.map((type, index) => (
              <li key={index}>{type}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

export default App

