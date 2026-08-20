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
  Key, Wand2, Shield, AlertCircle, ExternalLink, X, FileEdit, Plus, Minus,
  BookmarkPlus, FolderPlus, Award, History, RemoveFormatting, Palette, CheckCircle2,
  Info, AlertTriangle
} from 'lucide-react';
import {
  printOfficialLetter,
  generateOfficialLetterDocx
} from '../../utils/officialLetterExportUtils';
import {
  AVAILABLE_GEMINI_MODELS,
  getStoredGeminiKeys,
  saveGeminiKeys,
  fetchCloudGeminiKeys,
  saveCloudGeminiKeys,
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
import { saveGeneratedDocToHistory } from '../../services/docHistoryService';
import DocumentHistoryModal from './DocumentHistoryModal';
import ConfirmModal from '../components/ConfirmModal';

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

export default function OfficialLetterWriterView({
  onClose,
  onSwitchSubTab,
  onSwitchToRoster,
  showSettingsDrawerProp,
  onToggleSettingsDrawer
}) {
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
  const [dockSide, setDockSide] = useState(() => {
    try {
      return localStorage.getItem('hss_letter_dock_side') || 'right';
    } catch {
      return 'right';
    }
  });

  // Sync external Setup toggle from Top Sub-Nav bar
  useEffect(() => {
    if (showSettingsDrawerProp !== undefined) {
      setShowSettingsDrawer(showSettingsDrawerProp);
    }
  }, [showSettingsDrawerProp]);

  useEffect(() => {
    const handleToggle = () => setShowSettingsDrawer(prev => !prev);
    window.addEventListener('hss-toggle-studio-setup', handleToggle);
    return () => window.removeEventListener('hss-toggle-studio-setup', handleToggle);
  }, []);

  // ─── Reusable Custom Templates State ───
  const [templateToDelete, setTemplateToDelete] = useState(null);
  const [isDeletingTemplate, setIsDeletingTemplate] = useState(false);
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
  const [templateSaveMode, setTemplateSaveMode] = useState('update'); // 'update' | 'new'
  const [makeTemplateDefault, setMakeTemplateDefault] = useState(true);
  const [newTplName, setNewTplName] = useState('');
  const [newTplCategory, setNewTplCategory] = useState('Official Orders & Notices');
  const [newTplDesc, setNewTplDesc] = useState('');
  const [templateFilterTab, setTemplateFilterTab] = useState('all'); // 'all' | 'custom' | 'builtin'
  const [activeTableContext, setActiveTableContext] = useState(null);
  const lastActiveTableRef = useRef(null);
  const savedRangeRef = useRef(null);
  const [savedRange, setSavedRange] = useState(null);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [toast, setToast] = useState(null); // { message: string, type: 'success' | 'error' | 'info' | 'warning' }
  const toastTimeoutRef = useRef(null);

  const [activeFormats, setActiveFormats] = useState({
    bold: false,
    italic: false,
    underline: false,
    strikeThrough: false,
    h1: false,
    h2: false,
    p: false,
    justifyLeft: false,
    justifyCenter: false,
    justifyRight: false,
    justifyFull: false,
    insertUnorderedList: false,
    insertOrderedList: false
  });

  const checkActiveFormats = () => {
    if (typeof window === 'undefined' || !editorRef.current) return;
    try {
      const sel = window.getSelection();
      let isH1 = false;
      let isH2 = false;
      let isP = false;

      if (sel && sel.rangeCount > 0 && editorRef.current.contains(sel.anchorNode)) {
        let node = sel.getRangeAt(0).commonAncestorContainer;
        if (node.nodeType === 3) node = node.parentNode;
        const blockParent = node?.closest('h1, h2, h3, h4, h5, h6, p, blockquote, div');
        const tag = blockParent?.tagName?.toLowerCase();
        if (tag === 'h1') isH1 = true;
        else if (tag === 'h2') isH2 = true;
        else if (tag === 'p' || tag === 'div' || !tag) isP = true;
      }

      setActiveFormats({
        bold: document.queryCommandState('bold'),
        italic: document.queryCommandState('italic'),
        underline: document.queryCommandState('underline'),
        strikeThrough: document.queryCommandState('strikeThrough'),
        h1: isH1,
        h2: isH2,
        p: isP,
        justifyLeft: document.queryCommandState('justifyLeft'),
        justifyCenter: document.queryCommandState('justifyCenter'),
        justifyRight: document.queryCommandState('justifyRight'),
        justifyFull: document.queryCommandState('justifyFull'),
        insertUnorderedList: document.queryCommandState('insertUnorderedList'),
        insertOrderedList: document.queryCommandState('insertOrderedList')
      });
    } catch {}
  };

  const saveCurrentSelection = () => {
    if (typeof window !== 'undefined' && window.getSelection) {
      const sel = window.getSelection();
      if (sel.rangeCount > 0 && editorRef.current && editorRef.current.contains(sel.anchorNode)) {
        savedRangeRef.current = sel.getRangeAt(0).cloneRange();
        setSavedRange(savedRangeRef.current);
      }
    }
  };
  const showToast = (message, type = 'success', duration = 3500) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToast({ message, type });
    toastTimeoutRef.current = setTimeout(() => {
      setToast(null);
    }, duration);
  };

  // ─── Gemini AI Assistant State & Multi-Key Pool ───
  const [activeLeftTab, setActiveLeftTab] = useState('templates'); // 'templates' | 'ai'
  const [aiMode, setAiMode] = useState('draft'); // 'draft' | 'humanize' | 'formalize' | 'shorten' | 'expand'
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiTone, setAiTone] = useState('Formal Government');
  const [aiModel, setAiModel] = useState(() => getPreferredGeminiModel());
  const [geminiKeys, setGeminiKeys] = useState(() => getStoredGeminiKeys());
  const [keysInputText, setKeysInputText] = useState(() => getStoredGeminiKeys().join('\n'));
  const [showKeysConfig, setShowKeysConfig] = useState(false); // Hidden by default
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
  const [showAiMenu, setShowAiMenu] = useState(false);
  const aiMenuRef = useRef(null);
  const [showDocMenu, setShowDocMenu] = useState(false);
  const docMenuRef = useRef(null);
  const [showColorMenu, setShowColorMenu] = useState(false);
  const colorMenuRef = useRef(null);
  const [showQuickInsertMenu, setShowQuickInsertMenu] = useState(false);
  const quickInsertMenuRef = useRef(null);
  const [showAskGeminiMenu, setShowAskGeminiMenu] = useState(false);
  const askGeminiMenuRef = useRef(null);

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

  // Close menus on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (tableMenuRef.current && !tableMenuRef.current.contains(e.target)) {
        setShowTableMenu(false);
      }
      if (aiMenuRef.current && !aiMenuRef.current.contains(e.target)) {
        setShowAiMenu(false);
      }
      if (docMenuRef.current && !docMenuRef.current.contains(e.target)) {
        setShowDocMenu(false);
      }
      if (colorMenuRef.current && !colorMenuRef.current.contains(e.target)) {
        setShowColorMenu(false);
      }
      if (quickInsertMenuRef.current && !quickInsertMenuRef.current.contains(e.target)) {
        setShowQuickInsertMenu(false);
      }
      if (askGeminiMenuRef.current && !askGeminiMenuRef.current.contains(e.target)) {
        setShowAskGeminiMenu(false);
      }
    };
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, []);

  const handleOpenAiStudio = (mode = 'draft') => {
    setActiveLeftTab('ai');
    setAiMode(mode);
    setShowAiMenu(false);
    setShowAskGeminiMenu(false);
  };

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
          if (targetTpl.officeTitle) setOfficeTitle(targetTpl.officeTitle);
          if (targetTpl.institutionName) setInstitutionName(targetTpl.institutionName);
          if (targetTpl.institutionAddress) setInstitutionAddress(targetTpl.institutionAddress);
          if (targetTpl.refNo) setRefNo(targetTpl.refNo);
          if (targetTpl.signatoryName !== undefined) setSignatoryName(targetTpl.signatoryName);
          if (targetTpl.signatoryDesignation !== undefined) setSignatoryDesignation(targetTpl.signatoryDesignation);
          if (targetTpl.signatoryInstitution !== undefined) setSignatoryInstitution(targetTpl.signatoryInstitution);
          if (targetTpl.pageMargin !== undefined) setPageMargin(targetTpl.pageMargin);
          if (targetTpl.headerLayout !== undefined) setHeaderLayout(targetTpl.headerLayout);
          if (targetTpl.copyTo !== undefined) setCopyToText(targetTpl.copyTo || '');
          editorRef.current.innerHTML = targetTpl.bodyHtml;
          historyRef.current = [targetTpl.bodyHtml];
          historyIndexRef.current = 0;
          updateHistoryButtons();
        }

        // Fetch Cloud Gemini Keys
        fetchCloudGeminiKeys().then(keys => {
          if (!isMounted) return;
          if (keys && keys.length > 0) {
            setGeminiKeys(keys);
            setKeysInputText(keys.join('\n'));
          }
        }).catch(err => console.warn('Could not sync cloud Gemini keys:', err));
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

    try {
      document.execCommand('styleWithCSS', false, true);
    } catch {}

    const sel = window.getSelection();
    const activeRange = savedRangeRef.current || savedRange;
    if (activeRange && sel) {
      try {
        if (sel.rangeCount === 0 || !editorRef.current.contains(sel.anchorNode)) {
          sel.removeAllRanges();
          sel.addRange(activeRange);
        }
      } catch {}
    }

    try {
      if (command === 'formatBlock') {
        const targetClean = (value || 'p').replace(/[<>]/g, '').toLowerCase();
        let currentBlock = null;
        if (sel && sel.rangeCount > 0) {
          let node = sel.getRangeAt(0).commonAncestorContainer;
          if (node.nodeType === 3) node = node.parentNode;
          currentBlock = node?.closest('h1, h2, h3, h4, h5, h6, p, blockquote, div');
        }

        const currentTag = currentBlock?.tagName?.toLowerCase() || 'p';
        const isSameTag = currentTag === targetClean;

        // If clicking the active heading again, toggle off to normal paragraph '<p>'
        const newTag = (isSameTag && targetClean !== 'p') ? 'p' : targetClean;

        let success = document.execCommand('formatBlock', false, `<${newTag}>`);
        if (!success) {
          success = document.execCommand('formatBlock', false, newTag);
        }

        if (currentBlock && currentBlock.isConnected && currentBlock !== editorRef.current) {
          if (currentBlock.tagName.toLowerCase() !== newTag) {
            const newElem = document.createElement(newTag);
            newElem.innerHTML = currentBlock.innerHTML;
            currentBlock.parentNode.replaceChild(newElem, currentBlock);
            const r = document.createRange();
            r.selectNodeContents(newElem);
            sel.removeAllRanges();
            sel.addRange(r);
          }
        }
      } else {
        document.execCommand(command, false, value);
      }
    } catch (err) {
      console.warn('Formatting command error:', err);
    }
    saveCurrentSelection();
    setTimeout(() => {
      pushSnapshot();
      checkTableContext();
      checkActiveFormats();
    }, 50);
  };

  // Instantaneous Text Color Application with CSS styling & smart selection recovery
  const applyTextColor = (color) => {
    if (!editorRef.current) return;
    pushSnapshot();
    editorRef.current.focus();

    // 1. Enable CSS inline styles so color overrides all parent CSS classes immediately
    try {
      document.execCommand('styleWithCSS', false, true);
    } catch {}

    // 2. Restore saved selection if shifted or blurred
    const sel = window.getSelection();
    const activeRange = savedRangeRef.current || savedRange;
    if (activeRange && sel) {
      try {
        if (sel.rangeCount === 0 || !editorRef.current.contains(sel.anchorNode)) {
          sel.removeAllRanges();
          sel.addRange(activeRange);
        }
      } catch {}
    }

    // 3. If selection is collapsed inside text, auto-expand to word under cursor
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      if (range.collapsed && editorRef.current.contains(range.startContainer)) {
        const node = range.startContainer;
        if (node.nodeType === 3) {
          const text = node.nodeValue || '';
          let start = range.startOffset;
          let end = range.startOffset;
          while (start > 0 && !/\s/.test(text[start - 1])) start--;
          while (end < text.length && !/\s/.test(text[end])) end++;
          if (start < end) {
            const wordRange = document.createRange();
            wordRange.setStart(node, start);
            wordRange.setEnd(node, end);
            sel.removeAllRanges();
            sel.addRange(wordRange);
          }
        }
      }
    }

    // 4. Apply text color command
    try {
      const ok = document.execCommand('foreColor', false, color);
      if (!ok) {
        document.execCommand('styleWithCSS', false, false);
        document.execCommand('foreColor', false, color);
      }
    } catch (err) {
      console.warn('Text color command error:', err);
    }

    saveCurrentSelection();
    setTimeout(() => {
      pushSnapshot();
      checkTableContext();
    }, 50);
    showToast(`Color applied (${color})`, 'info', 1500);
  };

  // Helper to find closest table elements (with persistent fallback cache)
  const getSelectedTableElements = () => {
    // 1. Try active live selection
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      let node = sel.getRangeAt(0).commonAncestorContainer;
      if (node.nodeType === 3) node = node.parentNode;
      const td = node?.closest('td, th');
      const tr = node?.closest('tr');
      const table = node?.closest('table');
      if (td && tr && table) {
        const colIndex = Array.from(tr.children).indexOf(td);
        const allTrs = Array.from(table.querySelectorAll('tr'));
        const rowIndex = allTrs.indexOf(tr);
        lastActiveTableRef.current = { td, tr, table, colIndex, rowIndex };
        return { td, tr, table, colIndex, rowIndex };
      }
      if (table) {
        const firstTr = table.querySelector('tr');
        const firstTd = firstTr?.querySelector('td, th');
        return { td: firstTd, tr: firstTr, table, colIndex: 0, rowIndex: 0 };
      }
    }

    // 2. Fall back to cached last active table elements if valid and still connected to DOM
    if (lastActiveTableRef.current && lastActiveTableRef.current.table?.isConnected) {
      const { td, tr, table } = lastActiveTableRef.current;
      const validTable = table.isConnected ? table : editorRef.current?.querySelector('table');
      if (validTable) {
        const validTr = tr?.isConnected ? tr : validTable.querySelector('tr');
        const validTd = td?.isConnected ? td : validTr?.querySelector('td, th');
        const colIndex = validTr ? Array.from(validTr.children).indexOf(validTd) : 0;
        const rowIndex = validTr ? Array.from(validTable.querySelectorAll('tr')).indexOf(validTr) : 0;
        return { td: validTd, tr: validTr, table: validTable, colIndex: Math.max(0, colIndex), rowIndex: Math.max(0, rowIndex) };
      }
    }

    // 3. Fall back to first table inside editor if present
    if (editorRef.current) {
      const table = editorRef.current.querySelector('table');
      if (table) {
        const firstTr = table.querySelector('tr');
        const firstTd = firstTr?.querySelector('td, th');
        return { td: firstTd, tr: firstTr, table, colIndex: 0, rowIndex: 0 };
      }
    }

    return null;
  };

  // Inspect and update active table context state
  const checkTableContext = () => {
    const ctx = getSelectedTableElements();
    if (ctx && ctx.table) {
      const allTrs = Array.from(ctx.table.querySelectorAll('tr'));
      const colIndex = ctx.colIndex !== undefined ? ctx.colIndex : (ctx.tr && ctx.td ? Array.from(ctx.tr.children).indexOf(ctx.td) : 0);
      const rowIndex = ctx.rowIndex !== undefined ? ctx.rowIndex : (ctx.tr ? allTrs.indexOf(ctx.tr) : 0);
      const totalCols = ctx.tr ? ctx.tr.children.length : (ctx.table.querySelector('tr')?.children.length || 0);
      const totalRows = allTrs.length;

      setActiveTableContext({
        colIndex: Math.max(0, colIndex),
        rowIndex: Math.max(0, rowIndex),
        totalCols,
        totalRows,
        hasTable: true
      });
    } else {
      const hasAnyTable = !!editorRef.current?.querySelector('table');
      if (hasAnyTable) {
        const table = editorRef.current.querySelector('table');
        const allTrs = Array.from(table.querySelectorAll('tr'));
        setActiveTableContext({
          colIndex: 0,
          rowIndex: 0,
          totalCols: table.querySelector('tr')?.children.length || 0,
          totalRows: allTrs.length,
          hasTable: true
        });
      } else {
        setActiveTableContext(null);
      }
    }
  };

  // ── Table Manipulation Functions ──
  const insertTable = (rows = 2, cols = 4) => {
    let tableHtml = `<table style="width:100%; border-collapse:collapse; margin:12px 0;"><thead><tr style="background-color:#f1f5f9;">`;
    for (let c = 1; c <= cols; c++) {
      tableHtml += `<th style="border:1px solid #475569; padding:6px 8px; text-align:left; font-weight:700; font-size:12px;">Header ${c}</th>`;
    }
    tableHtml += `</tr></thead><tbody>`;
    for (let r = 1; r <= rows; r++) {
      tableHtml += `<tr>`;
      for (let c = 1; c <= cols; c++) {
        tableHtml += `<td style="border:1px solid #94a3b8; padding:6px 8px; font-size:12px;">—</td>`;
      }
      tableHtml += `</tr>`;
    }
    tableHtml += `</tbody></table><p></p>`;

    pushSnapshot();
    executeFormat('insertHTML', tableHtml);
    setTimeout(() => {
      pushSnapshot();
      checkTableContext();
    }, 50);
    setShowTableMenu(false);
  };

  const insertTableRow = (above = false) => {
    const ctx = getSelectedTableElements();
    if (!ctx || !ctx.table) {
      insertTable(2, 4);
      return;
    }
    pushSnapshot();
    const allRows = Array.from(ctx.table.querySelectorAll('tr'));
    if (allRows.length === 0) return;

    const colCount = allRows[0]?.children.length || 4;
    const newTr = document.createElement('tr');
    for (let i = 0; i < colCount; i++) {
      const td = document.createElement('td');
      td.style.border = '1px solid #94a3b8';
      td.style.padding = '6px 8px';
      td.style.fontSize = '12px';
      td.innerHTML = '—';
      newTr.appendChild(td);
    }

    const targetRow = ctx.tr || allRows[allRows.length - 1];
    if (targetRow && targetRow.parentNode) {
      if (above && targetRow.parentNode.tagName !== 'THEAD') {
        targetRow.parentNode.insertBefore(newTr, targetRow);
      } else {
        targetRow.parentNode.insertBefore(newTr, targetRow.nextSibling);
      }
    } else {
      const tbody = ctx.table.querySelector('tbody') || ctx.table;
      tbody.appendChild(newTr);
    }

    lastActiveTableRef.current = { td: newTr.children[0], tr: newTr, table: ctx.table, colIndex: 0, rowIndex: allRows.length };
    pushSnapshot();
    checkTableContext();
    setShowTableMenu(false);
  };

  const deleteTableRow = () => {
    const ctx = getSelectedTableElements();
    if (!ctx || !ctx.table) return;

    pushSnapshot();
    const allRows = Array.from(ctx.table.querySelectorAll('tr'));
    if (allRows.length <= 1) {
      ctx.table.remove();
      lastActiveTableRef.current = null;
    } else {
      const targetRow = ctx.tr || allRows[allRows.length - 1];
      if (targetRow) {
        targetRow.remove();
      }
    }

    pushSnapshot();
    checkTableContext();
    setShowTableMenu(false);
  };

  const insertTableColumn = (left = false) => {
    const ctx = getSelectedTableElements();
    if (!ctx || !ctx.table) {
      insertTable(2, 4);
      return;
    }
    pushSnapshot();
    const allRows = ctx.table.querySelectorAll('tr');
    if (allRows.length === 0) return;

    const targetColIdx = (ctx.colIndex !== undefined && ctx.colIndex >= 0)
      ? ctx.colIndex
      : (ctx.tr && ctx.td ? Array.from(ctx.tr.children).indexOf(ctx.td) : (allRows[0].children.length - 1));

    allRows.forEach((row, rIdx) => {
      const isHeader = row.parentNode?.tagName === 'THEAD' || row.querySelector('th') || rIdx === 0;
      const newCell = document.createElement(isHeader ? 'th' : 'td');
      newCell.style.border = isHeader ? '1px solid #475569' : '1px solid #94a3b8';
      newCell.style.padding = '6px 8px';
      newCell.style.fontSize = '12px';
      newCell.innerHTML = isHeader ? `Header ${row.children.length + 1}` : `—`;

      const targetCell = row.children[targetColIdx];
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
    checkTableContext();
    setShowTableMenu(false);
  };

  const deleteTableColumn = () => {
    const ctx = getSelectedTableElements();
    if (!ctx || !ctx.table) return;

    pushSnapshot();
    const allRows = ctx.table.querySelectorAll('tr');
    if (allRows.length === 0) return;

    const colIndex = (ctx.colIndex !== undefined && ctx.colIndex >= 0)
      ? ctx.colIndex
      : (ctx.tr && ctx.td ? Array.from(ctx.tr.children).indexOf(ctx.td) : (allRows[0].children.length - 1));

    allRows.forEach(row => {
      if (row.children[colIndex]) {
        row.children[colIndex].remove();
      }
    });

    // If table has no remaining columns, remove it
    if (allRows[0] && allRows[0].children.length === 0) {
      ctx.table.remove();
      lastActiveTableRef.current = null;
    }

    pushSnapshot();
    checkTableContext();
    setShowTableMenu(false);
  };

  const deleteEntireTable = () => {
    const ctx = getSelectedTableElements();
    if (ctx && ctx.table) {
      pushSnapshot();
      ctx.table.remove();
      lastActiveTableRef.current = null;
      pushSnapshot();
      checkTableContext();
      setShowTableMenu(false);
    } else if (editorRef.current?.querySelector('table')) {
      pushSnapshot();
      editorRef.current.querySelector('table').remove();
      lastActiveTableRef.current = null;
      pushSnapshot();
      checkTableContext();
      setShowTableMenu(false);
    }
  };

  // Load Template (Builtin or Custom)
  const handleSelectTemplate = (tpl) => {
    pushSnapshot();
    setSelectedTemplateId(tpl.id);
    if (tpl.officeTitle) setOfficeTitle(tpl.officeTitle);
    if (tpl.institutionName) setInstitutionName(tpl.institutionName);
    if (tpl.institutionAddress) setInstitutionAddress(tpl.institutionAddress);
    if (tpl.refNo) setRefNo(tpl.refNo);
    if (tpl.signatoryName !== undefined) setSignatoryName(tpl.signatoryName);
    if (tpl.signatoryDesignation !== undefined) setSignatoryDesignation(tpl.signatoryDesignation);
    if (tpl.signatoryInstitution !== undefined) setSignatoryInstitution(tpl.signatoryInstitution);
    if (tpl.pageMargin !== undefined) setPageMargin(tpl.pageMargin);
    if (tpl.headerLayout !== undefined) setHeaderLayout(tpl.headerLayout);
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
      showToast('✓ Set as default letter template!', 'success');
    } catch (err) {
      console.warn('Set default warning:', err);
      showToast(`Default set locally (${err.message})`, 'info');
    }
  };

  // Save Custom Template Handler (Firebase Cloud + LocalStorage)
  const handleSaveCustomTemplate = async (e) => {
    e?.preventDefault();
    if (!editorRef.current) return;

    const isUpdating = templateSaveMode === 'update';
    const activeTpl = [...customTemplates, ...BUILTIN_LETTER_TEMPLATES].find(t => t.id === selectedTemplateId) || BUILTIN_LETTER_TEMPLATES[0];

    if (!isUpdating && !newTplName.trim()) {
      showToast('Please enter a template name.', 'warning');
      return;
    }

    const templateData = {
      id: isUpdating ? selectedTemplateId : ('tpl_custom_' + Date.now()),
      name: isUpdating ? (activeTpl.name || 'Official Letter') : newTplName.trim(),
      category: isUpdating ? (activeTpl.category || 'Official Orders & Notices') : (newTplCategory.trim() || 'General'),
      desc: isUpdating ? (activeTpl.desc || 'Updated letter template') : (newTplDesc.trim() || 'Custom template saved by administrator'),
      officeTitle: officeTitle || 'OFFICE OF THE PRINCIPAL',
      institutionName: institutionName || 'GOVT. HIGHER SECONDARY SCHOOL SHANGUS',
      institutionAddress: institutionAddress || 'Anantnag, Kashmir — 192201 (J&K)',
      refNo: refNo || 'HSS/SHG/',
      signatoryName: signatoryName || '',
      signatoryDesignation: signatoryDesignation || 'Principal',
      signatoryInstitution: signatoryInstitution || 'Govt. Hr Sec. School Shangus',
      pageMargin: pageMargin || '0.5in',
      headerLayout: headerLayout || 'logo_right',
      bodyHtml: editorRef.current.innerHTML,
      copyTo: copyToText || '',
      isCustom: true
    };

    try {
      await saveCloudDocTemplate({
        type: 'letter',
        template: templateData,
        makeDefault: isUpdating ? (selectedTemplateId === defaultTemplateId || makeTemplateDefault) : makeTemplateDefault
      });

      const updated = [templateData, ...customTemplates.filter(t => t.id !== templateData.id)];
      setCustomTemplates(updated);
      setSelectedTemplateId(templateData.id);
      if (makeTemplateDefault || (isUpdating && selectedTemplateId === defaultTemplateId)) {
        setDefaultTemplateId(templateData.id);
      }
      setShowSaveTemplateModal(false);
      setNewTplName('');
      setNewTplDesc('');
      showToast(`☁️ Template "${templateData.name}" successfully saved to Cloud Database!`, 'success');
    } catch (err) {
      console.error(err);
      showToast(`Template saved locally (Cloud sync note: ${err.message})`, 'warning');
    }
  };

  // ─── Quick 1-Click Update of Active Template ───
  const handleQuickUpdateTemplate = async () => {
    if (!editorRef.current) return;
    const activeTpl = [...customTemplates, ...BUILTIN_LETTER_TEMPLATES].find(t => t.id === selectedTemplateId) || BUILTIN_LETTER_TEMPLATES[0];
    const templateData = {
      id: selectedTemplateId,
      name: activeTpl.name || 'Official Letter',
      category: activeTpl.category || 'Official Orders & Notices',
      desc: activeTpl.desc || 'Updated template',
      officeTitle: officeTitle || 'OFFICE OF THE PRINCIPAL',
      institutionName: institutionName || 'GOVT. HIGHER SECONDARY SCHOOL SHANGUS',
      institutionAddress: institutionAddress || 'Anantnag, Kashmir — 192201 (J&K)',
      refNo: refNo || 'HSS/SHG/',
      signatoryName: signatoryName || '',
      signatoryDesignation: signatoryDesignation || 'Principal',
      signatoryInstitution: signatoryInstitution || 'Govt. Hr Sec. School Shangus',
      pageMargin: pageMargin || '0.5in',
      headerLayout: headerLayout || 'logo_right',
      bodyHtml: editorRef.current.innerHTML,
      copyTo: copyToText || '',
      isCustom: true
    };
    try {
      await saveCloudDocTemplate({
        type: 'letter',
        template: templateData,
        makeDefault: selectedTemplateId === defaultTemplateId
      });
      const updated = [templateData, ...customTemplates.filter(t => t.id !== templateData.id)];
      setCustomTemplates(updated);
      showToast(`☁️ Template "${templateData.name}" successfully updated & overwritten in Cloud!`, 'success');
    } catch (err) {
      console.error(err);
      showToast(`Template saved locally (Cloud note: ${err.message})`, 'warning');
    }
  };

  // Delete Custom Template Handler (With Warning & Confirmation Modal)
  const handleDeleteCustomTemplate = (target, e) => {
    if (e) e.stopPropagation();
    const tpl = typeof target === 'object' ? target : customTemplates.find(t => t.id === target);
    if (!tpl) return;
    setTemplateToDelete(tpl);
  };

  const handleConfirmDeleteTemplate = async () => {
    if (!templateToDelete) return;
    const id = templateToDelete.id;
    const name = templateToDelete.name;
    setIsDeletingTemplate(true);
    try {
      await deleteCloudDocTemplate(id, 'letter');
      showToast(`🗑️ Template "${name}" permanently deleted from Cloud & workspace.`, 'info');
    } catch (err) {
      console.warn(err);
      showToast(`Template "${name}" deleted locally.`, 'info');
    }
    const updated = customTemplates.filter(t => t.id !== id);
    setCustomTemplates(updated);
    if (selectedTemplateId === id) {
      setSelectedTemplateId(BUILTIN_LETTER_TEMPLATES[0].id);
    }
    if (defaultTemplateId === id) {
      setDefaultTemplateId('fee_notification');
    }
    setIsDeletingTemplate(false);
    setTemplateToDelete(null);
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

  // Save Draft to LocalStorage & History Archive
  const handleSaveDraft = () => {
    if (!editorRef.current) return;
    const bodyHtml = editorRef.current.innerHTML;
    const tplName = [...customTemplates, ...BUILTIN_LETTER_TEMPLATES].find(t => t.id === selectedTemplateId)?.name || 'Official Letter';
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
      bodyHtml,
      savedAt: new Date().toISOString()
    };
    try {
      const existing = JSON.parse(localStorage.getItem('hss_official_letter_drafts') || '[]');
      existing.unshift(draftData);
      localStorage.setItem('hss_official_letter_drafts', JSON.stringify(existing.slice(0, 300)));
      setSavedDraftsCount(existing.length);

      // Auto-archive in Cloud & Document History
      saveGeneratedDocToHistory({
        docType: 'letter',
        title: tplName,
        refNo: refNo || '',
        dateStr: dateStr || new Date().toLocaleDateString('en-GB'),
        recipientOrStudent: signatoryInstitution || institutionName || '',
        bodyHtml,
        actionType: 'Saved to Cloud',
        templateId: selectedTemplateId,
        templateName: tplName,
        extraData: {
          officeTitle,
          institutionName,
          institutionAddress,
          signatoryName,
          signatoryDesignation,
          signatoryInstitution,
          copyToText,
          pageMargin,
          headerLayout
        }
      }).catch(err => console.warn('Auto-save history on draft error:', err));

      showToast('✓ Official letter successfully saved & archived!', 'success');
    } catch (e) {
      console.error(e);
      showToast('Could not save draft locally.', 'error');
    }
  };

  // ─── Cloud History Save Handler ───
  const handleSaveToCloud = async () => {
    if (!editorRef.current) return;
    const bodyHtml = editorRef.current.innerHTML;
    const tplName = [...customTemplates, ...BUILTIN_LETTER_TEMPLATES].find(t => t.id === selectedTemplateId)?.name || 'Official Letter';
    try {
      await saveGeneratedDocToHistory({
        docType: 'letter',
        title: tplName,
        refNo: refNo || '',
        dateStr: dateStr || new Date().toLocaleDateString('en-GB'),
        recipientOrStudent: signatoryInstitution || institutionName || '',
        bodyHtml,
        actionType: 'Saved to Cloud',
        templateId: selectedTemplateId,
        templateName: tplName,
        extraData: {
          officeTitle,
          institutionName,
          institutionAddress,
          signatoryName,
          signatoryDesignation,
          signatoryInstitution,
          copyToText,
          pageMargin,
          headerLayout
        }
      });
      showToast('✓ Official letter successfully archived in Cloud History!', 'success');
    } catch (err) {
      console.error('History save error:', err);
      showToast(`Could not save letter to cloud history: ${err.message}`, 'error');
    }
  };

  // ─── Load Draft from History Handler ───
  const handleLoadDraftFromHistory = (rec) => {
    if (!rec) return;
    if (rec.refNo) setRefNo(rec.refNo);
    if (rec.dateStr) setDateStr(rec.dateStr);
    if (rec.extraData?.copyToText !== undefined) setCopyToText(rec.extraData.copyToText);
    if (rec.extraData?.signatoryName) setSignatoryName(rec.extraData.signatoryName);
    if (rec.extraData?.signatoryDesignation) setSignatoryDesignation(rec.extraData.signatoryDesignation);
    if (rec.bodyHtml && editorRef.current) {
      editorRef.current.innerHTML = rec.bodyHtml;
      pushSnapshot();
    }
    showToast('Official letter draft loaded from history archive.', 'info');
  };

  // Print Letter (with auto cloud history logging)
  const handlePrint = () => {
    if (!editorRef.current) return;
    const bodyHtml = editorRef.current.innerHTML;
    const tplName = [...customTemplates, ...BUILTIN_LETTER_TEMPLATES].find(t => t.id === selectedTemplateId)?.name || 'Official Letter';

    // Auto-archive in Document History
    saveGeneratedDocToHistory({
      docType: 'letter',
      title: tplName,
      refNo: refNo || '',
      dateStr: dateStr || new Date().toLocaleDateString('en-GB'),
      recipientOrStudent: signatoryInstitution || institutionName || '',
      bodyHtml,
      actionType: 'Printed / Saved PDF',
      templateId: selectedTemplateId,
      templateName: tplName,
      extraData: {
        officeTitle,
        institutionName,
        institutionAddress,
        signatoryName,
        signatoryDesignation,
        signatoryInstitution,
        copyToText,
        pageMargin,
        headerLayout
      }
    }).catch(err => console.warn('Auto-save letter history error:', err));

    showToast('🖨️ Opening print dialog / PDF preview...', 'info', 2500);

    printOfficialLetter({
      officeTitle,
      institutionName,
      institutionAddress,
      refNo,
      dateStr,
      bodyHtml,
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
    const bodyHtml = editorRef.current.innerHTML;
    const tplName = [...customTemplates, ...BUILTIN_LETTER_TEMPLATES].find(t => t.id === selectedTemplateId)?.name || 'Official Letter';

    // Auto-archive in Document History
    saveGeneratedDocToHistory({
      docType: 'letter',
      title: tplName,
      refNo: refNo || '',
      dateStr: dateStr || new Date().toLocaleDateString('en-GB'),
      recipientOrStudent: signatoryInstitution || institutionName || '',
      bodyHtml,
      actionType: 'Downloaded (.docx)',
      templateId: selectedTemplateId,
      templateName: tplName,
      extraData: {
        officeTitle,
        institutionName,
        institutionAddress,
        signatoryName,
        signatoryDesignation,
        signatoryInstitution,
        copyToText,
        pageMargin,
        headerLayout
      }
    }).catch(err => console.warn('Auto-save letter history on docx error:', err));

    try {
      const textContent = editorRef.current.innerText || '';
      await generateOfficialLetterDocx({
        officeTitle,
        institutionName,
        institutionAddress,
        refNo,
        dateStr,
        bodyText: textContent,
        bodyHtml: bodyHtml,
        signatoryDesignation,
        signatoryInstitution,
        copyToText
      });

      showToast('📥 Word document (.docx) successfully exported!', 'success');
    } catch (err) {
      console.error(err);
      showToast(`Error generating DOCX document: ${err.message}`, 'error');
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

  const handleSaveKeys = async () => {
    const lines = keysInputText.split(/[\n,]+/).map(k => k.trim()).filter(Boolean);
    const saved = await saveCloudGeminiKeys(lines);
    setGeminiKeys(saved);
    setShowKeysConfig(false);
    setAiError('');
    showToast(`✓ ${saved.length} Gemini API key(s) successfully saved to Cloud Database!`, 'success');
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
    showToast('✨ AI-generated draft applied to letter canvas!', 'success');
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
    <div className="space-y-1.5 text-slate-800 dark:text-slate-100 animate-fadeIn text-xs">

      {/* ════════ COLLAPSIBLE LETTERHEAD & REFERENCE CONFIG DRAWER ════════ */}
      {showSettingsDrawer && (
        <div 
          className="rounded-xl p-2.5 shadow-2xs space-y-1.5 animate-fadeIn text-xs border"
          style={{ backgroundColor: 'var(--bg-card, #ffffff)', borderColor: 'var(--border-ui, #cbd5e1)' }}
        >
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1">
            <h3 className="font-black text-[10px] text-amber-900 dark:text-amber-200 uppercase tracking-wider flex items-center gap-1 m-0">
              <Sliders size={11} className="text-amber-600 dark:text-amber-400" />
              <span>Official Letterhead & Reference Setup</span>
            </h3>
            <span className="text-[9px] font-bold text-slate-400">All fields auto-align onto document & Word (.docx) export</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-1.5 text-xs w-full">
            {/* Office Title */}
            <div>
              <label className="block text-[8.5px] font-black uppercase text-slate-400 mb-0.5 tracking-wider">Office Header</label>
              <input
                type="text"
                value={officeTitle}
                onChange={(e) => setOfficeTitle(e.target.value)}
                placeholder="OFFICE OF THE PRINCIPAL"
                className="w-full px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-black text-xs text-rose-800 dark:text-rose-300 focus:ring-1 focus:ring-amber-500 focus:outline-none transition-all"
              />
            </div>

            {/* Ref No */}
            <div>
              <label className="block text-[8.5px] font-black uppercase text-slate-400 mb-0.5 tracking-wider">Reference No.</label>
              <input
                type="text"
                value={refNo}
                onChange={(e) => setRefNo(e.target.value)}
                placeholder="e.g. HSS/SHG/2026/..."
                className="w-full px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none transition-all"
              />
            </div>

            {/* Date */}
            <div>
              <label className="block text-[8.5px] font-black uppercase text-slate-400 mb-0.5 tracking-wider">Letter Date</label>
              <input
                type="text"
                value={dateStr}
                onChange={(e) => setDateStr(e.target.value)}
                placeholder="DD/MM/YYYY"
                className="w-full px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none transition-all"
              />
            </div>

            {/* Signatory Designation */}
            <div>
              <label className="block text-[8.5px] font-black uppercase text-slate-400 mb-0.5 tracking-wider">Signatory Title</label>
              <input
                type="text"
                value={signatoryDesignation}
                onChange={(e) => setSignatoryDesignation(e.target.value)}
                placeholder="Principal"
                className="w-full px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none transition-all"
              />
            </div>

            {/* Signatory Institution */}
            <div>
              <label className="block text-[8.5px] font-black uppercase text-slate-400 mb-0.5 tracking-wider">Institution</label>
              <input
                type="text"
                value={signatoryInstitution}
                onChange={(e) => setSignatoryInstitution(e.target.value)}
                placeholder="Govt. Hr Sec. School Shangus"
                className="w-full px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold text-xs text-blue-900 dark:text-blue-300 focus:ring-1 focus:ring-amber-500 focus:outline-none transition-all"
              />
            </div>

            {/* Header Layout Alignment */}
            <div>
              <label className="block text-[8.5px] font-black uppercase text-slate-400 mb-0.5 tracking-wider">Layout</label>
              <select
                value={headerLayout}
                onChange={(e) => setHeaderLayout(e.target.value)}
                className="w-full px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold text-xs cursor-pointer focus:ring-1 focus:ring-amber-500 focus:outline-none transition-all"
              >
                <option value="logo_right">Logo Right</option>
                <option value="logo_center">Centered</option>
                <option value="logo_left">Logo Left</option>
              </select>
            </div>

            {/* Page Margin */}
            <div>
              <label className="block text-[8.5px] font-black uppercase text-slate-400 mb-0.5 tracking-wider">Margins</label>
              <select
                value={pageMargin}
                onChange={(e) => setPageMargin(e.target.value)}
                className="w-full px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold text-xs cursor-pointer focus:ring-1 focus:ring-amber-500 focus:outline-none transition-all"
              >
                <option value="0.5in">0.5" Std</option>
                <option value="0.4in">0.4" Tight</option>
                <option value="0.3in">0.3" Min</option>
                <option value="0.75in">0.75" Med</option>
                <option value="1.0in">1.0" Wide</option>
              </select>
            </div>

            {/* Copy To / Dispatch block */}
            <div>
              <label className="block text-[8.5px] font-black uppercase text-slate-400 mb-0.5 tracking-wider">
                Copy To / Dispatch <span className="text-slate-400 font-normal lowercase">(optional)</span>
              </label>
              <input
                type="text"
                value={copyToText}
                onChange={(e) => setCopyToText(e.target.value)}
                placeholder="1. CEO Anantnag, 2. Office copy"
                className="w-full px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-medium text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none transition-all"
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
                  rows={5}
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder={
                    aiMode === 'draft'
                      ? 'What should this letter say? (e.g. Schedule for admission fee submission by April 30th)'
                      : 'Additional refinement notes (optional)'
                  }
                  className="w-full px-2.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 font-medium text-xs text-slate-900 dark:text-slate-100 focus:bg-white focus:outline-none focus:ring-1 focus:ring-purple-500 resize-y min-h-[110px]"
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

                {/* Template Cards List (Spacious View) */}
                <div className="space-y-1.5 max-h-[calc(100vh-280px)] min-h-[380px] overflow-y-auto pr-0.5">
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
                                  onClick={(e) => handleDeleteCustomTemplate(tpl, e)}
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

              {/* Quick Inserts Footer */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-1.5 shadow-2xs">
                <div className="relative" ref={quickInsertMenuRef}>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowQuickInsertMenu(prev => !prev);
                    }}
                    className="w-full px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200/80 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 font-bold text-[10.5px] flex items-center justify-between cursor-pointer transition-colors shadow-2xs"
                  >
                    <span className="flex items-center gap-1.5">
                      <Plus size={12} className="text-rose-600 font-black" />
                      <span>Quick Insert (Subject / Ref / Divider)</span>
                    </span>
                    <ChevronDown size={11} className="text-slate-400" />
                  </button>

                  {showQuickInsertMenu && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="absolute left-0 bottom-full mb-1.5 w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-50 p-1.5 space-y-1 text-xs font-bold animate-fadeIn"
                    >
                      <div className="px-2 py-0.5 text-[8.5px] font-black uppercase text-slate-400 border-b border-slate-100 dark:border-slate-800">
                        Quick Document Inserts
                      </div>
                      <button
                        type="button"
                        onClick={() => { insertSubjectLine(); setShowQuickInsertMenu(false); }}
                        className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/50 text-slate-700 dark:text-slate-200 flex items-center gap-1.5 cursor-pointer text-[10.5px]"
                      >
                        <span className="text-rose-600 font-black text-xs">+</span>
                        <span>Subject Line</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => { insertReferenceLine(); setShowQuickInsertMenu(false); }}
                        className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/50 text-slate-700 dark:text-slate-200 flex items-center gap-1.5 cursor-pointer text-[10.5px]"
                      >
                        <span className="text-rose-600 font-black text-xs">+</span>
                        <span>Reference Line</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => { executeFormat('insertHorizontalRule'); setShowQuickInsertMenu(false); }}
                        className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/50 text-slate-700 dark:text-slate-200 flex items-center gap-1.5 cursor-pointer text-[10.5px]"
                      >
                        <Minus size={11} className="text-slate-500" />
                        <span>Divider Line</span>
                      </button>
                    </div>
                  )}
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

          {/* ════════ WORKSPACE CANVAS & VERTICAL FLOATING DOCK CONTAINER ════════ */}
          <div className={`flex flex-col lg:flex-row items-start justify-center lg:justify-end gap-2.5 ${dockSide === 'right' ? 'lg:flex-row-reverse' : ''}`}>
            
            {/* ════════ VERTICAL FLOATING DOCK (3 Vertical Columns Side-by-Side) ════════ */}
            <div className="w-full lg:w-auto lg:sticky lg:top-2 z-30 shrink-0">
              <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-1.5 shadow-md flex flex-wrap lg:grid lg:grid-cols-3 items-center justify-items-center gap-1 max-w-fit">
                
                {/* ── Row 1: Primary Actions (Print, Word, Save) ── */}
                <button
                  type="button"
                  onClick={handlePrint}
                  className="w-7 h-7 rounded-xl bg-gradient-to-r from-rose-700 to-amber-700 hover:from-rose-600 hover:to-amber-600 text-white flex items-center justify-center shadow-xs cursor-pointer transition-all active:scale-95 shrink-0"
                  title="Print or Save Official Letter as PDF"
                >
                  <Printer size={13} />
                </button>

                <button
                  type="button"
                  disabled={isExportingDocx}
                  onClick={handleExportDocx}
                  className="w-7 h-7 rounded-xl bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center shadow-xs cursor-pointer disabled:opacity-50 transition-all active:scale-95 shrink-0"
                  title="Download editable Word Document (.docx)"
                >
                  {isExportingDocx ? <RefreshCw size={12} className="animate-spin" /> : <FileText size={13} />}
                </button>

                <button
                  type="button"
                  onClick={handleQuickUpdateTemplate}
                  className="w-7 h-7 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800/60 flex items-center justify-center shadow-2xs cursor-pointer transition-all active:scale-95 shrink-0"
                  title="Save & Overwrite active template in Cloud"
                >
                  <Save size={13} />
                </button>

                {/* ── Row 2: Template, Archive & Gemini AI ── */}
                <button
                  type="button"
                  onClick={() => setShowSaveTemplateModal(true)}
                  className="w-7 h-7 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700 flex items-center justify-center cursor-pointer transition-all shrink-0"
                  title="Save or overwrite as template"
                >
                  <BookmarkPlus size={13} />
                </button>

                <button
                  type="button"
                  onClick={() => setShowHistoryModal(true)}
                  className="w-7 h-7 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700 flex items-center justify-center cursor-pointer transition-all shrink-0"
                  title="Browse history & archived documents"
                >
                  <History size={13} />
                </button>

                {/* Gemini AI Drafter Dropdown */}
                <div className="relative" ref={askGeminiMenuRef}>
                  <button
                    type="button"
                    title="Gemini AI Letter Drafting & Humanize Tools"
                    onClick={() => setShowAskGeminiMenu(!showAskGeminiMenu)}
                    className="w-7 h-7 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white flex items-center justify-center shadow-xs cursor-pointer transition-all active:scale-95 shrink-0"
                  >
                    <Sparkles size={13} className="animate-pulse" />
                  </button>

                  {showAskGeminiMenu && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className={`absolute z-50 ${dockSide === 'right' ? 'right-full mr-2 top-0' : 'left-full ml-2 top-0'} bg-white dark:bg-slate-900 border border-purple-200 dark:border-purple-800 rounded-2xl shadow-2xl p-1.5 w-60 space-y-1 animate-fadeIn`}
                    >
                      <div className="px-2 py-1 text-[9px] font-black uppercase tracking-wider text-purple-600 dark:text-purple-400 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                        <span>Gemini AI Assistant</span>
                        <span className="text-[8px] bg-purple-100 dark:bg-purple-950 text-purple-700 px-1 py-0.5 rounded font-mono">v2.5</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => { handleOpenAiStudio('humanize'); setShowAskGeminiMenu(false); }}
                        className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-950/60 text-purple-900 dark:text-purple-200 flex items-center gap-1.5 cursor-pointer text-[10.5px] font-bold"
                      >
                        <Sparkles size={12} className="text-purple-600" />
                        <span>🪄 Humanize & Polish</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => { handleOpenAiStudio('formalize'); setShowAskGeminiMenu(false); }}
                        className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-950/60 text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5 cursor-pointer text-[10.5px] font-bold"
                      >
                        <FileEdit size={12} className="text-indigo-600" />
                        <span>📜 Formal Institutional</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => { handleOpenAiStudio('shorten'); setShowAskGeminiMenu(false); }}
                        className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-950/60 text-amber-900 dark:text-amber-200 flex items-center gap-1.5 cursor-pointer text-[10.5px] font-bold"
                      >
                        <span className="text-amber-600 text-xs">✂️</span>
                        <span>✂️ Shorten & Summarize</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => { handleOpenAiStudio('draft'); setShowAskGeminiMenu(false); }}
                        className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-950/60 text-purple-900 dark:text-purple-200 flex items-center gap-1.5 cursor-pointer text-[10.5px] font-bold border-t border-slate-100 dark:border-slate-800"
                      >
                        <Bot size={12} className="text-purple-600" />
                        <span>✍️ Draft New from Prompt</span>
                      </button>
                    </div>
                  )}
                </div>

                <div className="col-span-3 w-full h-px bg-slate-200 dark:bg-slate-700 my-0.5 hidden lg:block"></div>

                {/* ── Row 3: History & Block Formats (Undo, Redo, Paragraph) ── */}
                <button
                  type="button"
                  title="Undo (Ctrl+Z)"
                  disabled={!canUndo}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => { handleUndo(); setTimeout(checkActiveFormats, 50); }}
                  className={`w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer transition-colors ${
                    canUndo ? 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200' : 'text-slate-300 dark:text-slate-600 opacity-40 cursor-not-allowed'
                  }`}
                >
                  <Undo size={12} />
                </button>

                <button
                  type="button"
                  title="Redo (Ctrl+Y)"
                  disabled={!canRedo}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => { handleRedo(); setTimeout(checkActiveFormats, 50); }}
                  className={`w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer transition-colors ${
                    canRedo ? 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200' : 'text-slate-300 dark:text-slate-600 opacity-40 cursor-not-allowed'
                  }`}
                >
                  <Redo size={12} />
                </button>

                <button
                  type="button"
                  title="Normal Body Paragraph (¶)"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => executeFormat('formatBlock', '<p>')}
                  className={`w-7 h-7 rounded-lg font-black text-[10px] flex items-center justify-center cursor-pointer transition-all ${
                    activeFormats.p
                      ? 'bg-amber-100 dark:bg-amber-950/70 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700 shadow-2xs'
                      : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  ¶
                </button>

                {/* ── Row 4: Headings & Color (H1, H2, Color) ── */}
                <button
                  type="button"
                  title="Heading 1 (Click to apply, click again to revert to body text)"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => executeFormat('formatBlock', '<h1>')}
                  className={`w-7 h-7 rounded-lg font-black text-[10px] flex items-center justify-center cursor-pointer transition-all ${
                    activeFormats.h1
                      ? 'bg-amber-100 dark:bg-amber-950/70 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700 shadow-2xs font-black'
                      : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200'
                  }`}
                >
                  H1
                </button>

                <button
                  type="button"
                  title="Heading 2 (Click to apply, click again to revert to body text)"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => executeFormat('formatBlock', '<h2>')}
                  className={`w-7 h-7 rounded-lg font-black text-[10px] flex items-center justify-center cursor-pointer transition-all ${
                    activeFormats.h2
                      ? 'bg-amber-100 dark:bg-amber-950/70 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700 shadow-2xs font-black'
                      : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200'
                  }`}
                >
                  H2
                </button>

                {/* Color Palette Popout */}
                <div className="relative" ref={colorMenuRef}>
                  <button
                    type="button"
                    title="Text Color Palette"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      saveCurrentSelection();
                    }}
                    onClick={() => {
                      saveCurrentSelection();
                      setShowColorMenu(!showColorMenu);
                    }}
                    className="w-7 h-7 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center cursor-pointer transition-all active:scale-95"
                  >
                    <Palette size={12} className="text-amber-600" />
                  </button>

                  {showColorMenu && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className={`absolute z-50 ${dockSide === 'right' ? 'right-full mr-2 top-0' : 'left-full ml-2 top-0'} bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl p-2 flex items-center gap-1.5 animate-fadeIn`}
                    >
                      {[
                        { label: 'Black', color: '#0f172a' },
                        { label: 'Maroon', color: '#800000' },
                        { label: 'Navy Blue', color: '#0a192f' },
                        { label: 'Forest Green', color: '#065f46' },
                        { label: 'Slate Gray', color: '#475569' },
                        { label: 'Crimson', color: '#dc2626' }
                      ].map(c => (
                        <button
                          key={c.color}
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            applyTextColor(c.color);
                            setShowColorMenu(false);
                          }}
                          className="w-5 h-5 rounded-full border border-slate-300 dark:border-slate-600 cursor-pointer hover:scale-110 transition-transform shadow-2xs"
                          style={{ backgroundColor: c.color }}
                          title={c.label}
                        />
                      ))}
                    </div>
                  )}
                </div>

                <div className="col-span-3 w-full h-px bg-slate-200 dark:bg-slate-700 my-0.5 hidden lg:block"></div>

                {/* ── Row 5: Character Styles (Bold, Italic, Underline) ── */}
                <button
                  type="button"
                  title="Bold (Ctrl+B)"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => executeFormat('bold')}
                  className={`w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer transition-all ${
                    activeFormats.bold
                      ? 'bg-amber-100 dark:bg-amber-950/70 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700 font-black shadow-2xs'
                      : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-100'
                  }`}
                >
                  <Bold size={12} />
                </button>

                <button
                  type="button"
                  title="Italic (Ctrl+I)"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => executeFormat('italic')}
                  className={`w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer transition-all ${
                    activeFormats.italic
                      ? 'bg-amber-100 dark:bg-amber-950/70 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700 font-black shadow-2xs'
                      : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-100'
                  }`}
                >
                  <Italic size={12} />
                </button>

                <button
                  type="button"
                  title="Underline (Ctrl+U)"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => executeFormat('underline')}
                  className={`w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer transition-all ${
                    activeFormats.underline
                      ? 'bg-amber-100 dark:bg-amber-950/70 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700 font-black shadow-2xs'
                      : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-100'
                  }`}
                >
                  <Underline size={12} />
                </button>

                {/* ── Row 6: Strike, Divider & Clear Format ── */}
                <button
                  type="button"
                  title="Strikethrough"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => executeFormat('strikethrough')}
                  className={`w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer transition-all ${
                    activeFormats.strikeThrough
                      ? 'bg-amber-100 dark:bg-amber-950/70 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700 font-black shadow-2xs'
                      : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <Strikethrough size={12} />
                </button>

                <button
                  type="button"
                  title="Insert Horizontal Divider Line"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => executeFormat('insertHorizontalRule')}
                  className="w-7 h-7 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center cursor-pointer"
                >
                  <Minus size={12} />
                </button>

                <button
                  type="button"
                  title="Clear Text Formatting"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => executeFormat('removeFormat')}
                  className="w-7 h-7 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-700 flex items-center justify-center cursor-pointer"
                >
                  <RemoveFormatting size={12} />
                </button>

                <div className="col-span-3 w-full h-px bg-slate-200 dark:bg-slate-700 my-0.5 hidden lg:block"></div>

                {/* ── Row 7: Alignments (Left, Center, Right) ── */}
                <button
                  type="button"
                  title="Align Left"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => executeFormat('justifyLeft')}
                  className={`w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer transition-all ${
                    activeFormats.justifyLeft
                      ? 'bg-amber-100 dark:bg-amber-950/70 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700 shadow-2xs'
                      : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <AlignLeft size={12} />
                </button>

                <button
                  type="button"
                  title="Align Center"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => executeFormat('justifyCenter')}
                  className={`w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer transition-all ${
                    activeFormats.justifyCenter
                      ? 'bg-amber-100 dark:bg-amber-950/70 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700 shadow-2xs'
                      : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <AlignCenter size={12} />
                </button>

                <button
                  type="button"
                  title="Align Right"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => executeFormat('justifyRight')}
                  className={`w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer transition-all ${
                    activeFormats.justifyRight
                      ? 'bg-amber-100 dark:bg-amber-950/70 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700 shadow-2xs'
                      : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <AlignRight size={12} />
                </button>

                {/* ── Row 8: Justify, Bullet List, Numbered List ── */}
                <button
                  type="button"
                  title="Justify"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => executeFormat('justifyFull')}
                  className={`w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer transition-all ${
                    activeFormats.justifyFull
                      ? 'bg-amber-100 dark:bg-amber-950/70 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700 shadow-2xs'
                      : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <AlignJustify size={12} />
                </button>

                <button
                  type="button"
                  title="Bulleted List"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => executeFormat('insertUnorderedList')}
                  className={`w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer transition-all ${
                    activeFormats.insertUnorderedList
                      ? 'bg-amber-100 dark:bg-amber-950/70 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700 shadow-2xs'
                      : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <List size={12} />
                </button>

                <button
                  type="button"
                  title="Numbered List"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => executeFormat('insertOrderedList')}
                  className={`w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer transition-all ${
                    activeFormats.insertOrderedList
                      ? 'bg-amber-100 dark:bg-amber-950/70 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700 shadow-2xs'
                      : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <ListOrdered size={12} />
                </button>

                <div className="col-span-3 w-full h-px bg-slate-200 dark:bg-slate-700 my-0.5 hidden lg:block"></div>

                {/* ── Row 9: Table & Switcher ── */}
                <div className="relative" ref={tableMenuRef}>
                  <button
                    type="button"
                    title="Insert or Edit Table"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => { checkTableContext(); setShowTableMenu(!showTableMenu); }}
                    className={`w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer transition-colors ${
                      activeTableContext ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-400' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <TableIcon size={12} />
                  </button>

                  {showTableMenu && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className={`absolute z-50 ${dockSide === 'right' ? 'right-full mr-2 top-0' : 'left-full ml-2 top-0'} bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-2 w-52 space-y-1.5 animate-fadeIn`}
                    >
                      {activeTableContext ? (
                        <>
                          <div className="px-2 py-1 text-[9px] font-black uppercase text-emerald-600 dark:text-emerald-400 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                            <span>Table Context</span>
                            <span className="text-[8px] bg-emerald-100 text-emerald-800 px-1 py-0.5 rounded font-mono">EDIT</span>
                          </div>
                          <div className="grid grid-cols-2 gap-1">
                            <button
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => { insertTableColumn(false); setShowTableMenu(false); }}
                              className="text-left px-2 py-1 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-950 text-emerald-800 dark:text-emerald-300 text-[10px] font-bold border border-emerald-200"
                            >
                              + Col Right
                            </button>
                            <button
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => { insertTableColumn(true); setShowTableMenu(false); }}
                              className="text-left px-2 py-1 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-950 text-emerald-800 dark:text-emerald-300 text-[10px] font-bold border border-emerald-200"
                            >
                              + Col Left
                            </button>
                          </div>
                          <button
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => { deleteTableColumn(); setShowTableMenu(false); }}
                            className="w-full text-left px-2 py-1 rounded-lg hover:bg-rose-50 text-rose-700 text-[10px] border border-rose-100"
                          >
                            - Delete Col
                          </button>
                          <div className="grid grid-cols-2 gap-1">
                            <button
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => { insertTableRow(false); setShowTableMenu(false); }}
                              className="text-left px-2 py-1 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-950 text-emerald-800 dark:text-emerald-300 text-[10px] font-bold border border-emerald-200"
                            >
                              + Row Below
                            </button>
                            <button
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => { insertTableRow(true); setShowTableMenu(false); }}
                              className="text-left px-2 py-1 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-950 text-emerald-800 dark:text-emerald-300 text-[10px] font-bold border border-emerald-200"
                            >
                              + Row Above
                            </button>
                          </div>
                          <button
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => { deleteTableRow(); setShowTableMenu(false); }}
                            className="w-full text-left px-2 py-1 rounded-lg hover:bg-rose-50 text-rose-700 text-[10px] border border-rose-100"
                          >
                            - Delete Row
                          </button>
                          <button
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => { deleteEntireTable(); setShowTableMenu(false); }}
                            className="w-full text-left px-2 py-1 rounded-lg hover:bg-rose-100 text-rose-800 text-[10px] font-bold border border-rose-200"
                          >
                            🗑 Remove Table
                          </button>
                        </>
                      ) : (
                        <>
                          <div className="px-2 py-1 text-[9px] font-black uppercase text-slate-400 border-b border-slate-100 dark:border-slate-800">
                            Insert Table Preset
                          </div>
                          <button
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => { insertTable(2, 4); setShowTableMenu(false); }}
                            className="w-full text-left px-2.5 py-1.5 rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-950 text-indigo-900 dark:text-indigo-200 text-[10.5px] font-bold flex items-center justify-between"
                          >
                            <span>4 × 2 Fee Table</span>
                            <span className="text-[9px] text-slate-400 font-mono">Standard</span>
                          </button>
                          <button
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => { insertTable(3, 3); setShowTableMenu(false); }}
                            className="w-full text-left px-2.5 py-1.5 rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-950 text-indigo-900 dark:text-indigo-200 text-[10.5px] font-bold flex items-center justify-between"
                          >
                            <span>3 × 3 Grid Table</span>
                            <span className="text-[9px] text-slate-400 font-mono">9 cells</span>
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Dock Side Switcher (Spanning 2 columns) */}
                <button
                  type="button"
                  onClick={() => {
                    const nextSide = dockSide === 'left' ? 'right' : 'left';
                    setDockSide(nextSide);
                    try { localStorage.setItem('hss_letter_dock_side', nextSide); } catch {}
                  }}
                  className="col-span-2 w-full h-7 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-300 flex items-center justify-center cursor-pointer transition-colors text-[9px] font-bold font-mono hidden lg:flex"
                  title={dockSide === 'left' ? 'Move Dock to Right side of Canvas' : 'Move Dock to Left side of Canvas'}
                >
                  {dockSide === 'left' ? '👉 Right' : '👈 Left'}
                </button>

              </div>
            </div>

            {/* ════════ A4 PAPER LIVE VIEWPORT & EDITOR ════════ */}
            <div className="flex-1 w-full max-w-[840px] min-w-0">
              <div className="bg-white text-slate-900 border border-slate-300 rounded-xl p-4 sm:p-6 shadow-sm min-h-[420px] flex flex-col justify-start">
                
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
                onInput={(e) => {
                  handleEditorInput(e);
                  saveCurrentSelection();
                  checkTableContext();
                  checkActiveFormats();
                }}
                onKeyDown={handleEditorKeyDown}
                onKeyUp={() => {
                  saveCurrentSelection();
                  checkTableContext();
                  checkActiveFormats();
                }}
                onClick={() => {
                  saveCurrentSelection();
                  checkTableContext();
                  checkActiveFormats();
                }}
                onMouseUp={() => {
                  saveCurrentSelection();
                  checkTableContext();
                  checkActiveFormats();
                }}
                onFocus={() => {
                  saveCurrentSelection();
                  checkTableContext();
                  checkActiveFormats();
                }}
                onSelect={() => {
                  saveCurrentSelection();
                  checkActiveFormats();
                }}
                className="official-letter-wysiwyg-content outline-none focus:ring-1 focus:ring-amber-400 rounded-lg p-2 min-h-[160px] text-[13px] leading-relaxed text-slate-900"
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

      </div>

      </div>

      {/* ════════ SAVE / UPDATE REUSABLE TEMPLATE MODAL ════════ */}
      {showSaveTemplateModal && (() => {
        const activeTpl = allTemplates.find(t => t.id === selectedTemplateId) || BUILTIN_LETTER_TEMPLATES[0];
        return (
          <div className="fixed inset-0 z-[999999] bg-black/70 backdrop-blur-xs flex items-center justify-center p-3">
            <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl border border-emerald-300 dark:border-emerald-900/80 p-5 space-y-3.5 animate-fadeIn">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2.5">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-emerald-600 text-white shadow-md">
                    <BookmarkPlus size={18} />
                  </div>
                  <div>
                    <h3 className="font-black text-sm text-slate-900 dark:text-white m-0">
                      Save / Update Letter Template
                    </h3>
                    <p className="text-[10px] text-slate-500 font-medium m-0">
                      Overwrite current template or create a new reusable document preset.
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

              {/* Segmented Mode Selector: Update Current vs Save New */}
              <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                <button
                  type="button"
                  onClick={() => setTemplateSaveMode('update')}
                  className={`py-1.5 px-2 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    templateSaveMode === 'update'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  <RefreshCw size={11} className={templateSaveMode === 'update' ? 'animate-spin-slow' : ''} />
                  <span>Update Current ({activeTpl.name.split(' ')[0]}...)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setTemplateSaveMode('new')}
                  className={`py-1.5 px-2 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    templateSaveMode === 'new'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  <PlusCircle size={11} />
                  <span>Save as New</span>
                </button>
              </div>

              <form onSubmit={handleSaveCustomTemplate} className="space-y-3 text-xs">
                {templateSaveMode === 'update' ? (
                  <div className="p-3 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800/60 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-black text-emerald-900 dark:text-emerald-200 text-xs">
                        Target: {activeTpl.name}
                      </span>
                      <span className="text-[9.5px] font-bold text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/60">
                        {activeTpl.category || 'Official Orders'}
                      </span>
                    </div>
                    <p className="text-[10.5px] text-emerald-800 dark:text-emerald-300 leading-relaxed m-0">
                      This will overwrite this template in the cloud database with your current text, formatting, and layout. All future letters generated with this template will immediately load your changes.
                    </p>
                  </div>
                ) : (
                  <>
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
                  </>
                )}

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
                    <span className="text-[10px] text-amber-800 dark:text-amber-400 block">Auto-loads on studio launch and saves directly to Cloud Database.</span>
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
                    className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs cursor-pointer shadow-md flex items-center gap-1.5 active:scale-95"
                  >
                    <Save size={13} />
                    <span>{templateSaveMode === 'update' ? 'Overwrite & Update Template' : 'Save New Template'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* Unified Global Floating Toast Notification */}
      {toast && (
        <div
          style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999999 }}
          className={`px-4 py-3 rounded-2xl shadow-2xl border flex items-center gap-2.5 font-sans font-bold text-xs animate-in fade-in slide-in-from-bottom-4 duration-200 backdrop-blur-md ${
            toast.type === 'error'
              ? 'bg-rose-950/95 text-rose-100 border-rose-700/80 shadow-rose-950/60'
              : toast.type === 'info'
              ? 'bg-sky-950/95 text-sky-100 border-sky-700/80 shadow-sky-950/60'
              : toast.type === 'warning'
              ? 'bg-amber-950/95 text-amber-100 border-amber-700/80 shadow-amber-950/60'
              : 'bg-emerald-950/95 text-emerald-100 border-emerald-700/80 shadow-emerald-950/60'
          }`}
        >
          {toast.type === 'error' ? (
            <AlertCircle size={16} className="text-rose-400 shrink-0" />
          ) : toast.type === 'info' ? (
            <Info size={16} className="text-sky-400 shrink-0" />
          ) : toast.type === 'warning' ? (
            <AlertTriangle size={16} className="text-amber-400 shrink-0" />
          ) : (
            <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
          )}
          <span className="leading-snug">{toast.message}</span>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="ml-2 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X size={13} />
          </button>
        </div>
      )}

      {/* ════════ CLOUD DOCUMENT HISTORY & ARCHIVE MODAL ════════ */}
      <DocumentHistoryModal
        isOpen={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
        defaultFilter="letter"
        onLoadAsDraft={handleLoadDraftFromHistory}
      />

      {/* ════════ CUSTOM LETTER TEMPLATE DELETE CONFIRMATION & WARNING MODAL ════════ */}
      <ConfirmModal
        isOpen={Boolean(templateToDelete)}
        onClose={() => { if (!isDeletingTemplate) setTemplateToDelete(null); }}
        onConfirm={handleConfirmDeleteTemplate}
        title="Delete Custom Template?"
        message={`⚠️ WARNING: You are about to permanently delete "${templateToDelete?.name}". This will remove it from both your local workspace and Firebase Cloud storage. This action cannot be undone.`}
        confirmText="Yes, Delete Permanently"
        cancelText="Cancel / Keep Template"
        type="danger"
        loading={isDeletingTemplate}
      />

    </div>
  );
}
