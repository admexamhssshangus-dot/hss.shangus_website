// =================================================================
// HSS SHANGUS — Official Institutional Letterhead & Word Processor
// With Gemini AI Multi-Key Pool, Reusable Template Builder & Word Processor
// =================================================================

import React, { useState, useRef, useEffect } from 'react';
import {
  Printer, FileText, FileSpreadsheet, Download, RotateCcw, Save, Sparkles,
  Bold, Italic, Underline, Strikethrough, AlignLeft, AlignCenter,
  AlignRight, AlignJustify, List, ListOrdered, Table as TableIcon,
  Heading1, Heading2, Sliders, ChevronDown, Check, Copy, Undo, Redo,
  CornerDownLeft, PlusCircle, Trash2, ArrowLeft, RefreshCw, Bot,
  Key, Wand2, Shield, AlertCircle, ExternalLink, X, FileEdit, Plus,
  BookmarkPlus, FolderPlus, Award
} from 'lucide-react';
import {
  printOfficialLetter,
  generateOfficialLetterDocx
} from '../../utils/officialLetterExportUtils';
import {
  AVAILABLE_GEMINI_MODELS,
  getStoredGeminiKeys,
  saveGeminiKeys,
  getPreferredGeminiModel,
  savePreferredGeminiModel,
  generateLetterWithGemini
} from '../../services/geminiLetterService';
import {
  fetchCloudDocTemplates,
  saveCloudDocTemplate,
  setCloudDefaultTemplate,
  deleteCloudDocTemplate
} from '../../services/docTemplateService';

// Built-in Institutional Letter Templates for HSS Shangus
const BUILTIN_LETTER_TEMPLATES = [
  {
    id: 'fee_notification',
    name: 'Fee Notification & Distribution',
    category: 'Accounts & Fees',
    desc: 'RR and Examination fee collection schedule for 11th & 12th',
    refNo: 'HSS/SHG/Fee-Dist/10th/April',
    subject: 'Notification regarding collection and distribution of Student Examination & RR Fee.',
    bodyHtml: `
<p><strong>To,</strong><br/>
All Class Incharges / Dealing Assistants,<br/>
Govt. Higher Secondary School Shangus.</p>

<p><strong>Subject:</strong> <u>Notification regarding collection and distribution of Student Examination & RR Fee.</u></p>

<p>Sir / Madam,</p>

<p>In pursuance to the institutional admission guidelines and academic calendar for the Academic Session <strong>2025–26</strong>, it is hereby notified for the information of all concerned class incharges that the collection and reconciliation of the Registration Return (RR) and Examination Fee for <strong>Class 11th & 12th</strong> shall commence as per the schedule below:</p>

<table style="width: 100%; border-collapse: collapse; margin: 12px 0;">
  <thead>
    <tr style="background-color: #f1f5f9;">
      <th style="border: 1px solid #64748b; padding: 6px; text-align: left;">Class / Stream</th>
      <th style="border: 1px solid #64748b; padding: 6px; text-align: center;">Base Fee (RR & Exam)</th>
      <th style="border: 1px solid #64748b; padding: 6px; text-align: center;">Practical / Lab Surcharge</th>
      <th style="border: 1px solid #64748b; padding: 6px; text-align: left;">Last Date</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td style="border: 1px solid #94a3b8; padding: 6px;">Class 11th (Science)</td>
      <td style="border: 1px solid #94a3b8; padding: 6px; text-align: center;">₹1,750</td>
      <td style="border: 1px solid #94a3b8; padding: 6px; text-align: center;">+₹100 per practical subject</td>
      <td style="border: 1px solid #94a3b8; padding: 6px;">30th April 2026</td>
    </tr>
    <tr>
      <td style="border: 1px solid #94a3b8; padding: 6px;">Class 11th (Humanities/Arts)</td>
      <td style="border: 1px solid #94a3b8; padding: 6px; text-align: center;">₹1,750</td>
      <td style="border: 1px solid #94a3b8; padding: 6px; text-align: center;">+₹100 (if opt lab subject)</td>
      <td style="border: 1px solid #94a3b8; padding: 6px;">30th April 2026</td>
    </tr>
    <tr>
      <td style="border: 1px solid #94a3b8; padding: 6px;">Class 12th (All Streams)</td>
      <td style="border: 1px solid #94a3b8; padding: 6px; text-align: center;">₹1,750</td>
      <td style="border: 1px solid #94a3b8; padding: 6px; text-align: center;">+₹100 per practical subject</td>
      <td style="border: 1px solid #94a3b8; padding: 6px;">30th April 2026</td>
    </tr>
  </tbody>
</table>

<p>All class incharges are advised to ensure proper entry in the student register and deposit the collected amount with the cashier against proper institutional receipt.</p>

<p>Yours faithfully,</p>
    `,
    copyTo: ''
  },
  {
    id: 'ceo_covering',
    name: 'Covering Letter to CEO / Directorate',
    category: 'Official Submissions',
    desc: 'Forwarding letter for Student Enrollment & Subject Register to CEO Anantnag',
    refNo: 'HSS/SHG/Adm/Sub-List/2026/',
    subject: 'Submission of Student Enrollment & Subject Allocation Register for Session 2025–26.',
    bodyHtml: `
<p><strong>To,</strong><br/>
The Chief Education Officer,<br/>
District Anantnag, Kashmir.</p>

<p><strong>Subject:</strong> <u>Submission of Student Enrollment & Subject Allocation Register for Session 2025–26.</u></p>

<p><strong>Reference:</strong> <em>Your office communication No. CEO/A/Gen/2026 dated 05-04-2026.</em></p>

<p>Respected Sir,</p>

<p>With reference to the subject and communication cited above, I have the honor to submit herewith the consolidated <strong>Student Enrollment & Subject Allocation Register</strong> along with Registration Returns for <strong>Classes 9th, 10th, 11th, and 12th</strong> of Govt. Higher Secondary School Shangus for the ongoing Academic Session 2025–26.</p>

<p>The total enrollment and category-wise statistics are enclosed in the annexed roster sheets for your kind perusal and official record.</p>

<p>Thanking you.</p>

<p>Yours faithfully,</p>
    `,
    copyTo: ''
  },
  {
    id: 'office_order',
    name: 'Official Order / Deputation',
    category: 'Establishment & Orders',
    desc: 'Institutional committee assignments and administrative duty order',
    refNo: 'HSS/SHG/Estt/Order/2026/',
    subject: 'Institutional Duty & Committee Assignment Order.',
    bodyHtml: `
<p style="text-align: center; font-size: 14px; font-weight: 800; text-decoration: underline; margin-bottom: 12px;">OFFICE ORDER</p>

<p>In the interest of smooth school administration and hassle-free conduct of academic and examination affairs for the session 2025–26, the following faculty members are hereby deputed / assigned duties as detailed below with immediate effect:</p>

<ol style="margin-left: 20px; line-height: 1.8;">
  <li><strong>Admission & Documentation Committee:</strong> Overall supervision of online portal data, verification of original certificates, and registration return generation.</li>
  <li><strong>Practicals & Awards Committee:</strong> Safe upkeep of laboratory equipment, internal assessments, and continuous comprehensive evaluation records.</li>
  <li><strong>Examination Cell:</strong> Seating arrangements, question paper confidentiality, and answer booklet distribution.</li>
</ol>

<p>All concerned officials shall report compliance to the undersigned without fail.</p>
    `,
    copyTo: ''
  },
  {
    id: 'blank',
    name: 'Blank Letterhead (Custom)',
    category: 'General',
    desc: 'Clean standard template to write any custom official letter from scratch',
    refNo: 'HSS/SHG/',
    subject: '',
    bodyHtml: `
<p><strong>To,</strong><br/>
[Addressee Name / Designation],<br/>
[Department / Organization],<br/>
[Address / Location].</p>

<p><strong>Subject:</strong> <u>[Enter Subject Line Here]</u></p>

<p>Respected Sir / Madam,</p>

<p>[Type your official letter body content here. You can format text with Bold, Italic, Underline, Bulleted / Numbered lists, and Tables using the toolbar above, or use the Gemini AI Assistant to draft it automatically.]</p>

<p>Yours faithfully,</p>
    `,
    copyTo: ''
  }
];

// Quick Prompt Suggestions for Gemini AI Letter Drafter
const AI_PROMPT_SUGGESTIONS = [
  'Notification for upcoming Summer / Winter vacations and homework assignments',
  'Formal requisition letter to CEO Anantnag for laboratory equipment and chemicals',
  'Notice to parents regarding mandatory parent-teacher meeting (PTM) for 10th and 12th',
  'Office Order constituting institutional discipline and anti-ragging committee',
  'Covering letter for submitting Class 11th Registration Return (RR) hardcopies to JKBOSE',
  'Warning notice to students having short attendance below 75% threshold',
  'NOC and Character Certificate covering letter for higher studies admission'
];

export default function OfficialLetterWriterView({ onClose, onSwitchSubTab, onSwitchToRoster }) {
  // Letter Header State
  const [officeTitle, setOfficeTitle] = useState('OFFICE OF THE PRINCIPAL');
  const [institutionName, setInstitutionName] = useState('GOVT. HIGHER SECONDARY SCHOOL SHANGUS');
  const [institutionAddress, setInstitutionAddress] = useState('Anantnag, Kashmir — 192201 (J&K)');
  const [refNo, setRefNo] = useState('HSS/SHG/Fee-Dist/10th/April');
  const [dateStr, setDateStr] = useState(() => new Date().toLocaleDateString('en-GB'));
  const [signatoryName, setSignatoryName] = useState('');
  const [signatoryDesignation, setSignatoryDesignation] = useState('Principal');
  const [signatoryInstitution, setSignatoryInstitution] = useState('Govt. Hr Sec. School Shangus');
  const [copyToText, setCopyToText] = useState(''); // Default: Empty, do not show by default
  const [pageMargin, setPageMargin] = useState('0.5in');
  const [headerLayout, setHeaderLayout] = useState('logo_right'); // 'logo_right' (default) | 'logo_center' | 'logo_left'

  // Word Processor Body Content & Drawer States
  const [defaultTemplateId, setDefaultTemplateId] = useState(() => {
    try {
      return localStorage.getItem('hss_default_letter_template_id') || 'fee_notification';
    } catch {
      return 'fee_notification';
    }
  });
  const [selectedTemplateId, setSelectedTemplateId] = useState(() => {
    try {
      return localStorage.getItem('hss_default_letter_template_id') || 'fee_notification';
    } catch {
      return 'fee_notification';
    }
  });
  const [isExportingDocx, setIsExportingDocx] = useState(false);
  const [showSettingsDrawer, setShowSettingsDrawer] = useState(false);
  const [savedDraftsCount, setSavedDraftsCount] = useState(0);

  // ─── Reusable Custom Templates State ───
  const [customTemplates, setCustomTemplates] = useState(() => {
    try {
      const saved = localStorage.getItem('hss_custom_letter_templates');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.error(e);
    }
    return [];
  });
  const [showSaveTemplateModal, setShowSaveTemplateModal] = useState(false);
  const [makeTemplateDefault, setMakeTemplateDefault] = useState(true);
  const [newTplName, setNewTplName] = useState('');
  const [newTplCategory, setNewTplCategory] = useState('Official Orders & Notices');
  const [newTplDesc, setNewTplDesc] = useState('');
  const [templateFilterTab, setTemplateFilterTab] = useState('all'); // 'all' | 'custom' | 'builtin'

  // ─── Gemini AI Assistant State & Multi-Key Pool ───
  const [activeLeftTab, setActiveLeftTab] = useState('templates'); // 'templates' | 'ai'
  const [aiInsertedToast, setAiInsertedToast] = useState(false);
  const [aiMode, setAiMode] = useState('draft'); // 'draft' | 'humanize' | 'formalize' | 'shorten' | 'expand'
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiTone, setAiTone] = useState('Formal Government');
  const [aiModel, setAiModel] = useState(() => getPreferredGeminiModel());
  const [geminiKeys, setGeminiKeys] = useState(() => getStoredGeminiKeys());
  const [keysInputText, setKeysInputText] = useState(() => getStoredGeminiKeys().join('\n'));
  const [showKeysConfig, setShowKeysConfig] = useState(() => getStoredGeminiKeys().length === 0);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [aiGeneratedHtml, setAiGeneratedHtml] = useState('');
  const [aiError, setAiError] = useState('');
  const [aiSuccessKeyIndex, setAiSuccessKeyIndex] = useState(null);

  // ─── Draggable Dual-Pane Splitter State (Left Sidebar % vs Right Canvas %) ───
  const [leftSplitPct, setLeftSplitPct] = useState(() => {
    try {
      const saved = localStorage.getItem('hss_letter_split_pct');
      return saved ? Math.max(22, Math.min(60, Number(saved))) : 32;
    } catch {
      return 32;
    }
  });
  const [isDraggingSplitter, setIsDraggingSplitter] = useState(false);
  const [isDesktop, setIsDesktop] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 1024);

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleSplitterMouseDown = (e) => {
    e.preventDefault();
    setIsDraggingSplitter(true);
    const container = e.currentTarget.closest('.letter-split-container');
    if (!container) return;
    const rect = container.getBoundingClientRect();

    const handleMouseMove = (moveEvt) => {
      moveEvt.preventDefault();
      const mouseX = moveEvt.clientX - rect.left;
      const pct = Math.max(18, Math.min(60, (mouseX / rect.width) * 100));
      const rounded = Math.round(pct * 10) / 10;
      setLeftSplitPct(rounded);
      try {
        localStorage.setItem('hss_letter_split_pct', String(rounded));
      } catch {}
    };

    const handleMouseUp = () => {
      setIsDraggingSplitter(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const editorRef = useRef(null);
  const historyRef = useRef([]);
  const historyIndexRef = useRef(-1);
  const isUndoRedoActionRef = useRef(false);
  const typingTimerRef = useRef(null);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [showTableMenu, setShowTableMenu] = useState(false);
  const tableMenuRef = useRef(null);

  const updateHistoryButtons = () => {
    setCanUndo(historyIndexRef.current > 0);
    setCanRedo(historyIndexRef.current < historyRef.current.length - 1);
  };

  const pushSnapshot = (forcedHtml = null) => {
    if (!editorRef.current || isUndoRedoActionRef.current) return;
    const currentHtml = forcedHtml !== null ? forcedHtml : editorRef.current.innerHTML;

    // Prevent duplicate consecutive snapshots
    if (historyIndexRef.current >= 0 && historyRef.current[historyIndexRef.current] === currentHtml) {
      return;
    }

    const newStack = historyRef.current.slice(0, historyIndexRef.current + 1);
    newStack.push(currentHtml);
    if (newStack.length > 80) newStack.shift();

    historyRef.current = newStack;
    historyIndexRef.current = newStack.length - 1;
    updateHistoryButtons();
  };

  const handleUndo = () => {
    if (!editorRef.current || historyIndexRef.current <= 0) return;
    isUndoRedoActionRef.current = true;
    historyIndexRef.current -= 1;
    editorRef.current.innerHTML = historyRef.current[historyIndexRef.current];
    isUndoRedoActionRef.current = false;
    updateHistoryButtons();
    editorRef.current.focus();
  };

  const handleRedo = () => {
    if (!editorRef.current || historyIndexRef.current >= historyRef.current.length - 1) return;
    isUndoRedoActionRef.current = true;
    historyIndexRef.current += 1;
    editorRef.current.innerHTML = historyRef.current[historyIndexRef.current];
    isUndoRedoActionRef.current = false;
    updateHistoryButtons();
    editorRef.current.focus();
  };

  const handleEditorInput = () => {
    if (isUndoRedoActionRef.current) return;
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      pushSnapshot();
    }, 400);
  };

  const handleEditorKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
      e.preventDefault();
      handleUndo();
    } else if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) {
      e.preventDefault();
      handleRedo();
    }
  };

  // Close table dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (tableMenuRef.current && !tableMenuRef.current.contains(e.target)) {
        setShowTableMenu(false);
      }
    };
    window.addEventListener('mousedown', handleOutsideClick);
    return () => window.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Initialize editor with cloud templates, default template & first snapshot
  useEffect(() => {
    let isMounted = true;
    const initCloudTemplates = async () => {
      try {
        const { templates, defaultTemplateId: cloudDefaultId } = await fetchCloudDocTemplates('letter');
        if (!isMounted) return;

        if (templates && templates.length > 0) {
          setCustomTemplates(templates);
        }

        const activeDefId = cloudDefaultId || defaultTemplateId || 'fee_notification';
        if (cloudDefaultId) setDefaultTemplateId(cloudDefaultId);

        const allAvailable = [...(templates || []), ...BUILTIN_LETTER_TEMPLATES];
        const targetTpl = allAvailable.find(t => t.id === activeDefId) || BUILTIN_LETTER_TEMPLATES[0];

        if (targetTpl && editorRef.current) {
          setSelectedTemplateId(targetTpl.id);
          if (targetTpl.refNo) setRefNo(targetTpl.refNo);
          if (targetTpl.copyTo !== undefined) setCopyToText(targetTpl.copyTo || '');
          editorRef.current.innerHTML = targetTpl.bodyHtml;
          historyRef.current = [targetTpl.bodyHtml];
          historyIndexRef.current = 0;
          updateHistoryButtons();
        }
      } catch (err) {
        console.warn('Note: Could not sync cloud templates:', err);
      }
    };

    initCloudTemplates();
    return () => { isMounted = false; };
  }, []);

  // Format Command Executor for WYSIWYG
  const executeFormat = (command, value = null) => {
    if (!editorRef.current) return;
    pushSnapshot();
    editorRef.current.focus();
    document.execCommand(command, false, value);
    setTimeout(pushSnapshot, 50);
  };

  // Helper to find closest table elements
  const getSelectedTableElements = () => {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return null;
    let node = sel.getRangeAt(0).commonAncestorContainer;
    if (node.nodeType === 3) node = node.parentNode;
    const td = node?.closest('td, th');
    const tr = node?.closest('tr');
    const table = node?.closest('table');
    return { td, tr, table };
  };

  // ── Table Manipulation Functions ──
  const insertTable = (rows = 2, cols = 4) => {
    let tableHtml = `<table style="width:100%; border-collapse:collapse; margin:10px 0;"><thead><tr style="background-color:#f1f5f9;">`;
    for (let c = 1; c <= cols; c++) {
      tableHtml += `<th style="border:1px solid #475569; padding:5px; text-align:left;">Header ${c}</th>`;
    }
    tableHtml += `</tr></thead><tbody>`;
    for (let r = 1; r <= rows; r++) {
      tableHtml += `<tr>`;
      for (let c = 1; c <= cols; c++) {
        tableHtml += `<td style="border:1px solid #94a3b8; padding:5px;">—</td>`;
      }
      tableHtml += `</tr>`;
    }
    tableHtml += `</tbody></table><p></p>`;

    pushSnapshot();
    executeFormat('insertHTML', tableHtml);
    setTimeout(pushSnapshot, 50);
    setShowTableMenu(false);
  };

  const insertTableRow = (above = false) => {
    const ctx = getSelectedTableElements();
    if (!ctx || !ctx.tr) {
      alert('Please place your cursor inside any table cell to add a row.');
      return;
    }
    pushSnapshot();
    const cellCount = ctx.tr.children.length;
    const newTr = document.createElement('tr');
    for (let i = 0; i < cellCount; i++) {
      const td = document.createElement('td');
      td.style.border = '1px solid #94a3b8';
      td.style.padding = '5px';
      td.innerHTML = '—';
      newTr.appendChild(td);
    }
    if (above) {
      ctx.tr.parentNode.insertBefore(newTr, ctx.tr);
    } else {
      ctx.tr.parentNode.insertBefore(newTr, ctx.tr.nextSibling);
    }
    pushSnapshot();
    setShowTableMenu(false);
  };

  const deleteTableRow = () => {
    const ctx = getSelectedTableElements();
    if (!ctx || !ctx.tr) {
      alert('Please place your cursor inside a table row to delete it.');
      return;
    }
    pushSnapshot();
    const tbody = ctx.tr.parentNode;
    ctx.tr.remove();
    if (tbody && tbody.children.length === 0) {
      if (ctx.table) ctx.table.remove();
    }
    pushSnapshot();
    setShowTableMenu(false);
  };

  const insertTableColumn = (left = false) => {
    const ctx = getSelectedTableElements();
    if (!ctx || !ctx.td || !ctx.table) {
      alert('Please place your cursor inside a table cell to add a column.');
      return;
    }
    pushSnapshot();
    const colIndex = Array.from(ctx.tr.children).indexOf(ctx.td);
    const allRows = ctx.table.querySelectorAll('tr');
    allRows.forEach((row) => {
      const isHeader = row.parentNode.tagName === 'THEAD' || row.querySelector('th');
      const newCell = document.createElement(isHeader ? 'th' : 'td');
      newCell.style.border = isHeader ? '1px solid #475569' : '1px solid #94a3b8';
      newCell.style.padding = '5px';
      newCell.innerHTML = isHeader ? `Col` : `—`;
      const targetCell = row.children[colIndex];
      if (targetCell) {
        if (left) {
          row.insertBefore(newCell, targetCell);
        } else {
          row.insertBefore(newCell, targetCell.nextSibling);
        }
      } else {
        row.appendChild(newCell);
      }
    });
    pushSnapshot();
    setShowTableMenu(false);
  };

  const deleteTableColumn = () => {
    const ctx = getSelectedTableElements();
    if (!ctx || !ctx.td || !ctx.table) {
      alert('Please place your cursor inside a table cell to delete its column.');
      return;
    }
    pushSnapshot();
    const colIndex = Array.from(ctx.tr.children).indexOf(ctx.td);
    const allRows = ctx.table.querySelectorAll('tr');
    allRows.forEach(row => {
      if (row.children[colIndex]) {
        row.children[colIndex].remove();
      }
    });
    if (ctx.tr.children.length === 0) {
      ctx.table.remove();
    }
    pushSnapshot();
    setShowTableMenu(false);
  };

  const deleteEntireTable = () => {
    const ctx = getSelectedTableElements();
    if (!ctx || !ctx.table) {
      alert('Please place your cursor inside a table to delete it.');
      return;
    }
    pushSnapshot();
    ctx.table.remove();
    pushSnapshot();
    setShowTableMenu(false);
  };

  // Load Template (Builtin or Custom)
  const handleSelectTemplate = (tpl) => {
    pushSnapshot();
    setSelectedTemplateId(tpl.id);
    if (tpl.refNo) setRefNo(tpl.refNo);
    if (tpl.copyTo !== undefined) setCopyToText(tpl.copyTo || '');
    if (editorRef.current) {
      editorRef.current.innerHTML = tpl.bodyHtml;
    }
    setTimeout(pushSnapshot, 50);
  };

  // 1-Click Set as Default Template
  const handleSetDefaultTemplate = async (templateId, e) => {
    e?.stopPropagation();
    setDefaultTemplateId(templateId);
    try {
      await setCloudDefaultTemplate(templateId, 'letter');
    } catch (err) {
      console.warn('Set default warning:', err);
    }
  };

  // Save Custom Template Handler (Firebase Cloud + LocalStorage)
  const handleSaveCustomTemplate = async (e) => {
    e?.preventDefault();
    if (!newTplName.trim()) {
      alert('Please enter a template name.');
      return;
    }
    if (!editorRef.current) return;

    const templateData = {
      id: 'tpl_custom_' + Date.now(),
      name: newTplName.trim(),
      category: newTplCategory.trim() || 'General',
      desc: newTplDesc.trim() || 'Custom template saved by administrator',
      refNo: refNo || 'HSS/SHG/',
      bodyHtml: editorRef.current.innerHTML,
      copyTo: copyToText || '',
      isCustom: true
    };

    try {
      await saveCloudDocTemplate({
        type: 'letter',
        template: templateData,
        makeDefault: makeTemplateDefault
      });

      const updated = [templateData, ...customTemplates.filter(t => t.id !== templateData.id)];
      setCustomTemplates(updated);
      setSelectedTemplateId(templateData.id);
      if (makeTemplateDefault) {
        setDefaultTemplateId(templateData.id);
      }
      setShowSaveTemplateModal(false);
      setNewTplName('');
      setNewTplDesc('');
      alert(`✓ Template "${templateData.name}" successfully saved to Firebase Cloud and set as ${makeTemplateDefault ? 'Default' : 'Saved'}!`);
    } catch (err) {
      console.error(err);
      alert('Template saved locally (Cloud sync note: ' + err.message + ')');
    }
  };

  // Delete Custom Template Handler (Firebase Cloud + LocalStorage)
  const handleDeleteCustomTemplate = async (id, e) => {
    e?.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this custom template?')) return;
    try {
      await deleteCloudDocTemplate(id, 'letter');
    } catch (err) {
      console.warn(err);
    }
    const updated = customTemplates.filter(t => t.id !== id);
    setCustomTemplates(updated);
    if (selectedTemplateId === id) {
      setSelectedTemplateId(BUILTIN_LETTER_TEMPLATES[0].id);
    }
    if (defaultTemplateId === id) {
      setDefaultTemplateId('fee_notification');
    }
  };

  const insertSubjectLine = () => {
    pushSnapshot();
    executeFormat('insertHTML', '<p><strong>Subject:</strong> <u>Enter letter subject title here...</u></p>');
    setTimeout(pushSnapshot, 50);
  };

  const insertReferenceLine = () => {
    pushSnapshot();
    executeFormat('insertHTML', '<p><strong>Reference:</strong> <em>Your office communication No. ... dated ...</em></p>');
    setTimeout(pushSnapshot, 50);
  };

  const insertDividerLine = () => {
    pushSnapshot();
    executeFormat('insertHTML', '<hr style="border:none; border-top:1.5px solid #cbd5e1; margin:14px 0;" /><p></p>');
    setTimeout(pushSnapshot, 50);
  };

  // Save Draft to LocalStorage
  const handleSaveDraft = () => {
    if (!editorRef.current) return;
    const draftData = {
      officeTitle,
      institutionName,
      institutionAddress,
      refNo,
      dateStr,
      signatoryName,
      signatoryDesignation,
      signatoryInstitution,
      copyToText,
      pageMargin,
      headerLayout,
      bodyHtml: editorRef.current.innerHTML,
      savedAt: new Date().toISOString()
    };
    try {
      const existing = JSON.parse(localStorage.getItem('hss_official_letter_drafts') || '[]');
      existing.unshift(draftData);
      localStorage.setItem('hss_official_letter_drafts', JSON.stringify(existing.slice(0, 10)));
      setSavedDraftsCount(existing.length);
      alert('Official letter draft successfully saved locally!');
    } catch (e) {
      console.error(e);
    }
  };

  // Print Letter
  const handlePrint = () => {
    if (!editorRef.current) return;
    printOfficialLetter({
      officeTitle,
      institutionName,
      institutionAddress,
      refNo,
      dateStr,
      bodyHtml: editorRef.current.innerHTML,
      signatoryName,
      signatoryDesignation,
      signatoryInstitution,
      copyToText,
      pageMargin,
      headerLayout
    });
  };

  // Export to Word (.docx)
  const handleExportDocx = async () => {
    if (!editorRef.current) return;
    setIsExportingDocx(true);
    try {
      const textContent = editorRef.current.innerText || '';
      await generateOfficialLetterDocx({
        officeTitle,
        institutionName,
        institutionAddress,
        refNo,
        dateStr,
        bodyText: textContent,
        signatoryDesignation,
        signatoryInstitution,
        copyToText
      });
    } catch (err) {
      console.error(err);
      alert('Error generating DOCX document: ' + err.message);
    } finally {
      setIsExportingDocx(false);
    }
  };

  // ─── Gemini AI Handlers ───
  const handleOpenAiModal = (mode = 'draft') => {
    setAiMode(mode);
    setAiGeneratedHtml('');
    setAiError('');
    setAiSuccessKeyIndex(null);
    if (mode === 'humanize' || mode === 'formalize' || mode === 'shorten' || mode === 'expand') {
      setAiPrompt('');
    }
    const currentKeys = getStoredGeminiKeys();
    setGeminiKeys(currentKeys);
    setKeysInputText(currentKeys.join('\n'));
    setActiveLeftTab('ai');
    if (isDesktop && leftSplitPct < 32) {
      setLeftSplitPct(34);
    }
  };

  const handleSaveKeys = () => {
    const lines = keysInputText.split(/[\n,]+/).map(k => k.trim()).filter(Boolean);
    const saved = saveGeminiKeys(lines);
    setGeminiKeys(saved);
    setShowKeysConfig(false);
    setAiError('');
  };

  const handleGenerateAi = async () => {
    if (geminiKeys.length === 0) {
      setShowKeysConfig(true);
      setAiError('Please add at least one Gemini API key before generating.');
      return;
    }

    setIsGeneratingAi(true);
    setAiError('');
    setAiGeneratedHtml('');
    setAiSuccessKeyIndex(null);

    try {
      const currentContent = editorRef.current ? editorRef.current.innerHTML : '';
      const result = await generateLetterWithGemini({
        prompt: aiPrompt,
        currentContent,
        mode: aiMode,
        tone: aiTone,
        model: aiModel,
        customKeys: geminiKeys
      });

      setAiGeneratedHtml(result.html);
      setAiSuccessKeyIndex(result.usedKeyIndex);
      savePreferredGeminiModel(aiModel);
    } catch (err) {
      console.error(err);
      setAiError(err.message || 'Failed to generate letter with Gemini AI.');
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const handleApplyAiContent = (action = 'replace') => {
    if (!editorRef.current || !aiGeneratedHtml) return;
    pushSnapshot();

    if (action === 'replace') {
      editorRef.current.innerHTML = aiGeneratedHtml;
    } else if (action === 'append') {
      editorRef.current.innerHTML += `<br/>${aiGeneratedHtml}`;
    } else if (action === 'insert') {
      executeFormat('insertHTML', aiGeneratedHtml);
    }

    setTimeout(pushSnapshot, 50);
    setAiInsertedToast(true);
    setTimeout(() => setAiInsertedToast(false), 3000);
  };

  // Filtered Templates List
  const allTemplates = [
    ...customTemplates,
    ...BUILTIN_LETTER_TEMPLATES
  ];

  const displayedTemplates = templateFilterTab === 'custom'
    ? customTemplates
    : templateFilterTab === 'builtin'
      ? BUILTIN_LETTER_TEMPLATES
      : allTemplates;

  return (
    <div className="space-y-2 text-slate-800 dark:text-slate-100 animate-fadeIn">

      {/* ════════ COLLAPSIBLE LETTERHEAD & REFERENCE CONFIG DRAWER ════════ */}
      {showSettingsDrawer && (
        <div className="bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-900/60 rounded-xl p-3 shadow-sm space-y-2 animate-fadeIn text-xs">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-1.5">
            <h3 className="font-black text-[11px] text-amber-900 dark:text-amber-200 uppercase tracking-wider flex items-center gap-1.5 m-0">
              <Sliders size={12} />
              <span>Official Letterhead & Reference Configuration</span>
            </h3>
            <span className="text-[9.5px] text-slate-500">Auto-filled on print and Word document</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
            
            {/* Office Title */}
            <div>
              <label className="block text-[9.5px] font-black uppercase text-slate-500 mb-0.5">Office Header</label>
              <input
                type="text"
                value={officeTitle}
                onChange={(e) => setOfficeTitle(e.target.value)}
                placeholder="OFFICE OF THE PRINCIPAL"
                className="w-full px-2 py-0.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-black text-xs text-rose-800 dark:text-rose-300"
              />
            </div>

            {/* Ref No */}
            <div>
              <label className="block text-[9.5px] font-black uppercase text-slate-500 mb-0.5">Reference Number</label>
              <input
                type="text"
                value={refNo}
                onChange={(e) => setRefNo(e.target.value)}
                placeholder="e.g. HSS/SHG/Fee-Dist/10th/April"
                className="w-full px-2 py-0.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold text-xs"
              />
            </div>

            {/* Date */}
            <div>
              <label className="block text-[9.5px] font-black uppercase text-slate-500 mb-0.5">Letter Date</label>
              <input
                type="text"
                value={dateStr}
                onChange={(e) => setDateStr(e.target.value)}
                placeholder="e.g. 16/08/2026 or April 2026-27"
                className="w-full px-2 py-0.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold text-xs"
              />
            </div>

            {/* Page Margin */}
            <div>
              <label className="block text-[9.5px] font-black uppercase text-slate-500 mb-0.5">Print Page Margins</label>
              <select
                value={pageMargin}
                onChange={(e) => setPageMargin(e.target.value)}
                className="w-full px-2 py-0.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold text-xs"
              >
                <option value="0.5in">0.5 inch (Default - Official Standard)</option>
                <option value="0.4in">0.4 inch (Compact)</option>
                <option value="0.3in">0.3 inch (Narrow)</option>
                <option value="0.75in">0.75 inch (Medium)</option>
                <option value="1.0in">1.0 inch (Wide)</option>
              </select>
            </div>

            {/* Header Layout Alignment */}
            <div>
              <label className="block text-[9.5px] font-black uppercase text-slate-500 mb-0.5">Header Layout</label>
              <select
                value={headerLayout}
                onChange={(e) => setHeaderLayout(e.target.value)}
                className="w-full px-2 py-0.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold text-xs"
              >
                <option value="logo_right">Logo on Right (Recommended)</option>
                <option value="logo_center">Centered Header</option>
                <option value="logo_left">Logo on Left</option>
              </select>
            </div>

            {/* Signatory Designation */}
            <div>
              <label className="block text-[9.5px] font-black uppercase text-slate-500 mb-0.5">Signatory Designation</label>
              <input
                type="text"
                value={signatoryDesignation}
                onChange={(e) => setSignatoryDesignation(e.target.value)}
                placeholder="Principal"
                className="w-full px-2 py-0.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold text-xs"
              />
            </div>

            {/* Signatory Institution */}
            <div>
              <label className="block text-[9.5px] font-black uppercase text-slate-500 mb-0.5">Signatory Institution</label>
              <input
                type="text"
                value={signatoryInstitution}
                onChange={(e) => setSignatoryInstitution(e.target.value)}
                placeholder="Govt. Hr Sec. School Shangus"
                className="w-full px-2 py-0.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold text-xs"
              />
            </div>

            {/* Copy To block */}
            <div className="sm:col-span-2">
              <label className="block text-[9.5px] font-black uppercase text-slate-500 mb-0.5">
                Copy To / Dispatch Notes <span className="text-slate-400 lowercase font-normal">(leave blank to hide)</span>
              </label>
              <input
                type="text"
                value={copyToText}
                onChange={(e) => setCopyToText(e.target.value)}
                placeholder="Leave blank to hide completely, or enter e.g. 1. Worthy CEO Anantnag for info"
                className="w-full px-2 py-0.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-medium text-xs"
              />
            </div>
          </div>
        </div>
      )}

      {/* ── 2-COLUMN DRAG-RESIZABLE WORKSPACE: TEMPLATES & WYSIWYG EDITOR ── */}
      <div className="letter-split-container flex flex-col lg:flex-row gap-0 items-start w-full relative">
        
        {/* ─── LEFT SIDEBAR: REUSABLE TEMPLATES & GEMINI AI ASSISTANT ─── */}
        <div
          style={{ width: isDesktop ? `${leftSplitPct}%` : '100%' }}
          className="w-full lg:w-auto shrink-0 space-y-1.5 overflow-hidden"
        >
          {/* Top Segmented Tab Switcher */}
          <div className="flex items-center justify-between p-0.5 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setActiveLeftTab('templates')}
                className={`px-2.5 py-1 rounded-lg text-[10.5px] font-black transition-all cursor-pointer flex items-center gap-1 ${
                  activeLeftTab === 'templates'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <Sparkles size={11} className="text-amber-500" />
                <span>Templates ({allTemplates.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveLeftTab('ai')}
                className={`px-2.5 py-1 rounded-lg text-[10.5px] font-black transition-all cursor-pointer flex items-center gap-1 ${
                  activeLeftTab === 'ai'
                    ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-2xs'
                    : 'text-purple-700 dark:text-purple-300 hover:bg-purple-100/50 dark:hover:bg-purple-950/50'
                }`}
              >
                <Bot size={11} />
                <span>✨ Gemini AI</span>
              </button>
            </div>

            {activeLeftTab === 'ai' && (
              <button
                type="button"
                onClick={() => setShowKeysConfig(!showKeysConfig)}
                className={`px-2 py-0.5 rounded text-[9px] font-black border cursor-pointer transition-all flex items-center gap-1 ${
                  showKeysConfig
                    ? 'bg-amber-600 text-white border-amber-700'
                    : geminiKeys.length === 0
                    ? 'bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-200 border-amber-400 animate-pulse'
                    : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600'
                }`}
                title="Configure Gemini API Keys"
              >
                <Key size={9} className="text-amber-500" />
                <span>{geminiKeys.length === 0 ? 'Add Key' : `${geminiKeys.length} Keys`}</span>
              </button>
            )}
          </div>

          {/* ════════ TAB 1: GEMINI AI ASSISTANT (COMPACT LEFT PANEL) ════════ */}
          {activeLeftTab === 'ai' && (
            <div className="bg-white dark:bg-slate-900 border border-purple-200 dark:border-purple-900/60 rounded-xl p-2.5 shadow-2xs space-y-2 animate-fadeIn text-xs">
              
              {/* API Keys Configuration Drawer */}
              {showKeysConfig && (
                <div className="p-2.5 rounded-xl bg-amber-50/90 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 space-y-1.5 animate-fadeIn">
                  <div className="flex items-center justify-between">
                    <label className="font-black text-[10px] text-amber-950 dark:text-amber-200 flex items-center gap-1">
                      <Key size={11} className="text-amber-600" />
                      <span>Gemini API Key Pool:</span>
                    </label>
                    <a
                      href="https://aistudio.google.com/app/apikey"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[9.5px] text-amber-800 dark:text-amber-400 font-extrabold hover:underline flex items-center gap-0.5"
                    >
                      <span>Free Key</span>
                      <ExternalLink size={9} />
                    </a>
                  </div>
                  <textarea
                    rows={2}
                    value={keysInputText}
                    onChange={(e) => setKeysInputText(e.target.value)}
                    placeholder="Paste AIzaSy... here"
                    className="w-full px-2 py-1 rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900 font-mono text-[10.5px] text-slate-900 dark:text-slate-100"
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-bold text-amber-800 dark:text-amber-300">
                      {keysInputText.split(/[\n,]+/).map(k => k.trim()).filter(Boolean).length} keys detected
                    </span>
                    <button
                      type="button"
                      onClick={handleSaveKeys}
                      className="px-2.5 py-0.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-black text-[10px] cursor-pointer"
                    >
                      Save Keys
                    </button>
                  </div>
                </div>
              )}

              {/* Compact Mode Selector Pills */}
              <div className="flex items-center gap-1 overflow-x-auto pb-0.5 no-scrollbar">
                {[
                  { id: 'draft', label: '✍️ Draft' },
                  { id: 'humanize', label: '🪄 Polish' },
                  { id: 'formalize', label: '📜 Formalize' },
                  { id: 'shorten', label: '✂️ Shorten' },
                  { id: 'expand', label: '📖 Expand' }
                ].map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => { setAiMode(m.id); setAiGeneratedHtml(''); }}
                    className={`px-2 py-1 rounded-lg text-[10px] font-black whitespace-nowrap cursor-pointer transition-all border ${
                      aiMode === m.id
                        ? 'bg-purple-600 text-white border-purple-700 shadow-2xs'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-purple-50'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              {/* Prompt Input */}
              <div className="space-y-1">
                <textarea
                  rows={2}
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder={
                    aiMode === 'draft'
                      ? 'What should this letter say? (e.g. Schedule for admission fee submission by April 30th)'
                      : 'Additional refinement notes (optional)'
                  }
                  className="w-full px-2.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 font-medium text-xs text-slate-900 dark:text-slate-100 focus:bg-white focus:outline-none focus:ring-1 focus:ring-purple-500"
                />

                {/* Prompt Presets */}
                {aiMode === 'draft' && (
                  <div className="flex items-center gap-1 overflow-x-auto pb-0.5 no-scrollbar">
                    {AI_PROMPT_SUGGESTIONS.slice(0, 4).map((sug, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setAiPrompt(sug)}
                        className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-purple-50 text-slate-600 dark:text-slate-300 text-[8.5px] font-bold border border-slate-200 dark:border-slate-700 shrink-0 cursor-pointer"
                      >
                        + {sug.slice(0, 24)}...
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Model & Tone Selector Controls */}
              <div className="grid grid-cols-2 gap-1.5">
                <div>
                  <label className="block text-[9px] font-black uppercase text-slate-500 mb-0.5">Model</label>
                  <select
                    value={aiModel}
                    onChange={(e) => setAiModel(e.target.value)}
                    className="w-full px-1.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold text-[10px]"
                  >
                    {AVAILABLE_GEMINI_MODELS.map((m) => (
                      <option key={m.id} value={m.id}>{m.name.split(' (')[0]}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[9px] font-black uppercase text-slate-500 mb-0.5">Tone</label>
                  <select
                    value={aiTone}
                    onChange={(e) => setAiTone(e.target.value)}
                    className="w-full px-1.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold text-[10px]"
                  >
                    <option value="Formal Government">Formal Government</option>
                    <option value="Urgent Notice">Urgent Circular</option>
                    <option value="Polite Request">Polite Request</option>
                    <option value="Legal Notice">Strict Notice</option>
                  </select>
                </div>
              </div>

              {/* Generate AI Button */}
              <button
                type="button"
                disabled={isGeneratingAi}
                onClick={handleGenerateAi}
                className="w-full py-1.5 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-amber-600 hover:from-purple-500 hover:to-amber-500 text-white font-black text-xs cursor-pointer shadow-xs disabled:opacity-50 flex items-center justify-center gap-1.5 transition-all"
              >
                {isGeneratingAi ? (
                  <>
                    <RefreshCw size={12} className="animate-spin" />
                    <span>Drafting with Gemini...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={12} className="text-amber-200" />
                    <span>{aiMode === 'draft' ? 'Generate Letter Draft' : 'Refine Letter Text'}</span>
                  </>
                )}
              </button>

              {/* Error Banner */}
              {aiError && (
                <div className="p-2 rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-[10px] flex items-center gap-1.5">
                  <AlertCircle size={12} className="shrink-0 text-rose-600" />
                  <span>{aiError}</span>
                </div>
              )}

              {/* Generated Result Preview Card & Real-Time Live Insertion */}
              {aiGeneratedHtml && (
                <div className="space-y-1.5 pt-2 border-t border-purple-200 dark:border-purple-900/60 animate-fadeIn">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="font-black text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                      <Check size={12} />
                      <span>Draft Ready</span>
                      {aiSuccessKeyIndex !== null && (
                        <span className="text-slate-400 font-normal">
                          (Key #{aiSuccessKeyIndex + 1})
                        </span>
                      )}
                    </span>
                  </div>

                  <div
                    className="p-2 rounded-lg border border-purple-200 dark:border-purple-900 bg-purple-50/40 dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-[10.5px] max-h-36 overflow-y-auto leading-relaxed shadow-inner"
                    dangerouslySetInnerHTML={{ __html: aiGeneratedHtml }}
                  />

                  {/* Real-time Insert Actions */}
                  <div className="grid grid-cols-2 gap-1 pt-1">
                    <button
                      type="button"
                      onClick={() => handleApplyAiContent('replace')}
                      className="w-full py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[10.5px] cursor-pointer shadow-xs flex items-center justify-center gap-1 transition-transform active:scale-95"
                    >
                      <Sparkles size={11} />
                      <span>Replace Body</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyAiContent('insert')}
                      className="w-full py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-[10.5px] cursor-pointer"
                    >
                      Insert at Cursor
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ════════ TAB 2: TEMPLATES & PRESETS LIST (LEFT PANEL) ════════ */}
          {activeLeftTab === 'templates' && (
            <>
              {/* Reusable Letter Templates Manager */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-2 shadow-2xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[9.5px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1">
                    <Sparkles size={11} className="text-amber-600" />
                    <span>Templates & Presets</span>
                  </span>
                </div>

                {/* Template Filter Pills */}
                <div className="grid grid-cols-3 gap-0.5 text-[9px] font-bold text-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setTemplateFilterTab('all')}
                    className={`py-0.5 rounded cursor-pointer transition-all ${
                      templateFilterTab === 'all' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs font-black' : 'text-slate-500'
                    }`}
                  >
                    All ({allTemplates.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setTemplateFilterTab('custom')}
                    className={`py-0.5 rounded cursor-pointer transition-all ${
                      templateFilterTab === 'custom' ? 'bg-white dark:bg-slate-700 text-emerald-700 dark:text-emerald-300 shadow-2xs font-black' : 'text-slate-500'
                    }`}
                  >
                    Custom ({customTemplates.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setTemplateFilterTab('builtin')}
                    className={`py-0.5 rounded cursor-pointer transition-all ${
                      templateFilterTab === 'builtin' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs font-black' : 'text-slate-500'
                    }`}
                  >
                    Built-in ({BUILTIN_LETTER_TEMPLATES.length})
                  </button>
                </div>

                {/* Template Cards List (Compact View) */}
                <div className="space-y-1 max-h-[170px] overflow-y-auto pr-0.5">
                  {displayedTemplates.map((tpl) => {
                    const isDefault = defaultTemplateId === tpl.id;
                    return (
                      <div
                        key={tpl.id}
                        onClick={() => handleSelectTemplate(tpl)}
                        className={`w-full p-1.5 rounded-lg text-left border transition-all cursor-pointer relative group ${
                          selectedTemplateId === tpl.id
                            ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-400 dark:border-rose-700 text-rose-950 dark:text-rose-200 shadow-2xs'
                            : 'bg-slate-50/70 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-black text-[10.5px] truncate flex-1 flex items-center gap-1">
                            <span>{tpl.name}</span>
                            {isDefault && (
                              <span className="px-1 py-0.2 rounded text-[7.5px] font-black bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700 inline-flex items-center gap-0.5 shrink-0" title="Active Default Template">
                                ⭐ Default
                              </span>
                            )}
                          </span>
                          <div className="flex items-center gap-1 shrink-0">
                            {!isDefault && (
                              <button
                                type="button"
                                onClick={(e) => handleSetDefaultTemplate(tpl.id, e)}
                                className="text-slate-400 hover:text-amber-500 opacity-0 group-hover:opacity-100 transition-opacity p-0.5"
                                title="Set as Default Template (Auto-load on startup)"
                              >
                                <span className="text-[8px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-950/80 px-1 py-0.2 rounded border border-amber-200 dark:border-amber-800">Set Default</span>
                              </button>
                            )}
                            {tpl.isCustom ? (
                              <>
                                <span className="px-1 py-0.2 rounded text-[7.5px] font-black bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                                  Custom
                                </span>
                                <button
                                  type="button"
                                  onClick={(e) => handleDeleteCustomTemplate(tpl.id, e)}
                                  className="text-slate-400 hover:text-rose-600 cursor-pointer p-0.5"
                                  title="Delete custom template"
                                >
                                  <Trash2 size={9} />
                                </button>
                              </>
                            ) : (
                              <span className="px-1 py-0.2 rounded text-[7.5px] font-bold bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                                Built-in
                              </span>
                            )}
                          </div>
                        </div>
                        
                        {tpl.desc && (
                          <div className="text-[8.5px] text-slate-500 truncate mt-0.2">{tpl.desc}</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Quick Inserts & AI Writing Helpers (Single Consolidated Card) */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-2 shadow-2xs space-y-1.5">
                <span className="text-[9.5px] font-black uppercase tracking-wider text-slate-500 block">
                  Quick Inserts & AI Tools
                </span>
                <div className="grid grid-cols-2 gap-1 text-[9.5px] font-bold">
                  <button
                    type="button"
                    onClick={insertSubjectLine}
                    className="px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-left cursor-pointer truncate"
                  >
                    + Subject Line
                  </button>
                  <button
                    type="button"
                    onClick={insertReferenceLine}
                    className="px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-left cursor-pointer truncate"
                  >
                    + Reference Line
                  </button>
                  <button
                    type="button"
                    onClick={() => executeFormat('insertHorizontalRule')}
                    className="px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-left cursor-pointer truncate"
                  >
                    + Divider Line
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenAiModal('humanize')}
                    className="px-2 py-1 rounded-md bg-purple-50 dark:bg-purple-950/50 hover:bg-purple-100 text-purple-900 dark:text-purple-200 border border-purple-200 dark:border-purple-800 text-left cursor-pointer truncate flex items-center gap-1"
                    title="Humanize current text"
                  >
                    <Sparkles size={9} className="text-purple-600 shrink-0" />
                    <span>🪄 Humanize</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenAiModal('formalize')}
                    className="px-2 py-1 rounded-md bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 text-indigo-900 dark:text-indigo-200 border border-indigo-200 dark:border-indigo-800 text-left cursor-pointer truncate flex items-center gap-1"
                    title="Formal government tone"
                  >
                    <FileEdit size={9} className="text-indigo-600 shrink-0" />
                    <span>📜 Formalize</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenAiModal('shorten')}
                    className="px-2 py-1 rounded-md bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 text-amber-900 dark:text-amber-200 border border-amber-200 dark:border-amber-800 text-left cursor-pointer truncate"
                    title="Make body concise"
                  >
                    <span>✂️ Shorten</span>
                  </button>
                </div>
              </div>
            </>
          )}

        </div>

        {/* ── DRAGGABLE VERTICAL SPLITTER HANDLE ── */}
        <div
          onMouseDown={handleSplitterMouseDown}
          title="Drag horizontally to adjust workspace split width (Double-click to reset)"
          onDoubleClick={() => {
            setLeftSplitPct(28);
            try { localStorage.setItem('hss_letter_split_pct', '28'); } catch {}
          }}
          className="hidden lg:flex flex-col items-center justify-center w-3.5 self-stretch cursor-col-resize hover:bg-rose-400/20 active:bg-rose-600/30 group transition-colors z-20 shrink-0 mx-0.5"
        >
          <div className={`w-1 rounded-full transition-all group-hover:w-1.5 group-hover:bg-rose-700 ${isDraggingSplitter ? 'bg-rose-700 w-1.5 h-full shadow-md' : 'bg-slate-300 dark:bg-slate-700 h-24'}`} />
        </div>

        {/* ─── RIGHT WORKSPACE: FORMATTING TOOLBAR & A4 LIVE PAPER SHEET ─── */}
        <div
          style={{ width: isDesktop ? `${100 - leftSplitPct}%` : '100%' }}
          className="w-full lg:flex-1 space-y-1.5 pl-0 lg:pl-1 min-w-0"
        >
          
          {/* ════════ COMBINED WORD PROCESSOR FORMATTING TOOLBAR & ACTIONS (ALL ON 1 ROW) ════════ */}
          <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-2 py-1 shadow-2xs flex items-center justify-between gap-1 flex-wrap sticky top-2 z-30">
            
            {/* Left Side: Rich Text Formatting Controls */}
            <div className="flex items-center gap-1 flex-wrap">
              {/* History Undo / Redo */}
              <button
                type="button"
                title="Undo (Ctrl+Z)"
                disabled={!canUndo}
                onClick={handleUndo}
                className={`p-1 rounded cursor-pointer transition-opacity ${
                  canUndo ? 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200' : 'text-slate-300 dark:text-slate-600 opacity-40 cursor-not-allowed'
                }`}
              >
                <Undo size={13} />
              </button>
              <button
                type="button"
                title="Redo (Ctrl+Y)"
                disabled={!canRedo}
                onClick={handleRedo}
                className={`p-1 rounded cursor-pointer transition-opacity ${
                  canRedo ? 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200' : 'text-slate-300 dark:text-slate-600 opacity-40 cursor-not-allowed'
                }`}
              >
                <Redo size={13} />
              </button>

              <div className="w-[1px] h-4 bg-slate-300 dark:bg-slate-700 mx-0.5"></div>

              {/* Headings */}
              <button
                type="button"
                title="Heading 1"
                onClick={() => executeFormat('formatBlock', '<h1>')}
                className="px-1.5 py-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-black text-[10.5px] cursor-pointer"
              >
                H1
              </button>
              <button
                type="button"
                title="Heading 2"
                onClick={() => executeFormat('formatBlock', '<h2>')}
                className="px-1.5 py-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-black text-[10.5px] cursor-pointer"
              >
                H2
              </button>
              <button
                type="button"
                title="Normal Paragraph"
                onClick={() => executeFormat('formatBlock', '<p>')}
                className="px-1.5 py-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-[10.5px] cursor-pointer"
              >
                Body
              </button>

              <div className="w-[1px] h-4 bg-slate-300 dark:bg-slate-700 mx-0.5"></div>

              {/* Basic Formatting */}
              <button
                type="button"
                title="Bold (Ctrl+B)"
                onClick={() => executeFormat('bold')}
                className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 cursor-pointer font-bold"
              >
                <Bold size={13} />
              </button>
              <button
                type="button"
                title="Italic (Ctrl+I)"
                onClick={() => executeFormat('italic')}
                className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 cursor-pointer"
              >
                <Italic size={13} />
              </button>
              <button
                type="button"
                title="Underline (Ctrl+U)"
                onClick={() => executeFormat('underline')}
                className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 cursor-pointer"
              >
                <Underline size={13} />
              </button>
              <button
                type="button"
                title="Strikethrough"
                onClick={() => executeFormat('strikethrough')}
                className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 cursor-pointer"
              >
                <Strikethrough size={13} />
              </button>

              <div className="w-[1px] h-4 bg-slate-300 dark:bg-slate-700 mx-0.5"></div>

              {/* Alignments */}
              <button
                type="button"
                title="Align Left"
                onClick={() => executeFormat('justifyLeft')}
                className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 cursor-pointer"
              >
                <AlignLeft size={13} />
              </button>
              <button
                type="button"
                title="Align Center"
                onClick={() => executeFormat('justifyCenter')}
                className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 cursor-pointer"
              >
                <AlignCenter size={13} />
              </button>
              <button
                type="button"
                title="Align Right"
                onClick={() => executeFormat('justifyRight')}
                className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 cursor-pointer"
              >
                <AlignRight size={13} />
              </button>
              <button
                type="button"
                title="Justify"
                onClick={() => executeFormat('justifyFull')}
                className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 cursor-pointer"
              >
                <AlignJustify size={13} />
              </button>

              <div className="w-[1px] h-4 bg-slate-300 dark:bg-slate-700 mx-0.5"></div>

              {/* Lists */}
              <button
                type="button"
                title="Bulleted List"
                onClick={() => executeFormat('insertUnorderedList')}
                className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 cursor-pointer"
              >
                <List size={13} />
              </button>
              <button
                type="button"
                title="Numbered List"
                onClick={() => executeFormat('insertOrderedList')}
                className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 cursor-pointer"
              >
                <ListOrdered size={13} />
              </button>

              <div className="w-[1px] h-4 bg-slate-300 dark:bg-slate-700 mx-0.5"></div>

              {/* Interactive Table Tools Dropdown */}
              <div className="relative inline-block" ref={tableMenuRef}>
                <button
                  type="button"
                  title="Table Tools & Column / Row Controls"
                  onClick={() => setShowTableMenu(!showTableMenu)}
                  className="px-1.5 py-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold text-[10.5px] flex items-center gap-1 cursor-pointer bg-slate-50 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700"
                >
                  <TableIcon size={12} className="text-indigo-600 dark:text-indigo-400" />
                  <span>Table</span>
                  <ChevronDown size={11} className="text-slate-500" />
                </button>

                {showTableMenu && (
                  <div className="absolute left-0 top-full mt-1 w-52 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-50 p-1 space-y-0.5 text-xs font-bold animate-fadeIn">
                    <div className="px-2 py-1 text-[9px] font-black uppercase text-slate-400 border-b border-slate-100 dark:border-slate-800">
                      Table Operations
                    </div>
                    <button
                      type="button"
                      onClick={() => insertTable(2, 4)}
                      className="w-full text-left px-2 py-1 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-950 text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5 cursor-pointer text-[10.5px]"
                    >
                      <PlusCircle size={12} className="text-indigo-600" />
                      <span>Insert 4×2 Table</span>
                    </button>
                    <div className="w-full border-t border-slate-100 dark:border-slate-800 my-0.5"></div>
                    <button
                      type="button"
                      onClick={() => insertTableRow(false)}
                      className="w-full text-left px-2 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center gap-1.5 cursor-pointer text-[10.5px]"
                    >
                      <CornerDownLeft size={12} className="text-emerald-600" />
                      <span>Add Row Below</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => insertTableRow(true)}
                      className="w-full text-left px-2 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center gap-1.5 cursor-pointer text-[10.5px]"
                    >
                      <CornerDownLeft size={12} className="text-emerald-600 rotate-180" />
                      <span>Add Row Above</span>
                    </button>
                    <button
                      type="button"
                      onClick={deleteTableRow}
                      className="w-full text-left px-2 py-1 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950 text-rose-700 dark:text-rose-300 flex items-center gap-1.5 cursor-pointer text-[10.5px]"
                    >
                      <Trash2 size={12} />
                      <span>Delete Current Row</span>
                    </button>
                    <div className="w-full border-t border-slate-100 dark:border-slate-800 my-0.5"></div>
                    <button
                      type="button"
                      onClick={() => insertTableColumn(false)}
                      className="w-full text-left px-2 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center gap-1.5 cursor-pointer text-[10.5px]"
                    >
                      <Plus size={12} className="text-blue-600" />
                      <span>Add Column Right</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => insertTableColumn(true)}
                      className="w-full text-left px-2 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center gap-1.5 cursor-pointer text-[10.5px]"
                    >
                      <Plus size={12} className="text-blue-600" />
                      <span>Add Column Left</span>
                    </button>
                    <button
                      type="button"
                      onClick={deleteTableColumn}
                      className="w-full text-left px-2 py-1 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950 text-rose-700 dark:text-rose-300 flex items-center gap-1.5 cursor-pointer text-[10.5px]"
                    >
                      <Trash2 size={12} />
                      <span>Delete Current Column</span>
                    </button>
                    <div className="w-full border-t border-slate-100 dark:border-slate-800 my-0.5"></div>
                    <button
                      type="button"
                      onClick={deleteEntireTable}
                      className="w-full text-left px-2 py-1 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-900 dark:text-rose-200 flex items-center gap-1.5 cursor-pointer text-[10.5px] font-black"
                    >
                      <Trash2 size={12} />
                      <span>Delete Entire Table</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Quick AI Action in Toolbar */}
              <button
                type="button"
                onClick={() => handleOpenAiModal('humanize')}
                className="px-2 py-0.5 rounded bg-purple-50 dark:bg-purple-950/60 hover:bg-purple-100 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-800 font-black text-[10.5px] flex items-center gap-1 cursor-pointer shadow-2xs"
                title="Enhance & humanize current letter text with Gemini"
              >
                <Wand2 size={11} className="text-purple-600" />
                <span>AI Polish</span>
              </button>

              {/* Clear Formatting */}
              <button
                type="button"
                title="Remove Formatting"
                onClick={() => executeFormat('removeFormat')}
                className="px-1.5 py-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 font-bold text-[10px] cursor-pointer"
              >
                Clear
              </button>
            </div>

            {/* Right Side: Primary Actions & AI (Same Row) */}
            <div className="flex items-center gap-1.5 flex-wrap ml-auto">
              
              {/* Gemini AI Assistant Button */}
              <button
                type="button"
                onClick={() => handleOpenAiModal('draft')}
                className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-purple-600 via-indigo-600 to-amber-600 hover:from-purple-500 hover:to-amber-500 text-white font-black text-[10.5px] flex items-center gap-1 cursor-pointer shadow-xs transition-all active:scale-95 border border-purple-400/40"
                title="Draft or humanize letter with latest Gemini models"
              >
                <Sparkles size={11} className="text-amber-200 animate-pulse" />
                <span>✨ Gemini AI</span>
              </button>

              {/* Toggle Header & Reference Config Drawer */}
              <button
                type="button"
                onClick={() => setShowSettingsDrawer(!showSettingsDrawer)}
                className={`px-2.5 py-1 rounded-lg border font-extrabold text-[10.5px] flex items-center gap-1 cursor-pointer shadow-2xs transition-all ${
                  showSettingsDrawer
                    ? 'bg-amber-600 text-white border-amber-700'
                    : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:bg-amber-50'
                }`}
              >
                <Sliders size={11} />
                <span>Letterhead Details</span>
              </button>

              {/* Save Template */}
              <button
                type="button"
                onClick={() => setShowSaveTemplateModal(true)}
                className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 font-extrabold text-[10.5px] flex items-center gap-1 cursor-pointer shadow-2xs transition-all"
                title="Save current letter as a reusable template"
              >
                <BookmarkPlus size={11} className="text-emerald-600 dark:text-emerald-400" />
                <span>Save Template</span>
              </button>

              {/* Export to Word (.docx) */}
              <button
                type="button"
                disabled={isExportingDocx}
                onClick={handleExportDocx}
                className="px-2.5 py-1 rounded-lg bg-blue-700 hover:bg-blue-600 text-white font-black text-[10.5px] flex items-center gap-1 cursor-pointer shadow-xs disabled:opacity-50 transition-all"
                title="Download Word Document (.docx)"
              >
                <Download size={11} />
                <span>{isExportingDocx ? 'Generating...' : 'Word (.docx)'}</span>
              </button>

              {/* Print / Save PDF */}
              <button
                type="button"
                onClick={handlePrint}
                className="px-3 py-1 rounded-lg bg-gradient-to-r from-rose-700 to-amber-700 hover:from-rose-600 hover:to-amber-600 text-white font-black text-[10.5px] flex items-center gap-1 cursor-pointer shadow-xs transition-all active:scale-95"
                title="Print or Save as PDF"
              >
                <Printer size={11} />
                <span>Print / Save PDF</span>
              </button>
            </div>

          </div>

          {/* Real-time Draft Insertion Notification Alert */}
          {aiInsertedToast && (
            <div className="p-2 rounded-xl bg-emerald-600 text-white font-black text-xs text-center shadow-md animate-fadeIn flex items-center justify-center gap-1.5">
              <Check size={14} className="text-emerald-200" />
              <span>✓ Draft successfully inserted into letter canvas in real-time!</span>
            </div>
          )}

          {/* ════════ A4 PAPER LIVE VIEWPORT & EDITOR ════════ */}
          {/* Note: Compact min-height and natural document flow so Principal sits close to letter body */}
          <div className="bg-white text-slate-900 border border-slate-300 rounded-xl p-4 sm:p-6 shadow-sm max-w-[780px] mx-auto min-h-[420px] flex flex-col justify-start">
            
            {/* Top Official Letterhead Header Banner (Soft Ice-Blue Background) */}
            <div className="-mx-4 sm:-mx-6 -mt-4 sm:-mt-6 p-4 sm:p-5 text-center bg-[#f0f8ff] border-b-[2.5px] border-[#800000] rounded-t-xl mb-3">
              <img
                src="/logo192.png"
                alt="School Seal"
                style={{ width: '48px', height: '48px', maxWidth: '48px', maxHeight: '48px', objectFit: 'contain' }}
                className="w-12 h-12 object-contain mx-auto mb-1.5 drop-shadow-xs"
                onError={(e) => { e.target.src = '/logo.png'; e.target.onerror = null; }}
              />
              <h3 className="text-[11px] sm:text-xs font-black text-[#800000] uppercase tracking-[1.5px] m-0">
                {officeTitle || 'OFFICE OF THE PRINCIPAL'}
              </h3>
              <h1 className="text-base sm:text-lg font-black text-[#0a192f] tracking-wide uppercase m-0 mt-0.5 font-serif">
                {institutionName || 'GOVT. HIGHER SECONDARY SCHOOL SHANGUS'}
              </h1>
              <p className="text-[10px] text-slate-600 font-semibold m-0 mt-0.5">
                {institutionAddress || 'Anantnag, Kashmir — 192201 (J&K)'}
              </p>
            </div>

            <div>
              {/* Reference Number & Date Row */}
              <div className="flex items-center justify-between text-xs font-bold mb-4 px-1">
                <div>
                  <span className="text-[#800000] font-black">Ref. No.:</span>{' '}
                  <span className="text-slate-900 font-semibold">{refNo || '—'}</span>
                </div>
                <div>
                  <span className="text-[#800000] font-black">Date:</span>{' '}
                  <span className="text-slate-900 font-semibold">{dateStr || new Date().toLocaleDateString('en-GB')}</span>
                </div>
              </div>

              {/* ── WYSIWYG CONTENT-EDITABLE MAIN BODY ── */}
              <div
                ref={editorRef}
                contentEditable={true}
                suppressContentEditableWarning={true}
                onInput={handleEditorInput}
                onKeyDown={handleEditorKeyDown}
                className="outline-none focus:ring-1 focus:ring-amber-400 rounded-lg p-2 min-h-[160px] text-[13px] leading-relaxed text-slate-900"
                style={{ textAlign: 'justify' }}
              />
            </div>

            {/* Bottom Section: Signatories & Dispatch (Positioned closely below body) */}
            <div className="mt-6 pt-3 border-t border-slate-100">
              {/* Signatory Block — Positioned closely below body */}
              <div className="flex justify-end text-right">
                <div className="w-56 text-center space-y-0.5">
                  {signatoryName && (
                    <div className="font-bold text-xs text-slate-800">{signatoryName}</div>
                  )}
                  <div className="font-black text-[13px] text-[#0a192f] uppercase">
                    {signatoryDesignation || 'Principal'}
                  </div>
                  <div className="font-semibold text-[11px] text-slate-600">
                    {signatoryInstitution || institutionName}
                  </div>
                </div>
              </div>

              {/* Copy To / Dispatch block (Only displayed if non-empty) */}
              {copyToText && copyToText.trim().length > 0 && (
                <div className="mt-4 pt-2 border-t border-dashed border-slate-300 text-[10.5px] text-slate-600">
                  <div className="font-black text-slate-900 mb-0.5">Copy to the:</div>
                  <div className="whitespace-pre-line leading-tight">{copyToText}</div>
                </div>
              )}
            </div>

          </div>

        </div>

      </div>

      {/* ════════ SAVE AS REUSABLE TEMPLATE MODAL ════════ */}
      {showSaveTemplateModal && (
        <div className="fixed inset-0 z-[999999] bg-black/70 backdrop-blur-xs flex items-center justify-center p-3">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl border border-emerald-300 dark:border-emerald-900/80 p-5 space-y-4 animate-fadeIn">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-600 text-white shadow-md">
                  <BookmarkPlus size={18} />
                </div>
                <div>
                  <h3 className="font-black text-sm text-slate-900 dark:text-white m-0">
                    Save as Reusable Template
                  </h3>
                  <p className="text-[10px] text-slate-500 font-medium m-0">
                    Give this letter a title & category to recognize and reuse it anytime.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSaveTemplateModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveCustomTemplate} className="space-y-3 text-xs">
              <div>
                <label className="block text-[10.5px] font-black uppercase text-slate-600 dark:text-slate-400 mb-1">
                  Template Name *
                </label>
                <input
                  type="text"
                  required
                  value={newTplName}
                  onChange={(e) => setNewTplName(e.target.value)}
                  placeholder="e.g. JKBOSE Registration Return Covering Letter"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold text-xs"
                />
              </div>

              <div>
                <label className="block text-[10.5px] font-black uppercase text-slate-600 dark:text-slate-400 mb-1">
                  Category / Group
                </label>
                <input
                  type="text"
                  value={newTplCategory}
                  onChange={(e) => setNewTplCategory(e.target.value)}
                  placeholder="e.g. Admissions & Exams / General Circulars"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-medium text-xs"
                />
              </div>

              <div>
                <label className="block text-[10.5px] font-black uppercase text-slate-600 dark:text-slate-400 mb-1">
                  Short Description (Optional)
                </label>
                <textarea
                  rows={2}
                  value={newTplDesc}
                  onChange={(e) => setNewTplDesc(e.target.value)}
                  placeholder="Brief note to help recognize this template in the future..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-medium text-xs"
                />
              </div>

              {/* Set as Default Checkbox */}
              <label className="flex items-center gap-2.5 p-2.5 rounded-xl bg-amber-50/80 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={makeTemplateDefault}
                  onChange={(e) => setMakeTemplateDefault(e.target.checked)}
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 accent-emerald-600 cursor-pointer shrink-0"
                />
                <div className="text-xs">
                  <span className="font-black text-amber-950 dark:text-amber-200 block">⭐ Make Default Active Template</span>
                  <span className="text-[10px] text-amber-800 dark:text-amber-400 block">Auto-loads on studio launch and saves directly to Firebase Cloud.</span>
                </div>
              </label>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowSaveTemplateModal(false)}
                  className="px-3.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 font-bold text-xs cursor-pointer hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs cursor-pointer shadow-md flex items-center gap-1"
                >
                  <Save size={13} />
                  <span>Save Template</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
