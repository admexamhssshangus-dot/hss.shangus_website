// =================================================================
// HSS SHANGUS — Official Documents & Registers Studio
// Unified parent suite housing Student Roster Builder & Official Letterhead Writer
// =================================================================

import React, { useState, useEffect } from 'react';
import CustomRosterDocumentBuilderView from './CustomRosterDocumentBuilderView';
import OfficialLetterWriterView from './OfficialLetterWriterView';
import StudentCertificateStudioView from './StudentCertificateStudioView';

export default function OfficialDocumentsStudioView({
  allStudents = [],
  initialSubTab = 'roster',
  activeSubTab: controlledActiveSubTab,
  onSwitchSubTab: controlledOnSwitchSubTab,
  onClose
}) {
  const [internalActiveSubTab, setInternalActiveSubTab] = useState(initialSubTab);

  const activeSubTab = controlledActiveSubTab !== undefined ? controlledActiveSubTab : internalActiveSubTab;
  const setActiveSubTab = controlledOnSwitchSubTab || setInternalActiveSubTab;

  // Sync if initialSubTab prop changes
  useEffect(() => {
    if (initialSubTab && controlledActiveSubTab === undefined) {
      setInternalActiveSubTab(initialSubTab);
    }
  }, [initialSubTab, controlledActiveSubTab]);

  return (
    <div className="space-y-2 animate-fadeIn">
      {activeSubTab === 'roster' && (
        <CustomRosterDocumentBuilderView
          allStudents={allStudents}
          onClose={onClose}
          activeSubTab={activeSubTab}
          onSwitchSubTab={setActiveSubTab}
        />
      )}

      {activeSubTab === 'letter' && (
        <OfficialLetterWriterView
          onClose={onClose}
          activeSubTab={activeSubTab}
          onSwitchSubTab={setActiveSubTab}
        />
      )}

      {(activeSubTab === 'certStudio' || activeSubTab === 'certificate') && (
        <StudentCertificateStudioView
          allStudents={allStudents}
          onClose={onClose}
          activeSubTab={activeSubTab}
          onSwitchSubTab={setActiveSubTab}
        />
      )}
    </div>
  );
}
