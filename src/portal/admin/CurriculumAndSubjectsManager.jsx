import React, { useState, useEffect, useMemo } from 'react';
import { 
  BookOpen, Layers, GraduationCap, Plus, X, Trash2, Save, RefreshCw, 
  CheckCircle2, AlertCircle, Wand2, Copy, Check, Search, ArrowUpDown, 
  Pencil, Sparkles, Sliders, CheckSquare, Eye, SlidersHorizontal
} from 'lucide-react';
import { db } from '../../services/firebase';
import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';
import ConfirmModal from '../components/ConfirmModal';
import { 
  DEFAULT_FEEDER_SCHOOLS, 
  getCachedFeederSchools, 
  loadFeederSchools, 
  saveFeederSchools 
} from '../../utils/feederSchoolsManager';
import { logAdminActivity } from '../../services/adminActivityLogger';

const INITIAL_SUBJECT_MAP = {
  '8th_General': {
    groupA: ['English', 'Mathematics', 'Science', 'Social Studies'],
    groupB: ['Urdu', 'Arabic', 'Hindi', 'Kashmiri'],
    groupC: ['Healthcare', 'IT and ITES'],
    minSubjects: 5, maxSubjects: 6, g1Min: 0, g1Max: 1, g2Min: 0, g2Max: 1
  },
  '9th_General': {
    groupA: ['English', 'Mathematics', 'Science', 'Social Studies'],
    groupB: ['Urdu', 'Arabic', 'Hindi', 'Kashmiri'],
    groupC: ['Healthcare', 'IT and ITES'],
    minSubjects: 5, maxSubjects: 6, g1Min: 0, g1Max: 1, g2Min: 0, g2Max: 1
  },
  '9th_Humanities': {
    groupA: ['English', 'Mathematics', 'Science', 'Social Studies'],
    groupB: ['Urdu', 'Arabic', 'Hindi', 'Kashmiri'],
    groupC: ['Healthcare', 'IT and ITES'],
    minSubjects: 5, maxSubjects: 6, g1Min: 0, g1Max: 1, g2Min: 0, g2Max: 1
  },
  '9th_Science': {
    groupA: ['English', 'Mathematics', 'Science', 'Social Studies'],
    groupB: ['Urdu', 'Arabic', 'Hindi', 'Kashmiri'],
    groupC: ['Healthcare', 'IT and ITES'],
    minSubjects: 5, maxSubjects: 6, g1Min: 0, g1Max: 1, g2Min: 0, g2Max: 1
  },
  '10th_General': {
    groupA: ['English', 'Mathematics', 'Science', 'Social Studies'],
    groupB: ['Urdu', 'Arabic', 'Hindi', 'Kashmiri'],
    groupC: ['Healthcare', 'IT and ITES'],
    minSubjects: 5, maxSubjects: 6, g1Min: 0, g1Max: 1, g2Min: 0, g2Max: 1
  },
  '10th_Humanities': {
    groupA: ['English', 'Mathematics', 'Science', 'Social Studies'],
    groupB: ['Urdu', 'Arabic', 'Hindi', 'Kashmiri'],
    groupC: ['Healthcare', 'IT and ITES'],
    minSubjects: 5, maxSubjects: 6, g1Min: 0, g1Max: 1, g2Min: 0, g2Max: 1
  },
  '10th_Science': {
    groupA: ['English', 'Mathematics', 'Science', 'Social Studies'],
    groupB: ['Urdu', 'Arabic', 'Hindi', 'Kashmiri'],
    groupC: ['Healthcare', 'IT and ITES'],
    minSubjects: 5, maxSubjects: 6, g1Min: 0, g1Max: 1, g2Min: 0, g2Max: 1
  },
  '11th_Science': {
    groupA: ['General English', 'Physics', 'Chemistry'],
    groupB: ['Biology', 'Mathematics'],
    groupC: ['Environmental Science', 'Physical Education', 'Healthcare', 'IT and ITES'],
    minSubjects: 5, maxSubjects: 6, g1Min: 1, g1Max: 2, g2Min: 0, g2Max: 1
  },
  '12th_Science': {
    groupA: ['General English', 'Physics', 'Chemistry'],
    groupB: ['Biology', 'Mathematics'],
    groupC: ['Environmental Science', 'Physical Education', 'Healthcare', 'IT and ITES'],
    minSubjects: 5, maxSubjects: 6, g1Min: 1, g1Max: 2, g2Min: 0, g2Max: 1
  },
  '11th_Humanities': {
    groupA: ['General English'],
    groupB: ['Urdu', 'Education', 'Economics', 'History', 'Political Science', 'Mathematics'],
    groupC: ['Environmental Science', 'Physical Education', 'Healthcare', 'IT and ITES'],
    minSubjects: 5, maxSubjects: 6, g1Min: 3, g1Max: 4, g2Min: 0, g2Max: 1
  },
  '12th_Humanities': {
    groupA: ['General English'],
    groupB: ['Urdu', 'Education', 'Economics', 'History', 'Political Science', 'Mathematics'],
    groupC: ['Environmental Science', 'Physical Education', 'Healthcare', 'IT and ITES'],
    minSubjects: 5, maxSubjects: 6, g1Min: 3, g1Max: 4, g2Min: 0, g2Max: 1
  },
  '11th_Commerce': {
    groupA: ['General English', 'Accountancy', 'Business Studies'],
    groupB: ['Entrepreneurship', 'Economics', 'Mathematics'],
    groupC: ['Environmental Science', 'Information Practices', 'Physical Education & Sports'],
    minSubjects: 5, maxSubjects: 6, g1Min: 1, g1Max: 2, g2Min: 0, g2Max: 1
  },
  '12th_Commerce': {
    groupA: ['General English', 'Accountancy', 'Business Studies'],
    groupB: ['Entrepreneurship', 'Economics', 'Mathematics'],
    groupC: ['Environmental Science', 'Information Practices', 'Physical Education & Sports'],
    minSubjects: 5, maxSubjects: 6, g1Min: 1, g1Max: 2, g2Min: 0, g2Max: 1
  },
};

export default function CurriculumAndSubjectsManager() {
  const [activeSubTab, setActiveSubTab] = useState('subjects'); // 'subjects' | 'rules' | 'schools'
  const [saving, setSaving] = useState(false);
  const [alert, setAlert] = useState(null);
  const [confirmModalConfig, setConfirmModalConfig] = useState(null);

  // Subject Configuration States
  const [selectedClass, setSelectedClass] = useState('11th');
  const [selectedStream, setSelectedStream] = useState('Science');

  const [subjectConfigMap, setSubjectConfigMap] = useState(() => {
    try {
      const saved = localStorage.getItem('hss_subject_config_map_v2');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return INITIAL_SUBJECT_MAP;
  });

  const [minSubjects, setMinSubjects] = useState('5');
  const [maxSubjects, setMaxSubjects] = useState('6');
  const [groupA, setGroupA] = useState([]);
  const [groupB, setGroupB] = useState([]);
  const [groupC, setGroupC] = useState([]);
  const [g1Min, setG1Min] = useState('1');
  const [g1Max, setG1Max] = useState('1');
  const [g2Min, setG2Min] = useState('0');
  const [g2Max, setG2Max] = useState('1');

  // Input states for adding new subject to pools
  const [newSubA, setNewSubA] = useState('');
  const [newSubB, setNewSubB] = useState('');
  const [newSubC, setNewSubC] = useState('');

  // Feeder Schools State
  const [feederSchools, setFeederSchools] = useState(() => getCachedFeederSchools());
  const [newSchoolName, setNewSchoolName] = useState('');
  const [schoolSearchTerm, setSchoolSearchTerm] = useState('');
  const [editingSchoolIndex, setEditingSchoolIndex] = useState(null);
  const [editingSchoolValue, setEditingSchoolValue] = useState('');

  // Combinations Explorer Modal State
  const [showComboModal, setShowComboModal] = useState(false);
  const [comboList, setComboList] = useState([]);
  const [comboCopied, setComboCopied] = useState(false);

  // Test Flight State for Admission Form Simulation
  const [testFlightSelections, setTestFlightSelections] = useState([]);

  // Load Firestore Subjects Configuration & Feeder Schools
  useEffect(() => {
    async function loadData() {
      // 1. Feeder schools
      loadFeederSchools().then((schools) => {
        if (Array.isArray(schools) && schools.length > 0) {
          setFeederSchools(schools);
        }
      });

      // 2. Firestore Subjects Config
      try {
        const snap = await getDocs(collection(db, 'subjectsConfig'));
        if (!snap.empty) {
          const loadedMap = { ...INITIAL_SUBJECT_MAP };
          snap.docs.forEach(docSnap => {
            const d = docSnap.data();
            const cls = d.Class || d.className || d.class;
            const stream = d.Stream || d.stream || 'General';
            if (cls) {
              const k = `${cls}_${stream}`;
              loadedMap[k] = {
                groupA: d.groupA || d.compulsory || d['Compulsory Subjects'] || [],
                groupB: d.groupB || d.group1 || d['Group1 Options'] || [],
                groupC: d.groupC || d.group2 || d['Group2 Options'] || [],
                minSubjects: d.minSubjects !== undefined ? Number(d.minSubjects) : 5,
                maxSubjects: d.maxSubjects !== undefined ? Number(d.maxSubjects) : 6,
                g1Min: d.g1Min !== undefined ? Number(d.g1Min) : (d['G1 Min'] !== undefined ? Number(d['G1 Min']) : 1),
                g1Max: d.g1Max !== undefined ? Number(d.g1Max) : (d['G1 Max'] !== undefined ? Number(d['G1 Max']) : 1),
                g2Min: d.g2Min !== undefined ? Number(d.g2Min) : (d['G2 Min'] !== undefined ? Number(d['G2 Min']) : 0),
                g2Max: d.g2Max !== undefined ? Number(d.g2Max) : (d['G2 Max'] !== undefined ? Number(d['G2 Max']) : 1),
              };
            }
          });
          setSubjectConfigMap(loadedMap);
          try {
            localStorage.setItem('hss_subject_config_map_v2', JSON.stringify(loadedMap));
          } catch (_) {}
        }
      } catch (err) {
        console.warn('Firestore subjectsConfig load note:', err);
      }
    }
    loadData();
  }, []);

  // Sync groups whenever selectedClass or selectedStream changes
  useEffect(() => {
    const key = `${selectedClass}_${selectedStream}`;
    const cfg = subjectConfigMap[key] || INITIAL_SUBJECT_MAP[key] || INITIAL_SUBJECT_MAP[`${selectedClass}_General`] || INITIAL_SUBJECT_MAP['11th_Science'];

    setGroupA(cfg.groupA || []);
    setGroupB(cfg.groupB || []);
    setGroupC(cfg.groupC || []);
    setMinSubjects(String(cfg.minSubjects ?? 5));
    setMaxSubjects(String(cfg.maxSubjects ?? 6));
    setG1Min(String(cfg.g1Min ?? 1));
    setG1Max(String(cfg.g1Max ?? 1));
    setG2Min(String(cfg.g2Min ?? 0));
    setG2Max(String(cfg.g2Max ?? 1));
    setTestFlightSelections([]);
  }, [selectedClass, selectedStream, subjectConfigMap]);

  // Save Subject Config to Firestore & Local Storage
  const handleSaveSubjects = async (e) => {
    if (e?.preventDefault) e.preventDefault();
    setSaving(true);
    setAlert(null);

    const key = `${selectedClass}_${selectedStream}`;
    const newConfig = {
      className: selectedClass,
      stream: selectedStream,
      minSubjects: parseInt(minSubjects, 10),
      maxSubjects: parseInt(maxSubjects, 10),
      groupA,
      groupB,
      groupC,
      g1Min: parseInt(g1Min, 10),
      g1Max: parseInt(g1Max, 10),
      g2Min: parseInt(g2Min, 10),
      g2Max: parseInt(g2Max, 10),
    };

    const updatedMap = {
      ...subjectConfigMap,
      [key]: newConfig
    };

    try {
      await setDoc(doc(db, 'subjectsConfig', `${selectedClass}_${selectedStream}`), {
        Class: selectedClass,
        Stream: selectedStream,
        compulsory: groupA,
        group1: groupB,
        group2: groupC,
        groupA,
        groupB,
        groupC,
        'Compulsory Subjects': groupA,
        'Group1 Options': groupB,
        'Group2 Options': groupC,
        'G1 Min': parseInt(g1Min, 10),
        'G1 Max': parseInt(g1Max, 10),
        'G2 Min': parseInt(g2Min, 10),
        'G2 Max': parseInt(g2Max, 10),
        minSubjects: parseInt(minSubjects, 10),
        maxSubjects: parseInt(maxSubjects, 10),
        updatedAt: new Date().toISOString()
      }, { merge: true });

      setSubjectConfigMap(updatedMap);
      try {
        localStorage.setItem('hss_subject_config_map_v2', JSON.stringify(updatedMap));
      } catch (_) {}

      logAdminActivity({
        actionType: 'update',
        actionTitle: 'Updated Stream Subject Rules',
        details: `Saved subject pools for ${selectedClass} ${selectedStream} (${groupA.length} Compulsory, ${groupB.length} Group 1, ${groupC.length} Group 2)`,
        metadata: { selectedClass, selectedStream, minSubjects, maxSubjects }
      });
      setAlert({ type: 'success', text: `✨ Subject & stream configuration saved for ${selectedClass} ${selectedStream}!` });
    } catch (err) {
      setAlert({ type: 'error', text: `Subject rules were not saved: ${err.message}` });
    } finally { 
      setSaving(false); 
    }
  };

  // Generate All Valid Subject Combinations
  const handleExploreCombinations = () => {
    const base = [...groupA];
    const numBMin = parseInt(g1Min, 10) || 0;
    const numBMax = parseInt(g1Max, 10) || groupB.length;
    const numCMin = parseInt(g2Min, 10) || 0;
    const numCMax = parseInt(g2Max, 10) || groupC.length;
    const targetMin = parseInt(minSubjects, 10) || 5;
    const targetMax = parseInt(maxSubjects, 10) || 6;

    const getSubsets = (arr, minSize, maxSize) => {
      const results = [];
      const f = (prefix, idx) => {
        if (prefix.length >= minSize && prefix.length <= maxSize) {
          results.push([...prefix]);
        }
        if (prefix.length >= maxSize) return;
        for (let i = idx; i < arr.length; i++) {
          f([...prefix, arr[i]], i + 1);
        }
      };
      f([], 0);
      return results;
    };

    const bSubsets = getSubsets(groupB, numBMin, Math.min(numBMax, groupB.length));
    const cSubsets = getSubsets(groupC, numCMin, Math.min(numCMax, groupC.length));

    const allCombosSet = new Set();

    bSubsets.forEach((bChoice) => {
      cSubsets.forEach((cChoice) => {
        const fullList = [...base, ...bChoice, ...cChoice];
        if (fullList.length >= targetMin && fullList.length <= targetMax) {
          allCombosSet.add(fullList.join(' • '));
        }
      });
    });

    if (allCombosSet.size === 0) {
      groupB.forEach((b) => {
        if (groupC.length > 0) {
          groupC.forEach((c) => {
            const list = [...base, b, c];
            if (list.length >= targetMin && list.length <= targetMax) {
              allCombosSet.add(list.join(' • '));
            }
          });
        } else {
          const list = [...base, b];
          if (list.length >= targetMin && list.length <= targetMax) {
            allCombosSet.add(list.join(' • '));
          }
        }
      });
    }

    const finalCombos = Array.from(allCombosSet).sort();
    setComboList(finalCombos);
    setShowComboModal(true);
  };

  // Feeder Schools Directory Management Handlers
  const handleAddSchool = (e) => {
    e?.preventDefault();
    const clean = newSchoolName.trim();
    if (!clean) return;

    if (feederSchools.some((s) => s.toLowerCase() === clean.toLowerCase())) {
      setAlert({ type: 'error', text: `School "${clean}" already exists in the directory.` });
      return;
    }

    const updated = [...feederSchools, clean];
    setFeederSchools(updated);
    setNewSchoolName('');
    saveFeederSchools(updated);
    setAlert({ type: 'success', text: `Added "${clean}" to feeder schools directory!` });
  };

  const handleStartEditSchool = (index, currentName) => {
    setEditingSchoolIndex(index);
    setEditingSchoolValue(currentName);
  };

  const handleSaveEditSchool = (index) => {
    const clean = editingSchoolValue.trim();
    if (!clean) return;

    const exists = feederSchools.some((s, idx) => idx !== index && s.toLowerCase() === clean.toLowerCase());
    if (exists) {
      setAlert({ type: 'error', text: `School "${clean}" already exists in the list.` });
      return;
    }

    const updated = [...feederSchools];
    updated[index] = clean;
    setFeederSchools(updated);
    setEditingSchoolIndex(null);
    setEditingSchoolValue('');
    saveFeederSchools(updated);
    setAlert({ type: 'success', text: `Updated school name to "${clean}"!` });
  };

  const handleDeleteSchool = (index, name) => {
    setConfirmModalConfig({
      type: 'danger',
      title: 'Remove Feeder School',
      message: `Remove "${name}" from the feeder schools list?`,
      confirmText: 'Remove School',
      onConfirm: () => {
        setConfirmModalConfig(null);
        const updated = feederSchools.filter((_, idx) => idx !== index);
        setFeederSchools(updated);
        saveFeederSchools(updated);
        setAlert({ type: 'success', text: `Removed "${name}" from feeder schools.` });
      }
    });
  };

  const handleSortSchools = () => {
    const sorted = [...feederSchools].sort((a, b) => a.localeCompare(b));
    setFeederSchools(sorted);
    saveFeederSchools(sorted);
    setAlert({ type: 'success', text: `Sorted ${sorted.length} schools alphabetically (A-Z)!` });
  };

  const handleResetDefaultSchools = () => {
    setConfirmModalConfig({
      type: 'warning',
      title: 'Reset Feeder Schools',
      message: 'Reset the feeder schools list to the standard 44 valley schools? Any custom additions will be restored to defaults.',
      confirmText: 'Reset to Defaults',
      onConfirm: () => {
        setConfirmModalConfig(null);
        setFeederSchools(DEFAULT_FEEDER_SCHOOLS);
        saveFeederSchools(DEFAULT_FEEDER_SCHOOLS);
        setAlert({ type: 'success', text: 'Feeder schools list reset to standard defaults (44 schools)!' });
      }
    });
  };

  const filteredFeederSchools = useMemo(() => {
    if (!schoolSearchTerm.trim()) return feederSchools;
    const q = schoolSearchTerm.toLowerCase().trim();
    return feederSchools.filter((s) => s.toLowerCase().includes(q));
  }, [feederSchools, schoolSearchTerm]);

  // Universal Save Action (Applies current tab changes)
  const handleUniversalSave = () => {
    if (activeSubTab === 'schools') {
      saveFeederSchools(feederSchools);
      setAlert({ type: 'success', text: '✨ Feeder schools list saved and synchronized to cloud!' });
    } else {
      handleSaveSubjects();
    }
  };

  return (
    <div className="space-y-3.5 text-xs animate-fadeIn text-slate-900 dark:text-slate-100">
      {/* Top Banner Alert */}
      {alert && (
        <div className={`p-3 rounded-2xl font-extrabold flex items-center justify-between gap-3 shadow-xs ${
          alert.type === 'error' ? 'bg-rose-600 text-white' : 'bg-emerald-600 text-white'
        }`}>
          <div className="flex items-center gap-2">
            {alert.type === 'error' ? <AlertCircle size={15} /> : <CheckCircle2 size={15} />}
            <span>{alert.text}</span>
          </div>
          <button onClick={() => setAlert(null)} className="p-1 hover:opacity-75 cursor-pointer">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Main Module Card */}
      <div className="p-3 sm:p-4 rounded-3xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-3">
        {/* Top Header & Toolbar with Consistent [Save Changes] Button */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-3 gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-2xl bg-teal-50 dark:bg-teal-950/60 border border-teal-200/60 dark:border-teal-800/60 flex items-center justify-center text-teal-600 dark:text-teal-400 shrink-0 shadow-2xs">
              <BookOpen size={16} />
            </div>
            <div>
              <h2 className="font-extrabold text-sm text-slate-900 dark:text-white leading-tight">
                Subjects, Streams & Feeder Schools
              </h2>
              <p className="text-[10.5px] font-semibold text-slate-400 dark:text-slate-500">
                Configure stream pools, compulsory/elective rules & feeder schools directory
              </p>
            </div>
          </div>

          {/* Consistent Standard Save Changes Button */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleUniversalSave}
              disabled={saving}
              className="px-4 py-1.5 rounded-xl text-xs font-black bg-amber-600 hover:bg-amber-500 text-white shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-all active:scale-95"
            >
              {saving ? <RefreshCw size={13} className="animate-spin" /> : <Save size={13} />}
              <span>Save Changes</span>
            </button>
          </div>
        </div>

        {/* Sub Navigation Bar */}
        <div className="flex items-center gap-1.5 border-b border-slate-100 dark:border-slate-800 pb-2 overflow-x-auto no-scrollbar">
          {[
            { id: 'subjects', label: '1. Subjects & Streams Pools', shortLabel: '1. Pools', icon: BookOpen },
            { id: 'rules', label: '2. Admission Form Structure & Rules', shortLabel: '2. Form Rules', icon: Sliders },
            { id: 'schools', label: '3. Feeder Schools Registry', shortLabel: '3. Feeder Schools', icon: GraduationCap },
          ].map((sub) => {
            const Icon = sub.icon;
            const isActive = activeSubTab === sub.id;
            return (
              <button
                key={sub.id}
                type="button"
                onClick={() => setActiveSubTab(sub.id)}
                className={`py-1 px-3 rounded-xl font-black text-xs flex items-center gap-1.5 transition-all whitespace-nowrap cursor-pointer shrink-0 ${
                  isActive
                    ? 'bg-teal-600 text-white shadow-xs ring-1 ring-teal-500/30'
                    : 'bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <Icon size={13} />
                <span className="sm:hidden">{sub.shortLabel}</span>
                <span className="hidden sm:inline">{sub.label}</span>
              </button>
            );
          })}
        </div>

        {/* SUBTAB 1: SUBJECTS & STREAMS POOLS */}
        {activeSubTab === 'subjects' && (
          <form onSubmit={handleSaveSubjects} className="space-y-3.5 pt-1">
            {/* Class & Stream Selectors */}
            <div className="p-3 rounded-2xl bg-slate-50/70 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-slate-500">Target Class:</span>
                <div className="inline-flex p-1 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
                  {['9th', '10th', '11th', '12th'].map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setSelectedClass(c)}
                      className={`px-3 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
                        selectedClass === c
                          ? 'bg-teal-600 text-white shadow-2xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      Class {c}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-black uppercase tracking-wider text-slate-500">Stream:</span>
                <div className="inline-flex p-1 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
                  {['General', 'Science', 'Humanities', 'Commerce'].map(s => {
                    const isSec = selectedClass === '9th' || selectedClass === '10th';
                    if (isSec && s !== 'General') return null;
                    if (!isSec && s === 'General') return null;

                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setSelectedStream(s)}
                        className={`px-3 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
                          selectedStream === s
                            ? 'bg-indigo-600 text-white shadow-2xs'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        {s}
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={handleExploreCombinations}
                  className="px-3 py-1.5 rounded-xl font-black text-xs text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/80 hover:bg-indigo-100 border border-indigo-200 dark:border-indigo-800 flex items-center gap-1.5 cursor-pointer shadow-2xs transition-all"
                >
                  <Wand2 size={13} className="text-indigo-600" />
                  <span>Explore Combinations</span>
                </button>
              </div>
            </div>

            {/* Constraints Row: Min / Max Subjects */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-800/60">
              <div>
                <label className="block text-[10px] font-black uppercase text-amber-900 dark:text-amber-300 mb-1">
                  Min Total Subjects
                </label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={minSubjects}
                  onChange={(e) => setMinSubjects(e.target.value)}
                  className="w-full p-1.5 rounded-xl text-xs font-black border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-amber-900 dark:text-amber-300 mb-1">
                  Max Total Subjects
                </label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={maxSubjects}
                  onChange={(e) => setMaxSubjects(e.target.value)}
                  className="w-full p-1.5 rounded-xl text-xs font-black border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-amber-900 dark:text-amber-300 mb-1">
                  Group B Electives (Min - Max)
                </label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min="0"
                    max="10"
                    value={g1Min}
                    onChange={(e) => setG1Min(e.target.value)}
                    className="w-1/2 p-1.5 rounded-xl text-xs font-black border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                  />
                  <span className="text-slate-400 font-bold">-</span>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    value={g1Max}
                    onChange={(e) => setG1Max(e.target.value)}
                    className="w-1/2 p-1.5 rounded-xl text-xs font-black border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-amber-900 dark:text-amber-300 mb-1">
                  Group C Vocational (Min - Max)
                </label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min="0"
                    max="10"
                    value={g2Min}
                    onChange={(e) => setG2Min(e.target.value)}
                    className="w-1/2 p-1.5 rounded-xl text-xs font-black border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                  />
                  <span className="text-slate-400 font-bold">-</span>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    value={g2Max}
                    onChange={(e) => setG2Max(e.target.value)}
                    className="w-1/2 p-1.5 rounded-xl text-xs font-black border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                  />
                </div>
              </div>
            </div>

            {/* 3 Subject Pools Columns */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Pool A: Compulsory */}
              <div className="p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs space-y-2.5">
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 dark:border-slate-800">
                  <span className="font-black text-xs text-indigo-700 dark:text-indigo-400">
                    Group A: Compulsory ({groupA.length})
                  </span>
                  <span className="text-[9.5px] font-bold bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300 px-2 py-0.5 rounded-full">
                    Auto-Locked
                  </span>
                </div>

                <div className="flex flex-wrap gap-1.5 min-h-[90px] p-2 bg-slate-50 dark:bg-slate-950/40 rounded-xl border border-slate-200/70 dark:border-slate-800/70">
                  {groupA.map((sub, i) => (
                    <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-100 dark:bg-indigo-950 text-indigo-900 dark:text-indigo-200 text-xs font-bold shadow-2xs">
                      {sub}
                      <button
                        type="button"
                        onClick={() => setGroupA(groupA.filter((_, idx) => idx !== i))}
                        className="hover:text-rose-600 p-0.5"
                      >
                        <X size={11} />
                      </button>
                    </span>
                  ))}
                  {groupA.length === 0 && (
                    <span className="text-slate-400 italic text-xs self-center">No compulsory subjects configured</span>
                  )}
                </div>

                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={newSubA}
                    onChange={(e) => setNewSubA(e.target.value)}
                    placeholder="Add compulsory subject..."
                    className="flex-1 px-2.5 py-1.5 rounded-xl text-xs border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (newSubA.trim() && !groupA.includes(newSubA.trim())) {
                        setGroupA([...groupA, newSubA.trim()]);
                        setNewSubA('');
                      }
                    }}
                    className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs"
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* Pool B: Electives */}
              <div className="p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs space-y-2.5">
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 dark:border-slate-800">
                  <span className="font-black text-xs text-teal-700 dark:text-teal-400">
                    Group B: Electives ({groupB.length})
                  </span>
                  <span className="text-[9.5px] font-bold bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-300 px-2 py-0.5 rounded-full">
                    {g1Min}-{g1Max} Required
                  </span>
                </div>

                <div className="flex flex-wrap gap-1.5 min-h-[90px] p-2 bg-slate-50 dark:bg-slate-950/40 rounded-xl border border-slate-200/70 dark:border-slate-800/70">
                  {groupB.map((sub, i) => (
                    <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-teal-100 dark:bg-teal-950 text-teal-900 dark:text-teal-200 text-xs font-bold shadow-2xs">
                      {sub}
                      <button
                        type="button"
                        onClick={() => setGroupB(groupB.filter((_, idx) => idx !== i))}
                        className="hover:text-rose-600 p-0.5"
                      >
                        <X size={11} />
                      </button>
                    </span>
                  ))}
                  {groupB.length === 0 && (
                    <span className="text-slate-400 italic text-xs self-center">No group B electives configured</span>
                  )}
                </div>

                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={newSubB}
                    onChange={(e) => setNewSubB(e.target.value)}
                    placeholder="Add elective subject..."
                    className="flex-1 px-2.5 py-1.5 rounded-xl text-xs border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (newSubB.trim() && !groupB.includes(newSubB.trim())) {
                        setGroupB([...groupB, newSubB.trim()]);
                        setNewSubB('');
                      }
                    }}
                    className="px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs"
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* Pool C: Vocational / Skill */}
              <div className="p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs space-y-2.5">
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 dark:border-slate-800">
                  <span className="font-black text-xs text-amber-700 dark:text-amber-400">
                    Group C: Skill & Voc. ({groupC.length})
                  </span>
                  <span className="text-[9.5px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 px-2 py-0.5 rounded-full">
                    {g2Min}-{g2Max} Required
                  </span>
                </div>

                <div className="flex flex-wrap gap-1.5 min-h-[90px] p-2 bg-slate-50 dark:bg-slate-950/40 rounded-xl border border-slate-200/70 dark:border-slate-800/70">
                  {groupC.map((sub, i) => (
                    <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-200 text-xs font-bold shadow-2xs">
                      {sub}
                      <button
                        type="button"
                        onClick={() => setGroupC(groupC.filter((_, idx) => idx !== i))}
                        className="hover:text-rose-600 p-0.5"
                      >
                        <X size={11} />
                      </button>
                    </span>
                  ))}
                  {groupC.length === 0 && (
                    <span className="text-slate-400 italic text-xs self-center">No group C skill subjects configured</span>
                  )}
                </div>

                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={newSubC}
                    onChange={(e) => setNewSubC(e.target.value)}
                    placeholder="Add skill subject..."
                    className="flex-1 px-2.5 py-1.5 rounded-xl text-xs border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (newSubC.trim() && !groupC.includes(newSubC.trim())) {
                        setGroupC([...groupC, newSubC.trim()]);
                        setNewSubC('');
                      }
                    }}
                    className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>
          </form>
        )}

        {/* SUBTAB 2: ADMISSION FORM LIVE STRUCTURE & TEST FLIGHT */}
        {activeSubTab === 'rules' && (
          <div className="space-y-3.5 pt-1">
            <div className="p-3.5 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 space-y-2">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-indigo-600 dark:text-indigo-400" />
                <h3 className="font-extrabold text-sm text-indigo-950 dark:text-indigo-200">
                  Live Admission Form Integration Check
                </h3>
              </div>
              <p className="text-xs text-indigo-800 dark:text-indigo-300 leading-relaxed">
                When an applicant selects a class and stream on the admission portal, the form dynamically binds to the pools defined above. Below is a live interactive flight simulator testing the rule enforcement for <strong>{selectedClass} {selectedStream}</strong>.
              </p>
            </div>

            {/* Test Flight Simulator */}
            <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                <div>
                  <span className="text-xs font-black text-slate-900 dark:text-white">
                    Simulated Candidate Subject Selection ({selectedClass} {selectedStream})
                  </span>
                  <p className="text-[10px] text-slate-400">Click subjects below to test combination validator</p>
                </div>
                <div className="text-right">
                  <span className="text-xs font-mono font-bold text-teal-600 dark:text-teal-400">
                    Total: {groupA.length + testFlightSelections.length} / {maxSubjects}
                  </span>
                </div>
              </div>

              {/* Compulsory locked preview */}
              <div>
                <span className="text-[10.5px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  1. Locked Compulsory Subjects:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {groupA.map((sub, i) => (
                    <span key={i} className="px-2.5 py-1 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold">
                      🔒 {sub}
                    </span>
                  ))}
                </div>
              </div>

              {/* Elective Choices Preview */}
              <div>
                <span className="text-[10.5px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  2. Choose Optional Electives (Group B & Group C):
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {[...groupB, ...groupC].map((sub, i) => {
                    const isSelected = testFlightSelections.includes(sub);
                    const isB = groupB.includes(sub);
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => {
                          if (isSelected) setTestFlightSelections(testFlightSelections.filter(s => s !== sub));
                          else setTestFlightSelections([...testFlightSelections, sub]);
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                          isSelected
                            ? isB 
                              ? 'bg-teal-600 text-white border-teal-600 shadow-2xs' 
                              : 'bg-amber-600 text-white border-amber-600 shadow-2xs'
                            : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-400'
                        }`}
                      >
                        {isSelected ? '✓ ' : '+ '}{sub} ({isB ? 'Group B' : 'Group C'})
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Validation Result Box */}
              {(() => {
                const total = groupA.length + testFlightSelections.length;
                const min = parseInt(minSubjects, 10) || 5;
                const max = parseInt(maxSubjects, 10) || 6;
                const bCount = testFlightSelections.filter(s => groupB.includes(s)).length;
                const cCount = testFlightSelections.filter(s => groupC.includes(s)).length;
                const minB = parseInt(g1Min, 10) || 0;
                const maxB = parseInt(g1Max, 10) || 10;
                const minC = parseInt(g2Min, 10) || 0;
                const maxC = parseInt(g2Max, 10) || 10;

                let isValid = true;
                let errorMsg = null;

                if (total < min) {
                  isValid = false;
                  errorMsg = `Requires at least ${min} subjects. Currently ${total} selected.`;
                } else if (total > max) {
                  isValid = false;
                  errorMsg = `Exceeds max allowed (${max} subjects). Currently ${total} selected.`;
                } else if (bCount < minB) {
                  isValid = false;
                  errorMsg = `Please select at least ${minB} subject(s) from Group B (Currently ${bCount}).`;
                } else if (bCount > maxB) {
                  isValid = false;
                  errorMsg = `Exceeds Group B maximum of ${maxB} subject(s) (Currently ${bCount}).`;
                } else if (cCount < minC) {
                  isValid = false;
                  errorMsg = `Please select at least ${minC} subject(s) from Group C (Currently ${cCount}).`;
                } else if (cCount > maxC) {
                  isValid = false;
                  errorMsg = `Exceeds Group C maximum of ${maxC} subject(s) (Currently ${cCount}).`;
                }

                return (
                  <div className={`p-3 rounded-xl border font-bold text-xs flex items-center justify-between ${
                    isValid
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                      : 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200'
                  }`}>
                    <div className="flex items-center gap-2">
                      {isValid ? <CheckCircle2 size={16} className="text-emerald-600" /> : <AlertCircle size={16} className="text-rose-600" />}
                      <span>{isValid ? 'Valid Subject Combination: Candidate can proceed with submission!' : errorMsg}</span>
                    </div>
                    <span className="font-mono text-[11px] opacity-80">
                      G-B: {bCount} | G-C: {cCount}
                    </span>
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* SUBTAB 3: FEEDER SCHOOLS REGISTRY */}
        {activeSubTab === 'schools' && (
          <div className="space-y-3.5 pt-1">
            {/* Feeder Schools Controls Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <span className="font-black text-xs text-slate-800 dark:text-slate-200">
                  Feeder Schools Directory ({feederSchools.length})
                </span>
                <button
                  type="button"
                  onClick={handleSortSchools}
                  className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 flex items-center gap-1 cursor-pointer transition-colors"
                  title="Sort schools alphabetically A to Z"
                >
                  <ArrowUpDown size={12} />
                  <span>A-Z</span>
                </button>
                <button
                  type="button"
                  onClick={handleResetDefaultSchools}
                  className="px-2.5 py-1 rounded-lg text-xs font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100 border border-amber-200 dark:border-amber-800/80 cursor-pointer transition-colors"
                  title="Reset to 44 standard defaults"
                >
                  Reset Defaults
                </button>
              </div>

              <div className="relative sm:w-64">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={schoolSearchTerm}
                  onChange={(e) => setSchoolSearchTerm(e.target.value)}
                  placeholder="Search feeder school..."
                  className="w-full pl-7 pr-6 py-1 rounded-xl text-xs font-semibold bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:ring-1 focus:ring-teal-500 transition-all"
                />
                {schoolSearchTerm && (
                  <button onClick={() => setSchoolSearchTerm('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400">
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>

            {/* Add New School Form */}
            <form onSubmit={handleAddSchool} className="flex gap-2">
              <input
                type="text"
                value={newSchoolName}
                onChange={(e) => setNewSchoolName(e.target.value)}
                placeholder="Enter new feeder school name (e.g. GMS Shangus)..."
                className="flex-1 px-3 py-1.5 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-teal-500"
              />
              <button
                type="submit"
                disabled={!newSchoolName.trim()}
                className="px-4 py-1.5 rounded-xl text-xs font-black bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white flex items-center gap-1 cursor-pointer transition-all shadow-2xs"
              >
                <Plus size={13} />
                <span>Add School</span>
              </button>
            </form>

            {/* Feeder Schools List Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-[420px] overflow-y-auto p-1 scrollbar-thin">
              {filteredFeederSchools.map((school, idx) => {
                const isEditing = editingSchoolIndex === idx;
                return (
                  <div
                    key={idx}
                    className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 hover:border-teal-400 transition-all flex items-center justify-between gap-2"
                  >
                    {isEditing ? (
                      <div className="flex items-center gap-1.5 flex-1 min-w-0">
                        <input
                          type="text"
                          value={editingSchoolValue}
                          onChange={(e) => setEditingSchoolValue(e.target.value)}
                          className="flex-1 px-2 py-0.5 rounded-lg text-xs font-bold border border-teal-500 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveEditSchool(idx);
                            if (e.key === 'Escape') setEditingSchoolIndex(null);
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveEditSchool(idx)}
                          className="p-1 rounded bg-teal-600 text-white"
                        >
                          <Check size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingSchoolIndex(null)}
                          className="p-1 rounded bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ) : (
                      <>
                        <span className="font-bold text-xs text-slate-800 dark:text-slate-200 truncate">
                          {idx + 1}. {school}
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleStartEditSchool(idx, school)}
                            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800"
                            title="Edit school name"
                          >
                            <Pencil size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteSchool(idx, school)}
                            className="p-1 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/60"
                            title="Delete school"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}

              {filteredFeederSchools.length === 0 && (
                <div className="col-span-full py-8 text-center text-slate-400 font-semibold text-xs">
                  No feeder schools found matching "{schoolSearchTerm}".
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── COMBINATIONS EXPLORER MODAL ── */}
      {showComboModal && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/75 backdrop-blur-md flex items-center justify-center p-3 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[85vh] flex flex-col overflow-hidden animate-scaleUp">
            <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wand2 size={16} className="text-indigo-600" />
                <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                  Valid Subject Combinations ({selectedClass} {selectedStream})
                </h3>
              </div>
              <button onClick={() => setShowComboModal(false)} className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer">
                <X size={16} />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-2 flex-1 scrollbar-thin text-xs font-semibold">
              <p className="text-slate-500 dark:text-slate-400 text-[11px]">
                Calculated {comboList.length} permitted combinations based on current rules ({minSubjects}-{maxSubjects} subjects):
              </p>
              <div className="space-y-1.5">
                {comboList.map((combo, idx) => (
                  <div key={idx} className="p-2 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <span className="w-6 font-mono text-[10px] text-slate-400">{idx + 1}.</span>
                    <span className="font-bold">{combo}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(comboList.join('\n'));
                  setComboCopied(true);
                  setTimeout(() => setComboCopied(false), 2000);
                }}
                className="px-3 py-1.5 rounded-xl font-bold text-xs bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 flex items-center gap-1.5 cursor-pointer"
              >
                {comboCopied ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                <span>{comboCopied ? 'Copied to Clipboard!' : 'Copy All Combinations'}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowComboModal(false)}
                className="px-4 py-1.5 rounded-xl font-bold text-xs bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Feeder Schools */}
      {confirmModalConfig && (
        <ConfirmModal
          isOpen={true}
          onClose={() => setConfirmModalConfig(null)}
          onCancel={() => setConfirmModalConfig(null)}
          {...confirmModalConfig}
        />
      )}
    </div>
  );
}
