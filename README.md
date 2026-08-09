# Khalsa CBSE Syllabus Tracker

This repository reconstructs the previously built **Khalsa CBSE – Syllabus Lagging Tracker** from the preserved app screenshots, workflow requirements and school master-data rules.

## Preserved previous-app structure

- Secure staff login screen
- Dark-blue desktop sidebar
- Mobile header and fixed bottom navigation
- Dashboard
- Year Plans
- Weekly Status
- Reports
- Users
- Setup
- Install App / Help / sync-status controls
- Super Admin, Admin, HOD and Teacher role model
- HOD department scope and Teacher class-subject scope
- Department → Classes & Sections → Subjects selection workflow
- Orientation master with Edit / Disable / Delete actions
- Bulk-import preview with class, teacher, subject and mapping validation

## Academic sections

- 6A = C5A · C Batch
- 6B = C5B · C Batch
- 6C = L5 · Lead
- 7A = C4A · C Batch
- 7B = C4B · C Batch
- 7C = L4 · Lead
- 8A = C3A · C Batch
- 8B = C3B · C Batch
- 8C = L3 · Lead
- 8D = 8th Techno · Techno
- 9A = C2A · C Batch
- 9B = C2B · C Batch
- 9C = L2 · Lead
- 9D = 9th Techno · Techno
- 10A = C1A · C Batch
- 10B = C1B · C Batch
- 10C = 10th Techno · Techno

## Current reconstruction status

The browser UI and core workflow are functional. XLSX/XLS/CSV Year Plans can be preview-parsed locally and weekly rows are detected where recognizable headings exist. PDF files are indexed, but the original server-side PDF storage/parsing and central database are not yet connected.

Authentication, file storage and the **LIVE SYNC** indicator are currently local-preview behavior. Before production use, the app should be connected to a shared backend/database so every staff device sees the same data and uploaded files remain available after the original browser session.

## Run

Serve the repository as a static site or open `index.html` in a modern browser. Data is stored in browser `localStorage` until the shared backend is connected.
