import React from 'react';
import { Upload, CheckCircle2, AlertCircle, Info, Camera } from 'lucide-react';
import compressStudentPhoto from '../../utils/imageCompressor';

const PREVIOUS_SCHOOLS = [
  'Army Proud Scholars School Khundroo',
  'Badasgam Public School Anantnag',
  'Elite Public School Tailwani',
  'Evergreen Public Instt Kawarigam',
  'Govt  High School Cheerpora',
  'Govt Boys High School Nowgam',
  'Govt Boys Hr Sec Akingam',
  'Govt Boys Hr Sec Anantnag',
  'Govt Boys Hr Sec School Achabal',
  'Govt Boys Hr Sec School Anantnag',
  'Govt Boys Hr Sec School B K Pora Chadura',
  'Govt Boys Hr Sec School Natipora',
  'Govt Boys Hr Sec School Salia',
  'Govt Girls High School Brah',
  'Govt Girls High School Shangus',
  'Govt High School Andoo',
  'Govt High School Brariangan',
  'Govt High School Chowgam',
  'Govt High School Issoo',
  'Govt High School Krad',
  'Govt High School Nowgam Kuthar',
  'Govt High School Ranipora',
  'Govt High School Teelwani',
  'Govt Higher Secondary School Dethu',
  'Govt Hr Sec School Chittergul',
  'Govt Hr Sec School Khanabal Anantnag',
  'Govt Hr Sec School Shangus',
  'Govt Hr Sec School Utrasoo',
  'Hanfia High School Mir Mohlla Achabal',
  'Hanfia Memorial Institute Nowgam',
  'Hista Higher Secondary School Anantnag',
  'Iqra Public School',
  'KIE Hr Sec School Lasjan Srinagar',
  'Modern Public School Nowgam Shangus',
  'National Institute of Open Schooling',
  'Oxford Presentation School K P Road Anantnag',
  'PM Shri School Jawahar Navodaya Vidyalaya',
  'Radiant Public School Anantnag',
  'Saint Xians International School Anantnag',
  'Shaheen Public School Ranipora',
  'Sheikhulalam Memorial Institute Shangus',
  'Sidrah Institute of Education K P Road Anantnag',
  'Stpeters International Academy Anantnag',
];

/**
 * DynamicFormField — Renders a form input element based on field configuration.
 */
export default function DynamicFormField({
  config,
  value = '',
  onChange,
  disabled = false,
  error = null,
  subjectsConfig = null,
  selectedStream = '',
  formData = null,
}) {
  const name = config.fieldName || config.name || config['Field Name'];
  const label = name; // From sheet, name is the label
  const type = config.fieldType || config.type || config['Field Type'] || 'text';
  const required = config.required || config['Is Required?'] === 'TRUE';
  const optionsRaw = config.options || config['Options / Range / Length'] || '';
  const rawPlaceholder = config.placeholder || config['Placeholder'] || '';
  const hint = config.helpText || config['Help Text'] || '';

  // Clean raw {{Template}} tags from placeholders
  const placeholder = (rawPlaceholder && rawPlaceholder.includes('{{')) ? '' : rawPlaceholder;

  // Process options based on type
  let options = [];
  let min = '', max = '', length = '';

  if (type === 'list') {
    options = optionsRaw.split(',').map(o => o.trim()).filter(Boolean);
  } else if (type === 'number_range') {
    const parts = optionsRaw.split('-');
    if (parts.length === 2) {
      min = parts[0];
      max = parts[1];
    }
  } else if (type === 'text_numeric' || type === 'text') {
    length = optionsRaw; // maxLength
  }

  // Calculate live percentage badge if this is a marks field
  let calcPercentageBadge = null;
  const lowerName = (name || '').toLowerCase();
  if (formData && (lowerName.includes('marks obtained') || lowerName.includes('max. marks'))) {
    const clsMatch = name.match(/Class \d+th|Class 8th|Class 9th|Class 10th|Class 11th|Class 12th/i);
    if (clsMatch) {
      const cls = clsMatch[0];
      const obt = parseFloat(formData[`Total Marks Obtained in ${cls}`]);
      const maxVal = parseFloat(formData[`Total Max. Marks in ${cls}`] || 500);
      if (!isNaN(obt) && !isNaN(maxVal) && maxVal > 0) {
        const pct = ((obt / maxVal) * 100).toFixed(2);
        calcPercentageBadge = `${pct}%`;
      }
    }
  }

  // Handle photo/file upload with automatic 100KB canvas compression
  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const { dataUrl } = await compressStudentPhoto(file, 300, 360, 0.8);
      onChange(name, dataUrl);
    } catch (err) {
      console.error('Photo compression error:', err);
      const reader = new FileReader();
      reader.onload = (event) => onChange(name, event.target.result);
      reader.readAsDataURL(file);
    }
  };

  // Handle dynamic checkbox array for subjects
  const handleCheckboxArrayChange = (subject, checked) => {
    let currentArray = [];
    if (value && typeof value === 'string') {
      currentArray = value.split(', ').filter(Boolean);
    } else if (Array.isArray(value)) {
      currentArray = [...value];
    }

    if (checked) {
      currentArray.push(subject);
    } else {
      currentArray = currentArray.filter(s => s !== subject);
    }
    onChange(name, currentArray.join(', '));
  };

  const inputStyle = {
    backgroundColor: 'var(--bg-page, #f8fafc)',
    borderColor: error ? '#ef4444' : 'var(--border-ui, #cbd5e1)',
    color: 'var(--text-main, #0f172a)',
  };

  // Skip rendering for autogen fields and redundant ID card photo field
  if (type.startsWith('autogen') || lowerName === 'id card photo' || rawPlaceholder === '{{PHOTO_IC}}') return null;

  return (
    <div className="space-y-1" data-field-name={name}>
      <label className="text-xs font-bold flex items-center justify-between" style={{ color: 'var(--text-main, #1e293b)' }}>
        <span className="flex items-center gap-1.5">
          <span>{label} {required && <span className="text-red-500">*</span>}</span>
          {calcPercentageBadge && (
            <span className="px-2 py-0.5 rounded-md font-extrabold text-[10px] bg-teal-500/10 text-teal-600 border border-teal-500/20">
              Score: {calcPercentageBadge}
            </span>
          )}
        </span>
        {hint && (
          <span className="text-[10px] font-medium text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full flex items-center gap-1">
            <Info size={10} className="text-teal-600 flex-shrink-0" />
            {hint}
          </span>
        )}
      </label>

      {/* Select Field */}
      {type === 'list' && (
        <select
          value={value}
          onChange={(e) => onChange(name, e.target.value)}
          disabled={disabled}
          required={required}
          className="w-full px-3.5 py-2.5 rounded-xl text-sm border focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all cursor-pointer"
          style={inputStyle}
        >
          <option value="">-- Select {label} --</option>
          {options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      )}

      {/* Textarea Field */}
      {type === 'textarea' && (
        <textarea
          rows={3}
          value={value}
          onChange={(e) => onChange(name, e.target.value)}
          disabled={disabled}
          required={required}
          maxLength={length ? parseInt(length) : undefined}
          placeholder={placeholder || `Enter ${label}...`}
          className="w-full px-3.5 py-2.5 rounded-xl text-sm border focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all"
          style={inputStyle}
        />
      )}

      {/* File Upload Field / Passport Photo */}
      {(type === 'image' || type === 'file') && (
        <div className="space-y-2">
          {value ? (
            <div className="flex items-center gap-4 p-3 sm:p-4 rounded-2xl border bg-teal-500/5 border-teal-500/30 shadow-sm">
              <div className="w-20 h-24 rounded-xl border-2 border-teal-500/40 overflow-hidden bg-slate-100 dark:bg-slate-800 shadow-md flex-shrink-0">
                <img
                  src={value}
                  alt="Student Passport Preview"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex-1 text-xs space-y-1">
                <div className="font-extrabold text-teal-700 dark:text-teal-400 flex items-center gap-1 text-sm">
                  <CheckCircle2 size={16} /> Passport Photo Uploaded
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Compressed & optimized for official school register & identity cards (~5–10 KB).
                </p>
                {!disabled && (
                  <button
                    type="button"
                    onClick={() => onChange(name, '')}
                    className="mt-1 px-3 py-1 text-xs font-bold text-red-600 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1"
                  >
                    Replace Photo
                  </button>
                )}
              </div>
            </div>
          ) : (
            <label className="flex flex-col sm:flex-row items-center gap-4 p-4 border-2 border-dashed rounded-2xl cursor-pointer hover:border-teal-500 transition-all bg-slate-50 dark:bg-slate-900/40 border-slate-300 dark:border-slate-700">
              <div className="w-20 h-24 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 flex flex-col items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-400 flex-shrink-0">
                <Camera size={24} className="text-teal-600 mb-1" />
                <span className="text-[9px] font-black uppercase tracking-wider text-slate-500">35x45 mm</span>
              </div>
              <div className="flex-1 text-center sm:text-left">
                <div className="text-xs font-extrabold" style={{ color: 'var(--text-main, #0f172a)' }}>
                  Click to Upload Passport Size Photo {required && <span className="text-red-500">*</span>}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  Passport photo with white/light background (JPG, JPEG, PNG). Automatically compressed to ~5–10 KB.
                </p>
              </div>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFileChange}
                disabled={disabled}
                required={required && !value}
                className="hidden"
              />
            </label>
          )}
        </div>
      )}

      {/* Default Input (text, number, text_numeric, date) */}
      {(type === 'text' || type === 'number' || type === 'number_range' || type === 'text_numeric' || type === 'date') && (
        <>
          <input
            type={type === 'text' ? 'text' : type === 'text_numeric' ? 'tel' : type === 'date' ? 'date' : 'number'}
            value={value}
            onChange={(e) => onChange(name, e.target.value)}
            disabled={disabled}
            required={required}
            min={min}
            max={max}
            maxLength={length ? parseInt(length) : undefined}
            list={lowerName.includes('school') ? 'previous_schools_datalist' : undefined}
            placeholder={placeholder || `Enter ${label}`}
            className="w-full px-3.5 py-2.5 rounded-xl text-sm border focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all"
            style={inputStyle}
          />
          {lowerName.includes('school') && (
            <datalist id="previous_schools_datalist">
              {PREVIOUS_SCHOOLS.map((school, i) => (
                <option key={i} value={school} />
              ))}
            </datalist>
          )}
        </>
      )}

      {/* Checkbox Dynamic (Subjects) */}
      {type === 'checkbox_dynamic' && (
        <div className="space-y-2 mt-2">
          {(() => {
            let availableSubjects = [];
            if (subjectsConfig) {
              if (name.includes('11th') || name.includes('12th')) {
                // Determine class and stream
                const cls = name.includes('11th') ? '11th' : '12th';
                const strm = selectedStream || 'Science';
                const strmData = subjectsConfig[cls] && subjectsConfig[cls][strm];
                if (strmData) {
                  // Merge all groups if it's an object
                  if (Array.isArray(strmData)) {
                    availableSubjects = strmData;
                  } else {
                    availableSubjects = [
                      ...(strmData.compulsory || []),
                      ...(strmData.group1 || []),
                      ...(strmData.group2 || [])
                    ];
                  }
                }
              } else if (name.includes('9th') || name.includes('10th')) {
                const cls = name.includes('9th') ? '9th' : '10th';
                const strmData = subjectsConfig[cls] && subjectsConfig[cls]['General'];
                if (strmData) {
                  if (Array.isArray(strmData)) {
                    availableSubjects = strmData;
                  } else {
                    availableSubjects = [
                      ...(strmData.compulsory || []),
                      ...(strmData.group1 || []),
                      ...(strmData.group2 || [])
                    ];
                  }
                }
              }
            }

            if (!availableSubjects || availableSubjects.length === 0) {
              return <div className="text-xs text-slate-500 italic p-2">Please select Stream/Class first to view subjects.</div>;
            }

            const currentArray = (typeof value === 'string' ? value.split(', ') : (value || [])).filter(Boolean);

            return (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {availableSubjects.map((sub) => {
                  const isChecked = currentArray.includes(sub);
                  return (
                    <label
                      key={sub}
                      className={`flex items-center gap-2 text-xs p-2.5 rounded-xl border cursor-pointer transition-all ${
                        isChecked
                          ? 'bg-teal-50 border-teal-500 text-teal-950 font-bold shadow-sm dark:bg-teal-950/40 dark:text-teal-200'
                          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-teal-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => handleCheckboxArrayChange(sub, e.target.checked)}
                        disabled={disabled}
                        className="w-4 h-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                      />
                      {sub}
                    </label>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}

      {/* Checkbox Declaration */}
      {type === 'checkbox_declaration' && (
        <label className="flex items-start gap-3 p-4 rounded-2xl border bg-teal-50/50 dark:bg-slate-900/50 cursor-pointer transition-colors border-teal-500/30">
          <input
            type="checkbox"
            required={required}
            checked={value === 'TRUE' || value === true}
            onChange={(e) => onChange(name, e.target.checked ? 'TRUE' : 'FALSE')}
            disabled={disabled}
            className="w-5 h-5 rounded border-slate-300 text-teal-600 focus:ring-teal-500 mt-0.5"
          />
          <div className="text-xs leading-relaxed text-slate-800 dark:text-slate-200 flex-1 font-medium">
            {optionsRaw || hint || label}
          </div>
        </label>
      )}

      {error && (
        <div className="text-[11px] text-red-500 font-medium flex items-center gap-1 mt-0.5">
          <AlertCircle size={12} /> {error}
        </div>
      )}
    </div>
  );
}
