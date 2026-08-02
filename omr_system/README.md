# OMR Examination System Prototype

This folder contains a starter implementation for the OMR-based exam workflow described for the 10 August 2026 general knowledge test.

## Structure
- docs/OMR_Project_Workflow.md - full workflow and implementation guidance
- backend/ - Node.js backend skeleton for registration and OMR processing
- frontend/ - React starter page for student registration

## Quick Start

### Backend
1. cd omr_system/backend
2. npm install
3. node server.js

### Frontend
The frontend page is a standalone React component and can be integrated into your main app.

## Configuration
- Copy backend/.env.example to backend/.env and fill in your values.
- Replace REPLACE_WITH_YOUR_FOLDER_ID with your Google Drive folder ID if you will use Drive uploads.

## Notes
- This is a prototype skeleton, not a production-ready OCR pipeline.
- For full OCR/OMR accuracy, the next step is to add OpenCV-based preprocessing and a live watcher script.
