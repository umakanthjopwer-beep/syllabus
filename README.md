# Khalsa Syllabus Tracker

A lightweight web app for Sri Chaitanya School – Khalsa CBSE Branch to upload year plans, track weekly syllabus progress, identify lagging periods, and generate teacher/class/subject reports.

## Current rebuild

This repository is being rebuilt from the working requirements of the Khalsa Syllabus Tracker.

### Included in this version
- Dashboard with class/section status cards
- Year Plan upload and local parsing for CSV/XLSX/PDF
- Class / orientation / subject mapping
- Weekly syllabus status entry
- Automatic lag-status calculation
- Teacher-wise, class-wise and subject-wise reports
- CSV report export
- Local JSON backup / restore
- PWA-friendly static structure

### Class mapping used
- 6A – C Batch, 6B – C Batch, 6C – Lead
- 7A – C Batch, 7B – C Batch, 7C – Lead
- 8A – C Batch, 8B – C Batch, 8C – Lead, 8D – Techno
- 9A – C Batch, 9B – C Batch, 9C – Lead, 9D – Techno
- 10A – C Batch, 10B – C Batch, 10C – Techno

## Run locally
Open `index.html` in a modern browser, or serve the folder with any static web server.

All data is currently stored in the browser using localStorage. A shared online database/auth layer can be connected later without changing the core tracking workflow.
