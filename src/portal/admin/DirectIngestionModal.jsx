import React from 'react';
import BulkFieldOverwriteModal from './BulkFieldOverwriteModal';

/**
 * DirectIngestionModal (Unified Proxy)
 * All direct student ingestion, spreadsheet overwrite, and AI OCR capabilities
 * have been unified into BulkFieldOverwriteModal to eliminate duplicate functionality.
 */
export default function DirectIngestionModal({
  isOpen,
  onClose,
  onRecordAdded,
  allStudents = [],
  currentSession = '2025-26',
  ...props
}) {
  return (
    <BulkFieldOverwriteModal
      isOpen={isOpen}
      onClose={onClose}
      onRecordAdded={onRecordAdded}
      onComplete={onRecordAdded}
      allStudents={allStudents}
      currentSession={currentSession}
      initialMode="express"
      {...props}
    />
  );
}
