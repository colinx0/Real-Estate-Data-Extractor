# RE Extractor - PDF Folder Classifier

A React application that classifies folders containing PDFs into one of five MLS types and extracts data from them: NEWAMLS, NWMLS, Olympic MLS, RMLS, or YARMLs.

## Features

- Select folders containing PDF files
- Automatic classification based on folder name
- PDF data extraction for NEWAMLS and NWMLS types
- Console output of classification and extraction results
- Visual display of classification and extracted data
- CSV export functionality for Google Sheets

## Installation

1. Install dependencies:
```bash
npm install
```

## Usage

1. Start the development server:
```bash
npm run dev
```

2. Open your browser and navigate to the URL shown in the terminal (typically `http://localhost:5173`)

3. Click "Select Folders with PDFs" and choose folders containing PDF files

4. The application will:
   - Classify each folder based on its name
   - Extract data from PDFs (currently supports NEWAMLS and NWMLS)
   - Display results in the UI
   - Print classification and extraction results to the browser console
   - Allow copying extracted data as CSV

## Supported MLS Types

- **NEWAMLS**: Extracts date, residential/condo listings and sales
- **NWMLS**: Extracts date, county, and residential/condo/total listings and sales using table intersection
- Olympic MLS (coming soon)
- RMLS (coming soon)
- YARMLs (coming soon)

## Data Extraction

### NEWAMLS
- Extracts date from footer text
- Extracts residential and condo listings/sales from specific coordinates
- Outputs 3 rows per PDF: Residential, Condos, Total

### NWMLS
- Extracts date from page 1
- Extracts county from page 3
- Uses table intersection to find data at "count" row and "active"/"total" columns
- Outputs 3 rows per PDF: Residential, Condos, Total

## Development

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build

## Technologies

- React 18
- Vite
- PDF.js (pdfjs-dist)

