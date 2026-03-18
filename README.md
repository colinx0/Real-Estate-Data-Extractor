# RE Extractor

Extract real estate data from MLS PDFs into a unified spreadsheet-friendly format. Select folders of PDFs, and the app classifies them by MLS type and pulls out dates, counties, house types, listings, and sales.

## Quick Start

```bash
npm install
npm run dev
```

Open the URL in your browser (usually `http://localhost:5173`), click "Select Folders with PDFs", and choose your folders.

## Important: Folder Names

**Folders must be named exactly as one of the MLS types below** (match is case-insensitive). You can upload a parent folder that contains nested MLS folders—this app will scan for nested folders with these exact names (up to a 3 second scan limit).

| Type          | File format |
|---------------|-------------|
| `NEWAMLS`     | PDF         |
| `NWMLS`       | PDF         |
| `Olympic MLS` | XLSX        |
| `RMLS`        | PDF         |
| `YARMLS`      | PDF         |

Only files inside one of these folders will be processed.

## Parallel Processing

The app processes multiple files at once. Use the **Concurrent processors** slider (1–6) on the page to set how many files are processed in parallel. A higher value can speed up extraction; too high may slow down your machine or make the page sluggish. The default is 3.

## Output

All MLS types produce the same columns:

Year | Month | Quarter | House Type | County | MLS | Total Listings | Total Sales

You can view the results in the table and copy them as CSV for Google Sheets or Excel.

## Deployment

Run `npm run build`, then deploy the `dist/` folder to any static host (Netlify, Vercel, GitHub Pages, etc.). End users don't need to install anything—they just open the site in a browser.

The repo includes `netlify.toml` and `vercel.json` for quick deployment on those platforms.

## Tech

React, Vite, PDF.js, xlsx (SheetJS), p-limit (concurrency). Favicon: House icon by Icons8.
