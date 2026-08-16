# Google Drive Integration Guide

## Purpose
Use this guide to connect invigilator uploads from a Google Drive folder to the OMR workflow.

## Required Setup
1. Create a Google Cloud Project.
2. Enable the Google Drive API.
3. Create a service account and download the JSON credentials.
4. Share the target Google Drive folder with the service account email.
5. Put the folder ID in the backend environment file.

## Environment Variable
- GOOGLE_DRIVE_FOLDER_ID=REPLACE_WITH_YOUR_FOLDER_ID

## Recommended Workflow
1. Invigilators upload scanned OMR images to the Drive folder.
2. The watcher script checks for new files.
3. New files are processed and their metadata/results are stored in Firestore or a local results folder.

## Security Notes
- never commit service account credentials to source control
- keep the folder restricted to invigilators/admins
- use least-privilege permissions
