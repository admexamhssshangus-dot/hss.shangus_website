
    // Global utility to escape HTML characters
    window.escapeHtmlStr = function (str) {
        if (!str) return '';
        var result = '';
        var s = String(str);
        for (var i = 0; i < s.length; i++) {
            var c = s.charAt(i);
            switch (c) {
                case '&': result += '&amp;'; break;
                case '<': result += '&lt;'; break;
                case '>': result += '&gt;'; break;
                case "'": result += '&#39;'; break;
                case '"': result += '&quot;'; break;
                default: result += c;
            }
        }
        return result;
    };
    // Version tracking for auto-update detection
    const CLIENT_VERSION = '1.0.0';
    const MAINTENANCE_MESSAGE = 'The site is under maintenance and will be restored shortly. Please try again after a few minutes.';
    let lastSeenServerVersion = localStorage.getItem('hss_last_server_version') || '';
    let currentLoginRole = 'student';
    let registrationRole = 'student';

    // Interactive Contact Picker Logic for Login Footer
    window.toggleContactPicker = function (type) {
        const picker = document.getElementById('contactPicker');
        const options = document.getElementById('contactPickerOptions');
        const title = document.getElementById('contactPickerTitle');
        const numbers = ['7006537425', '7006034501', '9596165142'];

        if (!picker || !options) return;

        if (picker.classList.contains('hidden') || picker.dataset.type !== type) {
            picker.classList.remove('hidden');
            picker.dataset.type = type;
            title.innerText = type === 'call' ? 'Choose number to Call' : 'Choose contact for WhatsApp';

            if (type === 'whatsapp') {
                options.innerHTML = `
                    <div style="margin-bottom: 8px;">
                        <input type="text" id="customWaMsg" placeholder="Type your custom message..." style="width: 100%; padding: 10px; border-radius: 8px; border: 1px solid var(--border); font-size: 0.85rem;" value="Hi, I have a query regarding admission.">
                    </div>
                    ${numbers.map(num => `
                    <a href="#" onclick="var msg = document.getElementById('customWaMsg').value; window.open('https://api.whatsapp.com/send?phone=91${num}&text=' + encodeURIComponent(msg), '_blank'); return false;"
                       class="contact-option" target="_blank" rel="noopener noreferrer"
                       style="display: flex; align-items: center; justify-content: space-between; padding: 0.6rem 0.8rem; background: var(--bg-card); border: 1px solid var(--border); border-radius: 10px; text-decoration: none; color: var(--text-primary); transition: all 0.18s cubic-bezier(0.4, 0, 0.2, 1); box-shadow: 0 2px 4px rgba(0,0,0,0.04); margin-bottom: 6px;">
                        <div style="display:flex; align-items:center; gap:0.6rem">
                            <div style="width:32px; height:32px; border-radius:50%; display:flex; align-items:center; justify-content:center; background:rgba(37, 211, 102, 0.1)">
                                <span class="material-icons" style="font-size: 1.1rem; color: #25d366;">whatsapp</span>
                            </div>
                            <span style="font-family: monospace; font-weight: 700; font-size: 1rem; color: #1e293b;">${num}</span>
                        </div>
                        <span class="material-icons" style="font-size: 1.1rem; color: var(--text-secondary); opacity: 0.5;">send</span>
                    </a>
                `).join('')}`;
            } else {
                options.innerHTML = numbers.map(num => `
                    <a href="tel:${num}" 
                       class="contact-option" target="_blank" rel="noopener noreferrer"
                       style="display: flex; align-items: center; justify-content: space-between; padding: 0.6rem 0.8rem; background: var(--bg-card); border: 1px solid var(--border); border-radius: 10px; text-decoration: none; color: var(--text-primary); transition: all 0.18s cubic-bezier(0.4, 0, 0.2, 1); box-shadow: 0 2px 4px rgba(0,0,0,0.04); margin-bottom: 6px;">
                        <div style="display:flex; align-items:center; gap:0.6rem">
                            <div style="width:32px; height:32px; border-radius:50%; display:flex; align-items:center; justify-content:center; background:rgba(13, 148, 136, 0.1)">
                                <span class="material-icons" style="font-size: 1.1rem; color: #0d9488;">call</span>
                            </div>
                            <span style="font-family: monospace; font-weight: 700; font-size: 1rem; color: #1e293b;">${num}</span>
                        </div>
                        <span class="material-icons" style="font-size: 1.1rem; color: var(--text-secondary); opacity: 0.5;">phone_forwarded</span>
                    </a>
                `).join('');
            }

            // Auto scroll to picker if on mobile
            if (window.innerWidth < 640) {
                setTimeout(() => picker.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100);
            }
        } else {
            picker.classList.add('hidden');
        }
    };

    // Debounce utility to optimize rapid API calls and DOM filtering
    function debounce(func, wait) {
        let timeout;
        return function (...args) {
            const context = this;
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(context, args), wait);
        };
    }

    /* Premium Multi-Select Component Logic */
    window.toggleMultiSelect = (id) => {
        const container = document.getElementById(id);
        if (!container) return;
        const isActive = container.classList.contains('active');
        document.querySelectorAll('.multi-select-container.active').forEach(c => {
            if (c.id !== id) c.classList.remove('active');
        });
        container.classList.toggle('active');
    };

    window.handleMultiSelectAll = (id, allInput) => {
        const container = document.getElementById(id);
        if (!container) return;
        const checkboxes = container.querySelectorAll('input[type="checkbox"]:not(.option-all-input)');
        checkboxes.forEach(cb => cb.checked = allInput.checked);
        handleMultiSelectChange(id);
    };

    window.clearMultiSelect = (id) => {
        const container = document.getElementById(id);
        if (!container) return;
        const checkboxes = container.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(cb => cb.checked = false);
        handleMultiSelectChange(id);
    };

    window.handleMultiSelectChange = (id) => {
        const container = document.getElementById(id);
        if (!container) return;
        const allInput = container.querySelector('.option-all-input');
        const checkboxes = Array.from(container.querySelectorAll('input[type="checkbox"]:not(.option-all-input)'));
        const checkedCount = checkboxes.filter(cb => cb.checked).length;
        if (allInput) {
            allInput.checked = checkedCount === checkboxes.length;
            allInput.indeterminate = checkedCount > 0 && checkedCount < checkboxes.length;
        }
        updateMultiSelectText(id);
        if (id.startsWith('filter') || id === 'sortBy') {
            state.adminData.page = 1;
            renderAdminDashboard();
        } else if (id.startsWith('email')) {
            if (typeof updateRecipientCount === 'function') updateRecipientCount();
        } else if (id.startsWith('rollNo')) {
            if (typeof renderRollNoTable === 'function') renderRollNoTable();
        } else if (id.startsWith('push')) {
            const executePushBtn = document.getElementById('executePushToSourceBtn');
            const previewContainer = document.getElementById('pushPreviewContainer');
            if (executePushBtn) executePushBtn.disabled = true;
            if (previewContainer) previewContainer.style.display = 'none';
        } else if (id.startsWith('idCard')) {
            if (typeof clearIdCardResults === 'function') clearIdCardResults();
        }
    };

    function updateMultiSelectText(id) {
        const container = document.getElementById(id);
        if (!container) return;
        const triggerText = container.querySelector('.trigger-text');
        if (!triggerText) return;
        const inputs = Array.from(container.querySelectorAll('input[type="checkbox"]:not(.option-all-input), input[type="radio"]'));
        const checkboxes = Array.from(container.querySelectorAll('input[type="checkbox"]:not(.option-all-input)'));
        const checked = inputs.filter(i => i.checked);
        const placeholder = container.dataset.placeholder || 'Select...';
        // Update Select All checkbox state (only relevant when checkboxes exist)
        const allInput = container.querySelector('.option-all-input');
        if (allInput && checkboxes.length > 0) {
            const checkedCheckboxes = checked.filter(i => i.type === 'checkbox').length;
            allInput.checked = checkedCheckboxes === checkboxes.length;
            allInput.indeterminate = checkedCheckboxes > 0 && checkedCheckboxes < checkboxes.length;
        }
        // Update trigger text
        if (inputs.length === 0) {
            // No options yet - show 'All' as default state indicator
            triggerText.textContent = 'All ' + placeholder;
            triggerText.style.color = 'var(--text-secondary)';
        } else if (checked.length === 0) {
            triggerText.textContent = '- None -';
            triggerText.style.color = 'var(--warning)';
        } else if (checkboxes.length > 0 && checked.filter(i => i.type === 'checkbox').length === checkboxes.length) {
            triggerText.textContent = 'All ' + placeholder;
            triggerText.style.color = 'var(--primary)';
        } else if (checked.length === 1) {
            triggerText.textContent = checked[0].parentElement.textContent.trim();
            triggerText.style.color = 'var(--text-primary)';
        } else {
            triggerText.textContent = `${checked.length} of ${inputs.length}`;
            triggerText.style.color = 'var(--text-primary)';
        }
        const existingBadge = container.querySelector('.multi-select-badge');
        if (existingBadge) existingBadge.remove();
        if (checkboxes.length > 0 && checked.filter(i => i.type === 'checkbox').length > 0 && checked.filter(i => i.type === 'checkbox').length < checkboxes.length) {
            const badge = document.createElement('span');
            badge.className = 'multi-select-badge';
            badge.textContent = checked.filter(i => i.type === 'checkbox').length;
            const trigger = container.querySelector('.multi-select-trigger');
            if (trigger) trigger.appendChild(badge);
        }
    }

    function restoreDefaultsMultiSelect(id, defaultValues) {
        if (!defaultValues || !defaultValues.length) return;
        const container = document.getElementById(id);
        if (!container) return;
        const checks = container.querySelectorAll('input[type="checkbox"]:not(.option-all-input)');
        const defSet = new Set(defaultValues);
        checks.forEach(cb => {
            cb.checked = defSet.has(cb.value);
        });
        updateMultiSelectText(id);
    }

    function renderMultiSelect(id, options, placeholder, checkedValues = null, singleMode = false, defaultValues = null) {
        const container = document.getElementById(id);
        if (!container) return;
        container.dataset.placeholder = placeholder;
        container.dataset.singleMode = singleMode ? '1' : '0';

        // Determine if this is a first render or re-render
        const isFirstRender = !container.querySelector('.multi-select-trigger');

        // For re-renders, preserve only explicitly-unchecked options
        const explicitlyUnchecked = isFirstRender ? new Set() :
            new Set(Array.from(container.querySelectorAll('input[type="checkbox"]:not(.option-all-input):not(:checked)')).map(i => i.value));

        // Check if options actually changed (to avoid pointless re-renders while dropdown is open)
        const optionsJson = JSON.stringify(options);
        const optionsChanged = container.dataset.renderedOptions !== optionsJson;
        container.dataset.renderedOptions = optionsJson;

        // If dropdown is currently open and options haven't changed, just refresh text and return
        if (!isFirstRender && !optionsChanged && !checkedValues && container.classList.contains('active')) {
            updateMultiSelectText(id);
            return;
        }

        const allInputChecked = !isFirstRender ?
            Array.from(container.querySelectorAll('input[type="checkbox"]:not(.option-all-input)')).every(cb => cb.checked) : true;

        // Single-select mode: render radios instead of checkboxes
        if (singleMode) {
            // Determine selected value
            let selectedValue = null;
            if (checkedValues && checkedValues.length) selectedValue = checkedValues[0];
            else if (!isFirstRender) {
                const existing = container.querySelector('input[type="radio"]:checked');
                if (existing) selectedValue = existing.value;
            } else {
                selectedValue = options.length > 0 ? (typeof options[0] === 'object' ? options[0].value : options[0]) : null;
            }

            let html = `
                <button type="button" class="multi-select-trigger" onclick="toggleMultiSelect('${id}')">
                    <span class="trigger-text">${placeholder}</span>
                    <span class="trigger-icon material-icons">expand_more</span>
                </button>
                <div class="multi-select-options">
                    ${options.map(opt => {
                const val = typeof opt === 'object' ? opt.value : opt;
                const label = typeof opt === 'object' ? opt.label : opt;
                const shouldCheck = selectedValue !== null ? selectedValue === val : false;
                return `<label><input type="radio" name="${id}-single" value="${val}" ${shouldCheck ? 'checked' : ''} onchange="handleMultiSelectChange('${id}')"> ${label}</label>`;
            }).join('')}
                </div>
            `;

            container.innerHTML = html;
            container.classList.add('multi-select-container');
            updateMultiSelectText(id);
            return;
        }

        // Default multi-checkbox rendering
        let html = `
            <button type="button" class="multi-select-trigger" onclick="toggleMultiSelect('${id}')">
                <span class="trigger-text">${placeholder}</span>
                <span class="trigger-icon material-icons">expand_more</span>
            </button>
            <div class="multi-select-options">
                <div class="option-all" style="display:flex; justify-content:space-between; align-items:center; padding: 6px 10px; background:var(--bg-secondary); border-bottom:1px solid var(--border-light); gap: 10px;">
                    <label style="display:flex; align-items:center; gap:6px; margin:0; cursor:pointer; flex: 1;">
                        <input type="checkbox" class="option-all-input" onchange="handleMultiSelectAll('${id}', this)"> <span style="font-weight:700;">Select All</span>
                    </label>
                    <div style="display:flex; gap:12px; align-items:center;">
                        ${defaultValues ? `<span onclick="restoreDefaultsMultiSelect('${id}', ${JSON.stringify(defaultValues).replace(/"/g, '&quot;')})" style="font-size:0.65rem; color:var(--primary); cursor:pointer; font-weight:600; text-decoration:underline;">Select Defaults</span>` : ''}
                        <span onclick="clearMultiSelect('${id}')" style="font-size:0.65rem; color:var(--primary); cursor:pointer; font-weight:600; text-decoration:underline;">Deselect All</span>
                    </div>
                </div>
                ${options.map(opt => {
            const val = typeof opt === 'object' ? opt.value : opt;
            const label = typeof opt === 'object' ? opt.label : opt;
            let shouldCheck;
            if (checkedValues !== null) {
                shouldCheck = checkedValues.includes(val);
            } else if (isFirstRender) {
                shouldCheck = true; // First render: all selected by default
            } else {
                // Re-render: check unless user explicitly unchecked it
                shouldCheck = !explicitlyUnchecked.has(val);
            }
            return `<label><input type="checkbox" value="${val}" ${shouldCheck ? 'checked' : ''} onchange="handleMultiSelectChange('${id}')"> ${label}</label>`;
        }).join('')}
            </div>
        `;
        container.innerHTML = html;
        container.classList.add('multi-select-container');
        updateMultiSelectText(id);
    }


    function getMultiSelectValues(id) {
        const container = document.getElementById(id);
        if (!container) return [];
        const checkboxes = Array.from(container.querySelectorAll('input[type="checkbox"]:not(.option-all-input):checked'));
        if (checkboxes.length > 0) return checkboxes.map(cb => cb.value);
        const radios = Array.from(container.querySelectorAll('input[type="radio"]:checked'));
        if (radios.length > 0) return radios.map(r => r.value);
        return [];
    }

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.multi-select-container')) {
            document.querySelectorAll('.multi-select-container.active').forEach(c => c.classList.remove('active'));
        }
    });

    // Helper to convert to Proper Case (Title Case)
    function toProperCase(str) {
        if (!str || typeof str !== 'string') return str;
        return String(str)
            .toLowerCase()
            .replace(/\b([a-z])(\w*)/g, (m, p1, p2) => p1.toUpperCase() + p2);
    }

    // [FIX] Helper to determine Admission Type safely
    function getAdmType(app) {
        if (!app) return '';
        const s = String(app['Type of Admission'] || app['type_of_admission'] || '');
        if (s.toLowerCase().includes('provisional')) return 'Provisional';
        if (s.toLowerCase().includes('full')) return 'Full';
        return '';
    }


    /** Vocational / add-on subjects shown after core (5th/6th etc.) */
    const APPS_SUBJECT_ELECTIVE_LAST = new Set(['ITE', 'HTC', 'PD', 'ES', 'RET', 'TOU', 'SEC', 'AGR', 'TLC', 'MDE', 'BTW', 'PES', 'FS', 'MR', 'FH', 'TS', 'BM', 'TT', 'EE', 'HD', 'AM', 'EP', 'PA', 'BC', 'ET', 'BT', 'MU', 'CT', 'GO', 'BU', 'IS', 'VS', 'IP', 'CS', 'AY', 'BS']);

    /** EN / GE first, then other languages, then core, then electives */
    const APPS_SUBJECT_LANG_ORDER = ['EN', 'GE', 'EL', 'FE', 'HI', 'UR', 'DG', 'SA', 'PU', 'BO', 'AR', 'PE', 'KA'];

    function orderSubjectCodes(codes) {
        const seen = new Set();
        const uniq = [];
        for (let i = 0; i < codes.length; i++) {
            const u = String(codes[i] || '').trim().toUpperCase();
            if (!u || seen.has(u)) continue;
            seen.add(u);
            uniq.push(u);
        }
        const rankCode = (c) => {
            const li = APPS_SUBJECT_LANG_ORDER.indexOf(c);
            if (li !== -1) return [0, li, c];
            if (APPS_SUBJECT_ELECTIVE_LAST.has(c)) return [2, 0, c];
            return [1, 0, c];
        };
        return uniq.sort((a, b) => {
            const ra = rankCode(a), rb = rankCode(b);
            if (ra[0] !== rb[0]) return ra[0] - rb[0];
            if (ra[0] === 0 && ra[1] !== rb[1]) return ra[1] - rb[1];
            return String(ra[2]).localeCompare(String(rb[2]));
        });
    }

    function abbreviateOneSubjectName(subj) {
        if (!subj || !String(subj).trim()) return '';
        const map = {
            'general english': 'GE', 'english literature': 'EL', 'functional english': 'FE', 'english': 'EN',
            'hindi': 'HI', 'dogri': 'DG', 'sanskrit': 'SA', 'punjabi': 'PU', 'bhoti': 'BO',
            'arabic': 'AR', 'persian': 'PE', 'kashmiri': 'KA', 'urdu': 'UR',
            'history': 'HT', 'economics': 'EC', 'geography': 'GG', 'philosophy': 'PL',
            'education': 'ED', 'psychology': 'PY', 'sociology': 'SO', 'political science': 'PS',
            'home science': 'HS', 'home science (elective)': 'HS', 'statistics': 'ST',
            'mathematics': 'MA', 'maths': 'MA', 'math': 'MA',
            'islamic studies': 'IS', 'vedic studies': 'VS',
            'computer science': 'CS', 'information practices': 'IP', 'environmental science': 'ES',
            'physics': 'PH', 'chemistry': 'CH', 'biology': 'BI', 'botany': 'BI', 'zoology': 'BI',
            'electronics': 'ET', 'biotechnology': 'BT', 'bio-chemistry': 'BC', 'music': 'MU',
            'family health care & prevention': 'FH', 'food science': 'FS', 'management of resources': 'MR',
            'business studies': 'BS', 'travel, tourism & hotel management': 'TT',
            'accountancy': 'AY', 'entrepreneurship': 'EP', 'public administration': 'PA',
            'typewriting and shorthand': 'TS', 'business mathematics': 'BM', 'geology': 'GO',
            'buddhist studies': 'BU', 'physical education': 'PD', 'p.ed': 'PD', 'clothing for the family': 'CT',
            'applied mathematics': 'AM', 'microbiology': 'MB', 'extension education': 'EE', 'human development': 'HD',
            'science': 'GS', 'gen science': 'GS', 'gen. science': 'GS', 'general science': 'GS',
            'social studies': 'SST', 'social science': 'SST', 'sst': 'SST',
            'it and ites': 'ITE', 'retail': 'RET', 'healthcare': 'HTC',
            'tourism': 'TOU', 'security': 'SEC', 'agriculture': 'AGR', 'telecommunication': 'TLC',
            'media and entertainment': 'MDE', 'beauty and wellness': 'BTW', 'physical education & sports': 'PES'
        };
        const s = String(subj).toLowerCase().trim();
        if (map[s]) return map[s];
        if (s.includes('social stud') || s.includes('social scien')) return 'SST';
        if (s === 'sst') return 'SST';
        if (/\bgeneral\s+science\b/.test(s) || /^gen\.?\s*science$/.test(s)) return 'GS';
        return (subj.length > 5 ? subj.substring(0, 3) : subj).toUpperCase();
    }

    function abbreviateSubject(subj) {
        if (!subj) return '';
        const raw = String(subj);
        const separators = /[,;\n|\/]+/;
        if (separators.test(raw)) {
            const tokens = raw.split(separators).map(ss => abbreviateOneSubjectName(ss.trim())).filter(Boolean);
            return orderSubjectCodes(tokens).join(',');
        }
        return abbreviateOneSubjectName(raw.trim());
    }

    function buildSubsRawForAppsTable(app, appClass) {
        const ac = String(appClass || '').trim();
        if (ac === '11th') {
            return String(app['Subjects to be taken in Class 11th'] || '').trim();
        }
        if (ac === '12th') {
            const s11 = String(app['Subjects Studied in Class 11th'] || '').trim();
            const s12 = String(app['Stream & Subjects for Class 12th'] || '').trim();
            const s12Use = s12 && !/^same\s+as/i.test(s12) ? s12 : '';
            return [s11, s12Use].filter(Boolean).join(',');
        }
        if (ac.includes('9')) {
            return [
                app['Subjects to be taken in Class 9th'],
                app['Subjects Studied in Class 9th'],
                app['Vocational Subject (Class 9th)'],
                app['Elective Subject (Class 9th)']
            ].filter(Boolean).join(',');
        }
        if (ac.includes('10')) {
            return [
                app['Subjects to be taken in Class 10th'],
                app['Subjects Studied in Class 10th'],
                app['Vocational Subject (Class 10th)'],
                app['Elective Subject (Class 10th)']
            ].filter(Boolean).join(',');
        }
        return '';
    }

    function enrichSubsRawIfSparse(app, appClass, subsRaw) {
        let merged = String(subsRaw || '').trim();
        let ab = abbreviateSubject(merged);
        if (ab && ab !== 'SS' && ab !== 'SST' && !/^SS,/.test(ab) && !/^SST,/.test(ab)) return merged;

        const ac = String(appClass || '');
        if (ac === '11th') {
            const s10 = String(app['Subjects Studied in Class 10th'] || '').trim();
            if (s10 && s10.includes(',')) merged = merged ? merged + ',' + s10 : s10;
        }
        ab = abbreviateSubject(merged);
        if (ab && ab !== 'SS' && ab !== 'SST' && !/^SS,/.test(ab) && !/^SST,/.test(ab)) return merged;

        for (const k of Object.keys(app)) {
            if (!/subject/i.test(k) || /reappear/i.test(k)) continue;
            if (k === 'Subjects to be taken in Class 11th' || k === 'Subjects Studied in Class 11th' || k === 'Stream & Subjects for Class 12th') continue;
            const v = app[k];
            if (typeof v !== 'string' || v.length < 8 || !v.includes(',')) continue;
            merged = merged ? merged + ',' + v.trim() : v.trim();
            ab = abbreviateSubject(merged);
            if (ab && ab !== 'SS' && ab !== 'SST' && !/^SS,/.test(ab) && !/^SST,/.test(ab)) break;
        }
        return merged;
    }

    /** Apps table: show Science / General / Humanities from subject list (11th/12th/9th/10th). */
    function hasPhysicsAndChemistryInSubjects(subsRaw, abbreviatedSubs) {
        const blob = String(subsRaw || '').toLowerCase();
        if (/\bphysics\b/.test(blob) && /\bchemistry\b/.test(blob)) return true;
        const tokens = String(abbreviatedSubs || '').split(/[\s,]+/).map(t => t.trim().toUpperCase()).filter(Boolean);
        return tokens.includes('PH') && tokens.includes('CH');
    }

    function hasSocialStudiesInSubjects(subsRaw) {
        const blob = String(subsRaw || '').toLowerCase();
        if (/\bsocial\s+stud/.test(blob) || /\bsocial\s+science/.test(blob) || /\bsocial\s+studies\b/.test(blob) || /\bsst\b/.test(blob)) return true;
        const codes = abbreviateSubject(subsRaw).split(',').map(c => c.trim().toUpperCase());
        return codes.includes('SST') || codes.includes('SS');
    }

    function streamCategoryFromSubjects(subsRaw) {
        const raw = String(subsRaw || '').trim().toLowerCase();
        if (!raw) return 'Humanities';

        // Direct stream keywords
        if (raw.includes('science') || raw.includes('medical') || raw.includes('non-medical')) return 'Science';
        if (raw.includes('arts') || raw.includes('humanities')) return 'Humanities';
        if (raw.includes('commerce')) return 'Commerce';

        const abbrev = abbreviateSubject(subsRaw);
        if (hasPhysicsAndChemistryInSubjects(subsRaw, abbrev)) return 'Science';
        if (hasSocialStudiesInSubjects(subsRaw)) return 'General';
        return 'Humanities';
    }

    function streamCategoryLabel(appClass, subsRaw, streamRaw) {
        const cls = String(appClass || '').trim();
        const lowCls = cls.toLowerCase();

        // 1. Rule for 9th and 10th (General)
        if (lowCls.includes('9th') || lowCls.includes('10th') || lowCls.includes('8th')) {
            return 'General';
        }

        // 2. Rule for 11th and 12th (Based on Physics & Chemistry)
        if (lowCls.includes('11th') || lowCls.includes('12th')) {
            const abbrev = abbreviateSubject(subsRaw);
            if (hasPhysicsAndChemistryInSubjects(subsRaw, abbrev)) return 'Science';
            return 'Humanities';
        }

        // Fallback for other roles/classes or unknown
        const sr = String(streamRaw || '').trim().toLowerCase();
        if (sr.includes('science') || sr.includes('medical') || sr.includes('non-medical')) return 'Science';
        if (sr.includes('arts') || sr.includes('humanities')) return 'Humanities';
        if (sr.includes('commerce')) return 'Commerce';

        return streamCategoryFromSubjects(subsRaw);
    }

    // Helper to convert to Lower Case
    function toLowerCase(str) {
        if (!str || typeof str !== 'string') return str;
        return str.toLowerCase();
    }
    // [NEW] Weighted relevance score for "Google-like" search ranking
    function calculateRelevanceScore(item, query) {
        if (!query) return { score: 0, percentage: 0 };
        const q = query.toLowerCase().trim();
        if (!q) return { score: 0, percentage: 0 };

        let score = 0;
        const fields = {
            name: String(item["Student's Name (as per school records)"] || item["Account Name"] || '').toLowerCase(),
            email: String(item["Email Address"] || '').toLowerCase(),
            form: String(item["Form Number"] || '').toLowerCase(),
            mobile: String(item["Mobile No. (with working WhatsApp)"] || item["Account Mobile"] || '').toLowerCase(),
            village: String(item["Name of your village"] || item["Residence"] || '').toLowerCase(),
            roll: String(item["Class Roll No"] || '').toLowerCase(),
            parent: String(item["Parent's Mobile No. (must be working)"] || '').toLowerCase()
        };

        // 1. Exact Unique Identifiers (Maximum points)
        if (fields.form === q) score += 10000;
        if (fields.roll === q && q.length > 0) score += 9000;
        if (fields.email === q) score += 8000;
        if (fields.mobile === q) score += 7000;

        // 2. Name matching (High priority)
        if (fields.name === q) score += 6000;
        if (fields.name.startsWith(q)) score += 3000;

        // Word level matching for name
        const qWords = q.split(/\s+/).filter(w => w.length > 1);
        if (qWords.length > 0) {
            let matchedInName = 0;
            qWords.forEach(w => { if (fields.name.includes(w)) matchedInName++; });
            score += (matchedInName / qWords.length) * 2000;
            if (matchedInName === qWords.length && qWords.length > 1) score += 1000; // All words match bonus
        }

        // 3. General "Includes" matches (Medium/Low priority)
        if (fields.name.includes(q)) score += 1000;
        if (fields.email.includes(q)) score += 800;
        if (fields.village.includes(q)) score += 600;
        if (fields.form.includes(q)) score += 500;
        if (fields.mobile.includes(q)) score += 400;
        if (fields.parent.includes(q)) score += 300;

        // Calculate a percentage cap at 100%
        // We define 10000+ as "perfect / 100%", 1000 as "roughly 20%"
        let percentage = 0;
        if (score >= 10000) percentage = 100;
        else if (score > 0) percentage = Math.max(5, Math.min(99, Math.round((score / 5000) * 100)));

        return { score, percentage };
    }

    // [NEW] Interactive Stats Filter
    function filterByStat(category, value) {
        const classFilter = document.getElementById('filterClass');
        if (!classFilter) return;

        if (category === 'all') {
            classFilter.value = '';
        } else if (category === 'class') {
            classFilter.value = value;
        }

        // Reset pagination and re-render
        state.adminData.page = 1;
        renderAdminDashboard();

        // Optional: Scroll to table
        const table = document.getElementById('adminApplications');
        if (table) table.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    function getDeviceId() {
        try {
            let id = localStorage.getItem('hss_device_id');
            if (!id) {
                if (window.crypto && crypto.randomUUID) {
                    id = crypto.randomUUID();
                } else {
                    id = 'dev-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
                }
                localStorage.setItem('hss_device_id', id);
            }
            return id;
        } catch (e) {
            return 'dev-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
        }
    }

    const ADMIN_TABLE_COLUMNS = {
        'SNo': { label: 'S.No.', "class": 'col-sno', fixed: true },
        'Checkbox': { label: '', "class": '', fixed: true },
        'Form Number': { label: 'Form No.', "class": 'col-form', fixed: true },
        'Class Roll No': { label: 'Roll No', "class": 'col-roll no-wrap', fixed: true },
        'Student Photo': { label: 'Photo', "class": 'col-photo', fixed: true },
        "Student's Name (as per school records)": { label: 'Name', "class": 'col-name', fixed: true },
        'Email Address': { label: 'Email', "class": 'col-email' },
        'Email Address (Gmail Preferred - for updates)': { label: 'Email', "class": 'col-email' },
        'Account Mobile': { label: 'Profile M', "class": 'col-profilem' },
        'Mobile No. (with working WhatsApp)': { label: 'Mobile', "class": 'col-mobile' },
        "Parent's Mobile No. (must be working)": { label: 'Parent M', "class": 'col-parentm' },
        'Residence': { label: 'Residence', "class": 'col-residence' },
        'Admission sought for class': { label: 'Class', "class": 'col-class' },
        'Session': { label: 'Session', "class": 'col-session' },
        'Stream': { label: 'Stream', "class": 'col-stream' },
        'Subjects': { label: 'Subs', "class": 'col-subs' },
        'Status': { label: 'Status', "class": 'col-status', fixed: true },
        'Actions': { label: 'Actions', "class": 'actions col-actions', fixed: true }
    };

    const ADMIN_DEFAULT_COLUMNS = [
        'Email Address',
        'Mobile No. (with working WhatsApp)',
        "Parent's Mobile No. (must be working)",
        'Residence',
        'Admission sought for class',
        'Stream',
        'Subjects'
    ];

    // [NEW] Helper function for administrative checks
    function isAnyAdmin() {
        const role = state.currentUser?.role;
        return role === 'Admin' || role === 'SuperAdmin' || role === 'President';
    }


    const state = {
        currentUser: null,
        currentView: 'auth',
        applications: [], // [MODIFIED] Now an array
        adminData: { applications: [], filteredApplications: [], settings: {}, subjectsConfig: {}, allHeaders: [] },
        visibleColumns: (() => {
            try {
                const stored = localStorage.getItem('adminVisibleColumns');
                return stored ? (JSON.parse(stored) || [...ADMIN_DEFAULT_COLUMNS]) : [...ADMIN_DEFAULT_COLUMNS];
            } catch (e) {
                return [...ADMIN_DEFAULT_COLUMNS];
            }
        })(),
        adminActivity: [],
        adminActivityFiltered: [],
        activityOffset: 0,
        activityLimit: 100,
        activityHasMore: true,
        activityLoading: false,
        whitelistBound: false,
        isEditing: false,
        editingFormData: null,
        formStructure: [],
        subjectsConfig: {},
        photoFileData: null,
        oldPhotoUrl: null,
        deletePhoto: false,
        selectedClassForNewApp: null,
        profile: {},
        subjectError: false,
        editingSubjects: null,
        isUpgradeFlow: false,
        isProcessingSave: false
    };
    const dom = {
        container: document.querySelector('.container'),
        loader: document.getElementById('loader'),
        loaderActionBtn: document.getElementById('loaderActionBtn'),
        themeToggle: document.getElementById('themeToggleBtn'),
        // Modals
        confirmModal: document.getElementById('confirmModal'),
        inputModal: document.getElementById('inputModal'),
        profileModal: document.getElementById('profileModal'),
        subjectEditModal: document.getElementById('subjectEditModal'),
        instructionsModal: document.getElementById('instructionsModal'), // [NEW]
        // Modal Controls
        confirmMessage: document.getElementById('confirmMessage'),
        confirmCancel: document.getElementById('confirmCancel'),
        confirmOk: document.getElementById('confirmOk'),
        inputModalTitle: document.getElementById('inputModalTitle'),
        inputModalMessage: document.getElementById('inputModalMessage'),
        inputModalGroup: document.getElementById('inputModalGroup'),
        inputModalLabel: document.getElementById('inputModalLabel'),
        inputModalInput: document.getElementById('inputModalInput'),
        inputModalTextarea: document.getElementById('inputModalTextarea'),
        inputPresetContainer: document.getElementById('inputPresetContainer'),
        inputCancel: document.getElementById('inputCancel'),
        inputOk: document.getElementById('inputOk'),
        profileName: document.getElementById('profileName'),
        profileMobile: document.getElementById('profileMobile'),
        profileResidence: document.getElementById('profileResidence'),
        profileCancel: document.getElementById('profileCancel'),
        profileSave: document.getElementById('profileSave'),
        subjectEditTitle: document.getElementById('subjectEditTitle'),
        subjectEditList: document.getElementById('subjectEditList'),
        subjectEditInput: document.getElementById('subjectEditInput'),
        subjectEditAddBtn: document.getElementById('subjectEditAddBtn'),
        subjectEditCloseBtn: document.getElementById('subjectEditCloseBtn'),
        instructionsAgreeBtn: document.getElementById('instructionsAgreeBtn'), // [NEW]
        // Photo Preview
        photoPreviewOverlay: document.getElementById('photoPreviewOverlay'),
        photoPreviewPopup: document.getElementById('photoPreviewPopup'),
        photoPreviewImage: document.getElementById('photoPreviewImage'),
        schoolLogo: document.getElementById('schoolLogo'),
        studentLogo: document.getElementById('studentLogo'),
        adminLogo: document.getElementById('adminLogo'),
        adminLogoMobile: document.getElementById('adminLogoMobile'),
        logoSpinnerContainer: document.getElementById('logoSpinnerContainer'),
        adminAppVersionBadge: document.getElementById('adminAppVersionBadge'),
        adminAppVersionBadgeMobile: document.getElementById('adminAppVersionBadgeMobile'),
        // Views
        views: {
            auth: document.getElementById('authView'),
            studentDashboard: document.getElementById('studentDashboardView'),
            teacherDashboard: document.getElementById('teacherDashboardView'),
            adminDashboard: document.getElementById('adminDashboardView'),
            formEditor: document.getElementById('formEditorView'),
            attendance: document.getElementById('attendanceView'),
            practicals: document.getElementById('practicalsView')
        },
        // Auth
        loginForm: document.getElementById('loginForm'),
        loginEmail: document.getElementById('loginEmail'),
        loginPassword: document.getElementById('loginPassword'),
        loginBtn: document.getElementById('loginBtn'),
        registerForm: document.getElementById('registerForm'),
        forgotPasswordForm: document.getElementById('forgotPasswordForm'), // [NEW]
        authAlert: document.getElementById('auth-alert'),
        registerEmail: document.getElementById('registerEmail'),
        emailCheckHint: document.getElementById('emailCheckHint'),
        sendOtpBtn: document.getElementById('sendOtpBtn'),
        registerStep1: document.getElementById('registerStep1'),
        registerStep2: document.getElementById('registerStep2'),
        registerPassword: document.getElementById('registerPassword'),
        confirmPassword: document.getElementById('confirmPassword'),
        passwordMatchHint: document.getElementById('passwordMatchHint'),
        registerBtn: document.getElementById('registerBtn'),
        // [NEW] Forgot Password Elements
        forgotStep1: document.getElementById('forgotStep1'),
        forgotStep2: document.getElementById('forgotStep2'),
        sendResetOtpBtn: document.getElementById('sendResetOtpBtn'),
        resetOtpEmailDisplay: document.getElementById('resetOtpEmailDisplay'),
        resetPasswordMatchHint: document.getElementById('resetPasswordMatchHint'),
        resetPasswordBtn: document.getElementById('resetPasswordBtn'),
        // Student
        studentWelcome: document.getElementById('studentWelcome'),
        studentAppStatus: document.getElementById('studentAppStatus'),
        studentProfile: document.getElementById('studentProfile'),
        editProfileBtn: document.getElementById('editProfileBtn'),
        // Admin
        adminAlert: document.getElementById('admin-alert'),
        adminStats: document.getElementById('adminStats') || document.getElementById('adminStatsInline'),
        adminWelcome: document.getElementById('adminWelcome'),
        adminEmail: document.getElementById('adminEmail'),
        adminToggles: document.getElementById('admissionToggles'),
        emailToggles: document.getElementById('emailToggles'),
        otpsTableBody: document.getElementById('otpsTableBody'),
        adminProgressBar: document.getElementById('adminProgressBar'),
        subjectsConfigContainer: document.getElementById('subjectsConfigContainer'),
        adminTableBody: document.getElementById('adminTableBody'),
        searchInput: document.getElementById('searchInput'),
        activitySearchInput: document.getElementById('activitySearchInput'),
        adminActivityBody: document.getElementById('adminActivityBody'),
        globalProgressWrapper: document.getElementById('globalProgressWrapper'),
        globalProgressMsg: document.getElementById('globalProgressMsg'),
        globalProgressPercent: document.getElementById('globalProgressPercent'),
        globalProgressTimeRemaining: document.getElementById('globalProgressTimeRemaining'),
        globalProgressBarFill: document.getElementById('globalProgressBarFill'),
        globalProgressSubDetails: document.getElementById('globalProgressSubDetails'),
        globalProgressResultArea: document.getElementById('globalProgressResultArea'),
        globalProgressResultBtn: document.getElementById('globalProgressResultBtn'),
        globalProgressResultText: document.getElementById('globalProgressResultText'),
        // Whitelist
        mobileWhitelistBody: document.getElementById('mobileWhitelistBody'),
        whitelistEmail: document.getElementById('whitelistEmail'),
        whitelistMobile: document.getElementById('whitelistMobile'),
        whitelistReason: document.getElementById('whitelistReason'),
        addWhitelistBtn: document.getElementById('addWhitelistBtn'),
        // Form
        formEditorTitle: document.getElementById('formEditorTitle'),
        formFieldsContainer: document.getElementById('formFieldsContainer'),
        formAlert: document.getElementById('form-alert'),
        // Registration
        registerName: document.getElementById('registerName'),
        registerMobile: document.getElementById('registerMobile'),
        registerOtp: document.getElementById('registerOtp'),
        saveDraftBtn: document.getElementById('saveDraftBtn'),
        finalSubmitBtn: document.getElementById('finalSubmitBtn')
    };



    let rollNoStudents = [];

    function initRollNoTool() {
        const loadBtn = document.getElementById('toolsLoadStudentsBtn');
        const genBtn = document.getElementById('toolsGenerateRollNosBtn');
        const saveBtn = document.getElementById('toolsSaveRollNosBtn');
        const resetBtn = document.getElementById('toolsResetRollNosBtn');
        const filterClass = document.getElementById('rollNoFilterClass');
        const sortBySelect = document.getElementById('rollNoSortBy');

        console.log('Initializing Roll No Tool - elements found:', {
            loadBtn: !!loadBtn,
            genBtn: !!genBtn,
            saveBtn: !!saveBtn,
            resetBtn: !!resetBtn,
            filterClass: !!filterClass,
            sortBySelect: !!sortBySelect
        });

        if (loadBtn) {
            loadBtn.onclick = loadRollNoStudents;
            console.log('Load button event attached');
        }
        if (state.adminData.applications) {
            renderMultiSelect('rollNoFilterClass', ['9th', '10th', '11th', '12th', { value: 'not_assigned', label: '[Unassigned Only]' }], 'Classes');
        }
        if (genBtn) {
            genBtn.onclick = generateRollNos;
        }
        if (resetBtn) {
            resetBtn.onclick = () => {
                const cls = document.getElementById('rollNoFilterClass').value;
                const formNoInput = document.getElementById('rollNoFormNumbers').value;
                const session = (state.adminData?.settings?.session) || '2025-26';

                let formNumbers = [];
                if (formNoInput && formNoInput.trim()) {
                    formNumbers = formNoInput.split(',').map(s => s.trim()).filter(s => s);
                }

                if (!cls && (!formNumbers || formNumbers.length === 0)) {
                    showAlert('admin-alert', 'Please select a class OR enter specific Form Numbers to reset roll numbers.', 'warning');
                    return;
                }

                let msg = cls === 'not_assigned' ? 'ALL students with UNASSIGNED roll numbers' : (cls ? `ALL roll numbers for ${cls} (${session})` : `roll numbers for ${formNumbers.length} specified forms`);

                showConfirm(`Are you sure you want to PERMANENTLY RESET/DELETE ${msg}? This cannot be undone.`).then(async () => {
                    resetBtn.disabled = true;
                    resetBtn.innerHTML = '<span class="material-icons rotating" style="font-size:0.8rem; vertical-align:middle; margin-right:0.2rem;">sync</span>Resetting...';
                    try {
                        const res = await runServerFunction('resetRollNumbers', {
                            class: cls === 'not_assigned' ? '' : cls, // If not_assigned, server resets all? Wait...
                            session: session,
                            formNumbers: formNumbers,
                            onlyUnassigned: cls === 'not_assigned'
                        }, state.currentUser);

                        if (res.success) {
                            showAlert('admin-alert', `Successfully reset ${res.count} roll numbers.`, 'success');
                            setTimeout(loadRollNoStudents, 500);
                        } else {
                            throw new Error(res.message);
                        }
                    } catch (e) {
                        showAlert('admin-alert', 'Failed to reset: ' + e.message, 'danger');
                    } finally {
                        resetBtn.disabled = false;
                        resetBtn.innerHTML = '<span class="material-icons" style="font-size:0.8rem; vertical-align:middle; margin-right:0.2rem;">delete_sweep</span>Reset All';
                    }
                }).catch(() => {
                    console.log('Reset cancelled');
                });
            };
        }
        if (filterClass) {
            const apps = state.adminData.applications || [];
            renderMultiSelect('rollNoFilterClass', [
                { value: '9th', label: '9th' },
                { value: '10th', label: '10th' },
                { value: '11th', label: '11th' },
                { value: '12th', label: '12th' },
                { value: 'not_assigned', label: 'Not Assigned Only' }
            ], 'Classes');
        }
        if (filterClass && !filterClass.dataset.bound) {
            filterClass.addEventListener('change', function () {
                console.log('Filter changed to:', this.value);
                renderRollNoTable();
            });
            filterClass.disabled = false;
            filterClass.style.pointerEvents = 'auto';
            filterClass.dataset.bound = 'true';
            console.log('Filter By Class event attached');
        }
        if (sortBySelect && !sortBySelect.dataset.bound) {
            sortBySelect.addEventListener('change', function () {
                console.log('Sort changed to:', this.value);
                // Re-sort the students and re-render
                sortRollNoStudents();
                renderRollNoTable();
            });
            sortBySelect.disabled = false;
            sortBySelect.style.pointerEvents = 'auto';
            sortBySelect.dataset.bound = 'true';
            console.log('Sort By event attached');
        }

        if (loadBtn) {
            loadBtn.onclick = loadRollNoStudents;
            console.log('Load button event attached');
        }
        if (genBtn) {
            genBtn.onclick = generateRollNos;
            console.log('Generate button event attached');
        }
        if (saveBtn) {
            // Remove all existing listeners
            saveBtn.replaceWith(saveBtn.cloneNode(true));
            const newSaveBtn = document.getElementById('toolsSaveRollNosBtn');

            newSaveBtn.addEventListener('click', function (e) {
                console.log('CLICK: Save button clicked!', e);
                e.preventDefault();
                e.stopPropagation();
                saveRollNos();
            });

            newSaveBtn.disabled = false;
            newSaveBtn.style.pointerEvents = 'auto';
            newSaveBtn.style.opacity = '1';
            newSaveBtn.style.cursor = 'pointer';
            newSaveBtn.style.display = 'inline-flex';
            newSaveBtn.style.visibility = 'visible';
        }

        // [NEW] Real-time fetch for form numbers with debounce
        const formNoInput = document.getElementById('rollNoFormNumbers');
        if (formNoInput) {
            let debounceTimer;
            formNoInput.addEventListener('input', () => {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    loadRollNoStudents();
                }, 800);
            });
        }
    }

    async function loadRollNoStudents() {
        const btn = document.getElementById('toolsLoadStudentsBtn');
        if (btn) { btn.disabled = true; btn.textContent = 'Loading...'; }

        try {
            // Get class filter
            const classFilter = getMultiSelectValues('rollNoFilterClass');

            // Get form numbers filter
            const formNoInput = document.getElementById('rollNoFormNumbers').value;
            let formNumbers = null;
            if (formNoInput && formNoInput.trim()) {
                formNumbers = formNoInput.split(',').map(s => s.trim()).filter(s => s);
            }

            // Get sort by parameter
            const sortBySelect = document.getElementById('rollNoSortBy');
            const sortBy = sortBySelect ? sortBySelect.value : 'class_name';

            const result = await runServerFunction('getStudentsForRollNoAssignment', formNumbers, sortBy, state.currentUser, classFilter);
            if (result.success) {
                rollNoStudents = result.students || [];

                // If filtered by form numbers, sort students in the exact order of the input list
                if (formNumbers && formNumbers.length > 0) {
                    const orderMap = new Map();
                    formNumbers.forEach((num, index) => {
                        orderMap.set(String(num), index);
                    });

                    rollNoStudents.sort((a, b) => {
                        const idxA = orderMap.has(String(a.formNo)) ? orderMap.get(String(a.formNo)) : 9999;
                        const idxB = orderMap.has(String(b.formNo)) ? orderMap.get(String(b.formNo)) : 9999;
                        return idxA - idxB;
                    });
                }

                document.getElementById('rollNoControls').style.display = 'flex';
                document.getElementById('rollNoTableContainer').style.display = 'block';
                const rollNoStats = document.getElementById('rollNoStats');
                if (rollNoStats) {
                    rollNoStats.style.display = 'block';
                }

                // Ensure Save button is enabled and clickable
                const saveBtn = document.getElementById('toolsSaveRollNosBtn');
                if (saveBtn) {
                    saveBtn.disabled = false;
                    saveBtn.style.pointerEvents = 'auto';
                    saveBtn.style.opacity = '1';
                    console.log('Save button enabled after loading students');
                }

                renderRollNoTable();

                let msg = `Loaded ${rollNoStudents.length} students`;
                if (formNumbers && formNumbers.length > 0) {
                    msg += ` (Ordered by input list)`;
                } else {
                    // Add sort info when not using form number filter
                    const sortLabels = {
                        'class_name': 'Class -> Name',
                        'class_roll': 'Class -> Roll No',
                        'roll_class': 'Roll No -> Class',
                        'form_asc': 'Form No: Asc'
                    };
                    msg += ` (Sorted: ${sortLabels[sortBy] || sortBy})`;
                }
                showAlert('admin-alert', msg, 'success');
            } else {
                throw new Error(result.message);
            }
        } catch (e) {
            showAlert('admin-alert', `Failed to load students: ${e.message}`, 'danger');
        } finally {
            if (btn) { btn.disabled = false; btn.innerHTML = '<span class="material-icons" style="font-size:1.2rem; vertical-align:middle; margin-right:6px;">people</span> Load Students'; }
        }
    }

    function renderRollNoTable() {
        const tbody = document.getElementById('rollNoTableBody');
        const filters = getMultiSelectValues('rollNoFilterClass');
        const stats = document.getElementById('rollNoStats');

        if (!tbody) return;

        // Store existing input values before re-rendering
        const existingValues = {};
        const existingInputs = tbody.querySelectorAll('.new-roll-no');
        existingInputs.forEach(input => {
            if (input.value) {
                existingValues[input.dataset.form] = input.value;
            }
        });

        tbody.innerHTML = '';

        let filtered = rollNoStudents;
        if (filters.length > 0) {
            filtered = rollNoStudents.filter(s => {
                return filters.some(f => {
                    if (f === 'not_assigned') return !s.rollNo || s.rollNo === '-';
                    return s['class'] === f;
                });
            });
        }

        if (filtered.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:1rem;">No students found</td></tr>';
            if (stats) stats.textContent = '';
            return;
        }

        if (stats) stats.textContent = `Showing ${filtered.length} students${filter ? ' in ' + filter : ''}`;

        tbody.innerHTML = filtered.map((s, idx) => `
         <tr data-form="${s.formNo}">
           <td>${idx + 1}</td>
           <td>${s.formNo}</td>
           <td>${s.name}</td>
           <td>${s.class}</td>
           <td>${s.rollNumber || s.rollNo || '-'}</td>
           <td>
            <input type="number" class="new-roll-no" data-form="${s.formNo}" data-class="${s.class}" placeholder="New Roll No" value="${existingValues[s.formNo] || ''}" style="width: 100px; padding: 4px; border: 1px solid var(--border); border-radius: 4px;">
          </td>
         </tr>
       `).join('');
    }

    function sortRollNoStudents() {
        const sortBy = document.getElementById('rollNoSortBy')?.value || 'class_name';
        const classOrder = { '9th': 1, '10th': 2, '11th': 3, '12th': 4 };
        const classRank = c => classOrder[c] ?? 99;

        rollNoStudents.sort((a, b) => {
            if (sortBy === 'class_name') {
                const classDiff = classRank(a['class']) - classRank(b['class']);
                return classDiff !== 0 ? classDiff : String(a.name).localeCompare(String(b.name));
            } else if (sortBy === 'class_roll') {
                const classDiff = classRank(a['class']) - classRank(b['class']);
                if (classDiff !== 0) return classDiff;
                return (parseInt(a.rollNo) || 0) - (parseInt(b.rollNo) || 0);
            } else if (sortBy === 'roll_class') {
                const rDiff = (parseInt(a.rollNo) || 0) - (parseInt(b.rollNo) || 0);
                return rDiff !== 0 ? rDiff : classRank(a['class']) - classRank(b['class']);
            } else if (sortBy === 'form_asc') {
                return (parseInt(a.formNo) || 0) - (parseInt(b.formNo) || 0);
            }
            return 0;
        });

        console.log('Sorted students by:', sortBy);
    }

    function generateRollNos() {
        const startVal = parseInt(document.getElementById('rollNoStart').value);
        if (isNaN(startVal)) {
            showAlert('admin-alert', 'Please enter a valid Start From number', 'warning');
            return;
        }

        const inputs = document.querySelectorAll('#rollNoTableBody .new-roll-no');
        let current = startVal;

        inputs.forEach(input => {
            input.value = current++;
        });

        showAlert('admin-alert', `Generated roll numbers from ${startVal} to ${current - 1}`, 'success');
    }

    async function saveRollNos() {
        console.log('saveRollNos function called');
        const inputs = document.querySelectorAll('#rollNoTableBody .new-roll-no');
        const updates = [];

        console.log('Found inputs:', inputs.length);

        inputs.forEach(input => {
            const val = input.value;
            if (val) {
                updates.push({
                    formNo: input.dataset.form,
                    "class": input.dataset['class'],
                    rollNo: val
                });
            }
        });

        console.log('Updates to save:', updates);

        if (updates.length === 0) {
            showAlert('admin-alert', 'No new roll numbers to save', 'warning');
            return;
        }

        showConfirm(`Are you sure you want to update ${updates.length} roll numbers?`).then(async () => {
            const btn = document.getElementById('toolsSaveRollNosBtn');
            if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }

            try {
                const result = await runServerFunction('bulkUpdateRollNos', updates, state.currentUser);
                if (result.success) {
                    showAlert('admin-alert', result.message, 'success');
                    // Update local data
                    updates.forEach(u => {
                        const s = rollNoStudents.find(rs => String(rs.formNo) === String(u.formNo));
                        if (s) s.rollNo = u.rollNo;

                        // Also update main admin data if present
                        const app = state.adminData.applications.find(a => String(a['Form Number']) === String(u.formNo));
                        if (app) app['Class Roll No'] = u.rollNo;
                    });
                    renderRollNoTable();
                } else {
                    throw new Error(result.message);
                }
            } catch (e) {
                showAlert('admin-alert', `Failed to save: ${e.message}`, 'danger');
            } finally {
                if (btn) { btn.disabled = false; btn.innerHTML = '<span class="material-icons">save</span> Save All'; }
            }
        })
            .catch(err => {
                console.log('Save cancelled or failed:', err);
            });
    }

    function initPushToAutomationTool() {
        const executeBtn = document.getElementById('executePushToAutomationBtn');
        if (executeBtn) {
            executeBtn.onclick = pushToAutomationPortal;
        }

        if (state.adminData.applications) {
            const sessions = [...new Set(state.adminData.applications.map(app => app.Session || app.session || '').filter(s => s))].sort().reverse();
            renderMultiSelect('pushAutomationSessionFilter', sessions, 'Sessions');
            renderMultiSelect('pushAutomationClassFilter', ['9th', '10th', '11th', '12th'], 'Classes');
        }
    }

    async function pushToAutomationPortal() {
        const classFilter = getMultiSelectValues('pushAutomationClassFilter');
        const sessionFilter = getMultiSelectValues('pushAutomationSessionFilter');

        if (classFilter.length === 0) {
            showAlert('admin-alert', 'Please select at least one class.', 'warning');
            return;
        }

        const confirmed = await showConfirm(`Are you sure you want to push records for ${classFilter.join(', ')}? This will sync Roll Nos, Reg Nos, and Names to the Automation Portal.`);
        if (!confirmed) return;

        const btn = document.getElementById('executePushToAutomationBtn');
        const progressWrapper = document.getElementById('pushAutomationProgressWrapper');
        const statusMsg = document.getElementById('pushAutomationStatusMsg');
        const pctText = document.getElementById('pushAutomationPercentText');
        const fill = document.getElementById('pushAutomationProgressBarFill');

        if (btn) {
            btn.disabled = true;
            btn.dataset.originalText = btn.innerHTML;
            btn.innerHTML = '<span class="material-icons spinner-small" style="font-size:0.95rem;">sync</span> Pushing...';
        }
        if (progressWrapper) progressWrapper.style.display = 'block';

        const taskId = 'push_auto_' + Date.now();
        const pollInterval = setInterval(async () => {
            const progress = await runServerFunction('getTaskProgress', taskId);
            if (progress) {
                if (statusMsg) statusMsg.textContent = progress.message;
                if (pctText) pctText.textContent = progress.percent + '%';
                if (fill) fill.style.width = progress.percent + '%';
            }
        }, 1500);

        try {
            const result = await runServerFunction('syncDataToAutomation', classFilter, sessionFilter, state.currentUser, taskId);
            clearInterval(pollInterval);
            if (result.success) {
                showAlert('admin-alert', result.message, 'success');
            } else {
                showAlert('admin-alert', result.message, 'danger');
            }
        } catch (e) {
            clearInterval(pollInterval);
            showAlert('admin-alert', 'Push failed: ' + e.message, 'danger');
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = btn.dataset.originalText;
            }
            if (progressWrapper) progressWrapper.style.display = 'none';
        }
    }

    function initPushToSourceTool() {
        const executePushBtn = document.getElementById('executePushToSourceBtn');
        const previewPushBtn = document.getElementById('previewPushToSourceBtn');
        if (executePushBtn) {
            executePushBtn.onclick = pushToSourceDB;
            console.log('Push to Source DB event attached');
        }
        if (previewPushBtn) {
            previewPushBtn.onclick = loadPushPreview;
            console.log('Preview Push to Source event attached');
        }

        if (state.adminData.applications) {
            const sessions = [...new Set(state.adminData.applications.map(app => app.Session || app.session || '').filter(s => s))].sort().reverse();
            renderMultiSelect('pushSessionFilter', sessions, 'Sessions');
            renderMultiSelect('pushClassFilter', ['9th', '10th', '11th', '12th'], 'Classes');
        }

        if (state.adminData.allHeaders) {
            const skipColumns = ['Form Number', 'Timestamp', 'Status', 'Email Address', 'Roll Number', 'isUnlocked', 'photo_id'];
            const protectable = state.adminData.allHeaders.filter(h => !skipColumns.includes(h) && !h.startsWith('isUnlocked') && h.trim());

            // Define default protected columns based on user request logic
            const defaultProtected = protectable.filter(h => {
                const lower = h.toLowerCase().trim();
                // 1. student/father/mother name
                if (lower.includes("student's name") || lower.includes("father's name") || lower.includes("guardian's name") || lower.includes("mother's name")) return true;
                // 2. date of birth / dob
                if (lower.includes('date of birth') || lower.includes('dob')) return true;
                // 3. subjects (Subject1-6)
                if (lower.includes('subject')) return true;
                // 4. gender
                if (lower === 'gender') return true;
                // 5. category
                if (lower.includes('cat.') || lower.includes('category')) return true;
                // 6. registration/reg no
                if (lower.includes('reg') || lower.includes('registration')) return true;
                // 7. stream
                if (lower.includes('stream')) return true;

                return false;
            });

            renderMultiSelect('pushProtectedColumns', protectable, 'Select to Protect...', defaultProtected, false, defaultProtected);
        }

        // Disable Push by default until previewed or reset
        if (executePushBtn) executePushBtn.disabled = true;
        const previewContainer = document.getElementById('pushPreviewContainer');
        if (previewContainer) previewContainer.style.display = 'none';

        // Reset when filters change
        ['pushClassFilter', 'pushSessionFilter'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('change', () => {
                    if (executePushBtn) executePushBtn.disabled = true;
                    if (previewContainer) previewContainer.style.display = 'none';
                });
            }
        });
    }

    async function loadPushPreview() {
        const classFilter = getMultiSelectValues('pushClassFilter');
        const sessionFilter = getMultiSelectValues('pushSessionFilter');
        const protectedColumns = getMultiSelectValues('pushProtectedColumns');
        const order = document.getElementById('pushOrderFilter')?.value || 'roll_number';
        const previewBtn = document.getElementById('previewPushToSourceBtn');
        const executeBtn = document.getElementById('executePushToSourceBtn');
        const tbody = document.getElementById('pushPreviewTableBody');
        const countSpan = document.getElementById('pushPreviewTargetCount');
        const container = document.getElementById('pushPreviewContainer');

        if (previewBtn) { 
            previewBtn.disabled = true; 
            previewBtn.innerHTML = '<div class="loader-inline" style="border-top-color:white; width:14px; height:14px; margin-right:8px;"></div> Loading...'; 
        }
        if (executeBtn) executeBtn.disabled = true;
        if (tbody) {
            tbody.innerHTML = Array(5).fill(0).map(() => `
                <tr>
                    <td colspan="8" style="padding:0.8rem; border-bottom:1px solid var(--border-light);">
                        <div class="skeleton skeleton-table-row" style="margin:0; height:30px; opacity:0.6;"></div>
                    </td>
                </tr>
            `).join('');
        }
        if (container) container.style.display = 'block';

        try {
            // isPreview = true, added order param, added protectedColumns
            const result = await runServerFunction('syncDataToSource', classFilter, sessionFilter, true, state.currentUser, order, null, protectedColumns);
            if (result.success && result.previewMode) {
                if (countSpan) {
                    const counts = [];
                    if (result.appended) counts.push(`${result.appended} New`);
                    if (result.updated) counts.push(`${result.updated} Updated`);
                    countSpan.innerHTML = counts.length > 0 ? counts.join(' + ') : 'No changes';
                }
                if (tbody) {
                    let htmlBuilder = '';

                    if (result.data && result.data.length > 0) {
                        htmlBuilder += result.data.map((r, idx) => {
                            const isUpdated = r.status === 'Updated';
                            const statusBadge = isUpdated
                                ? `<span class="badge badge-info" style="font-size:0.6rem; padding:0.1rem 0.3rem;">Updated</span>`
                                : `<span class="badge badge-success" style="font-size:0.6rem; padding:0.1rem 0.3rem;">New</span>`;

                            return `
                                <tr style="${isUpdated ? 'background-color: rgba(14, 165, 233, 0.03);' : ''}">
                                    <td style="padding:0.5rem; border-bottom:1px solid var(--border-light);">${idx + 1}</td>
                                    <td style="padding:0.5rem; border-bottom:1px solid var(--border-light);">${r.form}</td>
                                    <td style="padding:0.5rem; border-bottom:1px solid var(--border-light); font-weight:600; color:var(--primary);">${r.roll}</td>
                                    <td style="padding:0.5rem; border-bottom:1px solid var(--border-light);">${r.name}</td>
                                    <td style="padding:0.5rem; border-bottom:1px solid var(--border-light);">${r.cls}</td>
                                    <td style="padding:0.5rem; border-bottom:1px solid var(--border-light); font-weight:600; color:var(--text-secondary);">${r.session || '-'}</td>
                                    <td style="padding:0.5rem; border-bottom:1px solid var(--border-light);">${r.stream}</td>
                                    <td style="padding:0.5rem; border-bottom:1px solid var(--border-light);">
                                        <div style="display:flex; align-items:center; gap:4px;">
                                            ${statusBadge}
                                            ${r.warning ? `<span class="badge ${r.warning.includes('&') ? 'badge-danger' : 'badge-warning'}" style="font-size:0.6rem; padding:0.1rem 0.3rem;">${r.warning}</span>` : ''}
                                        </div>
                                    </td>
                                </tr>
                            `;
                        }).join('');

                        if (result.count > result.data.length) {
                            htmlBuilder += `<tr><td colspan="8" style="text-align:center; padding:0.5rem; color:var(--text-secondary); font-style:italic;">...and ${result.count - result.data.length} more records</td></tr>`;
                        }
                    }

                    if (htmlBuilder === '') {
                        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:1rem;">No matching records found to push.</td></tr>';
                    } else {
                        tbody.innerHTML = htmlBuilder;
                    }
                }

                if (executeBtn && result.count > 0) executeBtn.disabled = false;
            } else {
                throw new Error(result.message || 'Unknown error during preview');
            }
        } catch (e) {
            if (tbody) tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:1rem; color:var(--danger);">${e.message}</td></tr>`;
            if (countSpan) countSpan.textContent = '0';
        } finally {
            if (previewBtn) {
                previewBtn.disabled = false;
                previewBtn.innerHTML = '<span class="material-icons" style="font-size:0.95rem; margin-right:0.3rem; vertical-align:middle;">visibility</span>Load Preview';
            }
        }
    }

    async function pushToSourceDB() {
        const classFilter = getMultiSelectValues('pushClassFilter');
        const sessionFilter = getMultiSelectValues('pushSessionFilter');
        const protectedColumns = getMultiSelectValues('pushProtectedColumns');
        const order = document.getElementById('pushOrderFilter')?.value || 'roll_number';

        const confirmMsg = `Are you sure you want to push assigned roll number records to the Source DB?`;

        showConfirm(confirmMsg).then(async () => {
            const btn = document.getElementById('executePushToSourceBtn');
            const wrapper = document.getElementById('pushProgressWrapper');
            const statusMsg = document.getElementById('pushStatusMsg');
            const percentText = document.getElementById('pushPercentText');
            const bar = document.getElementById('pushProgressBarFill');
            const timeRem = document.getElementById('pushTimeRemaining');
            const previewContainer = document.getElementById('pushPreviewContainer');

            setProgressBar(true);
            if (previewContainer) previewContainer.style.display = 'none';

            const updateProgress = (pct, msg, time) => {
                if (bar) bar.style.width = pct + '%';
                if (percentText) percentText.textContent = pct + '%';
                if (statusMsg) statusMsg.textContent = msg;
                if (timeRem && time) timeRem.textContent = time;
            };

            updateGlobalProgress('Initializing secure connection...', 5);

            try {
                // Poll for real time progress from server
                const taskId = 'push_' + Date.now();
                startProgressPolling(taskId, 2000);

                const result = await runServerFunction('syncDataToSource', classFilter, sessionFilter, false, state.currentUser, order, taskId, protectedColumns);

                stopProgressPolling();

                if (result.success) {
                    updateProgress(100, 'Sync completed successfully!', 'Finished');
                    if (bar) bar.style.background = 'linear-gradient(90deg, var(--success), #4ade80)';
                    showAlert('admin-alert', result.message, 'success');
                    setTimeout(() => {
                        if (wrapper) wrapper.style.display = 'none';
                        loadPushPreview();
                    }, 2500);
                } else {
                    throw new Error(result.message);
                }
            } catch (e) {
                updateProgress(0, 'Sync failed!', 'Error');
                if (bar) bar.style.background = 'var(--danger)';
                showAlert('admin-alert', 'Failed to push: ' + e.message, 'danger');
                setTimeout(() => { if (wrapper) wrapper.style.display = 'none'; }, 3000);
            } finally {
                stopProgressPolling();
                setProgressBar(false);
                if (btn) {
                    btn.disabled = false;
                    btn.innerHTML = '<span class="material-icons" style="font-size:0.95rem; vertical-align:middle; margin-right:0.2rem;">cloud_upload</span>Push Records';
                }
            }
        }).catch(err => {
            console.log('Push cancelled:', err);
        });
    }

    // Initialize
    window.addEventListener('click', (e) => {
        if (!e.target.closest('.header-dropdown')) {
            document.querySelectorAll('.dropdown-content.show').forEach(el => el.classList.remove('show'));
        }
    });

    /**
     * [NEW] SSO Login Handler - Validates token from URL
     */
    async function handleSSOLogin(token) {
        setLoading(true, true);
        showPopup('Authenticating gateway session...', { autoClose: false });

        try {
            const resp = await runServerFunction('validateSSOToken', token);
            if (resp.success && resp.data && resp.data.user && resp.data.user.email) {
                // Login successful via token
                const user = resp.data.user;
                state.currentUser = user;
                localStorage.setItem('hss_user', JSON.stringify(user));
                sessionStorage.setItem('hss_user', JSON.stringify(user));

                // Clear token from URL
                const url = new URL(window.location);
                url.searchParams.delete('token');
                window.history.replaceState({}, document.title, url.toString());

                // Use bundled initial data if available, fallback to separate query
                let data;
                if (resp.data.initialData) {
                    data = resp.data.initialData;
                } else {
                    data = await runServerFunction('getInitialDataForUser', state.currentUser);
                }
                handleInitialData(data);
                setupInactivityLogout();
                setLoading(false, true);
                return true;
            } else {
                showAlert('auth-alert', 'Gateway session expired or invalid.', 'danger');
            }
        } catch (e) {
            console.error('SSO error:', e);
            showAlert('auth-alert', 'Authentication error while connecting to gateway.', 'danger');
        }

        setLoading(false, true);
        return false;
    }

    function init() {
        const urlParams = new URLSearchParams(window.location.search);

        // [NEW] Global Logout Handover
        if (urlParams.get('logout') === 'true') {
            console.log('Logout requested via URL. Clearing local session...');
            localStorage.removeItem('hss_user');
            localStorage.removeItem('hss_token');
            localStorage.removeItem('hss_persist_token');
            sessionStorage.clear();

            const redir = urlParams.get('redirectTo');
            if (redir) {
                console.log('Redirecting to:', redir);
                setLoading(true);
                setLoadingMessage('Session Cleared. Redirecting...');
                setTimeout(() => {
                    try {
                        window.top.location.href = redir;
                    } catch (e) {
                        window.location.href = redir;
                    }
                }, 800);
                return; // Stop further init
            }

            // Clean URL if no redir
            const cleanUrl = window.location.pathname;
            window.history.replaceState({}, document.title, cleanUrl);
            setTimeout(() => showAlert('login-alert', 'Logged out successfully from all portals.', 'success'), 100);
        }

        const ssoToken = urlParams.get('token');
        if (ssoToken) {
            handleSSOLogin(ssoToken).then(success => {
                if (!success) {
                    // Fallback to standard init if SSO fails
                    render();
                }
            });
            return;
        }

        loadTheme();
        detectDevice();
        window.addEventListener('resize', detectDevice);
        setupEventListeners();

        // [NEW] Fetch public settings (logo) for login page
        runServerFunction('getPublicSettings')
            .then(settings => {
                const defaultDriveLogo = 'https://raw.githubusercontent.com/admexamhssshangus-dot/hss.shangus_website/refs/heads/main/public/logo.png';
                const url = settings.logo_url_resolved || settings.logo_url || settings.logoUrl || defaultDriveLogo;
                const authLogo = document.getElementById('authLogo');
                if (authLogo && url) {
                    authLogo.src = url;
                    authLogo.style.display = 'block';
                }
            })
            .catch(() => { });

        // [REFINED] Check for active session in local storage (high priority for persistence)
        const sessionUserText = localStorage.getItem('hss_user') || sessionStorage.getItem('hss_user');
        if (sessionUserText) {
            try {
                const sessionUser = JSON.parse(sessionUserText);
                state.currentUser = sessionUser;

                // [SPEED] Fast load from local storage cache if available
                const cacheKey = 'hss_cache_' + (sessionUser.email || 'guest');
                const cachedData = localStorage.getItem(cacheKey);
                let hasCache = false;
                if (cachedData) {
                    try {
                        const parsed = JSON.parse(cachedData);
                        handleInitialData(parsed, true); // true = silent/fast load
                        hasCache = true;
                        console.log('Instant load from cache.');
                    } catch (e) { console.warn('Cache parse failed', e); }
                }

                if (!hasCache) setLoading(true);

                runServerFunction('getInitialDataForUser', sessionUser)
                    .then(data => {
                        handleInitialData(data);
                        setupInactivityLogout();
                    })
                    .catch(err => {
                        if (!hasCache) {
                            localStorage.removeItem('hss_user');
                            sessionStorage.removeItem('hss_user');
                            state.currentUser = null;
                            handleError(err);
                            render();
                        } else {
                            console.error('Background refresh failed:', err);
                        }
                    })
                    .finally(() => {
                        setLoading(false);
                    });
                return;
            } catch (e) {
                localStorage.removeItem('hss_user');
                sessionStorage.removeItem('hss_user');
            }
        }

        // [NEW] Check for persisted session token first (Keep me logged in)
        const deviceId = getDeviceId();
        const persistedToken = localStorage.getItem('hss_persist_token');
        if (persistedToken) {
            setLoading(true); // Persisted validation always needs a spinner because we don't have user object yet
            runServerFunction('validatePersistentSession', persistedToken, deviceId)
                .then(response => {
                    if (response?.success && response.user) {
                        state.currentUser = response.user;
                        sessionStorage.setItem('hss_user', JSON.stringify(response.user));
                        localStorage.setItem('hss_active_token', persistedToken);

                        // [SPEED] Fast load from cache for persistent session
                        const cacheKey = 'hss_cache_' + (response.user.email || 'guest');
                        const cachedData = localStorage.getItem(cacheKey);
                        if (cachedData) {
                            try { handleInitialData(JSON.parse(cachedData), true); } catch (e) { }
                        }

                        if (response.initialData) {
                            return response.initialData;
                        }
                        return runServerFunction('getInitialDataForUser', response.user);
                    }
                    throw new Error(response?.message || 'Session expired');
                })
                .then(data => {
                    handleInitialData(data);
                    setupInactivityLogout();
                })
                .catch(err => {
                    localStorage.removeItem('hss_persist_token');
                    state.currentUser = null;
                    sessionStorage.removeItem('hss_user');
                    handleError(err);
                    render();
                })
                .finally(() => {
                    setLoading(false);
                });
            return;
        }

        // Normal init: clear old session data
        try {
            Object.keys(localStorage).forEach(k => {
                if (k !== 'hss_theme' && k !== 'hss_persist_token' && k !== 'hss_device_id') localStorage.removeItem(k);
            });
            sessionStorage.removeItem('hss_user');
        } catch (e) { }
        setLoading(false);
        setLoading(false);
        render();
        setupInactivityLogout();
    }
    // Inactivity auto-logout: 10 minutes idle - prompt; auto-logout after 10s if no response
    let inactivityTimer = null;
    let responseTimer = null;
    function resetInactivityTimer(isSharedAction = false) {
        if (inactivityTimer) clearTimeout(inactivityTimer);
        if (responseTimer) clearTimeout(responseTimer);

        // [NEW] Update global activity timestamp to sync with other tabs
        if (!isSharedAction) {
            localStorage.setItem('hss_last_activity', Date.now());
        }

        // [DECOUPLED] We now enforce inactivity logout even if 'Keep me logged in' is active.
        // The persistent token will simply allow them to re-log in automatically upon next visit.
        
        inactivityTimer = setTimeout(() => {
            if (!state.currentUser) return;
            
            // [SYNC] Check if another tab was active more recently before showing prompt
            const lastGlobal = parseInt(localStorage.getItem('hss_last_activity') || '0');
            const now = Date.now();
            if (now - lastGlobal < 9.5 * 60 * 1000) { // If active in last 9.5m (buffer), reschedule
                resetInactivityTimer(true);
                return;
            }

            showPopup('You have been inactive for a while.<br><br>Do you want to stay on the page?', {
                autoClose: false,
                buttons: [
                    { text: 'Stay', onClick: () => { clearTimeout(responseTimer); resetInactivityTimer(); } },
                    { text: 'Logout', onClick: () => { clearTimeout(responseTimer); handleLogout(); } }
                ]
            });
            if (responseTimer) clearTimeout(responseTimer);
            responseTimer = setTimeout(() => { handleLogout(); }, 10000);
        }, 10 * 60 * 1000);
    }
    function setupInactivityLogout() {
        ['click', 'mousemove', 'keydown', 'scroll', 'touchstart'].forEach(evt => {
            window.addEventListener(evt, () => resetInactivityTimer(false), { passive: true });
        });
        
        // [NEW] Multi-tab synchronization listener
        window.addEventListener('storage', (e) => {
            if (e.key === 'hss_last_activity' && e.newValue) {
                resetInactivityTimer(true); // Sync timer without rewriting to storage
            }
            if ((e.key === 'hss_user' || e.key === 'hss_persist_token') && !e.newValue && state.currentUser) {
                // Logout detected in another tab
                handleLogout(true, 'Logged out from another tab.'); 
            }
            if (e.key === 'hss_active_token' && e.newValue && state.currentUser) {
                const currentToken = localStorage.getItem('hss_persist_token') || sessionStorage.getItem('hss_session_token');
                if (e.newValue !== currentToken) {
                    handleLogout(true, 'Logged out: Another session was started in another tab.');
                }
            }
        });

        resetInactivityTimer();
    }
    // Session Heartbeat Check (Every 60s)
    let sessionHeartbeatInterval = null;
    function startSessionHeartbeat() {
        if (sessionHeartbeatInterval) clearInterval(sessionHeartbeatInterval);
        sessionHeartbeatInterval = setInterval(() => {
            if (!state.currentUser) return;
            const token = localStorage.getItem('hss_persist_token') || sessionStorage.getItem('hss_session_token');
            const deviceId = localStorage.getItem('hss_device_id') || getDeviceId();
            if (token && deviceId) {
                runServerFunction('validateSessionHeartbeat', token, deviceId)
                    .then(response => {
                        if (response && response.success === false) {
                            handleLogout(true, response.message || 'Your session has been terminated because you logged in on another device.');
                        }
                    })
                    .catch(err => {
                        console.warn('Heartbeat check error:', err);
                    });
            }
        }, 10000);
    }
    function stopSessionHeartbeat() {
        if (sessionHeartbeatInterval) clearInterval(sessionHeartbeatInterval);
    }
    // [NEW] Visual warning before refresh to prevent session loss
    function setupRefreshWarning() {
        window.addEventListener('beforeunload', (e) => {
            if (state.currentUser) {
                e.preventDefault();
                e.returnValue = 'Refreshing the page will log you out. Are you sure?';
                return e.returnValue;
            }
        });
    }
    let pollInterval;
    function startPolling() {
        if (pollInterval) clearInterval(pollInterval);
        pollInterval = setInterval(() => {
            if (state.currentUser && (state.currentView === 'studentDashboard' || state.currentView === 'adminDashboard')) {
                const prevData = state.currentView === 'studentDashboard' ? state.applications.map(a => a.lastModified).join(',') : state.adminData.lastModified;
                runServerFunction('getInitialDataForUser', state.currentUser)
                    .then(newData => {
                        const newStamp = state.currentView === 'studentDashboard' ? newData.applications.map(a => a.lastModified).join(',') : newData.lastModified;
                        if (prevData !== newStamp) {
                            handleInitialData(newData);
                            console.log('Background refresh: Data updated');
                            showAlert(state.currentView === 'studentDashboard' ? 'student-dashboard-alert' : 'admin-alert', 'Dashboard refreshed: New updates available', 'info');
                        }
                    })
                    .catch(err => console.warn('Polling error:', err));
            }
        }, 300000);
    }
    function stopPolling() {
        if (pollInterval) clearInterval(pollInterval);
    }
    function detectDevice() {
        try {
            const w = window.innerWidth || document.documentElement.clientWidth;
            const h = window.innerHeight || document.documentElement.clientHeight;
            const ua = navigator.userAgent || '';
            let type = 'desktop';
            if (w <= 640) type = 'phone';
            else if (w <= 1024) type = 'tablet';
            const isSafari = /Safari\//.test(ua) && !/Chrome\//.test(ua);
            const isFirefox = /Firefox\//.test(ua);
            const isChrome = /Chrome\//.test(ua);
            state.deviceInfo = { type, width: w, height: h, isSafari, isFirefox, isChrome };
            document.body.dataset.device = type;
            document.body.classList.remove('device-phone', 'device-tablet', 'device-desktop');
            document.body.classList.add(`device-${type}`);
        } catch (e) { }
    }
    // Theme Management
    function loadTheme() {
        const savedTheme = localStorage.getItem('hss_theme') || 'light';
        if (savedTheme === 'dark') {
            document.body.classList.add('dark-theme');
            updateThemeToggleIcons('light_mode');
        }
    }
    function toggleTheme() {
        document.body.classList.toggle('dark-theme');
        const isDark = document.body.classList.contains('dark-theme');
        localStorage.setItem('hss_theme', isDark ? 'dark' : 'light');
        updateThemeToggleIcons(isDark ? 'light_mode' : 'dark_mode');
    }
    function updateThemeToggleIcons(icon) {
        // Update admin theme toggle
        const adminToggle = document.getElementById('themeToggleBtn');
        if (adminToggle) {
            const adminIcon = adminToggle.querySelector('.material-icons');
            if (adminIcon) adminIcon.textContent = icon;
        }
        // Update student theme toggle
        const studentToggle = document.getElementById('studentThemeToggleBtn');
        if (studentToggle) {
            const studentIcon = studentToggle.querySelector('.material-icons');
            if (studentIcon) studentIcon.textContent = icon;
        }

        // [NEW] Update login screen theme pill
        const loginIcon = document.getElementById('loginThemeIcon');
        const loginLabel = document.getElementById('loginThemeLabel');
        const isDark = icon === 'light_mode';
        if (loginIcon) loginIcon.textContent = icon;
        if (loginLabel) loginLabel.textContent = isDark ? 'Light' : 'Dark';
        // Update admin mobile icon if present
        const adminIconMobile = document.getElementById('adminThemeIconMobile');
        if (adminIconMobile) adminIconMobile.textContent = icon;
    }
    // Confirmation Modal
    function showConfirm(message, title = 'Confirm Action') {
        return new Promise((resolve, reject) => {
            const titleEl = dom.confirmModal.querySelector('h3');
            if (titleEl) titleEl.textContent = title;
            dom.confirmMessage.innerHTML = message; // Use innerHTML for line breaks
            dom.confirmModal.classList.remove('hidden');
            function onConfirm() {
                dom.confirmModal.classList.add('hidden');
                cleanup();
                resolve();
            }
            function onCancel() {
                dom.confirmModal.classList.add('hidden');
                cleanup();
                reject(new Error('Cancelled'));
            }
            function cleanup() {
                dom.confirmOk.removeEventListener('click', onConfirm);
                dom.confirmCancel.removeEventListener('click', onCancel);
            }
            dom.confirmOk.addEventListener('click', onConfirm);
            dom.confirmCancel.addEventListener('click', onCancel);
        });
    }
    // Input Modal
    function showInputModal(title, message, label, defaultValue = '', inputType = 'text', presets = []) {
        return new Promise((resolve, reject) => {
            dom.inputModalTitle.textContent = title;
            dom.inputModalMessage.innerHTML = message;
            dom.inputModalGroup.style.display = 'block';
            dom.inputModalLabel.textContent = label;
            const useTextarea = inputType === 'textarea';
            dom.inputModalInput.style.display = useTextarea ? 'none' : 'block';
            dom.inputModalTextarea.style.display = useTextarea ? 'block' : 'none';
            dom.inputModalInput.value = useTextarea ? '' : defaultValue;
            dom.inputModalTextarea.value = useTextarea ? defaultValue : '';
            dom.inputPresetContainer.style.display = presets && presets.length ? 'flex' : 'none';
            if (presets && presets.length) {
                dom.inputPresetContainer.innerHTML = presets.map((text, idx) => `
            <span data-index="${idx}" style="display:inline-flex; align-items:center; gap:6px; background: var(--bg); border:1px solid var(--border); border-radius:999px; padding:4px 8px; font-size:0.8rem;">
              <span>${text}</span>
              <button type="button" class="btn btn-small" data-action="add" style="padding:0 6px; font-size:0.8rem;">+</button>
              <button type="button" class="btn btn-small" data-action="remove" style="padding:0 6px; font-size:0.8rem;">-</button>
            </span>
          `).join('');
                dom.inputPresetContainer.querySelectorAll('button').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const action = btn.dataset.action;
                        const text = btn.parentElement.querySelector('span').textContent;
                        const target = useTextarea ? dom.inputModalTextarea : dom.inputModalInput;
                        let val = target.value || '';
                        if (action === 'add') {
                            if (!val.includes(text)) target.value = (val ? (val + (useTextarea ? '\n' : ' ')) : '') + text;
                        } else {
                            target.value = val.replace(new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '').replace(/\n\n+/g, '\n').trim();
                        }
                    });
                });
            }
            dom.inputModal.classList.remove('hidden');
            function onConfirm() {
                const value = (useTextarea ? dom.inputModalTextarea.value : dom.inputModalInput.value).trim();
                if (!value && label) { // Allow empty for some
                    reject(new Error('Input required'));
                    return;
                }
                dom.inputModal.classList.add('hidden');
                cleanup();
                resolve(value);
            }
            function onCancel() {
                dom.inputModal.classList.add('hidden');
                cleanup();
                reject(new Error('Cancelled'));
            }
            function cleanup() {
                dom.inputOk.removeEventListener('click', onConfirm);
                dom.inputCancel.removeEventListener('click', onCancel);
                dom.inputModalGroup.style.display = 'none';
                dom.inputPresetContainer.style.display = 'none';
                dom.inputPresetContainer.innerHTML = '';
            }
            dom.inputOk.addEventListener('click', onConfirm);
            dom.inputCancel.addEventListener('click', onCancel);
        });
    }
    // Profile Modal
    function showProfileModal() {
        return new Promise((resolve, reject) => {
            dom.profileName.value = state.profile.name || '';
            dom.profileMobile.value = state.profile.mobile || '';
            dom.profileResidence.value = state.profile.residence || '';
            dom.profileModal.classList.remove('hidden');
            function onSave() {
                const name = dom.profileName.value.trim();
                const mobile = dom.profileMobile.value.trim();
                const residence = dom.profileResidence.value.trim();
                if (!name) {
                    reject(new Error('Name is required'));
                    return;
                }
                dom.profileModal.classList.add('hidden');
                cleanup();
                resolve({ name, mobile, residence });
            }
            function onCancel() {
                dom.profileModal.classList.add('hidden');
                cleanup();
                reject(new Error('Cancelled'));
            }
            function cleanup() {
                dom.profileSave.removeEventListener('click', onSave);
                dom.profileCancel.removeEventListener('click', onCancel);
            }
            dom.profileSave.addEventListener('click', onSave);
            dom.profileCancel.addEventListener('click', onCancel);
        });
    }
    // [MODIFIED] Subject Editor Modal Logic - Handles lists and numeric rules
    function handleOpenSubjectEditor(cls, stream, group) {
        state.editingSubjects = { cls, stream, group };
        const groupNames = {
            compulsory: 'Group A (Compulsory)',
            group1: 'Group B',
            group2: 'Group C'
        };

        // For subject lists
        dom.subjectEditTitle.textContent = `Edit ${groupNames[group]} for ${cls} ${stream}`;
        renderSubjectEditList();
        dom.subjectEditInput.value = '';
        dom.subjectEditInput.placeholder = 'Enter new subject name';
        dom.subjectEditInput.type = 'text';
        dom.subjectEditAddBtn.innerHTML = '<span class="material-icons" style="font-size: 1.25rem;">add_circle</span>';

        dom.subjectEditModal.classList.remove('hidden');
        // Focus on input for quick entry
        setTimeout(() => dom.subjectEditInput.focus(), 100);
    }
    function renderSubjectEditList() {
        const { cls, stream, group } = state.editingSubjects;
        const subjects = state.adminData.subjectsConfig[cls]?.[stream]?.[group] || [];
        dom.subjectEditList.innerHTML = subjects.length > 0 ? subjects.map(sub => `
        <div class="subject-item">
          <span>${sub}</span>
          <button type="button" class="icon-btn danger" data-subject="${sub.replace(/"/g, '&quot;')}" onclick="event.preventDefault(); handleRemoveSubject(this.getAttribute('data-subject'))">
            <span class="material-icons" style="font-size: 1.25rem;">remove_circle</span>
          </button>
        </div>
      `).join('') : '<div class="subject-item"><span style="color: var(--text-secondary); font-style: italic;">No subjects yet. Add one below.</span></div>';
    }
    function handleAddSubject() {
        const { cls, stream, group } = state.editingSubjects;
        const newSubject = dom.subjectEditInput.value.trim();

        // Handle adding subject
        if (!newSubject) {
            showPopup('<strong>Subject name cannot be empty!</strong>', { autoClose: true, timeout: 2000 });
            dom.subjectEditInput.focus();
            return;
        }
        // Validate: no special characters or numbers only
        if (!/^[A-Za-z\s\-&()]+$/.test(newSubject)) {
            showPopup('<strong>Subject name must contain only letters, spaces, hyphens, and parentheses.</strong>', { autoClose: true, timeout: 2000 });
            return;
        }
        // Check if already exists (case-insensitive)
        const existingSubjects = (state.adminData.subjectsConfig[cls]?.[stream]?.[group] || []);
        if (existingSubjects.some(s => s.toLowerCase() === newSubject.toLowerCase())) {
            showPopup(`<strong>"${newSubject}" already exists in this group!</strong>`, { autoClose: true, timeout: 2000 });
            dom.subjectEditInput.value = '';
            dom.subjectEditInput.focus();
            return;
        }
        // Add subject
        if (!state.adminData.subjectsConfig[cls][stream]) {
            state.adminData.subjectsConfig[cls][stream] = { compulsory: [], group1: [], group2: [], minTotal: 5, maxTotal: 6, g1Min: 0, g1Max: 1, g2Min: 0, g2Max: 1 };
        }
        state.adminData.subjectsConfig[cls][stream][group].push(newSubject);
        renderSubjectEditList();
        dom.subjectEditInput.value = '';
        dom.subjectEditInput.focus();
        showPopup(`<strong>[OK] "${newSubject}" added!</strong>`, { autoClose: true, timeout: 1500 });
    }
    // Global for onclick
    window.handleRemoveSubject = (subjectName) => {
        showConfirm(`Remove <strong>"${subjectName}"</strong> from this group?`)
            .then(() => {
                const { cls, stream, group } = state.editingSubjects;
                const idx = (state.adminData.subjectsConfig[cls][stream][group] || []).indexOf(subjectName);
                if (idx > -1) {
                    state.adminData.subjectsConfig[cls][stream][group].splice(idx, 1);
                    renderSubjectEditList();
                    showPopup(`<strong>[OK] "${subjectName}" removed!</strong>`, { autoClose: true, timeout: 1500 });
                }
            })
            .catch(() => { });
    }
    // [MODIFIED] Auto-save to localStorage - Fixed populate on load
    function saveFormToLocalStorage() {
        if (!state.currentUser?.email || state.currentView !== 'formEditor') return;
        const formData = collectFormData();
        const key = `hss_form_autosave_${state.currentUser.email}`;
        try {
            localStorage.setItem(key, JSON.stringify({
                formData,
                timestamp: new Date().toISOString(),
                class: formData['Admission sought for class']
            }));
        } catch (e) {
            console.warn('Failed to auto-save to localStorage:', e);
        }
    }
    function restoreFormFromLocalStorage() {
        if (!state.currentUser?.email) return null;
        const key = `hss_form_autosave_${state.currentUser.email}`;
        try {
            const saved = localStorage.getItem(key);
            if (saved) {
                const data = JSON.parse(saved);
                // Check if it's for the same class
                if (data['class'] === state.selectedClassForNewApp) {
                    console.log('Restored form data from localStorage:', data.timestamp);
                    return data.formData;
                } else {
                    console.log('Autosave found but for different class, clearing.');
                    clearLocalStorageAutosave();
                    return null;
                }
            }
        } catch (e) {
            console.warn('Failed to restore from localStorage:', e);
        }
        return null;
    }
    function clearLocalStorageAutosave() {
        if (!state.currentUser?.email) return;
        const key = `hss_form_autosave_${state.currentUser.email}`;
        localStorage.removeItem(key);
    }

    // [ENHANCED] Touch handling for smooth interactions without blocking standard browser features
    function setupTouchHandling() {
        // We allow standard pinch zoom and double-tap zoom as per user request for "smooth zoom"
        // Modern browsers with touch-action: manipulation already handle the 300ms delay.

        // Optimize scroll performance with passive listeners
        document.addEventListener('touchstart', function (e) {
            // Just a placeholder to ensure the browser knows we are touch-ready
        }, { passive: true });

        // Ensure input fields are always accessible
        const inputs = document.querySelectorAll('input, textarea, select');
        inputs.forEach(input => {
            input.addEventListener('touchstart', function (e) {
                // Allow focus to happen naturally
            }, { passive: true });
        });

        // [NEW] Add a global scroll listener to handle any necessary UI updates during scroll
        window.addEventListener('scroll', debounce(() => {
            // Any UI updates needed on scroll (like sticky headers)
        }, 100), { passive: true });
    }

    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
    // Event Listeners
    window.switchAdminTab = function (tabId) {
        console.log('[UI] Switching Admin Tab:', tabId);
        if (state) state.adminTab = tabId;

        // Route to consolidated renderer
        if (typeof renderAdminDashboard === 'function') {
            renderAdminDashboard();
        } else {
            console.error('[UI] renderAdminDashboard not found during tab switch');
        }
    };



    function setupEventListeners() {
        setupRefreshWarning(); // [NEW] Activate refresh warning

        // [NEW] Prevent double-tap zoom on mobile devices
        setupTouchHandling();

        // Theme toggle will be set up when the elements are created
        // Admin theme toggle is now in the header, student theme toggle is created dynamically
        // Auth view toggles
        document.getElementById('showRegister')?.addEventListener('click', (e) => {
            e.preventDefault();
            if (state.currentUser) { handleLogout(); }

            // [NEW] Determine registration role based on active tab
            const activeTab = document.querySelector('.login-tab.active');
            registrationRole = activeTab ? activeTab.dataset.role : 'student';

            const teacherSection = document.getElementById('teacherDetailsSection');
            if (teacherSection) {
                if (registrationRole === 'teacher') {
                    teacherSection.classList.remove('hidden');
                } else {
                    teacherSection.classList.add('hidden');
                }
            }

            dom.loginForm.classList.add('hidden');
            dom.forgotPasswordForm.classList.add('hidden');
            dom.registerForm.classList.remove('hidden');
            dom.authAlert.classList.add('hidden');
            dom.container.classList.remove('wide');
        });
        document.getElementById('showLogin')?.addEventListener('click', (e) => {
            e.preventDefault();
            // Ensure any previous session is cleared when returning to login
            if (state.currentUser) { handleLogout(); }
            dom.registerForm.classList.add('hidden');
            dom.forgotPasswordForm.classList.add('hidden');
            dom.loginForm.classList.remove('hidden');
            dom.authAlert.classList.add('hidden');
            dom.container.classList.remove('wide');
            state.loginTarget = null;
            registrationRole = 'student'; // Reset
        });
        document.getElementById('showForgotPassword')?.addEventListener('click', (e) => {
            e.preventDefault();
            dom.loginForm.classList.add('hidden');
            dom.registerForm.classList.add('hidden');
            dom.forgotPasswordForm.classList.remove('hidden');
            dom.authAlert.classList.add('hidden');
            dom.container.classList.remove('wide');
            state.loginTarget = null;
        });
        document.getElementById('showLoginFromForgot')?.addEventListener('click', (e) => {
            e.preventDefault();
            dom.registerForm.classList.add('hidden');
            dom.forgotPasswordForm.classList.add('hidden');
            dom.loginForm.classList.remove('hidden');
            dom.authAlert.classList.add('hidden');
            dom.container.classList.remove('wide');
        });
        // Auth forms
        dom.loginForm.addEventListener('submit', handleLogin);

        // [NEW] President Login Toggle
        document.getElementById('presidentLoginBtn')?.addEventListener('click', (e) => {
            const container = document.getElementById('loginPortalContainer');
            const isPresident = container.classList.toggle('president-mode');
            const emailInput = document.getElementById('loginEmail');
            const presidentEmail = 'adm.exam.hss.shangus@gmail.com';
            const tabs = document.querySelector('.login-tabs');
            const lockIcon = e.currentTarget;

            if (isPresident) {
                currentLoginRole = 'President'; // Use dedicated President role
                emailInput.value = presidentEmail;
                if (tabs) tabs.style.display = 'none'; // Hide tabs for superadmin mode

                // [NEW] Update title for Presidential feel
                const titleEl = container.querySelector('.login-portal-header h2');
                if (titleEl) {
                    titleEl.dataset.originalText = titleEl.textContent;
                    titleEl.textContent = 'President Portal';
                }

                lockIcon.textContent = 'lock_open';
                showToast('SuperAdmin Access Enabled', 'success');
                // Pre-set focus
                document.getElementById('loginPassword').focus();
            } else {
                currentLoginRole = 'student';
                emailInput.value = '';
                if (tabs) tabs.style.display = 'flex';

                // [NEW] Restore original title
                const titleEl = container.querySelector('.login-portal-header h2');
                if (titleEl && titleEl.dataset.originalText) {
                    titleEl.textContent = titleEl.dataset.originalText;
                }

                lockIcon.textContent = 'lock';
                // Reset to student tab
                document.querySelectorAll('.login-tab').forEach(t => {
                    t.classList.toggle('active', t.dataset.role === 'student');
                });
            }
        });
        dom.registerForm.addEventListener('submit', handleRegister);
        dom.forgotPasswordForm.addEventListener('submit', handleResetPassword); // [NEW]
        document.getElementById('toggleLoginPassword')?.addEventListener('click', () => togglePassword('loginPassword', 'toggleLoginPassword'));
        document.getElementById('toggleRegisterPassword')?.addEventListener('click', () => togglePassword('registerPassword', 'toggleRegisterPassword'));
        document.getElementById('toggleConfirmPassword')?.addEventListener('click', () => togglePassword('confirmPassword', 'toggleConfirmPassword'));
        document.getElementById('toggleResetPassword')?.addEventListener('click', () => togglePassword('resetPassword', 'toggleResetPassword'));
        document.getElementById('toggleResetConfirmPassword')?.addEventListener('click', () => togglePassword('resetConfirmPassword', 'toggleResetConfirmPassword'));
        document.getElementById('adminLoginLink')?.addEventListener('click', (e) => {
            e.preventDefault();
            state.currentView = 'auth';
            state.loginTarget = 'Admin';
            dom.registerForm.classList.add('hidden');
            dom.forgotPasswordForm.classList.add('hidden');
            dom.loginForm.classList.remove('hidden');
            dom.authAlert.textContent = 'Admin Login';
            dom.authAlert.className = 'alert alert-info';
            document.getElementById('adminLoginLink').style.display = 'none';
            document.getElementById('studentLoginLink').style.display = 'block';
        });
        document.getElementById('studentLoginLink')?.addEventListener('click', (e) => {
            e.preventDefault();
            state.currentView = 'auth';
            state.loginTarget = null;
            dom.registerForm.classList.add('hidden');
            dom.forgotPasswordForm.classList.add('hidden');
            dom.loginForm.classList.remove('hidden');
            dom.authAlert.classList.add('hidden');
            document.getElementById('adminLoginLink').style.display = 'block';
            document.getElementById('studentLoginLink').style.display = 'none';
        });
        // Registration form listeners
        dom.registerEmail.addEventListener('blur', (e) => handleEmailCheck(e, registrationRole));
        document.getElementById('registerMobile')?.addEventListener('blur', handleMobileCheck);
        dom.sendOtpBtn.addEventListener('click', handleSendOtp);
        dom.registerPassword.addEventListener('input', validatePasswordMatch);
        dom.confirmPassword.addEventListener('input', validatePasswordMatch);
        // [NEW] Forgot Password listeners
        dom.sendResetOtpBtn.addEventListener('click', handleSendResetOtp);
        document.getElementById('resendRegisterOtpBtn')?.addEventListener('click', handleResendOtp);
        document.getElementById('resendResetOtpBtn')?.addEventListener('click', handleResendResetOtp);
        dom.resetPasswordBtn.addEventListener('click', handleResetPassword);
        document.getElementById('resetPassword')?.addEventListener('input', validateResetPasswordMatch);
        document.getElementById('resetConfirmPassword')?.addEventListener('input', validateResetPasswordMatch);
        // Logout buttons
        document.getElementById('studentLogoutBtn')?.addEventListener('click', handleLogout);
        document.getElementById('teacherLogoutBtn')?.addEventListener('click', handleLogout);
        document.getElementById('adminLogoutBtn')?.addEventListener('click', handleLogout);
        // Student refresh button
        document.getElementById('studentRefreshBtn')?.addEventListener('click', () => {
            const btn = document.getElementById('studentRefreshBtn');
            if (btn) btn.disabled = true;
            runServerFunction('getInitialDataForUser', state.currentUser)
                .then(handleInitialData)
                .catch(handleError)
                .finally(() => { if (btn) btn.disabled = false; });
        });
        // Theme toggle buttons
        document.getElementById('studentThemeToggleBtn')?.addEventListener('click', toggleTheme);
        document.getElementById('themeToggleBtn')?.addEventListener('click', toggleTheme);
        document.getElementById('loginThemeToggleBtn')?.addEventListener('click', toggleTheme);

        // [NEW] Robust Tab Delegation - Ensures tabs are ALWAYS clickable
        const adminTabsEl = document.getElementById('adminTabs');
        if (adminTabsEl) {
            // [FIX] Clone to flush old duplicate event listeners and prevent race conditions
            const newAdminTabsEl = adminTabsEl.cloneNode(true);
            adminTabsEl.parentNode.replaceChild(newAdminTabsEl, adminTabsEl);

            newAdminTabsEl.addEventListener('click', (e) => {
                const btn = e.target.closest('button[data-tab]');
                if (!btn) return;
                window.switchAdminTab(btn.dataset.tab);
            });
        }

        // Admin controls
        document.getElementById('toolsSaveContactsBtn')?.addEventListener('click', handleSaveContacts);
        document.getElementById('toolsSaveAllWithRollNosBtn')?.addEventListener('click', handleSaveAllWithRollNos);
        document.getElementById('toolsClearBtn')?.addEventListener('click', () => {
            document.getElementById('toolsFormNumbers').value = '';
            document.getElementById('toolsResultContainer').style.display = 'none';
        });
        // [NEW] Toggle Log and Info Listeners
        document.getElementById('toggleToolsLogBtn')?.addEventListener('click', (e) => {
            const log = document.getElementById('toolsResultLog');
            if (log.style.display === 'none') {
                log.style.display = 'block';
                e.target.textContent = 'Hide Log';
            } else {
                log.style.display = 'none';
                e.target.textContent = 'Show Log';
            }
        });
        document.getElementById('toggleToolsInfoBtn')?.addEventListener('click', (e) => {
            const info = document.getElementById('toolsInfoSection');
            const icon = e.currentTarget.querySelector('.material-icons:last-child'); // The expand_more icon
            if (info.style.display === 'none') {
                info.style.display = 'block';
                if (icon) icon.textContent = 'expand_less';
            } else {
                info.style.display = 'none';
                if (icon) icon.textContent = 'expand_more';
            }
        });

        // ID Card Data functionality
        document.getElementById('generateIdCardDataBtn')?.addEventListener('click', handleGenerateIdCardData);
        document.getElementById('generateIdCardPdfsBtn')?.addEventListener('click', handleGenerateIdCardPdfs);
        document.getElementById('toggleIdCardLogBtn')?.addEventListener('click', (e) => {
            const log = document.getElementById('idCardLog');
            if (!log) return;
            const isHidden = log.style.display === 'none';
            log.style.display = isHidden ? 'block' : 'none';
            e.target.textContent = isHidden ? 'Hide Logs' : 'Show Logs';
        });
        document.getElementById('toggleIdCardInfoBtn')?.addEventListener('click', () => {
            const info = document.getElementById('idCardInfoSection');
            if (info) info.style.display = info.style.display === 'none' ? 'block' : 'none';
        });

        document.getElementById('saveSettingsBtn')?.addEventListener('click', handleSaveSettings);
        document.getElementById('refreshOtpsBtn')?.addEventListener('click', loadAdminOtps);
        document.getElementById('saveSubjectsBtn')?.addEventListener('click', handleSaveSubjects);
        document.getElementById('generateSubjectListsBtn')?.addEventListener('click', handleGenerateSubjectLists);
        dom.searchInput?.addEventListener('input', debounce(handleAdminSearch, 300));
        document.getElementById('headerSearchInput')?.addEventListener('input', debounce(handleAdminSearch, 300));

        // [NEW] Mobile Filter Toggle
        const mobileFilterToggle = document.getElementById('mobileFilterToggle');
        if (mobileFilterToggle) {
            mobileFilterToggle.addEventListener('click', () => {
                const filters = document.getElementById('adminFiltersContainer');
                if (filters) {
                    const willBeVisible = filters.classList.contains('mobile-hide');
                    filters.classList.toggle('mobile-hide');
                    
                    // Add active class to button for visual feedback
                    mobileFilterToggle.classList.toggle('btn-primary', willBeVisible);
                    mobileFilterToggle.classList.toggle('btn-secondary', !willBeVisible);
                }
            });
        }
        document.getElementById('exportBtn')?.addEventListener('click', handleExport);
        document.getElementById('printReportBtn')?.addEventListener('click', openPrintSettings);
        // Form controls
        document.getElementById('saveDraftBtn')?.addEventListener('click', () => handleSaveApplication('Draft'));
        document.getElementById('finalSubmitBtn')?.addEventListener('click', () => handleSaveApplication('Submitted'));
        document.getElementById('cancelEditBtn')?.addEventListener('click', () => {
            const role = state.currentUser?.role;
            const isAdmin = (role === 'Admin' || role === 'SuperAdmin' || role === 'President');
            state.currentView = isAdmin ? 'adminDashboard' : 'studentDashboard';
            state.isEditing = false;
            state.editingFormData = null;
            state.oldPhotoUrl = null;
            state.selectedClassForNewApp = null;
            stopCountdownTimer();
            render();
        });
        dom.editProfileBtn?.addEventListener('click', handleEditProfile);
        // [MODIFIED] Subject Modal Listeners
        dom.subjectEditAddBtn.addEventListener('click', handleAddSubject);
        // Allow Enter key to add subject
        dom.subjectEditInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') handleAddSubject();
        });
        dom.subjectEditCloseBtn.addEventListener('click', () => {
            // Auto-save to Subjects_Config when closing editor
            handleSaveSubjects();
            dom.subjectEditModal.classList.add('hidden');
            state.editingSubjects = null;
            renderSubjectsEditor(); // Re-render admin dash to show changes
        });
        // [NEW] Numeric rule inputs listener
        document.addEventListener('change', (e) => {
            if (e.target.classList.contains('rule-input')) {
                const cls = e.target.dataset.cls;
                const stream = e.target.dataset.stream;
                const type = e.target.dataset.type;
                state.adminData.subjectsConfig[cls][stream][type] = parseInt(e.target.value) || 0;
            }
        });
        // Subjects editor collapse/expand
        const subjectsToggleBtn = document.getElementById('subjectsToggleBtn');
        if (subjectsToggleBtn) {
            subjectsToggleBtn.addEventListener('click', () => {
                const container = document.getElementById('subjectsConfigContainer');
                const isHidden = container.style.display === 'none';
                container.style.display = isHidden ? 'block' : 'none';
                subjectsToggleBtn.textContent = isHidden ? '-' : '+';
            });
        }
        // Admission controls collapse/expand
        const adminControlsToggleBtn = document.getElementById('adminControlsToggleBtn');
        if (adminControlsToggleBtn) {
            adminControlsToggleBtn.addEventListener('click', () => {
                const container = document.getElementById('adminControlsContainer');
                const isHidden = container.style.display === 'none';
                container.style.display = isHidden ? 'block' : 'none';
                adminControlsToggleBtn.textContent = isHidden ? '-' : '+';
            });
        }
        // Test submissions collapse/expand
        const testSubmissionsToggleBtn = document.getElementById('testSubmissionsToggleBtn');
        if (testSubmissionsToggleBtn) {
            testSubmissionsToggleBtn.addEventListener('click', () => {
                const container = document.getElementById('testSubmissionsContainer');
                const isHidden = container.style.display === 'none';
                container.style.display = isHidden ? 'block' : 'none';
                testSubmissionsToggleBtn.textContent = isHidden ? '-' : '+';
            });
        }
        // Test submission buttons
        document.getElementById('testAll')?.addEventListener('click', () => handleTestSubmission('all'));

        // [NEW] Toggle Tools Log
        document.getElementById('toggleToolsLogBtn')?.addEventListener('click', function () {
            const logDiv = document.getElementById('toolsResultLog');
            if (logDiv.style.display === 'none') {
                logDiv.style.display = 'block';
                this.textContent = 'Hide Log';
            } else {
                logDiv.style.display = 'none';
                this.textContent = 'Show Log';
            }
        });

        // [NEW] Toggle Tools Info
        document.getElementById('toggleToolsInfoBtn')?.addEventListener('click', function () {
            const infoSection = document.getElementById('toolsInfoSection');
            const expandIcon = this.querySelector('.material-icons:last-child');
            if (infoSection.style.display === 'none' || infoSection.style.display === '') {
                infoSection.style.display = 'block';
                expandIcon.textContent = 'expand_less';
            } else {
                infoSection.style.display = 'none';
                expandIcon.textContent = 'expand_more';
            }
        });

        document.getElementById('test9th')?.addEventListener('click', () => handleTestSubmission('9th'));
        document.getElementById('test10th')?.addEventListener('click', () => handleTestSubmission('10th'));
        document.getElementById('test11thFull')?.addEventListener('click', () => handleTestSubmission('11th-full'));
        document.getElementById('test11thProv')?.addEventListener('click', () => handleTestSubmission('11th-provisional'));
        document.getElementById('test12thFull')?.addEventListener('click', () => handleTestSubmission('12th-full'));
        document.getElementById('test12thProv')?.addEventListener('click', () => handleTestSubmission('12th-provisional'));
        document.getElementById('testClearDemo')?.addEventListener('click', handleClearDemoData);
        // [NEW] Instructions modal listener
        dom.instructionsAgreeBtn.addEventListener('click', () => {
            dom.instructionsModal.classList.add('hidden');
            renderFormEditor(true); // Render form *after* agree
        });
        window.addEventListener('beforeunload', stopPolling);
    }

    // Countdown Timer Functions
    let countdownInterval = null;
    let unlockExpiryTime = null;

    function formatTimeCountdown(seconds) {
        if (seconds <= 0) return '00:00:00';
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }

    function startCountdownTimer(expiryTimestamp) {
        // Clear any existing interval
        if (countdownInterval) clearInterval(countdownInterval);

        unlockExpiryTime = expiryTimestamp;
        const countdownEl = document.getElementById('countdownTimer');
        const countdownDisplay = document.getElementById('countdownDisplay');

        if (!countdownEl || !countdownDisplay) return;

        // Show timer
        countdownEl.classList.remove('hidden');

        // Update countdown every second
        countdownInterval = setInterval(() => {
            const now = Date.now();
            const timeRemaining = Math.max(0, Math.floor((expiryTimestamp - now) / 1000));

            // Format and display time
            countdownDisplay.textContent = formatTimeCountdown(timeRemaining);

            // Add critical class when less than 5 minutes
            if (timeRemaining < 300 && timeRemaining > 0) {
                countdownEl.classList.add('critical');
            } else if (timeRemaining >= 300) {
                countdownEl.classList.remove('critical');
            }

            // Stop timer when expired
            if (timeRemaining <= 0) {
                clearInterval(countdownInterval);
                countdownEl.classList.add('critical');
                countdownDisplay.textContent = '00:00:00';
                // Optionally show an alert or disable editing
                showPopup('Edit Time Expired', 'Your edit window has expired. Please save your work and submit.', 'warning');
            }
        }, 1000);

        // Initial update
        const timeRemaining = Math.max(0, Math.floor((expiryTimestamp - Date.now()) / 1000));
        countdownDisplay.textContent = formatTimeCountdown(timeRemaining);
    }

    function stopCountdownTimer() {
        if (countdownInterval) {
            clearInterval(countdownInterval);
            countdownInterval = null;
        }
        const countdownEl = document.getElementById('countdownTimer');
        if (countdownEl) {
            countdownEl.classList.add('hidden');
            countdownEl.classList.remove('critical');
        }
    }

    // Rendering
    function render() {
        try {
            // [SECURITY] Preventive View Access Control
            const role = state.currentUser?.role;
            const isAdmin = (role === 'Admin' || role === 'SuperAdmin' || role === 'President');

            if (state.currentView === 'adminDashboard' && !isAdmin) {
                console.warn('Unauthorized view access attempt blocked.');
                state.currentView = (role === 'Student') ? 'studentDashboard' : 'auth';
            }
            console.log('[UI] Rendering view:', state.currentView, '| Role:', state.currentUser?.role, '| Apps:', state.applications?.length, '| AdminApps:', state.adminData?.applications?.length);

            if (!dom.views[state.currentView]) {
                console.error(`[ERROR] View element for "${state.currentView}" not found in DOM.`);
                showGlobalError(`Crucial UI component missing: ${state.currentView}. Please refresh or contact Admin.`);
                return;
            }

            // Hide all views first
            Object.values(dom.views).forEach(view => {
                if (view) view.classList.add('hidden');
            });

            // Unhide current view
            dom.views[state.currentView].classList.remove('hidden');

            // Apply global container layout classes
            if (state.currentView === 'adminDashboard' || state.currentView === 'formEditor') {
                dom.container.classList.add('wide');
            } else {
                dom.container.classList.remove('wide');
            }

            // Stop countdown timer when leaving form editor
            if (state.currentView !== 'formEditor') {
                stopCountdownTimer();
            }

            // Trigger specific rendering logic
            switch (state.currentView) {
                case 'auth':
                    if (dom.loginBtn) setBtnLoading(dom.loginBtn, false, 'Log In');
                    if (dom.loginEmail) dom.loginEmail.disabled = false;
                    if (dom.loginPassword) dom.loginPassword.disabled = false;
                    if (dom.logoSpinnerContainer) dom.logoSpinnerContainer.classList.remove('loading');
                    break;
                case 'studentDashboard': renderStudentDashboard(); break;
                case 'teacherDashboard': renderTeacherDashboard(); break;
                case 'adminDashboard': renderAdminDashboard(); break;
                case 'formEditor': renderFormEditor(true); break;
                case 'practicals': if (typeof prac_initPortal === 'function') prac_initPortal(); break;
                case 'attendance': if (typeof initAttendanceView === 'function') initAttendanceView(); break;
            }
        } catch (err) {
            console.error('[CRITICAL] Rendering cycle failed:', err);
            showGlobalError(`An error occurred while displaying the dashboard: ${err.message}. \n\nClick "Refresh" to retry.`);
        }
    }

    /**
     * Shows a modal-like error overlay if the app crashes during load
     */
    function showGlobalError(msg) {
        let errorBox = document.getElementById('global-error-overlay');
        if (!errorBox) {
            errorBox = document.createElement('div');
            errorBox.id = 'global-error-overlay';
            errorBox.style = 'position:fixed; inset:0; background:rgba(0,0,0,0.85); z-index:999999; display:flex; align-items:center; justify-content:center; padding:20px;';
            errorBox.innerHTML = `
                <div style="background:white; padding:2rem; border-radius:12px; max-width:450px; width:100%; text-align:center; box-shadow:0 10px 30px rgba(0,0,0,0.5);">
                    <div style="color:#dc2626; font-size:3rem; margin-bottom:1rem;">[!]</div>
                    <h3 style="margin:0 0 1rem; color:#111827;">Application Error</h3>
                    <div id="global-error-msg" style="color:#4b5563; font-size:0.9rem; line-height:1.5; margin-bottom:1.5rem; white-space:pre-wrap;"></div>
                    <button onclick="location.reload()" style="background:#1d4ed8; color:white; border:none; padding:12px 24px; border-radius:8px; font-weight:600; cursor:pointer;">Reload Application</button>
                </div>
            `;
            document.body.appendChild(errorBox);
        }
        document.getElementById('global-error-msg').textContent = msg;
        errorBox.style.display = 'flex';
    }

    function renderTeacherDashboard() {
        const teacherNameDisplay = document.getElementById('teacherNameDisplay');
        const teacherLogo = document.getElementById('teacherLogo');
        if (teacherNameDisplay) teacherNameDisplay.textContent = state.currentUser.name || state.currentUser.email;
        if (teacherLogo && state.adminData.settings.logo_url_resolved) {
            teacherLogo.src = state.adminData.settings.logo_url_resolved;
        }

        // [NEW] Dynamically load class-wise monthly attendance preview summary
        if (typeof loadDashboardAttendancePreview === 'function') {
            // Set initial preview class selector to match the teacher's primary class if available
            const classSelect = document.getElementById('dashboardPreviewClass');
            if (classSelect && state.currentUser && state.currentUser.initialClass) {
                const target = state.currentUser.initialClass;
                for (let i = 0; i < classSelect.options.length; i++) {
                    if (classSelect.options[i].value === target) {
                        classSelect.selectedIndex = i;
                        break;
                    }
                }
            }
            loadDashboardAttendancePreview();
        }
    }
    let _loadingRefCounter = 0;
    let _loadingSafetyTimeout = null;

    function setLoading(isLoading, isForce = false) {
        if (isForce) {
            _loadingRefCounter = isLoading ? 1 : 0;
        } else {
            if (isLoading) _loadingRefCounter++;
            else _loadingRefCounter--;
        }

        if (_loadingRefCounter < 0) _loadingRefCounter = 0;
        const active = _loadingRefCounter > 0;

        state.isLoading = active;
        
        // Handle Prominent Loader
        const pLoader = document.getElementById('prominentGlobalLoader');
        if (pLoader) {
            if (active && isForce) {
                pLoader.classList.remove('hidden');
            } else if (!active) {
                pLoader.classList.add('hidden');
            }
        }

        if (dom.loader) {
            if (active) {
                dom.loader.classList.remove('hidden');
                dom.loader.style.display = 'flex';
                // Safety timeout: auto-close after 30 seconds in case of network orphan
                if (_loadingSafetyTimeout) clearTimeout(_loadingSafetyTimeout);
                _loadingSafetyTimeout = setTimeout(() => {
                    if (_loadingRefCounter > 0) {
                        console.warn('Loading safety timeout triggered');
                        setLoading(false, true);
                    }
                }, 30000);
            } else {
                dom.loader.classList.add('hidden');
                dom.loader.style.display = 'none';
                if (_loadingSafetyTimeout) clearTimeout(_loadingSafetyTimeout);
            }
        }
        // Reset loading message and action button when hiding loader
        if (!active) {
            setLoadingMessage('Loading...');
            if (dom.loaderActionBtn) {
                dom.loaderActionBtn.classList.add('hidden');
                dom.loaderActionBtn.style.display = 'none';
                dom.loaderActionBtn.onclick = null;
            }
        }
    }

    /**
     * [NEW] Show a clickable button inside the loader for manual actions (like blocked redirects)
     */
    function setLoadingAction(text, callback) {
        if (!dom.loaderActionBtn) return;
        dom.loaderActionBtn.textContent = text;
        dom.loaderActionBtn.onclick = (e) => {
            e.stopPropagation();
            callback();
        };
        dom.loaderActionBtn.classList.remove('hidden');
        dom.loaderActionBtn.style.display = 'inline-block';

        // Pulsing effect for the action button to attract attention
        dom.loaderActionBtn.style.animation = 'pulsePrimary 1.5s infinite';
    }

    /**
     * [NEW] Global Progress Bar controller
     */
    let _taskStartTime = null;
    function setProgressBar(isLoading) {
        if (!dom.globalProgressWrapper) return;
        if (isLoading) {
            _taskStartTime = Date.now();
            dom.globalProgressWrapper.classList.add('visible');
            dom.globalProgressWrapper.classList.remove('hidden');
            dom.globalProgressWrapper.style.display = 'block'; // Changed from flex to block for corner widget

            // Hide result area during loading
            if (dom.globalProgressResultArea) dom.globalProgressResultArea.style.display = 'none';
            if (dom.globalProgressSubDetails) dom.globalProgressSubDetails.style.display = 'none';

            // Direct initialization to avoid using updateGlobalProgress
            const msgEl = document.getElementById('globalProgressMsg');
            const pctEl = document.getElementById('globalProgressPercent');
            const fillEl = document.getElementById('globalProgressBarFill');
            if (msgEl) msgEl.textContent = 'Initializing...';
            if (pctEl) pctEl.textContent = '0%';
            if (fillEl) fillEl.style.width = '0%';
        } else {
            dom.globalProgressWrapper.classList.remove('visible');
            dom.globalProgressWrapper.style.display = 'none';
        }
    }

    let _isInternalProgressUpdate = false;
    function updateGlobalProgress(msg, percent, resultUrl = null) {
        if (!dom.globalProgressWrapper || _isInternalProgressUpdate) return;
        _isInternalProgressUpdate = true;

        try {
            // Ensure visibility without calling setProgressBar
            dom.globalProgressWrapper.classList.remove('hidden');
            if (dom.globalProgressWrapper.style.display !== 'block') {
                dom.globalProgressWrapper.style.display = 'block';
            }

            // Split message for sub-details if applicable
            // Pattern: "Main Task: Detail Info"
            if (msg && msg.includes(': ')) {
                const parts = msg.split(': ');
                if (dom.globalProgressMsg) dom.globalProgressMsg.textContent = parts[0];
                if (dom.globalProgressSubDetails) {
                    dom.globalProgressSubDetails.textContent = parts[1];
                    dom.globalProgressSubDetails.style.display = 'block';
                }
            } else {
                if (dom.globalProgressMsg) dom.globalProgressMsg.textContent = msg || 'Processing...';
                if (dom.globalProgressSubDetails) dom.globalProgressSubDetails.style.display = 'none';
            }

            if (dom.globalProgressPercent) dom.globalProgressPercent.textContent = Math.round(percent) + '%';
            if (dom.globalProgressBarFill) dom.globalProgressBarFill.style.width = Math.round(percent) + '%';

            // Calculate Time Remaining
            if (dom.globalProgressTimeRemaining) {
                if (percent > 3 && _taskStartTime) {
                    const elapsed = (Date.now() - _taskStartTime) / 1000; // seconds
                    const totalEstimated = (elapsed / percent) * 100;
                    const remaining = Math.max(0, totalEstimated - elapsed);

                    const min = Math.floor(remaining / 60);
                    const sec = Math.floor(remaining % 60);
                    dom.globalProgressTimeRemaining.textContent = `${min}:${sec.toString().padStart(2, '0')} remaining`;
                } else {
                    dom.globalProgressTimeRemaining.textContent = '--:--';
                }
            }

            // Result Area Logic
            if (resultUrl && dom.globalProgressResultArea && dom.globalProgressResultBtn) {
                dom.globalProgressResultBtn.href = resultUrl;
                dom.globalProgressResultArea.style.display = 'block';
                if (dom.globalProgressResultText) dom.globalProgressResultText.textContent = 'Open Generated Files';
            }

            const abortBtn = document.getElementById('abortTaskBtn');
            if (abortBtn) {
                if (percent > 0 && percent < 100) {
                    abortBtn.style.display = 'flex';
                } else {
                    abortBtn.style.display = 'none';
                }
            }
        } finally {
            _isInternalProgressUpdate = false;
        }
    }

    let progressPollTimer = null;
    let currentTaskId = null;
    function startProgressPolling(taskId, interval = 1500) {
        stopProgressPolling();
        currentTaskId = taskId;

        // Attach abort listener once
        const abortBtn = document.getElementById('abortTaskBtn');
        if (abortBtn && !abortBtn.dataset.bound) {
            abortBtn.addEventListener('click', async () => {
                if (!currentTaskId) return;
                try {
                    abortBtn.disabled = true;
                    abortBtn.textContent = 'Stopping...';
                    await runServerFunction('abortTask', currentTaskId);
                    showToast('Task abortion signal sent.', 'warning');
                    stopProgressPolling();
                    setLoading(false);
                } catch (e) {
                    console.error('Abort failed:', e);
                } finally {
                    abortBtn.disabled = false;
                    abortBtn.innerHTML = '<span class="material-icons" style="font-size: 0.9rem; vertical-align: middle; margin-right: 4px;">stop_circle</span>Stop Execution';
                }
            });
            abortBtn.dataset.bound = 'true';
        }

        progressPollTimer = setInterval(async () => {
            try {
                const data = await runServerFunction('getTaskProgress', taskId);
                if (data && data.percent !== undefined) {
                    updateGlobalProgress(data.message || 'Processing...', data.percent);
                    if (data.percent >= 100 || data.aborted) {
                        stopProgressPolling();
                        if (data.aborted) {
                            showToast('Task was stopped.', 'warning');
                            setProgressBar(false);
                            setLoading(false);
                        } else {
                            // Completion - show 100% for a moment then close
                            setTimeout(() => {
                                setProgressBar(false);
                            }, 2000);
                        }
                    }
                }
            } catch (e) {
                console.warn('Progress poll error:', e);
            }
        }, interval);
    }

    function stopProgressPolling() {
        if (progressPollTimer) {
            clearInterval(progressPollTimer);
            progressPollTimer = null;
        }
    }

    /**
     * [NEW] Button specific loading state
     */
    function setBtnLoading(btn, isLoading, text = 'Processing...') {
        if (!btn) return;
        if (isLoading) {
            // Prevent overwriting originalHtml with spinner markup during sequential loading calls
            if (!btn.classList.contains('btn-loading') && !btn.dataset.originalHtml) {
                btn.dataset.originalHtml = btn.innerHTML;
            }
            btn.classList.add('btn-loading');
            const isDark = btn.classList.contains('btn-secondary') || btn.classList.contains('btn-outline');
            btn.innerHTML = `<span class="btn-spinner ${isDark ? 'dark' : ''}"></span> ${text}`;
            btn.disabled = true;
        } else {
            btn.classList.remove('btn-loading');
            btn.innerHTML = btn.dataset.originalHtml || text;
            btn.removeAttribute('data-original-html');
            btn.disabled = false;
        }
    }

    function setLoadingMessage(msg) {
        const el = document.getElementById('loader-text');
        if (el) el.textContent = msg || 'Loading, please wait...';
        
        const pEl = document.getElementById('prominentLoaderMsg');
        if (pEl) pEl.textContent = msg || 'Preparing Secure Environment...';
    }
    function formatCompactDate(ts) {
        if (!ts) return 'N/A';
        try {
            const d = (ts instanceof Date) ? ts : new Date(ts);
            if (isNaN(d.getTime())) return 'N/A';
            const day = d.getDate();
            const month = d.getMonth() + 1;
            const year = String(d.getFullYear()).slice(-2);
            const hour = String(d.getHours()).padStart(2, '0');
            const min = String(d.getMinutes()).padStart(2, '0');
            return `${day}-${month}-${year}, ${hour}:${min}`;
        } catch (e) { return 'N/A'; }
    }
    function showAlert(elementId, message, type = 'danger') {
        // Create toast popup instead of inline alert
        showToast(message, type);
    }

    // Toast notification popup system
    function showToast(message, type = 'info') {
        // Remove any existing toast
        const existingToast = document.getElementById('toast-notification');
        if (existingToast) {
            existingToast.remove();
        }

        // Create toast container
        const toast = document.createElement('div');
        toast.id = 'toast-notification';

        // Set styles based on type
        const colors = {
            success: { bg: 'var(--success-light)', border: 'var(--success)', icon: 'check_circle', color: '#15803d' },
            danger: { bg: 'var(--danger-light)', border: 'var(--danger)', icon: 'error', color: '#b91c1c' },
            warning: { bg: 'var(--warning-light)', border: 'var(--warning)', icon: 'warning', color: '#78350f' },
            info: { bg: 'var(--info-light)', border: 'var(--info)', icon: 'info', color: '#0369a1' }
        };

        const style = colors[type] || colors.info;

        // Toast styles
        toast.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: ${style.bg};
        border: 2px solid ${style.border};
        border-radius: 12px;
        padding: 16px 24px;
        display: flex;
        align-items: center;
        gap: 12px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.15);
        z-index: 1000000;
        min-width: 300px;
        max-width: 90vw;
        font-family: inherit;
        animation: slideDown 0.3s ease-out;
      `;

        // Icon
        const icon = document.createElement('span');
        icon.className = 'material-icons';
        icon.textContent = style.icon;
        icon.style.cssText = `font-size: 24px; color: ${style.color}; flex-shrink: 0;`;

        // Message
        const msgDiv = document.createElement('div');
        msgDiv.innerHTML = message;
        msgDiv.style.cssText = `color: ${style.color}; font-size: 0.9rem; font-weight: 500; line-height: 1.4;`;

        // Close button
        const closeBtn = document.createElement('button');
        closeBtn.innerHTML = '<span class="material-icons" style="font-size:1.1rem; vertical-align:middle;">close</span>';
        closeBtn.title = "Close Message";
        closeBtn.style.cssText = `
        background: none;
        border: none;
        color: ${style.color};
        font-size: 18px;
        cursor: pointer;
        padding: 4px;
        margin-left: auto;
        opacity: 0.6;
        transition: opacity 0.2s;
      `;
        closeBtn.onmouseover = () => closeBtn.style.opacity = '1';
        closeBtn.onmouseout = () => closeBtn.style.opacity = '0.6';
        closeBtn.onclick = () => toast.remove();

        toast.appendChild(icon);
        toast.appendChild(msgDiv);
        toast.appendChild(closeBtn);

        document.body.appendChild(toast);

        // Auto hide after delay
        const autoHideMs = type === 'danger' ? 6000 : 5000;
        setTimeout(() => {
            if (toast.parentNode) {
                toast.style.animation = 'slideUp 0.3s ease-in';
                setTimeout(() => toast.remove(), 300);
            }
        }, autoHideMs);
    }

    // Add toast animations
    const toastStyles = document.createElement('style');
    toastStyles.textContent = `
      @keyframes slideDown {
        from { transform: translateX(-50%) translateY(-100%); opacity: 0; }
        to { transform: translateX(-50%) translateY(0); opacity: 1; }
      }
      @keyframes slideUp {
        from { transform: translateX(-50%) translateY(0); opacity: 1; }
        to { transform: translateX(-50%) translateY(-100%); opacity: 0; }
      }
    `;
    document.head.appendChild(toastStyles);

    // Popup modal (dismissible by click-away or close button)
    function showPopup(message, options = {}) {
        const { autoClose = false, timeout = 4000, buttons = [], wide = false } = options;
        // Create overlay
        const overlay = document.createElement('div');
        overlay.className = 'popup-overlay';
        overlay.tabIndex = -1;
        const content = document.createElement('div');
        content.className = 'popup-content';
        if (wide) content.classList.add('wide');
        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.className = 'popup-close';
        closeBtn.setAttribute('aria-label', 'Close');
        closeBtn.title = 'Close';
        closeBtn.innerHTML = '<span class="material-icons" style="font-size:1.35rem;line-height:1;display:block;">close</span>';
        closeBtn.addEventListener('click', () => { try { document.body.removeChild(overlay); } catch (e) { } });
        content.appendChild(closeBtn);
        const p = document.createElement('div');
        p.innerHTML = message;
        content.appendChild(p);
        // Add custom buttons if provided
        if (buttons.length > 0) {
            const buttonContainer = document.createElement('div');
            buttonContainer.style.cssText = 'margin-top: 1rem; display: flex; gap: 0.5rem; justify-content: flex-end;';
            buttons.forEach(btn => {
                const btnEl = document.createElement('button');
                btnEl.textContent = btn.text;
                btnEl.className = 'btn btn-small';
                btnEl.style.width = 'auto';
                btnEl.addEventListener('click', () => {
                    if (btn.onClick) btn.onClick();
                    try { document.body.removeChild(overlay); } catch (e) { }
                });
                buttonContainer.appendChild(btnEl);
            });
            content.appendChild(buttonContainer);
        }
        overlay.appendChild(content);
        // click-away to close
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                try { document.body.removeChild(overlay); } catch (e) { }
            }
        });
        document.body.appendChild(overlay);
        if (autoClose) setTimeout(() => { try { document.body.removeChild(overlay); } catch (e) { } }, timeout);
    }
    function closePopups() {
        try {
            document.querySelectorAll('.popup-overlay').forEach(el => el.parentNode && el.parentNode.removeChild(el));
        } catch (e) { }
    }
    // Server Communication
    function runServerFunction(functionName) {
        var args = Array.prototype.slice.call(arguments, 1);
        console.log('Calling:', functionName);
        return new Promise(function (resolve, reject) {
            if (typeof google === 'undefined' || !google.script || !google.script.run) {
                reject(new Error('Google Apps Script environment not detected'));
                return;
            }
            var runner = google.script.run
                .withSuccessHandler(function (res) {
                    console.log('runServerFunction success:', functionName, res);
                    if (res && typeof res === 'object' && res.success === false) {
                        if (res.code === 'SESSION_CONFLICT' || functionName === 'validateSessionHeartbeat') {
                            resolve(res);
                        } else {
                            reject(new Error(res.message || 'Operation failed'));
                        }
                    } else {
                        resolve(res);
                    }
                })
                .withFailureHandler(function (err) {
                    console.error('runServerFunction failure:', functionName, err);
                    reject(new Error(err.message || err));
                });

            runner[functionName].apply(runner, args);
        });
    }
    // [NEW] Check for available updates
    function checkForUpdates() {
        runServerFunction('getServerVersion')
            .then(response => {
                const serverVersion = response?.version || '';
                if (!serverVersion) return;
                // First run: just store the version, do not reload
                if (!lastSeenServerVersion) {
                    lastSeenServerVersion = serverVersion;
                    localStorage.setItem('hss_last_server_version', serverVersion);
                    return;
                }
                // Subsequent runs: prompt user to refresh only if version changed
                if (serverVersion !== lastSeenServerVersion) {
                    lastSeenServerVersion = serverVersion;
                    localStorage.setItem('hss_last_server_version', serverVersion);

                    // [NEW] Clear cache to force fresh data (fixes stale portal configs)
                    if (state.currentUser?.email) {
                        localStorage.removeItem('hss_cache_' + state.currentUser.email);
                        console.log('Cache cleared due to version mismatch:', serverVersion);
                    }

                    const targetAlert = state.currentView === 'adminDashboard' ? 'admin-alert' : (state.currentView === 'studentDashboard' ? 'student-dashboard-alert' : 'auth-alert');
                    showAlert(targetAlert, 'A new update is available. Please refresh to get the latest version.', 'info');
                }
            })
            .catch(err => console.log('Version check failed (ok to ignore):', err.message));
    }

    /**
     * [IMPROVED] Secure Portal Switcher
     * Handles one-way secure SSO token generation and frame redirection.
     */
    async function switchPortal(portalId, isDirect = false) {
        if (!state.currentUser?.email) return;

        // Show overlay
        const overlay = document.getElementById('redirectOverlay');
        const bar = document.getElementById('redirectProgressBar');
        const pctText = document.getElementById('redirectPercent');
        const targetName = document.getElementById('targetPortalName');

        const portalNames = {
            practicals: 'Practicals Portal',
            automation: 'Automation Portal',
            advanced_reports: 'Reports Portal',
            fund_distribution: 'Distribution Portal',
            hub: 'Admission Hub',
            attendance: 'Attendance Portal'
        };

        if (targetName) targetName.innerText = portalNames[portalId] || 'Portal';
        if (overlay) overlay.classList.add('visible');
        if (bar) bar.style.width = '0%';
        if (pctText) pctText.innerText = '0%';

        let progress = 0;
        const interval = setInterval(() => {
            if (progress < 85) {
                progress += Math.random() * 15;
                if (progress > 85) progress = 85;
                if (bar) bar.style.width = progress + '%';
                if (pctText) pctText.innerText = Math.round(progress) + '%';
            }
        }, 200);

        // [SECURITY] Role-based Portal Access Control
        const role = state.currentUser.role;
        const isAdmin = (role === 'Admin' || role === 'SuperAdmin' || role === 'President');

        // ... existing logic but wrap with clearInterval ...
        const cleanup = () => {
            clearInterval(interval);
            if (overlay) overlay.classList.remove('visible');
        };

        // Teachers can access whitelisted portals, dashboard, or 'hub'
        const teacherAllowedPortals = ['practicals', 'attendance', 'dashboard', 'hub'];
        if (role === 'Teacher' && !teacherAllowedPortals.includes(portalId)) {
            cleanup();
            showAlert('admin-alert', 'Access Denied: You do not have permission to access this portal.', 'danger');
            return;
        }

        // Students cannot access ANY satellite portals directly via this function
        if (role === 'Student' && portalId !== 'hub') {
            cleanup();
            showAlert('auth-alert', 'Access Denied: Administrative action restricted.', 'danger');
            return;
        }

        // If 'hub' is requested, redirect to the main hub (self or known URL)
        if (portalId === 'hub') {
            cleanup();
            const hubUrl = state.adminData.settings?.hub_url || window.location.origin + window.location.pathname;
            window.location.href = hubUrl;
            return;
        }

        // If 'dashboard' requested, route locally to the appropriate dashboard
        if (portalId === 'dashboard') {
            cleanup();
            if (role === 'Teacher') {
                state.currentView = 'teacherDashboard';
            } else if (isAdmin) {
                state.currentView = 'adminDashboard';
            } else {
                state.currentView = 'studentDashboard';
            }
            window.history.pushState({ view: state.currentView }, '');
            render();
            return;
        }

        // [NEW] Local Portal Handling
        if (portalId === 'attendance') {
            cleanup();
            state.currentView = 'attendance';
            render();
            return;
        }
        if (portalId === 'practicals') {
            cleanup();
            state.currentView = 'practicals';
            render();
            return;
        }

        // Retrieve portal configuration from settings
        const portals = state.adminData.settings?.portals || {};
        let portal = portals[portalId];

        // If config is missing, try a background refresh first
        if (!portal || !portal.url) {
            console.warn('Portal config missing, attempting background refresh...');
            if (!overlay) showAlert('admin-alert', 'Connecting to gateway... please wait.', 'info');
            // setLoading(true); // Don't use setLoading if overlay is visible

            try {
                const refreshed = await runServerFunction('getInitialDataForUser', state.currentUser);
                handleInitialData(refreshed);
                const retryPortals = state.adminData.settings?.portals || {};
                portal = retryPortals[portalId];
            } catch (e) {
                console.error('Handshake refresh failed', e);
            }

            if (!portal || !portal.url) {
                cleanup();
                showAlert('admin-alert', 'Portal configuration not found. Please refresh the page.', 'danger');
                return;
            }
        }

        try {
            // Request a one-time SSO token from the server
            console.log('Generating SSO token for:', state.currentUser.email);
            const response = await runServerFunction('generateSSOToken', state.currentUser.email);
            console.log('SSO Response:', response);

            // Extract token (handle standardResponse wrapper if present)
            const token = (response && response.token) ? response.token : (response && response.data && response.data.token);

            if (token) {
                clearInterval(interval);
                if (bar) bar.style.width = '100%';
                if (pctText) pctText.innerText = '100%';

                const targetUrl = portal.url + (portal.url.includes('?') ? '&' : '?') + 'token=' + token;
                
                setTimeout(() => {
                    if (isDirect) {
                        try {
                            window.top.location.href = targetUrl;
                            setTimeout(() => { if (overlay) overlay.classList.remove('visible'); }, 1500);
                        } catch (navErr) {
                            window.location.href = targetUrl;
                            setTimeout(() => { if (overlay) overlay.classList.remove('visible'); }, 1500);
                        }
                    } else {
                        window.open(targetUrl, '_blank');
                        setTimeout(() => { if (overlay) overlay.classList.remove('visible'); }, 1500);
                    }
                }, 300);
            } else {
                cleanup();
                showAlert('admin-alert', 'Failed to generate access token. Please try again.', 'danger');
            }
        } catch (error) {
            console.error('Portal Switch Error:', error);
            cleanup();
            showAlert('admin-alert', 'Portal Gateway Error: ' + error.message, 'danger');
        }
    }

    // Data Handlers
    function renderAdminPermissions() {
        const container = document.getElementById('adminPermissionsContainer');
        const listEl = document.getElementById('adminPermissionsList');
        if (!container || !listEl) return;

        // Only show if we are on the Controls (panel) tab
        const activeTabBtn = document.querySelector('#adminTabs .active[data-tab]');
        const currentTab = activeTabBtn ? activeTabBtn.dataset.tab : 'apps';

        if (currentTab !== 'panel') {
            container.style.display = 'none';
            return;
        }

        container.style.display = 'block';

        const users = state.adminData?.userProfiles || {};
        const SUPER_ADMIN_EMAIL = 'adm.exam.hss.shangus@gmail.com';

        let html = '';
        const allTabs = [
            { id: 'panel', name: 'Controls' },
            { id: 'subjects', name: 'Subjects' },
            { id: 'email', name: 'Email' },
            { id: 'activity', name: 'Activity' },
            { id: 'whitelist', name: 'Whitelist' },
            { id: 'tools', name: 'Tools' },
            { id: 'otps', name: 'OTPs' }
        ];

        const adminTabsMap = state.adminData?.settings?.admin_tabs || {};
        let hasAdmins = false;

        Object.keys(users).forEach(email => {
            const userRole = (users[email]?.role || '').toLowerCase();
            const isAdminType = userRole === 'admin' || userRole === 'superadmin' || userRole === 'president';

            if (isAdminType && email !== SUPER_ADMIN_EMAIL && email !== state.currentUser?.email?.toLowerCase()) {
                hasAdmins = true;
                const name = users[email].name || 'Unknown User';
                const allowedTabs = adminTabsMap[email] || [];

                html += `
                    <div style="background:var(--bg); border:1px solid var(--border); border-radius:6px; padding:0.5rem;">
                        <div style="font-weight:600; font-size:0.8rem; border-bottom:1px solid var(--border); padding-bottom:0.25rem; margin-bottom:0.5rem; display:flex; justify-content:space-between;">
                            <span>${escapeHtmlStr(name)} <span style="color:var(--text-secondary); font-weight:normal;">(${escapeHtmlStr(email)})</span></span>
                        </div>
                        <div style="display:flex; flex-wrap:wrap; gap:0.5rem;">
                `;

                allTabs.forEach(tab => {
                    const checked = allowedTabs.includes(tab.id) ? 'checked' : '';
                    html += `
                        <div class="toggle-group" style="background:var(--bg); border:1px solid var(--border); padding:2px 8px; border-radius:4px; min-width:110px;">
                          <span style="font-weight: 500; font-size:0.75rem; flex-grow:1;">${tab.name}</span>
                          <label class="switch" style="transform: scale(0.8); margin:0;">
                            <input type="checkbox" class="admin-tab-checkbox" data-email="${email}" value="${tab.id}" ${checked}>
                            <span class="slider"></span>
                          </label>
                        </div>
                    `;
                });

                html += `
                        </div>
                    </div>
                `;
            }
        });

        if (!hasAdmins) {
            listEl.innerHTML = '<div style="font-size:0.8rem; color:var(--text-secondary); text-align:center;">No other admins found.</div>';
            return;
        }
        listEl.innerHTML = html;

        const saveBtn = document.getElementById('saveAdminPermissionsBtn');
        if (saveBtn) {
            saveBtn.onclick = () => {
                const newPermissions = {};
                const checkboxes = document.querySelectorAll('.admin-tab-checkbox');
                checkboxes.forEach(cb => {
                    const em = String(cb.getAttribute('data-email') || '').trim();
                    const val = String(cb.value || '').trim();
                    if (!newPermissions[em]) newPermissions[em] = [];
                    if (cb.checked && val) newPermissions[em].push(val);
                });

                const originalText = saveBtn.textContent;
                saveBtn.textContent = 'Saving...';
                saveBtn.disabled = true;

                runServerFunction('updateAdminTabPermissions', newPermissions, state.currentUser)
                    .then(res => {
                        if (res.success) {
                            showAlert('admin', 'Admin permissions updated successfully.', 'success');
                            if (!state.adminData.settings) state.adminData.settings = {};
                            state.adminData.settings.admin_tabs = newPermissions;
                        } else {
                            throw new Error(res.message);
                        }
                    })
                    .catch(err => {
                        showAlert('admin', 'Error: ' + err.message, 'error');
                    })
                    .finally(() => {
                        saveBtn.textContent = originalText;
                        saveBtn.disabled = false;
                    });
            };
        }
    }


    function handleInitialData(data, redirect = true) {
        console.log("Data received from server:", data);
        try {
            if (!data || !data.profile) {
                console.warn('[AUTH] Missing profile in data packet, retrying...');
                // If we have data but no profile, it's a structural error in return packet
                if (data && !data.profile) {
                    throw new Error('Incomplete data received from server. Please log out and log back in.');
                }
                return;
            }

            console.log('[AUTH] Initializing portal with user data for:', data.profile.email);
            state.currentUser = data.profile;
            state.profile = data.profile; // Sync both for legacy and new code compatibility
            sessionStorage.setItem('hss_user', JSON.stringify(state.currentUser));
            startSessionHeartbeat();

            const role = state.currentUser.role || 'Student';

            // Populate global state objects
            state.settings = data.settings || {};
            state.formStructure = data.formStructure || [];
            state.subjectsConfig = data.subjectsConfig || [];
            state.applications = data.applications || [];

            // [FIX] Role-specific data mapping - don't blindly overwrite state.adminData for all roles
            const lowRole = role.toLowerCase();
            if (lowRole === 'admin' || lowRole === 'superadmin' || lowRole === 'president') {
                // For admin roles, merge server data into adminData, preserving client-only fields like page
                const preservedPage = state.adminData.page || 1;
                state.adminData = data;
                state.adminData.page = preservedPage;
                state.adminData.applications = data.applications || [];
                state.adminData.filteredApplications = [...(data.applications || [])];
                state.adminData.userProfiles = data.userProfiles || {};
                state.adminData.photoMap = data.photoMap || {};
                state.adminData.lastModified = data.lastModified;
                state.adminData.allHeaders = data.allHeaders || [];
                console.log(`[DATA] Admin data loaded: ${state.adminData.applications.length} applications, ${Object.keys(state.adminData.userProfiles).length} profiles`);
                try { ensureAdminActivityLoaded(); } catch (e) { }
                if (redirect) {
                    state.currentView = 'adminDashboard';
                    window.history.pushState({ view: 'adminDashboard' }, '');
                }
            } else if (lowRole === 'teacher') {
                // For non-admin roles: update adminData properties
                // WITHOUT overwriting the entire object (preserves structure for shared utilities)
                state.adminData.settings = data.settings || state.adminData.settings || {};
                state.adminData.appVersion = data.appVersion || state.adminData.appVersion;
                console.log(`[DATA] Teacher data loaded: formStructure: ${state.formStructure.length} fields`);
                if (redirect) {
                    // [MODIFIED] All teachers: show selection dashboard first
                    console.log('[ROUTING] Teacher session active, showing selection dashboard.');
                    state.currentView = 'teacherDashboard';
                    window.history.pushState({ view: 'teacherDashboard' }, '');
                    render();
                    setLoading(false);
                    return;
                }
            } else {
                // For Student: update adminData properties
                // WITHOUT overwriting the entire object (preserves structure for shared utilities)
                state.adminData.settings = data.settings || state.adminData.settings || {};
                state.adminData.appVersion = data.appVersion || state.adminData.appVersion;
                console.log(`[DATA] ${role} data loaded: ${state.applications.length} applications, formStructure: ${state.formStructure.length} fields`);
                // Student role default path
                if (redirect) {
                    state.currentView = 'studentDashboard';
                    window.history.pushState({ view: 'studentDashboard' }, '');
                }
            }

            // Sync navigation history for hub redirection
            if (window.redirectTo && lowRole !== 'teacher') {
                const target = window.redirectTo;
                window.redirectTo = null;
                window.location.href = target;
                return;
            }

            // Final render pass - Ensure a clean transition
            state.currentView = lowRole === 'student' ? 'studentDashboard' : (lowRole === 'teacher' ? 'teacherDashboard' : 'adminDashboard');
            console.log(`[ROUTING] Finalizing view to: ${state.currentView}`);
            render();

            // Failsafe role switcher rendering
            try {
                if (typeof window.renderRoleSwitcher === 'function') {
                    window.renderRoleSwitcher();
                }
            } catch (e) { console.warn('[UI] roleSwitcher render failed:', e); }

            setLoading(false);
            // Hide prominent loader if still visible
            const pLoader = document.getElementById('prominentGlobalLoader');
            if (pLoader) pLoader.classList.add('hidden');
        } catch (err) {
            console.error('[CRITICAL] handleInitialData error:', err);
            setLoading(false);
            const pLoader = document.getElementById('prominentGlobalLoader');
            if (pLoader) pLoader.classList.add('hidden');
            showGlobalError(`Failed to load portal: ${err.message}. This might be due to a session timeout or server-side update.`);
        }
    }
    function handleError(error) {
        console.error('Error:', error);
        setLoading(false);
        const msg = error?.message || 'An error occurred';
        if (msg === 'Login cancelled.' || msg === 'Cancelled') {
            return;
        }
        if (state.currentView === 'auth') showAlert('auth-alert', msg, 'danger');
        else if (state.currentView === 'formEditor') showAlert('form-alert', msg, 'danger');
        else if (state.currentView === 'adminDashboard') showAlert('admin-alert', msg, 'danger');
        else if (state.currentView === 'studentDashboard') showAlert('student-dashboard-alert', msg, 'danger');
        if (msg.includes('Invalid user') || msg.includes('Permission')) {
            handleLogout();
        }
    }
    // Auth Handlers - Unchanged
    function initLoginTabs() {
        const tabs = document.querySelectorAll('.login-tab');
        const loginUserLabel = document.getElementById('loginUserLabel');
        const loginEmail = document.getElementById('loginEmail');
        const logoImg = document.getElementById('loginHeaderLogo');

        // Auto-set logo if available in settings
        if (logoImg && state.settings?.logoUrl) {
            logoImg.src = state.settings.logoUrl;
        }

        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                currentLoginRole = tab.dataset.role;

                // User corrected: Students also use Email
                loginUserLabel.innerHTML = 'Email Address <span class="required">*</span>';
                loginEmail.placeholder = ' ';
                const loginPass = document.getElementById('loginPassword');
                if (loginPass) loginPass.placeholder = ' ';

                // [NEW] Dynamic Registration Link
                const showRegister = document.getElementById('showRegister');
                if (showRegister) {
                    if (currentLoginRole === 'student') {
                        showRegister.style.display = 'inline-block';
                        showRegister.textContent = 'Create Student Account';
                    } else if (currentLoginRole === 'teacher') {
                        showRegister.style.display = 'inline-block';
                        showRegister.textContent = 'Register as teacher';
                    } else {
                        showRegister.style.display = 'none'; // No self-reg for Admin
                    }
                }
            });
        });
    }

    function handleLogin(e) {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value.trim();
        const password = document.getElementById('loginPassword').value;
        const keepLoggedIn = document.getElementById('keepMeLoggedIn')?.checked || false;
        const deviceId = getDeviceId();

        setBtnLoading(dom.loginBtn, true, 'Logging in...');
        if (dom.logoSpinnerContainer) dom.logoSpinnerContainer.classList.add('loading');
        if (dom.loginEmail) dom.loginEmail.disabled = true;
        if (dom.loginPassword) dom.loginPassword.disabled = true;

        try {
            // Only clear portal-specific session data, preserve settings like theme
            ['hss_user', 'hss_token', 'hss_persist_token'].forEach(k => localStorage.removeItem(k));
        } catch (e) { }

        // [NEW] Special handling for President role if in president mode
        const loginContainer = document.getElementById('loginPortalContainer');
        const finalRole = loginContainer.classList.contains('president-mode') ? 'President' : currentLoginRole;

        runServerFunction('loginUser', email, password, keepLoggedIn, deviceId, finalRole, false)
            .then(response => {
                if (response?.code === 'SESSION_CONFLICT') {
                    return showConfirm(response.message, 'Active Session Detected')
                        .then(() => {
                            setBtnLoading(dom.loginBtn, true, 'Logging in and terminating other sessions...');
                            return runServerFunction('loginUser', email, password, keepLoggedIn, deviceId, finalRole, true);
                        })
                        .catch(() => {
                            throw new Error('Login cancelled.');
                        });
                }
                return response;
            })
            .then(response => {
                if (response?.success) {
                    state.currentUser = response.user;
                    if (state.loginTarget === 'Admin' && response.user?.role !== 'Admin') {
                        throw new Error('Admin account required for Admin Login');
                    }
                    sessionStorage.setItem('hss_user', JSON.stringify(response.user));
                    if (keepLoggedIn && response.sessionToken) {
                        localStorage.setItem('hss_persist_token', response.sessionToken);
                        localStorage.setItem('hss_device_id', deviceId);
                    } else {
                        localStorage.removeItem('hss_persist_token');
                        if (response.sessionToken) {
                            sessionStorage.setItem('hss_session_token', response.sessionToken);
                        }
                    }
                    if (response.sessionToken) {
                        localStorage.setItem('hss_active_token', response.sessionToken);
                    }
                    if (response.initialData) {
                        return response.initialData;
                    }
                    return runServerFunction('getInitialDataForUser', response.user);
                }
                throw new Error(response?.message || 'Login failed');
            })
            .then(handleInitialData)
            .catch(handleError)
            .finally(() => {
                setBtnLoading(dom.loginBtn, false, 'Log In');
                if (dom.logoSpinnerContainer) dom.logoSpinnerContainer.classList.remove('loading');
                if (dom.loginEmail) dom.loginEmail.disabled = false;
                if (dom.loginPassword) dom.loginPassword.disabled = false;
            });
    }
    function handleEmailCheck(e, role = 'student') {
        const email = e.target.value.trim();
        if (!email || !validateEmail(email)) {
            dom.emailCheckHint.textContent = '';
            dom.registerEmail.classList.remove('is-invalid');
            return;
        }
        dom.emailCheckHint.innerHTML = '<span class="spinner-small" style="width:10px; height:10px; border-width:1.5px; margin-right:4px; vertical-align:middle; display:inline-block;"></span> Checking email...';
        dom.emailCheckHint.className = 'field-hint';
        dom.sendOtpBtn.disabled = true;
        runServerFunction('checkEmailRegistered', email, role)
            .then(response => {
                if (response?.exists) {
                    dom.emailCheckHint.textContent = 'Email already registered';
                    dom.emailCheckHint.className = 'field-hint error';
                    dom.registerEmail.classList.add('is-invalid');
                    dom.sendOtpBtn.disabled = true;
                } else {
                    dom.emailCheckHint.innerHTML = 'Email is available!<br><em>Please ensure that the email address provided is correct, as OTP verification and the admission form will be sent to this email.</em>';
                    dom.emailCheckHint.className = 'field-hint success';
                    dom.registerEmail.classList.remove('is-invalid');
                    checkAllFieldsAndEnableButton();
                }
            })
            .catch(err => {
                dom.emailCheckHint.textContent = 'Could not verify email.';
                dom.emailCheckHint.className = 'field-hint error';
                dom.registerEmail.classList.add('is-invalid');
                dom.sendOtpBtn.disabled = true;
            });
    }

    function handleMobileCheck(e) {
        const mobile = e.target.value.trim();
        const mobileHint = document.getElementById('mobileCheckHint');
        const mobileInput = document.getElementById('registerMobile');
        const email = dom.registerEmail.value.trim();

        if (!mobile || !/^[0-9]{10}$/.test(mobile)) {
            mobileHint.textContent = '';
            mobileInput.classList.remove('is-invalid');
            return;
        }

        mobileHint.innerHTML = '<span class="spinner-small" style="width:10px; height:10px; border-width:1.5px; margin-right:4px; vertical-align:middle; display:inline-block;"></span> Checking mobile...';
        mobileHint.className = 'field-hint';
        dom.sendOtpBtn.disabled = true;

        runServerFunction('checkMobileRegistered', mobile, email)
            .then(response => {
                if (response?.exists && !response?.whitelisted) {
                    mobileHint.textContent = 'Mobile already registered';
                    mobileHint.className = 'field-hint error';
                    mobileInput.classList.add('is-invalid');
                    dom.sendOtpBtn.disabled = true;
                } else if (response?.whitelisted) {
                    mobileHint.textContent = 'Duplicate mobile allowed (admin)';
                    mobileHint.className = 'field-hint success';
                    mobileInput.classList.remove('is-invalid');
                    checkAllFieldsAndEnableButton();
                } else {
                    mobileHint.innerHTML = 'Mobile No. is available!<br><em>Please note that the mobile number provided is correct, as it will be used for communication whenever required, including during the admission process.</em>';
                    mobileHint.className = 'field-hint success';
                    mobileInput.classList.remove('is-invalid');
                    checkAllFieldsAndEnableButton();
                }
            })
            .catch(err => {
                mobileHint.textContent = 'Could not verify mobile.';
                mobileHint.className = 'field-hint error';
                mobileInput.classList.add('is-invalid');
                dom.sendOtpBtn.disabled = true;
            });
    }

    function checkAllFieldsAndEnableButton() {
        const emailOk = dom.emailCheckHint.classList.contains('success');
        const mobileOk = document.getElementById('mobileCheckHint')?.classList.contains('success');
        dom.sendOtpBtn.disabled = !(emailOk && mobileOk);
    }
    function validateEmail(email) {
        return String(email)
            .toLowerCase()
            .match(
                /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|.(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
            );
    }
    function validatePasswordMatch() {
        const password = dom.registerPassword.value;
        const confirm = dom.confirmPassword.value;
        if (!confirm) {
            dom.passwordMatchHint.textContent = '';
            dom.confirmPassword.classList.remove('is-invalid');
            dom.registerBtn.disabled = true;
            return;
        }
        if (password === confirm) {
            dom.passwordMatchHint.textContent = 'Passwords match';
            dom.passwordMatchHint.className = 'field-hint success';
            dom.confirmPassword.classList.remove('is-invalid');
            dom.registerBtn.disabled = false;
        } else {
            dom.passwordMatchHint.textContent = 'Passwords do not match';
            dom.passwordMatchHint.className = 'field-hint error';
            dom.confirmPassword.classList.add('is-invalid');
            dom.registerBtn.disabled = true;
        }
    }
    // [NEW] OTP Timer logic to manage daily quota efficiently
    let otpTimers = {};
    function startOtpTimer(timerId, resendBtnId, waitTimeSeconds = 60) {
        if (otpTimers[timerId]) clearInterval(otpTimers[timerId]);
        const timerEl = document.getElementById(timerId);
        const resendBtn = document.getElementById(resendBtnId);
        if (!timerEl || !resendBtn) return;
        resendBtn.style.display = 'none';
        timerEl.style.display = 'inline';
        timerEl.style.fontWeight = '600';
        timerEl.style.color = 'var(--text-secondary)';
        let timeLeft = waitTimeSeconds;
        const updateTimer = () => {
            const mins = Math.floor(timeLeft / 60);
            const secs = timeLeft % 60;
            timerEl.textContent = `Retry in ${mins}:${secs.toString().padStart(2, '0')}`;
            if (timeLeft <= 0) {
                clearInterval(otpTimers[timerId]);
                timerEl.style.display = 'none';
                resendBtn.style.display = 'inline';
            }
            timeLeft--;
        };
        updateTimer();
        otpTimers[timerId] = setInterval(updateTimer, 1000);
    }
    function handleResendOtp(e) {
        handleSendOtp(e, true);
    }
    function handleResendResetOtp(e) {
        handleSendResetOtp(e, true);
    }
    function handleSendOtp(e, isResend = false) {
        if (e) e.preventDefault();
        const email = dom.registerEmail.value.trim();
        const mobile = document.getElementById('registerMobile').value.trim();
        const name = document.getElementById('registerName').value.trim();

        if (!name) {
            showAlert('auth-alert', 'Please enter your full name.', 'danger');
            return;
        }
        if (!email || !validateEmail(email)) {
            showAlert('auth-alert', 'Please enter a valid email.', 'danger');
            return;
        }
        if (!mobile || !/^[0-9]{10}$/.test(mobile)) {
            showAlert('auth-alert', 'Please enter a valid 10-digit mobile number.', 'danger');
            return;
        }

        // [NEW] Teacher Assignment Validation
        if (registrationRole === 'teacher') {
            const cls = document.getElementById('teacherInitialClass').value;
            const sub = document.getElementById('teacherInitialSubject').value.trim();
            if (!cls || !sub) {
                showAlert('auth-alert', 'Teacher: Please specify Class and Subject assignments.', 'danger');
                return;
            }
        }

        setBtnLoading(dom.sendOtpBtn, true, 'Sending...');
        runServerFunction('sendRegistrationOTP', email, name, mobile)
            .then(response => {
                if (response.success) {
                    showAlert('auth-alert', response.message, 'success');
                    startOtpTimer('registerOtpTimer', 'resendRegisterOtpBtn', 60);
                    dom.registerStep1.classList.add('hidden');
                    dom.registerStep2.classList.remove('hidden');
                    document.getElementById('otpNameDisplay').textContent = name;
                    document.getElementById('otpEmailDisplay').textContent = email;
                    document.getElementById('otpMobileDisplay').textContent = mobile;
                    dom.registerBtn.disabled = true;
                } else {
                    throw new Error(response.message);
                }
            })
            .catch(err => {
                handleError(err);
                if (err.message && err.message.includes('10 minutes')) {
                    startOtpTimer('registerOtpTimer', 'resendRegisterOtpBtn', 600);
                } else if (err.message && err.message.includes('Please wait')) {
                    const match = err.message.match(/wait (\d+) seconds/);
                    if (match && match[1]) {
                        startOtpTimer('registerOtpTimer', 'resendRegisterOtpBtn', parseInt(match[1]));
                    }
                }
            })
            .finally(() => {
                setBtnLoading(dom.sendOtpBtn, false, 'Send Verification OTP');
            });
    }
    function handleRegister(e) {
        e.preventDefault();
        const name = document.getElementById('registerName').value.trim();
        const email = dom.registerEmail.value.trim();
        const mobile = document.getElementById('registerMobile').value.trim();
        const otp = document.getElementById('registerOtp').value.trim();
        const password = dom.registerPassword.value;
        if (password !== dom.confirmPassword.value) {
            showAlert('auth-alert', 'Passwords do not match.', 'danger');
            return;
        }

        let initialClass = '';
        let initialSubject = '';
        if (registrationRole === 'teacher') {
            initialClass = document.getElementById('teacherInitialClass').value;
            initialSubject = document.getElementById('teacherInitialSubject').value.trim();
        }

        setBtnLoading(dom.registerBtn, true, 'Creating Account...');
        runServerFunction('registerUser', name, email, mobile, password, otp, registrationRole, initialClass, initialSubject)
            .then(response => {
                if (response?.success) {
                    let msg = response.message;
                    if (response.formNumber) {
                        msg += ` Your form number is: ${response.formNumber}`;
                    }
                    showAlert('auth-alert', msg, 'success');
                    dom.registerForm.classList.add('hidden');
                    dom.loginForm.classList.remove('hidden');
                    document.getElementById('loginEmail').value = email;
                    // Clear any existing session to prevent cross-account dashboard
                    state.currentUser = null;
                    sessionStorage.removeItem('hss_user');
                    state.applications = [];
                    state.profile = {};
                    // Reset register form
                    dom.registerForm.reset();
                    dom.registerStep2.classList.add('hidden');
                    dom.registerStep1.classList.remove('hidden');
                    dom.passwordMatchHint.textContent = '';
                    dom.emailCheckHint.textContent = '';
                    document.getElementById('mobileCheckHint').textContent = '';

                    // [NEW] Clear teacher-specific fields
                    if (document.getElementById('teacherInitialClass')) document.getElementById('teacherInitialClass').value = '';
                    if (document.getElementById('teacherInitialSubject')) document.getElementById('teacherInitialSubject').value = '';
                    registrationRole = 'student'; // Reset global role
                } else throw new Error(response?.message || 'Registration failed');
            })
            .catch(handleError)
            .finally(() => setBtnLoading(dom.registerBtn, false, 'Create Account'));
    }
    // [NEW] Forgot Password Handlers
    function validateResetPasswordMatch() {
        const password = document.getElementById('resetPassword').value;
        const confirm = document.getElementById('resetConfirmPassword').value;
        if (!confirm) {
            dom.resetPasswordMatchHint.textContent = '';
            document.getElementById('resetConfirmPassword').classList.remove('is-invalid');
            dom.resetPasswordBtn.disabled = true;
            return;
        }
        if (password === confirm) {
            dom.resetPasswordMatchHint.textContent = 'Passwords match';
            dom.resetPasswordMatchHint.className = 'field-hint success';
            document.getElementById('resetConfirmPassword').classList.remove('is-invalid');
            dom.resetPasswordBtn.disabled = false;
        } else {
            dom.resetPasswordMatchHint.textContent = 'Passwords do not match';
            dom.resetPasswordMatchHint.className = 'field-hint error';
            document.getElementById('resetConfirmPassword').classList.add('is-invalid');
            dom.resetPasswordBtn.disabled = true;
        }
    }

    /**
     * Highlight required/invalid fields within a container (or whole document if no container).
     * Uses HTML5 validity and some custom rules (data-validate attributes).
     * Returns true if valid, false if there were invalid fields.
     */
    function clearFieldErrors(container) {
        const root = container || document;
        root.querySelectorAll('.field-error').forEach(el => el.classList.remove('field-error'));
        root.querySelectorAll('.validation-tooltip').forEach(t => t.remove());
    }

    function highlightInvalidFields(container) {
        const root = container || document;
        clearFieldErrors(root);
        const selector = 'input[required],textarea[required],select[required],[data-validate]';
        const elems = Array.from(root.querySelectorAll(selector));
        let invalidCount = 0;
        elems.forEach(el => {
            let valid = true;
            const val = (el.value || '').toString().trim();
            if (el.hasAttribute('required')) {
                if (!val) valid = false;
            }
            const vtype = el.dataset && el.dataset.validate ? el.dataset.validate : null;
            if (valid && vtype) {
                if (vtype === 'email' && val && !validateEmail(val)) valid = false;
                if (vtype === 'phone' && val && !/^\d{10}$/.test(val.replace(/\D/g, ''))) valid = false;
                if (vtype === 'number' && val && isNaN(Number(val))) valid = false;
            }
            if (!valid) {
                invalidCount++;
                el.classList.add('field-error');
                const msg = document.createElement('div');
                msg.className = 'validation-tooltip';
                msg.textContent = el.dataset.validateMessage || 'Please fill this required field correctly.';
                // prefer placing after input; fallback to parent
                if (el.parentElement) el.parentElement.appendChild(msg);
            }
        });
        return invalidCount === 0;
    }

    // Delegate submit validation for forms
    document.addEventListener('submit', function (e) {
        try {
            const form = e.target;
            if (!(form && form.nodeName === 'FORM')) return;
            const ok = highlightInvalidFields(form);
            if (!ok) {
                e.preventDefault();
                e.stopPropagation();
                showToast('Please correct highlighted fields.', 'warning');
                // focus first invalid
                const first = form.querySelector('.field-error'); if (first) first.focus();
            }
        } catch (err) { console.warn('Form validation error:', err); }
    }, true);

    // Buttons with .btn-validate will run validation on their closest form before action
    document.addEventListener('click', function (e) {
        const btn = e.target.closest && e.target.closest('.btn-validate');
        if (!btn) return;
        const form = btn.closest('form') || document.querySelector('form');
        if (!form) return;
        const ok = highlightInvalidFields(form);
        if (!ok) {
            e.preventDefault();
            e.stopPropagation();
            showToast('Please correct highlighted fields.', 'warning');
            const first = form.querySelector('.field-error'); if (first) first.focus();
        }
    });
    function handleSendResetOtp(e, isResend = false) {
        if (e) e.preventDefault();
        const email = document.getElementById('forgotEmail').value.trim();
        if (!email || !validateEmail(email)) {
            showAlert('auth-alert', 'Please enter a valid, registered email.', 'danger');
            return;
        }
        setBtnLoading(dom.sendResetOtpBtn, true, 'Sending...');
        runServerFunction('sendPasswordResetOTP', email)
            .then(response => {
                if (response.success) {
                    showAlert('auth-alert', response.message, 'success');
                    startOtpTimer('resetOtpTimer', 'resendResetOtpBtn', 60);
                    dom.forgotStep1.classList.add('hidden');
                    dom.forgotStep2.classList.remove('hidden');
                    dom.resetOtpEmailDisplay.textContent = email;
                    dom.resetPasswordBtn.disabled = true;
                } else {
                    throw new Error(response.message);
                }
            })
            .catch(err => {
                handleError(err);
                if (err.message && err.message.includes('10 minutes')) {
                    startOtpTimer('resetOtpTimer', 'resendResetOtpBtn', 600);
                } else if (err.message && err.message.includes('Please wait')) {
                    const match = err.message.match(/wait (\d+) seconds/);
                    if (match && match[1]) {
                        startOtpTimer('resetOtpTimer', 'resendResetOtpBtn', parseInt(match[1]));
                    }
                }
            })
            .finally(() => {
                setBtnLoading(dom.sendResetOtpBtn, false, 'Send Reset OTP');
            });
    }
    function handleResetPassword(e) {
        e.preventDefault();
        const email = document.getElementById('forgotEmail').value.trim();
        const otp = document.getElementById('resetOtp').value.trim();
        const newPassword = document.getElementById('resetPassword').value;
        if (newPassword !== document.getElementById('resetConfirmPassword').value) {
            showAlert('auth-alert', 'Passwords do not match.', 'danger');
            return;
        }
        setBtnLoading(dom.resetPasswordBtn, true, 'Resetting...');
        runServerFunction('resetPasswordWithOTP', email, otp, newPassword)
            .then(response => {
                if (response?.success) {
                    showAlert('auth-alert', response.message, 'success');
                    dom.forgotPasswordForm.classList.add('hidden');
                    dom.loginForm.classList.remove('hidden');
                    document.getElementById('loginEmail').value = email;
                    // Reset forgot form
                    dom.forgotPasswordForm.reset();
                    dom.forgotStep2.classList.add('hidden');
                    dom.forgotStep1.classList.remove('hidden');
                    dom.resetPasswordMatchHint.textContent = '';
                } else throw new Error(response?.message || 'Reset failed');
            })
            .catch(handleError)
            .finally(() => setBtnLoading(document.getElementById('resetPasswordByOtpBtn'), false, 'Reset Password'));
    }
    function togglePassword(inputId, btnId) {
        const input = document.getElementById(inputId);
        const btn = document.getElementById(btnId);
        if (!input || !btn) return;
        const isPwd = input.type === 'password';
        input.type = isPwd ? 'text' : 'password';
        const icon = btn.querySelector('.material-icons');
        if (icon) {
            icon.textContent = isPwd ? 'visibility_off' : 'visibility';
        } else {
            btn.textContent = isPwd ? 'Hide' : 'Show';
        }
    }


    function handleLogout(isShared = false, message = '') {
        stopSessionHeartbeat();
        if (isShared) {
            // [SYNC] If logged out from another tab/device, just reset state and render
            state.currentUser = null;
            sessionStorage.removeItem('hss_user');
            localStorage.removeItem('hss_persist_token');
            sessionStorage.removeItem('hss_session_token');
            state.currentView = 'auth';
            render();
            if (message) {
                showAlert('auth-alert', message, 'danger');
            } else {
                showAlert('auth-alert', 'You have been logged out from this portal.', 'warning');
            }
            return;
        }
        try {
            const role = state.currentUser?.role;
            const isAdmin = (role === 'Admin' || role === 'SuperAdmin' || role === 'President');
            if (isAdmin) {
                runServerFunction('lockTempUnlocksForAdmin', state.currentUser).catch(() => { });
            }
        } catch (e) { }
        try {
            const token = localStorage.getItem('hss_persist_token') || sessionStorage.getItem('hss_session_token');
            const deviceId = localStorage.getItem('hss_device_id') || getDeviceId();
            if (token && deviceId) {
                runServerFunction('revokePersistentSession', token, deviceId).catch(() => { });
            }
        } catch (e) { }
        stopPolling();
        // Clear autosave for the current user before clearing
        try {
            if (state.currentUser?.email) {
                const key = `hss_form_autosave_${state.currentUser.email}`;
                localStorage.removeItem(key);
            }
            // Clear any unlock notification flags saved on this device
            localStorage.removeItem('hss_persist_token');
            sessionStorage.removeItem('hss_session_token');
            Object.keys(localStorage).forEach(k => { if (k.startsWith('unlock_notify_')) localStorage.removeItem(k); });
        } catch (e) { /* no-op */ }
        state.currentUser = null;
        sessionStorage.removeItem('hss_user');
        state.currentView = 'auth';
        state.applications = [];
        state.adminData = { applications: [], filteredApplications: [], settings: {}, subjectsConfig: {} };
        state.profile = {};
        state.subjectsConfig = {};
        // Clear any residual editor state
        state.isEditing = false;
        state.editingFormData = null;
        state.oldPhotoUrl = null;
        state.photoFileData = null;
        state.deletePhoto = false;
        state.selectedClassForNewApp = null;
        state.subjectError = false;
        dom.container.classList.remove('wide');
        // Ensure previous student dashboard HTML is cleared
        try { document.getElementById('studentAppStatus').innerHTML = ''; } catch (e) { }
        render();
    }
    function handleEditProfile() {
        showProfileModal()
            .then(profileData => {
                setLoading(true);
                runServerFunction('updateUserProfile', state.currentUser.email, profileData.name, profileData.mobile, profileData.residence)
                    .then(response => {
                        if (response.success) {
                            state.profile = { ...state.profile, ...profileData };
                            state.currentUser.name = profileData.name;
                            showAlert('student-dashboard-alert', response.message, 'success');
                            renderStudentDashboard(); // Re-render profile section
                        } else {
                            throw new Error(response.message);
                        }
                    })
                    .catch(handleError)
                    .finally(() => setLoading(false));
            })
            .catch(err => {
                if (err.message !== 'Cancelled') {
                    showAlert('student-dashboard-alert', err.message, 'warning');
                }
            });
    }
    // Dashboard Renderers
    function handleUpgradeToFull(app) {
        if (!app) return;
        showConfirm('Are you sure you want to upgrade to Full Admission? This will unlock your form for editing. You must enter your marks and other details.')
            .then(() => {
                state.isUpgradeFlow = true;
                handleEditApplication(app);
            })
            .catch(() => { });
    }

    function handleEditApplication(app) {
        if (!app) {
            // Fallback for direct calls if any
            const emailLower = String(state.currentUser?.email || '').toLowerCase();
            const currentSession = (state.adminData?.settings?.session) || '2025-26';
            app = (state.applications || []).find(a =>
                String(a['Email Address'] || '').toLowerCase() === emailLower &&
                (a['Status'] === 'Draft' || a['Status'] === 'Submitted')
            );
        }
        if (!app) return;

        state.isEditing = true;
        state.editingFormData = { ...app };
        state.oldPhotoUrl = app['Student Photo'] || null;

        if (state.isUpgradeFlow) {
            const cls = app['Admission sought for class'];
            if (cls === '11th') state.editingFormData['Admission Type (Class 11th)'] = 'Full';
            if (cls === '12th') state.editingFormData['Admission Type (Class 12th)'] = 'Full';

            state.editingFormData.isUnlockedEditMode = true;
            state.editingFormData.isUpgradeFlow = true;
            state.isUpgradeFlow = false;
        }

        state.currentView = 'formEditor';
        render();
    }

    function initToolTabListeners() {
        try {
            const adminToolTabs = document.querySelectorAll('#adminTools .tab-btn');
            adminToolTabs.forEach(btn => {
                const newBtn = btn.cloneNode(true);
                btn.parentNode.replaceChild(newBtn, btn);
            });

            const freshAdminToolTabs = document.querySelectorAll('#adminTools .tab-btn');
            freshAdminToolTabs.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    try {
                        if (typeof clearIdCardResults === 'function') clearIdCardResults();

                        freshAdminToolTabs.forEach(b => {
                            if (b) {
                                b.classList.remove('active');
                                b.style.borderBottom = '';
                                b.style.color = 'var(--text-secondary)';
                            }
                        });

                        // Hide all tab contents securely
                        // Hide all tab contents securely
                        const allTabContents = document.querySelectorAll('#adminTools .tab-content');
                        allTabContents.forEach(c => {
                            if (c) {
                                c.classList.remove('active');
                                c.style.cssText = 'display: none !important; height: 0;';
                            }
                        });

                        // Activate clicked tab
                        if (e.currentTarget) {
                            e.currentTarget.classList.add('active');
                            e.currentTarget.style.color = '';

                            const tabId = e.currentTarget.getAttribute('data-tab');
                            if (tabId) {
                                const content = document.getElementById(tabId);
                                if (content) {
                                    content.classList.add('active');
                                    // [BULLETPROOF VISIBILITY]
                                    content.style.cssText = 'display: flex !important; flex-direction: column !important; min-height: 400px; opacity: 1; visibility: visible;';

                                    if (tabId === 'tab-contact-saver' && typeof loadContactConfig === 'function') loadContactConfig();
                                    if (tabId === 'tab-subject-lists' && typeof initSubjectLists === 'function') initSubjectLists();
                                    if (tabId === 'tab-registration-excel' && typeof initRegistrationExcelTool === 'function') initRegistrationExcelTool();
                                }
                            }
                        }
                    } catch (error) {
                        console.error('Error in tool tab switching:', error);
                    }
                });
            });
        } catch (error) {
            console.error('Error initializing tool tab listeners:', error);
        }
    }

    // [Tool: Registration Excel]
    async function initRegistrationExcelTool() {
        const sessionSelect = document.getElementById('regExcelSession');
        const generateBtn = document.getElementById('generateRegExcelBtn');
        const infoIcon = document.getElementById('toggleRegInfoIcon');
        const clearLogBtn = document.getElementById('clearRegExcelLog');

        if (!sessionSelect || !generateBtn) return;

        // Populate session dropdown from admin data
        if (state.adminData.applications) {
            const sessions = new Set();
            if (state.adminData.settings && state.adminData.settings.session) {
                sessions.add(state.adminData.settings.session);
            }
            state.adminData.applications.forEach(app => {
                const s = app.Session || app.session;
                if (s) sessions.add(s);
            });
            sessionSelect.innerHTML = '<option value="">All Sessions</option>';
            Array.from(sessions).sort().reverse().forEach(session => {
                const opt = document.createElement('option');
                opt.value = session;
                opt.textContent = session;
                sessionSelect.appendChild(opt);
            });
            // Select current session by default
            if (state.adminData.settings && state.adminData.settings.session) {
                sessionSelect.value = state.adminData.settings.session;
            }
        }

        // Generate button click
        generateBtn.onclick = handleGenerateRegistrationExcel;

        // Clear log button click
        if (clearLogBtn) {
            clearLogBtn.onclick = () => {
                const log = document.getElementById('regExcelLog');
                if (log) log.innerHTML = '';
            };
        }
    }

    async function handleGenerateRegistrationExcel() {
        const btn = document.getElementById('generateRegExcelBtn');
        const section = document.getElementById('regExcelResult');
        const log = document.getElementById('regExcelLog');

        const session = document.getElementById('regExcelSession').value;
        const cls = document.getElementById('regExcelClass').value;
        const order = document.getElementById('regExcelOrder')?.value || 'roll_number';

        setBtnLoading(btn, true, 'Generating...');
        section.style.display = 'block';
        if (log) log.innerHTML = `<div style="margin-bottom:0.25rem;">[${new Date().toLocaleTimeString()}] Fetching student data from server...</div>`;

        try {
            const result = await runServerFunction('generateRegistrationExcel', {
                session,
                class: cls,
                order: order
            }, state.currentUser);

            if (result.success && result.downloadUrl) {
                if (log) log.innerHTML += `<div style="color:var(--success); margin-bottom:0.25rem;">[${new Date().toLocaleTimeString()}] Success! Processed ${result.count} students.</div>`;
                if (log) log.innerHTML += `<div style="margin-bottom:0.25rem;">[${new Date().toLocaleTimeString()}] Preparing Excel file download...</div>`;

                // Trigger download using hidden anchor with target=_top
                const a = document.createElement('a');
                a.href = result.downloadUrl;
                a.target = '_top'; // Crucial for Apps Script sandboxed iframe downloads
                a.style.display = 'none';
                document.body.appendChild(a);
                a.click();
                setTimeout(() => {
                    document.body.removeChild(a);
                }, 100);

                if (log) {
                    var manualDownloadHtml =
                        '<div style="margin-top:0.75rem; margin-bottom:0.25rem; font-weight:600; text-align:center; padding:10px; background:var(--bg-card); border:1px solid var(--border); border-radius:8px;">' +
                        '<span style="display:block; margin-bottom:0.5rem; color:var(--text-secondary);">If the download doesn\'t start automatically:</span>' +
                        '<a href="' + result.downloadUrl + '" target="_top" style="display:inline-block; padding:0.4rem 1rem; background:var(--primary); color:white; border-radius:6px; text-decoration:none;">' +
                        '<span class="material-icons" style="font-size:1rem; vertical-align:middle; margin-right:4px;">file_download</span>' +
                        'Download Manually' +
                        '</a>' +
                        '</div>';
                    log.innerHTML += manualDownloadHtml;
                }

                showAlert('admin-alert', result.message || `Excel generated successfully for ${result.count} students.`, 'success');
            } else {
                throw new Error(result.message || 'Failed to generate Excel file.');
            }
        } catch (e) {
            if (log) log.innerHTML += `<div style="color:var(--danger); margin-bottom:0.25rem;">[${new Date().toLocaleTimeString()}] Error: ${e.message}</div>`;
            showAlert('admin-alert', e.message, 'danger');
        } finally {
            setBtnLoading(btn, false);
        }
    }

    // Global cleanup function to ensure tools are completely hidden
    function forceHideAllTools() {
        try {
            const adminToolsEl = document.getElementById('adminTools');
            if (adminToolsEl) {
                adminToolsEl.style.display = 'none';

                // Reset textareas
                adminToolsEl.querySelectorAll('textarea').forEach(ta => {
                    if (ta) ta.value = '';
                });
            }
        } catch (e) {
            console.error('Error in forceHideAllTools:', e);
        }
    }

    function renderStudentDashboard() {
        try {
            // Use global cleanup function to ensure Tools content is completely hidden
            forceHideAllTools();

            dom.studentWelcome.textContent = `Welcome, ${toProperCase(state.currentUser.name)}`;

            const appVersionBadge = document.getElementById('studentAppVersionBadge');
            if (appVersionBadge && state.adminData?.appVersion) {
                appVersionBadge.textContent = 'v' + state.adminData.appVersion;
                appVersionBadge.style.display = 'inline-block';
            }

            try {
                const defaultDriveLogo = 'https://raw.githubusercontent.com/admexamhssshangus-dot/hss.shangus_website/refs/heads/main/public/logo.png';
                const url = state.adminData?.settings?.logo_url_resolved || state.adminData?.settings?.logo_url || state.adminData?.settings?.logoUrl || defaultDriveLogo;
                if (dom.studentLogo) {
                    if (url) { dom.studentLogo.src = url; dom.studentLogo.style.display = 'inline-block'; }
                    else { dom.studentLogo.style.display = 'none'; }
                }
            } catch (e) { }
            // Render Profile
                        if (dom.studentProfile) {
                                const studentEmail = toLowerCase(state.currentUser.email || '');
                                const profilePwd = (state.adminData && state.adminData.userProfiles && state.adminData.userProfiles[studentEmail]) ? (state.adminData.userProfiles[studentEmail].passwordPlain || '********') : '********';
                                dom.studentProfile.innerHTML = `
                <div style="border: 1px solid var(--border); border-radius: 4px; padding: 0.75rem; margin-bottom: 1.75rem;">
                     <h3 style="font-size: 1rem; margin-top: 0;">Profile</h3>
                     <div style="display: grid; gap: 0.5rem; font-size: 0.875rem;">
                         <div style="display:flex; align-items:center; gap:0.5rem;">
                             <strong style="flex:0 0 auto;">Email:</strong>
                             <span style="flex:1 1 auto; word-break:break-word;">${studentEmail}</span>
                             <button class="icon-btn btn-copy-email" data-email="${studentEmail}" title="Copy email" style="flex:0 0 auto; margin-left:6px;">
                                 <span class="material-icons" style="font-size:1rem;">content_copy</span>
                             </button>
                         </div>
                        
                         <div><strong>Mobile:</strong> ${state.currentUser.mobile || 'Not set'}</div>
                         <div><strong>Residence:</strong> ${toProperCase(state.currentUser.residence || 'Not set')}</div>
                     </div>
                </div>
            `;
                        } else {
                                console.warn('[UI] studentProfile element not found in DOM');
                        }
            // [MODIFIED] Find current application strictly for the logged-in user
            const emailLower = String(state.currentUser?.email || '').toLowerCase();
            const normalizeSession = (s) => String(s || '').replace(/[?-]/g, '-').trim();
            const currentSession = (state.adminData?.settings?.session) || '2025-26';

            // [DEBUG] Log email matching for troubleshooting blank screens
            const allAppEmails = (state.applications || []).map(a => String(a['Email Address'] || '').toLowerCase());
            console.log('[DEBUG] Student email to match:', emailLower, '| Available apps with emails:', allAppEmails.length > 0 ? allAppEmails.slice(0, 5) : 'NO APPS');

            const applications = (state.applications || []).filter(a => String(a['Email Address'] || '').toLowerCase() === emailLower);
            const appsInCurrent = applications.filter(a => normalizeSession(a.Session) === normalizeSession(currentSession));
            let currentApp = appsInCurrent.find(a => a.Status === 'Draft');
            if (!currentApp && appsInCurrent.length > 0) {
                currentApp = [...appsInCurrent].sort((a, b) => new Date(b.Timestamp) - new Date(a.Timestamp))[0];
            }
            // Skip empty draft created at registration (no class selected yet)
            if (currentApp && currentApp['Admission sought for class']) {
                const app = currentApp;
                const status = app['Status'] || 'Draft';
                const pdfUrl = app['PDF URL'] || null;
                const isEditable = (status === 'Draft') || (app.isEditable !== undefined ? app.isEditable : false);
                const isUnlockedEditMode = app.isUnlockedEditMode || false;
                const draftCount = app.draftCount || 0;
                let statusMessage = '';
                let buttonText = 'Continue Editing Application';
                let buttonDisabled = false;
                if (status === 'Draft') {
                    statusMessage = '[NOTE] Your application is saved as a draft. You can continue editing and submit when ready.';
                } else { // Submitted
                    buttonDisabled = !isEditable;
                    if (isEditable) {
                        if (isUnlockedEditMode) {
                            const exp = new Date(app.unlockExpiry);
                            const now = new Date();
                            const diffMs = Math.max(0, exp.getTime() - now.getTime());
                            const days = Math.floor(diffMs / (24 * 60 * 60 * 1000));
                            const hours = Math.floor((diffMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
                            const minutes = Math.floor((diffMs % (60 * 60 * 1000)) / (60 * 1000));
                            statusMessage = `Your application is unlocked for draft edits.`;
                            buttonText = 'Edit Application (Draft Only)';
                        } else {
                            statusMessage = 'Your application has been unlocked by the admin for editing.';
                            buttonText = 'View / Edit Application (Unlocked)';
                        }
                    } else {
                        statusMessage = 'Your application has been submitted successfully. If you think there was any mistake, you can contact Admissions Office (HSS Shangus) on below given contacts.';
                        buttonText = 'Application Submitted';
                    }
                }
                let extraInfo = '';
                if (app.unlockExpiry) {
                    const exp = new Date(app.unlockExpiry);
                    const now = new Date();
                    const diffMs = Math.max(0, exp.getTime() - now.getTime());
                    const days = Math.floor(diffMs / (24 * 60 * 60 * 1000));
                    const hours = Math.floor((diffMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
                    const minutes = Math.floor((diffMs % (60 * 60 * 1000)) / (60 * 1000));
                    extraInfo = `<div style="display:grid; gap:6px; padding:0.5rem; background: var(--bg); border-radius:4px;">
                <div style="display:flex; justify-content: space-between;"><span style="font-weight:500;">Unlock Expires On:</span><strong>${exp.toLocaleString('en-IN')}</strong></div>
                <div style="display:flex; justify-content: space-between;"><span style="font-weight:500;">Remaining:</span><strong>${days}d ${hours}h ${minutes}m</strong></div>
                <div style="display:flex; justify-content: space-between;"><span style="font-weight:500;">Draft Saves:</span><strong>${draftCount}/${MAX_DRAFTS_IN_EDIT_MODE}</strong></div>
              </div>`;
                }
                let upgradeHtml = '';
                if (canUpgradeToFull(app)) {
                    upgradeHtml = `
                 <div style="margin-top: 1rem; padding: 0.75rem; background: var(--info-light); border: 1px solid var(--info); border-radius: 6px;">
                   <h5 style="margin-top:0; color:var(--info);">[EDU] Upgrade to Full Admission?</h5>
                   <p style="font-size:0.85rem; margin-bottom:0.75rem;">Results declared? You can now update your provisional admission to full admission by entering your marks.</p>
                   <button class="btn btn-primary btn-small" id="upgradeToFullBtn">Upgrade to Full Admission</button>
                 </div>
               `;
                }

                let actionButtons = '';
                const pdfButtonHtml = ((status === 'Submitted' || isUnlockedEditMode) && pdfUrl) ? `
              <button class="btn btn-secondary" id="downloadPdfBtn" style="flex:1; min-width:220px;">
                <span class="material-icons" style="vertical-align: middle; font-size:1.1rem; margin-right:4px;">picture_as_pdf</span>
                Download ${isUnlockedEditMode ? 'Updated' : 'Submitted'} PDF
              </button>` : '';
                const editButtonHtml = `
              <button class="btn" id="editMyAppBtn" style="flex:1; min-width:220px;" ${buttonDisabled ? 'disabled' : ''}>
                <span class="material-icons" style="vertical-align: middle; font-size:1.1rem; margin-right:4px;">edit_note</span>
                ${buttonText}
              </button>`;
                actionButtons = `
              <div style="display:flex; gap:0.5rem; margin-top:0.5rem; flex-wrap:wrap;">
                ${editButtonHtml}
                ${pdfButtonHtml}
              </div>
              ${upgradeHtml}`;
                let nextStepsHtml = '';
                if (status === 'Submitted' && !isUnlockedEditMode) {
                    const admType = app['Admission Type (Class 11th)'] || app['Admission Type (Class 12th)'] || 'Full';
                    const steps = (admType === 'Provisional') ? [
                        'Download your provisional form and print it.',
                        "Sign the student's declaration.",
                        'Attach admit card of recent exam and/or marks card.',
                        'Submit the completed form at HSS Shangus admissions section.'
                    ] : [
                        'Download your admission form and print it.',
                        'Review and sign (student and parent/guardian).',
                        'Gather documents: Discharge & Character Certificates (original); photocopies of marks sheet(s), bank passbook, ration card (if applicable), Aadhaar, and category certificate (if applicable).',
                        'Submit signed form, documents, and fee at HSS Shangus.'
                    ];
                    nextStepsHtml = `
                <div style="margin-top: 0.75rem; border: 1px dashed var(--border); border-radius: 6px; padding: 0.75rem; background: var(--bg);">
                  <h4 style="font-size: 0.95rem; margin: 0 0 0.5rem 0;">Next Steps</h4>
                  <ul style="margin: 0; padding-left: 1.1rem; line-height: 1.5; font-size: 0.9rem;">
                    ${steps.map(s => `<li>${s}</li>`).join('')}
                  </ul>
                  <p style="margin: 0.5rem 0 0 0; font-size: 0.85rem; color: var(--text-secondary);">
                    For queries, contact the admissions office 
                    (<a href="tel:7006034501">7006034501</a> | 
                    <a href="tel:9682547458">9682547458</a> | 
                    <a href="tel:9596165142">9596165142</a>).
                  </p>
                </div>`;
                }
                const appSession = app['Session'] || currentSession;
                if (dom.studentAppStatus) {
                    dom.studentAppStatus.innerHTML = `
              <div style="border: 1px solid var(--border); border-radius: 4px; padding: 0.75rem;">
                <h3 style="font-size: 1rem; margin-top: 0;">Your Application</h3>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; margin-top: 0.5rem; font-size: 0.875rem;">
                  <div style="display: flex; justify-content: space-between; padding: 0.5rem; background: var(--bg); border-radius: 4px;">
                    <span style="font-weight: 500;">Form Number:</span>
                    <strong>${app['Form Number']}</strong>
                  </div>
                  <div style="display: flex; justify-content: space-between; padding: 0.5rem; background: var(--bg); border-radius: 4px;">
                    <span style="font-weight: 500;">Status:</span>
                    <span class="status-badge ${status === 'Draft' ? 'status-draft' : 'status-submitted'}">${status}</span>
                  </div>
                  <div style="display: flex; justify-content: space-between; padding: 0.5rem; background: var(--bg); border-radius: 4px;">
                    <span style="font-weight: 500;">Class:</span>
                    <strong>${app['Admission sought for class'] || 'N/A'}</strong>
                  </div>
                  <div style="display: flex; justify-content: space-between; padding: 0.5rem; background: var(--bg); border-radius: 4px;">
                    <span style="font-weight: 500;">Session:</span>
                    <strong>${appSession}</strong>
                  </div>
                  ${extraInfo}
                </div>
                <p style="margin-top: 1rem;" class="alert ${isEditable ? 'alert-info' : 'alert-warning'}">${statusMessage}</p>
                ${actionButtons}
                ${nextStepsHtml}
              </div>
            `;
                    document.getElementById('editMyAppBtn')?.addEventListener('click', () => handleEditApplication(app));
                    document.getElementById('downloadPdfBtn')?.addEventListener('click', () => downloadFile(pdfUrl, `Application_${app['Form Number']}.pdf`));
                    document.getElementById('upgradeToFullBtn')?.addEventListener('click', () => handleUpgradeToFull(app));
                }
            }
            // Offer new application only when there is NO application in the current session
            const settings = state.adminData.settings;
            const classMap = { 'allow_9th': '9th', 'allow_10th': '10th', 'allow_11th': '11th', 'allow_12th': '12th' };
            const unordered = Object.keys(settings).filter(k => settings[k] && classMap[k]).map(k => classMap[k]);
            const allowedClasses = ['9th', '10th', '11th', '12th'].filter(cls => unordered.includes(cls));
            const canApply = allowedClasses.length > 0;
            const normalizedCurrent = normalizeSession(currentSession);
            const hasCurrentSessionApp = (state.applications || []).some(a => {
                const sameEmail = String(a['Email Address'] || '').toLowerCase() === emailLower;
                const sameSession = normalizeSession(a['Session']) === normalizedCurrent;
                const validStatus = a['Status'] === 'Draft' || a['Status'] === 'Submitted';
                return sameEmail && sameSession && validStatus && !!a['Admission sought for class'];
            });
            const existingOffer = document.getElementById('newAppOffer');
            if (hasCurrentSessionApp) {
                if (existingOffer) existingOffer.remove();
            } else if (canApply) {
                if (existingOffer) existingOffer.remove();

                // Clear container to avoid duplicate blocks on repeated renders
                if (!currentApp && dom.studentAppStatus) dom.studentAppStatus.innerHTML = '';

                if (dom.studentAppStatus) {
                    let optionsHtml = '<option value="">-- Select a class --</option>' + allowedClasses.map(cls => `<option value="${cls}">${cls}</option>`).join('');
                    const previousSubmitted = (state.applications || []).filter(a => a.Status === 'Submitted' && (a.Session || '') !== currentSession);
                    console.log('[DEBUG] Showing new app offer for classes:', allowedClasses);

                    let prefillHtml = '';
                    if (previousSubmitted.length > 0) {
                        prefillHtml = `
                    <div class="form-group" style="margin-top: 1rem; text-align: left; padding: 0.5rem; background: var(--info-light); border-radius: 4px;">
                      <label style="font-weight: 600;">
                        <input type="checkbox" id="prefillCheck" style="width: auto; margin-right: 0.5rem;">
                        Prefill from previous year's application?
                      </label>
                      <p class="field-hint" style="margin: 0; color: var(--info-dark);">We found your old data. Check this to prefill personal details.</p>
                    </div>`;
                    }

                    const html = `
                    <div style="border: 1px solid var(--border); border-radius: 4px; padding: 0.75rem; text-align: center; margin-top: 1rem;">
                        <h3 style="font-size: 1rem; margin-top: 0;">Start New Admission Application</h3>
                        <div style="color: maroon; font-size: 0.875rem; margin-top: 0.25rem;">HSS Shangus</div>
                        <div class="form-group" style="margin-top: 1rem; text-align: left;">
                          <label for="selectNewClass">1. Choose class for admission</label>
                          <select id="selectNewClass">${optionsHtml}</select>
                        </div>
                        ${prefillHtml}
                        <button class="btn" id="startAppBtn" disabled style="margin-top: 1rem; max-width: 240px; padding: 0.6rem 1rem; font-weight: 600; border-radius: 8px;">2. Apply Online</button>
                    </div>`;

                    const container = document.createElement('div');
                    container.id = 'newAppOffer';
                    container.innerHTML = html;
                    dom.studentAppStatus.appendChild(container);

                    const selectEl = container.querySelector('#selectNewClass');
                    const startBtn = container.querySelector('#startAppBtn');

                    // Add class validation message container
                    const validationMsgDiv = document.createElement('div');
                    validationMsgDiv.id = 'classValidationMsg';
                    validationMsgDiv.style.cssText = 'margin-top: 0.5rem; padding: 0.5rem; border-radius: 4px; font-size: 0.875rem; display: none;';
                    container.appendChild(validationMsgDiv);

                    // Function to check if class is allowed
                    const isClassAllowed = (className) => {
                        const settings = state.adminData.settings || {};
                        const classKeyMap = { '9th': 'allow_9th', '10th': 'allow_10th', '11th': 'allow_11th', '12th': 'allow_12th' };
                        const settingKey = classKeyMap[className];
                        return settingKey ? settings[settingKey] === true : false;
                    };

                    // Function to show class validation message
                    const showClassMessage = (className) => {
                        if (!className) {
                            validationMsgDiv.style.display = 'none';
                            startBtn.disabled = true;
                            return;
                        }

                        if (isClassAllowed(className)) {
                            validationMsgDiv.style.display = 'none';
                            startBtn.disabled = false;
                            validationMsgDiv.className = '';
                        } else {
                            validationMsgDiv.style.display = 'block';
                            validationMsgDiv.style.background = 'var(--danger-light, #fee2e2)';
                            validationMsgDiv.style.color = 'var(--danger-dark, #991b1b)';
                            validationMsgDiv.style.border = '1px solid var(--danger, #dc2626)';
                            validationMsgDiv.innerHTML = `
                            <strong>Admission Closed for ${className} Class</strong><br>
                            Admissions for ${className} class are currently closed. Please contact the school administration for more information.
                        `;
                            startBtn.disabled = true;
                        }
                    };

                    // Add event listener for class selection change
                    selectEl.addEventListener('change', (e) => {
                        showClassMessage(e.target.value);
                    });

                    // Initial check
                    showClassMessage(selectEl.value);

                    startBtn.addEventListener('click', () => {
                        const selectedClass = selectEl.value;
                        if (!selectedClass) return;
                        state.selectedClassForNewApp = selectedClass;
                        state.isEditing = true;
                        const prefillCheck = container.querySelector('#prefillCheck');
                        if (prefillCheck && prefillCheck.checked) {
                            const latestSubmitted = [...(state.applications || [])]
                                .filter(a => a.Status === 'Submitted' && (a.Session || '') !== currentSession)
                                .sort((a, b) => new Date(b.Timestamp) - new Date(a.Timestamp))[0];
                            if (latestSubmitted) state.editingFormData = createPrefillData(latestSubmitted);
                        } else {
                            state.editingFormData = null;
                        }
                        state.currentView = 'formEditor';
                        render();
                    });
                } else {
                    console.warn('[UI] studentAppStatus element not found in DOM');
                }
            } else {
                if (existingOffer) existingOffer.remove();
                if (!currentApp && dom.studentAppStatus) dom.studentAppStatus.innerHTML = '';

                if (dom.studentAppStatus) {
                    const maintenance = document.createElement('div');
                    maintenance.id = 'newAppOffer';
                    maintenance.innerHTML = `
                    <div style="border: 1px solid var(--border); border-radius: 4px; padding: 0.75rem; text-align: center; margin-top: 1rem;">
                        <h3 style="font-size: 1rem; margin-top: 0;">Admissions Closed</h3>
                        <p class="alert alert-warning" style="margin-top: 0.75rem;">${MAINTENANCE_MESSAGE}</p>
                    </div>`;
                    dom.studentAppStatus.appendChild(maintenance);
                } else {
                    console.error('[UI] Cannot append maintenance message - studentAppStatus not found');
                }
            }
        } catch (e) {
            console.error('CRITICAL: renderStudentDashboard failed:', e);
        }
    }

    /**
     * [NEW] Helper to create a prefilled form data object from a previous application.
     * It copies personal/contact info but clears academic, status, and upload fields.
     */
    function createPrefillData(oldData) {
        const newData = { ...oldData }; // Copy all
        // Fields to KEEP (personal/contact info)
        const fieldsToKeep = [
            "Student's Name (as per school records)", "DoB (as per school records)", "Gender",
            "Father's/Guardian's Name (as per school records)", "Mother's Name (as per school records)",
            "Father's/Guardian's Occupation", 'Mobile No. (with working WhatsApp)',
            "Parent's Mobile No. (must be working)", 'Aadhar No.', 'House No.',
            'Name of your village', 'Block', 'Tehsil', 'District', 'State/UT', 'PIN code',
            'E-mail ID', 'Height (cm)', 'Weight (kg)', 'Blood Group', 'Your Mother Tongue',
            'Religion', 'Social category', 'Socio-economic category', 'Whether Any Disability',
            'Type of Disability', 'Bank Account No.', 'Name of Bank', 'IFSC code',
            'Passport No. (if available)', 'Identification Mark (if any)', 'PEN Number (given by UDISE portal)', 'APAAR ID'
        ];
        // Clear all fields NOT in the keep list
        Object.keys(newData).forEach(key => {
            if (!fieldsToKeep.includes(key)) {
                newData[key] = '';
            }
        });
        // Explicitly clear status/meta fields
        newData['Form Number'] = '';
        newData['Status'] = 'Draft';
        newData['Timestamp'] = '';
        newData['Last Edited'] = '';
        newData['PDF URL'] = '';
        newData['Student Photo'] = ''; // Clear photo
        newData['Declaration'] = ''; // Clear declaration
        // Clear academic fields (even if they were in keep list by mistake)
        state.formStructure.forEach(f => {
            if (f.fieldName.includes('Class') || f.fieldName.includes('Subjects') || f.fieldName.includes('Marks') || f.fieldName.includes('Stream')) {
                newData[f.fieldName] = '';
            }
        });
        return newData;
    }
    // [MODIFIED] Admin Dashboard Renderer - Updated for numeric rules and robust panel management
    function renderAdminDashboard() {
        try {
            // Robust Panel Management - Done first to ensure UI consistency
            let activeTabBtn = document.querySelector('#adminTabs .active[data-tab]') ||
                document.querySelector('#sidebarNavList .active[data-tab]');

            if (!activeTabBtn) {
                const firstTab = document.querySelector('#adminTabs [data-tab]');
                if (firstTab) {
                    firstTab.classList.add('active');
                    activeTabBtn = firstTab;
                    console.log('[UI] Initialized first admin tab as active');
                } else {
                    console.warn('[UI] No admin tabs found in DOM - panel rendering may be incomplete');
                }
            }

            const currentTab = state.adminTab || (activeTabBtn ? activeTabBtn.dataset.tab : 'apps');
            console.log('[UI] renderAdminDashboard - Tab:', currentTab);

            const panelMap = {
                'apps': 'adminApplications',
                'panel': 'adminControls',
                'subjects': 'subjectsEditor',
                'email': 'emailComposer',
                'activity': 'adminActivity',
                'whitelist': 'mobileWhitelist',
                'tools': 'adminTools',
                'otps': 'adminOtps'
            };

            const activePanelId = panelMap[currentTab] || 'adminApplications';
            const activePanel = document.getElementById(activePanelId);

            // 1. Hide all panels first
            document.querySelectorAll('.admin-panel').forEach(el => {
                el.classList.add('hidden');
                el.style.display = 'none';
            });

            // 2. Show active panel with flexbox constraints
            if (activePanel) {
                activePanel.classList.remove('hidden');
                // Clear any existing inline styles first to avoid !important conflicts
                activePanel.style.cssText = '';
                // Force reflow to ensure style clearing takes effect
                void activePanel.offsetHeight;
                // Now apply the visible styles
                activePanel.style.display = 'flex';
                activePanel.style.flexDirection = 'column';
                activePanel.style.flex = '1 1 auto';
                activePanel.style.minHeight = '0';
                activePanel.style.visibility = 'visible';
                activePanel.style.opacity = '1';
                console.log('[UI] Panel activated:', activePanelId, '| Display:', activePanel.style.display, '| Height:', activePanel.offsetHeight);

                // 3. Sync UI (Tabs, Pagination visibility, etc.)
                document.querySelectorAll('#adminTabs [data-tab], #sidebarNavList [data-tab]').forEach(btn => {
                    if (btn) btn.classList.toggle('active', btn.dataset.tab === currentTab);
                });

                const headerPagination = document.getElementById('headerPagination');
                if (headerPagination) {
                    headerPagination.style.display = (currentTab === 'apps') ? 'flex' : 'none';
                }

                // 4. Clean up tool logs and results to prevent stale data display
                const toHide = ['idCardResultContainer', 'subjectListResults', 'toolsResultLogContainer', 'regExcelResult', 'bulkRollNoResult', 'pushToSourceResult'];
                toHide.forEach(id => {
                    const el = document.getElementById(id);
                    if (el) el.style.display = 'none';
                });
                const logs = ['regExcelLog', 'idCardLog', 'bulkRollNoLog', 'toolsResultLog'];
                logs.forEach(id => {
                    const el = document.getElementById(id);
                    if (el) el.innerHTML = '';
                });

                // 5. Invoke specific renderer
                switch (currentTab) {
                    case 'apps':
                        renderApplications();
                        break;
                    case 'subjects':
                        const sC = document.getElementById('subjectsConfigContainer');
                        if (sC) sC.style.display = 'block';
                        if (typeof renderSubjectsEditor === 'function') renderSubjectsEditor();
                        break;
                    case 'email':
                        if (typeof initEmailComposer === 'function') initEmailComposer();
                        break;
                    case 'activity':
                        if (typeof loadAdminActivity === 'function') {
                            loadAdminActivity();
                        } else if (typeof renderAdminActivity === 'function') {
                            renderAdminActivity();
                        }
                        break;
                    case 'whitelist':
                        if (typeof renderMobileWhitelist === 'function') renderMobileWhitelist();
                        else if (typeof loadMobileWhitelist === 'function') loadMobileWhitelist();
                        break;
                    case 'otps':
                        if (typeof loadAdminOtps === 'function') {
                            loadAdminOtps(false);
                        } else if (typeof renderAdminOtps === 'function') {
                            renderAdminOtps();
                        }
                        break;
                    case 'tools':
                        if (typeof initToolTabListeners === 'function') initToolTabListeners();
                        if (typeof initRollNoTool === 'function') initRollNoTool();
                        if (typeof initPushToSourceTool === 'function') initPushToSourceTool();
                        if (typeof initPushToAutomationTool === 'function') initPushToAutomationTool();
                        if (state.adminData?.applications && typeof renderMultiSelect === 'function') {
                            renderMultiSelect('idCardClassFilter', ['9th', '10th', '11th', '12th'], 'Classes', null, true);
                        }
                        if (typeof loadContactConfig === 'function') try { loadContactConfig(); } catch (e) { }

                        // Load recent ID Card folders for admin tools (shows existing ID_Card_Data folders)
                        try {
                            if (typeof loadIdCardFolders === 'function') {
                                loadIdCardFolders();
                            }
                        } catch (e) { console.warn('loadIdCardFolders failed to run:', e); }

                        // Activate first tool tab by default
                        const adminToolsEl = document.getElementById('adminTools');
                        if (adminToolsEl) {
                            adminToolsEl.querySelectorAll('.tab-btn').forEach(b => {
                                b.classList.remove('active');
                                b.style.borderBottom = '';
                                b.style.color = 'var(--text-secondary)';
                            });
                            adminToolsEl.querySelectorAll('.tab-content').forEach(c => {
                                c.style.cssText = 'display: none !important;';
                                c.classList.remove('active');
                            });
                            const firstTab = document.getElementById('tab-contact-saver');
                            const firstBtn = adminToolsEl.querySelector('[data-tab="tab-contact-saver"]');
                            if (firstTab) {
                                firstTab.classList.add('active');
                                firstTab.style.cssText = 'display: flex !important; flex-direction: column !important; min-height: 400px;';
                            }
                            if (firstBtn) {
                                firstBtn.classList.add('active');
                                firstBtn.style.color = '';
                            }
                        }
                        break;
                }
                console.log('[UI] Panel Switch Success:', activePanelId);
            } else {
                console.error('[UI] Switch FAILED. Panel not found:', activePanelId);
            }

            // Update admin welcome message and logo
            if (dom.adminWelcome) {
                dom.adminWelcome.innerHTML = `<span class="material-icons" style="font-size:1rem; color:var(--primary);">badge</span> <span>${toProperCase(state.currentUser.name)}</span>`;
            }
            if (dom.adminEmail) {
                dom.adminEmail.innerHTML = `<span class="material-icons" style="font-size:0.85rem; color:var(--text-secondary);">alternate_email</span> <span>${state.currentUser.email}</span>`;
            }

            const appVersionBadge = document.getElementById('adminAppVersionBadge');
            const appVersionBadgeMobile = document.getElementById('adminAppVersionBadgeMobile');
            const versionStr = state.adminData?.appVersion ? 'v' + state.adminData.appVersion : '';
            if (versionStr) {
                if (appVersionBadge) {
                    appVersionBadge.textContent = versionStr;
                    appVersionBadge.style.display = 'inline-block';
                }
                if (appVersionBadgeMobile) {
                    appVersionBadgeMobile.textContent = versionStr;
                    appVersionBadgeMobile.style.display = 'inline-block';
                }
            }

            const adminLogoUrl = state.adminData?.settings?.logo_url_resolved ||
                state.adminData?.settings?.logo_url ||
                state.adminData?.settings?.logoUrl ||
                'https://raw.githubusercontent.com/admexamhssshangus-dot/hss.shangus_website/refs/heads/main/public/logo.png';
            if (dom.adminLogo) {
                dom.adminLogo.src = adminLogoUrl;
                dom.adminLogo.style.display = 'inline-block';
            }
            if (dom.adminLogoMobile) {
                dom.adminLogoMobile.src = adminLogoUrl;
                dom.adminLogoMobile.style.display = 'inline-block';
            }

            // Sync Stats
            const apps = state.adminData.applications || [];
            const total = apps.length;
            const classCounts = apps.reduce((acc, app) => {
                const cls = app['Admission sought for class'] || 'Unknown';
                acc[cls] = (acc[cls] || 0) + 1;
                return acc;
            }, {});
            const statsHtml = [
                `<button class="stats-badge" title="Show All Applications" onclick="filterByStat('all')"><span class="material-icons" style="font-size:0.9rem;">groups</span> Total: <strong>${total}</strong></button>`,
                ...Object.entries(classCounts).map(([name, count]) => {
                    let icon = 'school';
                    if (name.includes('12th')) icon = 'military_tech';
                    if (name.includes('11th')) icon = 'workspace_premium';
                    if (name.includes('10th')) icon = 'star';
                    if (name.includes('9th')) icon = 'auto_awesome';
                    const filterVal = name === 'Unknown' ? 'Unknown' : name;
                    return `<button class="stats-badge" title="Filter by ${name}" onclick="filterByStat('class', '${filterVal}')"><span class="material-icons" style="font-size:0.9rem;">${icon}</span> ${name}: <strong>${count}</strong></button>`;
                })
            ];
            const chips = statsHtml.join('');
            if (dom.adminStats) dom.adminStats.innerHTML = chips;
            const inlineStats = document.getElementById('adminStatsInline');
            if (inlineStats) inlineStats.innerHTML = chips;
            try {
                if (dom.adminStats) dom.adminStats.classList.add('stats-compact');
                const SUPER_ADMIN_EMAIL = 'adm.exam.hss.shangus@gmail.com';
                const userRole = (state.currentUser?.role || '').toLowerCase();
                const isSuperAdmin = (String(state.currentUser?.email || '').toLowerCase() === SUPER_ADMIN_EMAIL) ||
                    userRole === 'superadmin' ||
                    userRole === 'president';

                // Hide restricted tabs for non-super admin based on permissions
                const adminTabsMap = state.adminData.settings?.admin_tabs || {};
                const userEmail = String(state.currentUser?.email || '').toLowerCase().trim();
                const myAllowedTabs = adminTabsMap[userEmail] || [];

                document.querySelectorAll('#adminTabs [data-tab="panel"], #adminTabs [data-tab="subjects"], #adminTabs [data-tab="email"], #adminTabs [data-tab="activity"], #adminTabs [data-tab="whitelist"], #adminTabs [data-tab="tools"], #adminTabs [data-tab="otps"]').forEach(btn => {
                    const tabId = btn.getAttribute('data-tab');
                    const isAllowed = isSuperAdmin || myAllowedTabs.includes(tabId);
                    btn.style.display = isAllowed ? 'inline-block' : 'none';
                });
                if (isSuperAdmin) {
                    renderAdminPermissions();
                }

                // Hide bulk action buttons for non-super admin
                const bulkButtons = ['#batchSendPassBtn', '#batchUnlockBtn', '#batchDeleteBtn'];
                bulkButtons.forEach(selector => {
                    const btn = document.querySelector(selector);
                    if (btn) btn.style.display = isSuperAdmin ? 'inline-block' : 'none';
                });
                // [FIX] Auto-close tool logs and result panels when switching tabs
                const resultPanels = [
                    'regExcelResult', 'idCardResult', 'subjectListsResult',
                    'bulkRollNoResult', 'pushToSourceResult'
                ];
                resultPanels.forEach(id => {
                    const el = document.getElementById(id);
                    if (el) el.style.display = 'none';
                });

                const logs = ['regExcelLog', 'idCardLog', 'bulkRollNoLog'];
                logs.forEach(id => {
                    const el = document.getElementById(id);
                    if (el) el.innerHTML = '';
                });

            } catch (e) {
                console.error('Inner render error:', e);
            }
        } catch (error) {
            console.error('CRITICAL: renderAdminDashboard failed:', error);
        }
    }

    function renderApplications() {
        try {
            if (!state.adminData) {
                console.error('[UI] renderApplications: state.adminData is missing');
                return;
            }
            const apps = state.adminData.applications || [];
            const settings = state.adminData.settings || {};
            const currentSession = settings.session || '2025-26';
            const toggles = [
                { key: 'allow_9th', label: '9th Class' },
                { key: 'allow_10th', label: '10th Class' },
                { key: 'allow_11th', label: '11th Class' },
                { key: 'allow_12th', label: '12th Class' }
            ].map(item => `
        <div class="toggle-group">
          <span style="font-weight: 500;">${item.label}</span>
          <label class="switch">
            <input type="checkbox" data-key="${item.key}" ${settings[item.key] ? 'checked' : ''}>
            <span class="slider"></span>
          </label>
        </div>
      `).join('');
            if (dom.adminToggles) dom.adminToggles.innerHTML = toggles;

            // Render Email Toggles
            const emailToggles = [
                { key: 'email_submission', label: 'Submission/Update' },
                { key: 'email_upgrade', label: 'Upgrade PDF' },
                { key: 'email_rejection', label: 'Rejection' },
                { key: 'email_reg_otp', label: 'Registration OTP' },
                { key: 'email_reset_otp', label: 'Password Reset OTP' }
            ].map(item => `
        <div class="toggle-group" style="background:var(--bg-card); padding:2px 8px; border-radius:4px; margin-right:4px;">
          <span style="font-weight: 500; font-size:0.75rem;">${item.label}</span>
          <label class="switch" style="transform: scale(0.8);">
            <input type="checkbox" data-key="${item.key}" ${settings[item.key] !== false ? 'checked' : ''}>
            <span class="slider"></span>
          </label>
        </div>
      `).join('');
            if (dom.emailToggles) dom.emailToggles.innerHTML = emailToggles;

            // [NEW] Add event listeners to all setting toggles for auto-save
            document.querySelectorAll('.toggle-group input[data-key]').forEach(input => {
                input.addEventListener('change', async (e) => {
                    const key = e.target.getAttribute('data-key');
                    const val = e.target.checked;
                    if (!key) return;

                    // Optimistically update local state
                    if (!state.adminData.settings) state.adminData.settings = {};
                    state.adminData.settings[key] = val;

                    try {
                        const res = await runServerFunction('saveAdminSettings', { [key]: val }, state.currentUser);
                        if (!res.success) throw new Error(res.message);
                    } catch (err) {
                        showAlert('admin-alert', 'Failed to save setting: ' + err.message, 'danger');
                        // Revert UI on failure
                        e.target.checked = !val;
                        state.adminData.settings[key] = !val;
                    }
                });
            });

            // [RESTORED] Populate settings input fields from server state
            try {
                const sesEl = document.getElementById('sessionInput');
                if (sesEl) sesEl.value = settings['session'] || '';
                const poEl = document.getElementById('printOrderSelect');
                if (poEl) poEl.value = settings['print_sort_by'] || 'submitted_desc';
                const logoEl = document.getElementById('logoUrlInput');
                if (logoEl) logoEl.value = settings['logo_url'] || settings['logoUrl'] || settings['logo_url_resolved'] || '';
            } catch (e) { /* ignore */ }

            // [MODIFIED] Multi-select Filter Initializations
            if (apps.length > 0) {
                const sessions = [...new Set(apps.map(a => a['Session'] || '').filter(Boolean))].sort().reverse();
                renderMultiSelect('filterSession', sessions, 'Sessions');
                renderMultiSelect('filterClass', ['9th', '10th', '11th', '12th'], 'Classes');
                renderMultiSelect('filterStatus', [
                    { value: 'Submitted', label: 'Submitted' },
                    { value: 'AssignedRollNos', label: 'Roll No Assigned' },
                    { value: 'Draft', label: 'Draft' },
                    { value: 'Rejected', label: 'Rejected' }
                ], 'Status');
                renderMultiSelect('filterType', ['Full', 'Provisional'], 'Type');
            }

            // [NEW] Handle dynamic column state and header rendering
            const mandatory = ['SNo', 'Checkbox', 'Form Number', 'Class Roll No', 'Student Photo', "Student's Name (as per school records)", 'Status', 'Actions'];
            if (!Array.isArray(state.visibleColumns) || state.visibleColumns.length === 0) {
                console.warn('[UI] visibleColumns corrupted or empty, resetting to defaults.');
                state.visibleColumns = Array.isArray(ADMIN_DEFAULT_COLUMNS) ? [...ADMIN_DEFAULT_COLUMNS] : [];
            }
            // Filter out any mandatory columns that might have accidentally leaked into visibleColumns
            state.visibleColumns = state.visibleColumns.filter(c => c && !mandatory.includes(c));

            const activeCols = [
                'SNo', 'Checkbox', 'Form Number', 'Class Roll No', 'Student Photo',
                "Student's Name (as per school records)",
                ...(state.visibleColumns || []),
                'Status', 'Actions'
            ];

            const headerEl = document.getElementById('adminTableHeader');
            if (headerEl) {
                headerEl.innerHTML = `<tr>${activeCols.map(colKey => {
                    const col = ADMIN_TABLE_COLUMNS[colKey] || { label: colKey, "class": '' };
                    if (colKey === 'Checkbox') return `<th class="col-checkbox"><input type="checkbox" id="adminSelectAll"></th>`;
                    return `<th class="${col["class"] || ''}" data-col-key="${colKey}">${col.label}</th>`;
                }).join('')}</tr>`;

                // Re-bind Select All listener
                const selectAll = document.getElementById('adminSelectAll');
                if (selectAll) {
                    selectAll.addEventListener('change', (e) => {
                        const checked = e.target.checked;
                        document.querySelectorAll('.admin-select-row').forEach(cb => cb.checked = checked);
                    });
                }
            }

            const sessionFilter = getMultiSelectValues('filterSession');
            const classFilter = getMultiSelectValues('filterClass');
            const statusFilter = getMultiSelectValues('filterStatus');
            const typeFilter = getMultiSelectValues('filterType');
            const sortBy = document.getElementById('sortBy')?.value || 'submitted_desc';
            const pageSizeEl = document.getElementById('pageSize');
            const pageSize = Math.max(5, Math.min(200, parseInt(pageSizeEl?.value || '25', 10) || 25));
            state.adminData.page = state.adminData.page || 1;

            let filteredApps = [...apps];

            // [KEY FIX] For multi-selects: if ALL options checked = no filter (show everything)
            // Only filter when user has explicitly DESELECTED at least one option
            const allSessions = [...new Set(apps.map(a => a['Session'] || '').filter(Boolean))];
            const allClasses = ['9th', '10th', '11th', '12th'];
            const allStatuses = ['Submitted', 'AssignedRollNos', 'Draft', 'Rejected'];
            const allTypes = ['Full', 'Provisional'];

            const sessionFiltering = sessionFilter.length > 0 && sessionFilter.length < allSessions.length;
            const classFiltering = classFilter.length > 0 && classFilter.length < allClasses.length;
            const statusFiltering = statusFilter.length > 0 && statusFilter.length < allStatuses.length;
            const typeFiltering = typeFilter.length > 0 && typeFilter.length < allTypes.length;

            if (sessionFiltering) filteredApps = filteredApps.filter(a => sessionFilter.includes(a['Session'] || ''));
            if (classFiltering) filteredApps = filteredApps.filter(a => classFilter.includes(a['Admission sought for class'] || ''));
            if (statusFiltering) {
                filteredApps = filteredApps.filter(a => {
                    return statusFilter.some(s => {
                        if (s === 'Rejected') return !!a.rejectionReason;
                        if (s === 'AssignedRollNos') return !!a['Class Roll No'];
                        return (a['Status'] || '') === s && !a.rejectionReason;
                    });
                });
            }
            if (typeFiltering) {
                filteredApps = filteredApps.filter(a => typeFilter.includes(getAdmType(a)));
            }

            // [MODIFIED] Apply search query with weighted relevance scoring
            const searchQuery = state.adminData.searchQuery || '';
            if (searchQuery) {
                filteredApps = filteredApps.map(app => {
                    const relevance = calculateRelevanceScore(app, searchQuery);
                    return { ...app, _relevance: relevance.score, _matchPercent: relevance.percentage };
                }).filter(app => app._relevance > 0);

                // Always prioritize relevance when searching
                filteredApps.sort((a, b) => {
                    if (b._relevance !== a._relevance) return b._relevance - a._relevance;
                    // Tie-breaker: Newer submissions first for identical relevance
                    return new Date(b.Timestamp || 0) - new Date(a.Timestamp || 0);
                });
            }
            if (searchQuery) {
                // Already sorted by relevance above with tie-breaker
            } else if (sortBy === 'submitted_desc') {
                filteredApps.sort((a, b) => new Date(b.Timestamp || 0) - new Date(a.Timestamp || 0));
            } else if (sortBy === 'submitted_asc') {
                filteredApps.sort((a, b) => new Date(a.Timestamp || 0) - new Date(b.Timestamp || 0));
            } else if (sortBy === 'form_asc') {
                filteredApps.sort((a, b) => {
                    const formA = parseInt(a['Form Number']) || 999999;
                    const formB = parseInt(b['Form Number']) || 999999;
                    return formA - formB;
                });
            } else if (sortBy === 'class_form') {
                filteredApps.sort((a, b) => {
                    const classA = String(a['Admission sought for class'] || '');
                    const classB = String(b['Admission sought for class'] || '');
                    if (classA !== classB) return classA.localeCompare(classB);
                    const formA = parseInt(a['Form Number']) || 999999;
                    const formB = parseInt(b['Form Number']) || 999999;
                    return formA - formB;
                });
            } else if (sortBy === 'class_roll') {
                filteredApps.sort((a, b) => {
                    const classA = String(a['Admission sought for class'] || '');
                    const classB = String(b['Admission sought for class'] || '');
                    if (classA !== classB) return classA.localeCompare(classB);
                    const rollNumA = parseInt(a['Class Roll No']) || 999999;
                    const rollNumB = parseInt(b['Class Roll No']) || 999999;
                    return rollNumA - rollNumB;
                });
            } else if (sortBy === 'roll_class') {
                filteredApps.sort((a, b) => {
                    const rollNumA = parseInt(a['Class Roll No']) || 999999;
                    const rollNumB = parseInt(b['Class Roll No']) || 999999;
                    if (rollNumA !== rollNumB) return rollNumA - rollNumB;
                    return String(a['Admission sought for class'] || '').localeCompare(String(b['Admission sought for class'] || ''));
                });
            }
            const totalItems = filteredApps.length;
            const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
            state.adminData.page = Math.max(1, Math.min(state.adminData.page, totalPages));
            const start = (state.adminData.page - 1) * pageSize;
            const end = start + pageSize;
            const pageApps = filteredApps.slice(start, end);

            const targetTableBody = document.getElementById('adminTableBody');
            console.log(`[UI] Rendering Admin Table: ${pageApps.length} rows. Page ${state.adminData.page}/${totalPages}. Columns: ${activeCols.length}`);

            if (targetTableBody) {
                const panel = document.getElementById('adminApplications');
                console.log(`[UI] Table Body found. Panel Visible: ${panel ? panel.offsetParent !== null : 'N/A'}, Panel Height: ${panel ? panel.offsetHeight : 0}`);

                // Clear and Force Layout
                targetTableBody.innerHTML = '';

                if (pageApps.length === 0) {
                    targetTableBody.innerHTML = `<tr><td colspan="${activeCols.length}" style="text-align:center; padding:3rem; color:var(--text-secondary);">No applications found matching your current filters.</td></tr>`;
                } else {
                    const rowsHtml = pageApps.map((app, idx) => {
                        try {
                            const status = app['Status'] || 'Draft';
                            const hasPdf = app['PDF URL'];
                            const emailLower = String(app['Email Address'] || '').toLowerCase();
                            const profile = (state.adminData.userProfiles || {})[emailLower] || {};
                            const mobile = app['Mobile No. (with working WhatsApp)'] || 'N/A';
                            const parentMobile = app["Parent's Mobile No. (must be working)"] || 'N/A';
                            const accountMobile = app['Account Mobile'] || profile.accountMobile || 'N/A';
                            const residence = toProperCase(app['Residence'] || app['Name of your village'] || profile.residence || 'N/A');
                            const nameDisplay = toProperCase(app["Student's Name (as per school records)"] || app['Account Name'] || profile.name || 'N/A');
                            const relevanceBadge = (searchQuery && app._matchPercent) ? `<div style="font-size: 0.65rem; color: var(--accent); font-weight: 600; margin-top: 2px;">${app._matchPercent}% match</div>` : '';
                            const admTypeFull = getAdmType(app);
                            const admTypeLabel = admTypeFull === 'Provisional' ? 'Prov.' : (admTypeFull ? 'Full' : '');
                            const sno = start + idx + 1;

                            // [NEW] Get Stream and Subjects
                            const appClass = (app['Admission sought for class'] || '').toString();
                            let streamRaw = '';
                            if (appClass === '11th') {
                                streamRaw = app['Stream for Class 11th'] || app['Stream opted in Class 11th'] || '';
                            } else if (appClass === '12th') {
                                streamRaw = app['Stream for Class 12th'] || app['Stream opted in Class 12th'] || '';
                            } else if (appClass.includes('9')) {
                                streamRaw = 'General';
                            } else if (appClass.includes('10')) {
                                streamRaw = 'General';
                            }
                            let subsRaw = buildSubsRawForAppsTable(app, appClass);
                            subsRaw = enrichSubsRawIfSparse(app, appClass, subsRaw);
                            const abbreviatedSubs = abbreviateSubject(subsRaw);
                            const streamDisplay = streamCategoryLabel(appClass, subsRaw, streamRaw);
                            const statusText = app.rejectionReason ? 'Rejected' : status;
                            const statusClass = app.rejectionReason ? 'status-rejected' : (status === 'Submitted' ? 'status-submitted' : (status === 'Draft' ? 'status-draft' : 'status-submitted'));

                            // Check if student has confirmed admission (roll number assigned)
                            const hasRollNo = app['Class Roll No'] && String(app['Class Roll No']).trim() !== '';
                            const admissionConfirmedLabel = hasRollNo ? '<span class="admission-confirmed-badge" title="Admission Confirmed - Roll number assigned, fee and documents submitted">[OK]</span>' : '';

                            // Build comprehensive activity history for unified icon
                            let activityHistory = [];
                            let activityIcon = '<span class="material-icons" style="font-size:1rem;">list</span>';
                            let iconColor = '#6b7280';

                            // Registration date
                            const regDate = profile.registeredAt || app['Timestamp'];
                            if (regDate) activityHistory.push(`Registered: ${formatCompactDate(regDate)}`);

                            // Draft activity
                            if (status === 'Draft' && app['Timestamp']) {
                                const draftStr = formatCompactDate(app['Timestamp']);
                                if (!regDate || formatCompactDate(regDate) !== draftStr) activityHistory.push(`Draft saved: ${draftStr}`);
                            }

                            // Last edited
                            if (app['Last Edited']) activityHistory.push(`Last edited: ${formatCompactDate(app['Last Edited'])}`);

                            // Submission activity
                            if (status === 'Submitted') {
                                activityHistory.push(`Submitted: ${formatCompactDate(app['Last Submission At'] || app['Timestamp'])}`);
                                activityIcon = '<span class="material-icons" style="font-size:1rem;">check_circle</span>';
                                iconColor = '#22c55e';
                            }

                            // Rejection activity
                            if (app.rejectionReason) {
                                activityHistory.push(`Rejected: ${app.rejectionReason}`);
                                if (app['Rejected At']) activityHistory.push(`Rejected on: ${formatCompactDate(app['Rejected At'])}`);
                                activityIcon = '<span class="material-icons" style="font-size:1rem;">cancel</span>';
                                iconColor = '#b91c1c';
                            }

                            // Roll number assignment
                            if (hasRollNo) {
                                activityHistory.push(`Admission confirmed: Roll No ${app['Class Roll No']} assigned`);
                                activityIcon = '<span class="material-icons" style="font-size:1rem;">school</span>';
                                iconColor = '#059669';
                            }

                            const unifiedActivityTooltip = activityHistory.join('\n');
                            const unifiedActivityIcon = activityHistory.length > 0 ?
                                `<span class="admin-activity-icon unified-activity" style="color: ${iconColor}; background: ${iconColor}15; border-color: ${iconColor}40;" 
                   data-tooltip="${unifiedActivityTooltip}" title="Application History">${activityIcon}</span>` : '';

                            // COMPACT STATUS DESIGN
                            const ts = formatCompactDate(app.rejectionReason ? (app['Rejected At'] || app['Timestamp']) : (status === 'Submitted' ? (app['Last Submission At'] || app['Timestamp']) : app['Timestamp']));
                            const statusIndicator = `<div class="status-cell-wrapper" style="display:flex;flex-direction:column;align-items:flex-start;gap:0;line-height:1.15;">` +
                                (app.rejectionReason ?
                                    `<span class="status-badge status-rejected" title="${app.rejectionReason}" style="padding:1px 5px;font-size:0.68rem;"><span class="material-icons" style="font-size:0.72rem;">cancel</span> Rejected</span>` :
                                    (status === 'Submitted' ?
                                        `<span class="status-badge status-submitted" style="padding:1px 5px;font-size:0.68rem;"><span class="material-icons" style="font-size:0.72rem;">check_circle</span> Submitted</span>` :
                                        `<span class="status-badge status-draft" style="padding:1px 5px;font-size:0.68rem;"><span class="material-icons" style="font-size:0.72rem;">drafts</span> Draft</span>`)) +
                                `<span style="font-size:0.63rem;color:var(--text-secondary);opacity:0.85;margin-top:1px;">${ts}</span>` +
                                `</div>`;

                            const photoHtml = `<td class="col-photo" data-label="Student Photo">
                          ${(() => {
                                    const rollNo = app['Class Roll No'] ? String(app['Class Roll No']).trim() : '';
                                    const formNum = String(app['Form Number']).trim();
                                    const photoKey = rollNo ? `${rollNo}_${formNum}` : '';
                                    const photoKeys = Object.keys(state.adminData.photoMap || {});
                                    const matchingKey = photoKey ? photoKeys.find(k => k.startsWith(photoKey)) : null;
                                    const adminPhotoId = matchingKey ? state.adminData.photoMap[matchingKey] : null;
                                    if (adminPhotoId) {
                                        const imageUrl = 'https://lh3.googleusercontent.com/d/' + adminPhotoId + '=s220';
                                        return '<img src="' + imageUrl + '" alt="" style="width: 48px; height: 48px; object-fit: cover; border-radius: 50%; border: 2px solid #e2e8f0; display: block; cursor: pointer;" onclick="window.open(\'https://drive.google.com/file/d/' + adminPhotoId + '/view\', \'_blank\')" title="View Formal Photo">';
                                    }
                                    const photoUrl = app['Student Photo'] || app['Student photo'] || app['photo'] || '';
                                    if (photoUrl) {
                                        const m = String(photoUrl).match(/[?&]id=([a-zA-Z0-9_-]+)/) || String(photoUrl).match(/\/d\/([a-zA-Z0-9_-]+)/);
                                        if (m && m[1]) return '<img src="https://lh3.googleusercontent.com/d/' + m[1] + '=s220" alt="" style="width: 48px; height: 48px; object-fit: cover; border-radius: 50%; border: 2px solid #e2e8f0; display: block; cursor: pointer;" onclick="window.open(\'' + photoUrl + '\', \'_blank\')" title="View Photo">';
                                    }
                                    return '<div style="width: 38px; height: 38px; border-radius: 50%; background: #f1f5f9; display: flex; align-items: center; justify-content: center; color: #64748b; font-size: 0.6rem; text-align: center;">No Photo</div>';
                                })()} </td>`;

                                                        const actionsHtml = `<td class="actions col-actions" data-label="Actions" style="padding: 6px 12px !important; background: var(--bg-secondary);">
                                                    <div class="action-buttons" style="justify-content: center; gap: 4px;">
                                                        ${unifiedActivityIcon}
                                                        ${hasPdf ? `<button type="button" class="btn btn-secondary btn-small btn-view-pdf" data-form="${app['Form Number']}" title="View PDF" style="padding: 2px 5px; font-size: 0.65rem; min-height: 0 !important; height: auto !important; width: auto !important; line-height: 1; display: inline-flex; align-items: center; border-radius: 3px; font-weight: 600;">PDF</button>` : ''}
                                                        <button class="btn-actions-menu" title="More" aria-haspopup="true" aria-expanded="false" style="padding: 0; min-height:0; width:22px; height:22px;"><span class="material-icons" style="font-size:1rem;">more_vert</span></button>
                                                    </div>
                                                    <div class="actions-menu">
                                                        ${status === 'Submitted' ? '<button class="menu-item menu-unlock" title="Unlock"><span class="material-icons">lock_open</span> Unlock for Edit</button>' : ''}
                                                        <button class="menu-item menu-view" title="View Details"><span class="material-icons">visibility</span> View Record</button>
                                                        <button class="menu-item menu-edit" title="Edit Data"><span class="material-icons">edit</span> Edit Application</button>
                                                        ${hasPdf ? '<button class="menu-item menu-download-pdf" data-form="' + app['Form Number'] + '" title="View/Download PDF"><span class="material-icons">picture_as_pdf</span> PDF: View / Download</button>' : ''}
                                                        <button class="menu-item menu-history" title="View Activity History"><span class="material-icons">history</span> View Activity History</button>
                                                        <button class="menu-item menu-send-pass" title="Send Password"><span class="material-icons">vpn_key</span> Send Password</button>
                                                        <button class="menu-item menu-send-whatsapp" title="Send WhatsApp"><span class="material-icons">chat</span> Send WhatsApp</button>
                                                        <button class="menu-item menu-reject" title="Reject"><span class="material-icons">report</span> Reject</button>
                                                        <button class="menu-item menu-delete danger" title="Delete"><span class="material-icons">delete</span> Delete</button>
                                                    </div>
                                                </td>`;

                            const rowCells = activeCols.map(colKey => {
                                const colConfig = ADMIN_TABLE_COLUMNS[colKey] || { label: colKey, class: '' };
                                const label = colConfig.label || '';
                                const labelAttr = label ? `data-label="${label}"` : '';

                                if (colKey === 'SNo') return `<td class="col-sno" ${labelAttr}>${sno}</td>`;
                                if (colKey === 'Checkbox') return `<td class="col-checkbox" data-label="Select"><input type="checkbox" class="admin-select-row" data-form="${app['Form Number']}"></td>`;
                                if (colKey === 'Form Number') return `<td class="col-form" ${labelAttr}>${app['Form Number'] || 'N/A'}</td>`;
                                if (colKey === 'Class Roll No') return `<td class="col-roll" ${labelAttr}><input type="number" class="roll-no-input ${hasRollNo ? 'roll-no-assigned' : ''}" data-form="${app['Form Number']}" value="${app['Class Roll No'] || ''}" placeholder="-" style="width: 48px; padding: 1px 3px; height: 20px; font-size: 0.7rem; border: 1px solid var(--border); border-radius: 4px;"></td>`;
                                if (colKey === 'Student Photo') return photoHtml;
                                if (colKey === "Student's Name (as per school records)") return `<td class="col-name truncate-cell" style="min-width: 85px;" ${labelAttr}>
                            <div style="font-weight: 600; color: var(--text-primary); font-size: 0.825rem;">${nameDisplay}</div>
                            ${relevanceBadge}
                        </td>`;
                                if (colKey === 'Status') return `<td class="col-status" style="overflow: hidden;" ${labelAttr}>${statusIndicator}</td>`;
                                if (colKey === 'Actions') return actionsHtml;

                                // Dynamic column lookup
                                let val = app[colKey] || '';
                                if (colKey === 'Session') val = app.Session || app.session || 'N/A';
                                if (colKey === 'Stream') return `<td class="col-stream" style="font-size: 0.65rem; color: var(--text-secondary);" ${labelAttr}>${streamDisplay}</td>`;
                                if (colKey === 'Subjects') return `<td class="col-subjects" style="font-size: 0.65rem;" title="${subsRaw}" ${labelAttr}>${abbreviatedSubs}</td>`;

                                // If this column is the email column, render email with copy / password toggle controls (admin-only)
                                const isEmailCol = (colConfig.class && String(colConfig.class).includes('col-email')) || (String(colKey).toLowerCase().includes('email'));
                                if (isEmailCol) {
                                    const emailVal = val || app['Email Address'] || '';
                                    if (!emailVal) return `<td class="col-email" ${labelAttr}><span style="opacity:0.3">---</span></td>`;
                                    // Compact email display: remove '@' and truncate for compact layout; full email shown on hover
                                    let compactEmail = String(emailVal || '').replace('@', '');
                                    let displayEmail = compactEmail;
                                    if (displayEmail.length > 18) displayEmail = displayEmail.slice(0, 15) + '...';
                                    const emailHtml = `
                                        <div class="email-wrap">
                                            <div class="email-line" style="display:flex; align-items:center; gap:6px;">
                                                <span class="material-icons" style="font-size:0.9rem; vertical-align:text-bottom;">alternate_email</span>
                                                <span class="email-display" title="${emailVal}" style="word-break:normal; font-family:monospace; font-size:0.85rem;">${displayEmail}</span>
                                                <button class="icon-btn btn-copy-email" data-email="${emailVal}" title="Copy email"><span class="material-icons" style="font-size:0.85rem;">content_copy</span></button>
                                            </div>
                                            
                                        </div>
                                    `;
                                    return `<td class="col-email" ${labelAttr}>${emailHtml}</td>`;
                                }

                                return `<td class="truncate-cell col-generic" data-col="${colKey}" title="${val}" style="font-size: 0.75rem;" ${labelAttr}>${val}</td>`;
                            }).join('');

                            return `<tr data-form-number="${app['Form Number']}" class="${hasRollNo ? 'admission-confirmed-row' : ''}">${rowCells}</tr>`;
                        } catch (err) {
                            console.error('Row render error:', err);
                            return `<tr><td colspan="${activeCols.length}">Error rendering row: ${err.message}</td></tr>`;
                        }
                    }).join('');

            // [FIX] Use DocumentFragment for performant batch insertion
            const fragment = document.createDocumentFragment();
            const tempBody = document.createElement('tbody');
            tempBody.innerHTML = rowsHtml;
            while (tempBody.firstChild) {
                fragment.appendChild(tempBody.firstChild);
            }
            targetTableBody.innerHTML = '';
            targetTableBody.appendChild(fragment);

            // [NEW] Force layout and scroll to top of table
            const parent = targetTableBody.closest('.table-responsive');
            if (parent) {
                parent.scrollTop = 0;
                parent.style.display = 'none';
                parent.offsetHeight; // Force reflow
                parent.style.display = 'block';
            }
        }
    }

    // Initialize tooltips for the newly rendered activity icons
    setTimeout(() => initActivityTooltips(), 50);

    // [NEW] Unified Pagination: Single point of truth in the header
    const paginationConfigs = [
        { info: 'mainHeaderInfo', prev: 'mainHeaderPrev', next: 'mainHeaderNext' }
    ];

    paginationConfigs.forEach(paginationConfig => {
        const infoEl = document.getElementById(paginationConfig.info);
        if (infoEl) infoEl.textContent = `${state.adminData.page} / ${totalPages}`;

        const prevBtn = document.getElementById(paginationConfig.prev);
        if (prevBtn) {
            prevBtn.disabled = state.adminData.page <= 1;
            prevBtn.onclick = () => {
                state.adminData.page = Math.max(1, state.adminData.page - 1);
                if (typeof clearIdCardResults === 'function') clearIdCardResults();
                renderAdminDashboard();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            };
        }

        const nextBtn = document.getElementById(paginationConfig.next);
        if (nextBtn) {
            nextBtn.disabled = state.adminData.page >= totalPages;
            nextBtn.onclick = () => {
                state.adminData.page = Math.min(totalPages, state.adminData.page + 1);
                if (typeof clearIdCardResults === 'function') clearIdCardResults();
                renderAdminDashboard();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            };
        }
    });

    // Re-attach listeners (scoped to targetTableBody for massive performance boost)
    if (targetTableBody) {
        targetTableBody.querySelectorAll('.btn-actions-menu').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const targetBtn = e.currentTarget;
                const cell = targetBtn.closest('td');
                const menu = cell.querySelector('.actions-menu');

                document.querySelectorAll('.actions-menu.show').forEach(m => {
                    if (m !== menu) {
                        m.classList.remove('show');
                        const otherCell = m.closest('td');
                        if (otherCell) otherCell.style.zIndex = '10';
                    }
                });

                if (menu.classList.contains('show')) {
                    menu.classList.remove('show');
                    cell.style.zIndex = '10';
                    return;
                }

                cell.style.zIndex = '1001';
                const rect = targetBtn.getBoundingClientRect();
                menu.style.position = 'fixed';
                menu.style.zIndex = '100000';
                menu.style.visibility = 'hidden';
                menu.style.top = '-9999px';
                menu.style.left = '-9999px';
                menu.style.display = 'block';

                const menuWidth = menu.offsetWidth;
                const menuHeight = menu.offsetHeight;
                let top = rect.bottom + 6;
                let left = rect.right - menuWidth;

                if (left + menuWidth > window.innerWidth - 10) left = window.innerWidth - menuWidth - 10;
                if (left < 10) left = 10;
                if (top + menuHeight > window.innerHeight - 10) top = rect.top - menuHeight - 6;

                menu.style.top = `${top}px`;
                menu.style.left = `${left}px`;
                menu.style.display = '';
                menu.style.visibility = '';
                menu.classList.add('show');
            });
        });

        targetTableBody.querySelectorAll('.event-icon').forEach(icon => {
            icon.addEventListener('click', async (e) => {
                const row = e.target.closest('tr');
                const formNumber = row?.dataset?.formNumber;
                if (!formNumber) return;
                await openEventDetailsPopup(formNumber);
            });
        });

        targetTableBody.querySelectorAll('.btn-view-pdf').forEach(btn => btn.onclick = handleAdminViewPDF);
        targetTableBody.querySelectorAll('.menu-view').forEach(btn => btn.onclick = handleAdminView);
        targetTableBody.querySelectorAll('.menu-edit').forEach(btn => btn.onclick = handleAdminEdit);
        targetTableBody.querySelectorAll('.menu-delete').forEach(btn => btn.onclick = handleAdminDelete);
        targetTableBody.querySelectorAll('.menu-unlock').forEach(btn => btn.onclick = handleAdminUnlock);
        targetTableBody.querySelectorAll('.menu-history').forEach(btn => btn.onclick = (e) => { const row = e.currentTarget.closest('tr'); const form = row?.dataset?.formNumber; if (form) openEventDetailsPopup(form); });
        targetTableBody.querySelectorAll('.menu-lock-now').forEach(btn => btn.onclick = handleAdminLockNow);
        targetTableBody.querySelectorAll('.menu-download-pdf').forEach(btn => btn.onclick = handleAdminDownloadPDF);
        targetTableBody.querySelectorAll('.menu-send-pass').forEach(btn => btn.onclick = handleAdminSendPassword);
        targetTableBody.querySelectorAll('.menu-reject').forEach(btn => btn.onclick = handleAdminReject);
        targetTableBody.querySelectorAll('.menu-send-whatsapp').forEach(btn => btn.onclick = handleAdminSendWhatsApp);
        targetTableBody.querySelectorAll('.btn-copy-email').forEach(btn => btn.onclick = async (ev) => {
            const email = ev.currentTarget.dataset.email || '';
            if (!email) return;
            try { await navigator.clipboard.writeText(email); showAlert('admin-alert', 'Email copied', 'success'); } catch (e) { }
        });
            
            document.querySelectorAll('.roll-no-input').forEach(input => {
                input.addEventListener('change', async (e) => {
                    const formNo = e.target.dataset.form;
                    const newRollNo = e.target.value;
                    const originalValue = e.target.defaultValue;
                    if (!formNo) return;
                    e.target.disabled = true;
                    e.target.style.opacity = '0.7';
                    try {
                        const result = await runServerFunction('updateStudentRollNo', formNo, newRollNo, state.currentUser);
                        if (result.success) {
                            showAlert('admin-alert', `Roll No updated for Form ${formNo}`, 'success');
                            e.target.defaultValue = newRollNo;
                            const app = state.adminData.applications.find(a => String(a['Form Number']) === String(formNo));
                            if (app) app['Class Roll No'] = newRollNo;
                        } else {
                            throw new Error(result.message || 'Update failed');
                        }
                    } catch (err) {
                        showAlert('admin-alert', `Failed to update Roll No: ${err.message}`, 'danger');
                        e.target.value = originalValue;
                    } finally {
                        e.target.disabled = false;
                        e.target.style.opacity = '1';
                    }
                });
            });
        } // [FIX] Add missing closing brace for if (targetTableBody) block
            // Batch actions
            const selectAll = document.getElementById('adminSelectAll');
            if (selectAll) {
                selectAll.onclick = () => {
                    document.querySelectorAll('.admin-select-row').forEach(cb => { cb.checked = selectAll.checked; });
                };
            }
            const getSelectedForms = () => Array.from(document.querySelectorAll('.admin-select-row:checked')).map(cb => cb.dataset.form).filter(Boolean);
            const getFormsFromInput = () => [];
            document.getElementById('batchDeleteBtn')?.addEventListener('click', async () => {
                const forms = [...new Set([...getSelectedForms(), ...getFormsFromInput()])];
                for (const f of forms) await handleAdminDelete({ target: { closest: () => ({ dataset: { formNumber: f } }) } });
            });
            document.getElementById('batchUnlockBtn')?.addEventListener('click', async () => {
                const forms = [...new Set([...getSelectedForms(), ...getFormsFromInput()])];
                for (const f of forms) await handleAdminUnlock({ target: { closest: () => ({ dataset: { formNumber: f } }) } });
            });
            document.getElementById('batchSendPassBtn')?.addEventListener('click', async () => {
                const forms = [...new Set([...getSelectedForms(), ...getFormsFromInput()])];
                for (const f of forms) await handleAdminSendPassword({ target: { closest: () => ({ dataset: { formNumber: f } }) } });
            });
            document.getElementById('backupBtn')?.addEventListener('click', async function handleBackupClick() {
                try {
                    const formNumbers = await showInputModal(
                        'Backup PDFs & Photos',
                        'Enter form numbers to backup (comma separated, or leave empty for all):',
                        'Form Numbers',
                        '',
                        'text'
                    );

                    // Empty input means all students
                    const forms = formNumbers
                        ? formNumbers.split(',').map(s => s.trim()).filter(Boolean)
                        : [];

                    // [NEW] Check for recent backups
                    checkRecentAndProceed('Class Backup Folder', async () => {
                        showAlert('admin-alert', `Starting backup for ${forms.length > 0 ? forms.length : 'all'} form(s)...`, 'info');

                        // Batch processing state
                        let backupState = {
                            isProcessing: true,
                            processedCount: 0,
                            totalCount: 0,
                            continuationToken: null,
                            timestamp: null
                        };

                        let batchNumber = 1;

                        while (backupState.isProcessing) {
                            setLoading(true);
                            setLoadingMessage(`Backup batch ${batchNumber}... (${backupState.processedCount} forms processed)`);

                            const requestData = {
                                formNumbers: forms,
                                batchSize: 30,
                                continuationToken: backupState.continuationToken,
                                timestamp: backupState.timestamp,
                                processedCount: backupState.processedCount
                            };

                            const response = await runServerFunction('backupPdfsWithClassOrganization', requestData, state.currentUser);

                            if (!response?.success) {
                                throw new Error(response?.message || 'Backup failed');
                            }

                            // Update state
                            backupState.processedCount = response.processedCount;
                            backupState.totalCount = response.totalCount;
                            backupState.continuationToken = response.continuationToken;
                            backupState.timestamp = response.timestamp;
                            backupState.isProcessing = response.hasMore;

                            const progress = response.totalCount > 0
                                ? Math.round((response.processedCount / response.totalCount) * 100)
                                : 0;

                            console.log(`Backup batch ${batchNumber}: ${backupState.processedCount}/${backupState.totalCount} (${progress}%)`);
                            batchNumber++;

                            if (response.hasMore) {
                                await new Promise(resolve => setTimeout(resolve, 500));
                            }
                        }

                        showAlert('admin-alert', `[OK] Backup complete! Processed ${backupState.processedCount} forms`, 'success');
                    });

                } catch (error) {
                    if (error.message !== 'Cancelled') {
                        handleError(error);
                    }
                } finally {
                    setLoading(false);
                }
            });
            document.getElementById('exportBtn')?.addEventListener('click', handleExport);
            document.getElementById('printReportBtn')?.addEventListener('click', openPrintSettings);
            document.getElementById('subjectListBtn')?.addEventListener('click', () => {
                // Navigate to Tools tab and show Subject-wise Lists section
                state.adminTab = 'tools';
                // Use setTimeout to ensure render completes before switching tab
                setTimeout(() => {
                    const subjectListsTabBtn = document.querySelector('[data-tab="tab-subject-lists"]');
                    if (subjectListsTabBtn) {
                        subjectListsTabBtn.click();
                    }
                    // Initialize the subject lists
                    try {
                        if (typeof initSubjectLists === 'function') initSubjectLists();
                    } catch (e) {
                        console.warn('Failed to init subject lists:', e);
                    }
                }, 100);
                render();
            });
            // Add Refresh button
            const header = document.querySelector('#adminDashboardView .dashboard-header');
            if (header && !header.querySelector('#refreshBtn')) {
                const refreshBtn = document.createElement('button');
                refreshBtn.id = 'refreshBtn';
                refreshBtn.className = 'btn btn-secondary btn-small btn-refresh';
                refreshBtn.title = 'Refresh data';
                refreshBtn.innerHTML = '<span class="material-icons" style="font-size: 1rem;">refresh</span>';
                refreshBtn.addEventListener('click', () => {
                    setLoading(true);
                    runServerFunction('getInitialDataForUser', state.currentUser)
                        .then(handleInitialData)
                        .catch(handleError)
                        .finally(() => setProgressBar(false));
                });
                header.appendChild(refreshBtn);
            }
            // Bind existing refresh button if present
            const refreshBtnExisting = header?.querySelector('#refreshBtn');
            if (refreshBtnExisting && !refreshBtnExisting.dataset.bound) {
                refreshBtnExisting.addEventListener('click', () => {
                    setLoading(true);
                    runServerFunction('getInitialDataForUser', state.currentUser)
                        .then(handleInitialData)
                        .catch(handleError)
                        .finally(() => setProgressBar(false));
                });
                refreshBtnExisting.dataset.bound = 'true';
            }
            try {
                const bindFilterListener = (id, evt) => {
                    const el = document.getElementById(id);
                    if (el && !el.dataset.bound) {
                        el.addEventListener(evt, () => {
                            state.adminData.page = 1;
                            if (typeof clearIdCardResults === 'function') clearIdCardResults();
                            renderAdminDashboard();
                        });
                        el.dataset.bound = 'true';
                    }
                };
                bindFilterListener('sortBy', 'change');
                bindFilterListener('pageSize', 'input');
            } catch (error) {
                console.error('CRITICAL: renderApplications failed:', error);
                if (dom.adminTableBody) {
                    dom.adminTableBody.innerHTML = `<tr><td colspan="20" style="text-align:center; padding:2rem; color:var(--danger);">Error: ${error.message}</td></tr>`;
                }
            }
        } catch (outerError) {
            console.error('Outer renderApplications failure:', outerError);
        }
    }

    // Expose editor open handler for inline onclick usage
    window.handleOpenSubjectEditor = handleOpenSubjectEditor
    // [MODIFIED] Renders the subject editor with clickable groups and numeric inputs
    function renderSubjectsEditor() {
        const config = state.adminData.subjectsConfig || {};
        const classes = ['8th', '9th', '10th', '11th', '12th'];

        // 1. Build Tabs HTML
        let tabsHtml = '<div class="tabs">';
        classes.forEach((cls, index) => {
            const isActive = index === 0 ? 'active' : '';
            tabsHtml += `<button class="tab-btn btn-small ${isActive}" data-target="subject-tab-${cls}" style="border:none; background:none;">${cls}</button>`;
        });
        tabsHtml += '</div>';

        // 2. Build Content HTML
        let contentHtml = '';
        classes.forEach((cls, index) => {
            const isHidden = index === 0 ? '' : 'hidden';
            contentHtml += `<div id="subject-tab-${cls}" class="subject-tab-pane ${isHidden}">`;

            const streams = cls === '8th' || cls === '9th' || cls === '10th' ? ['General'] : ['Science', 'Humanities'];
            streams.forEach(stream => {
                const data = config[cls]?.[stream] || { compulsory: [], group1: [], group2: [], minTotal: 5, maxTotal: 6, g1Min: 0, g1Max: 1, g2Min: 0, g2Max: 1 };
                const renderGroup = (group, title) => {
                    const subjects = data[group] || [];
                    let rulesInline = '';
                    if (group === 'group1') {
                        rulesInline = `<div class="rules-inline">
                   <span class="field-hint">G1 Min</span><input type="number" class="rule-input" min="0" max="5" value="${data.g1Min}" data-cls="${cls}" data-stream="${stream}" data-type="g1Min">
                   <span class="field-hint">G1 Max</span><input type="number" class="rule-input" min="0" max="5" value="${data.g1Max}" data-cls="${cls}" data-stream="${stream}" data-type="g1Max">
                 </div>`;
                    } else if (group === 'group2') {
                        rulesInline = `<div class="rules-inline">
                   <span class="field-hint">G2 Min</span><input type="number" class="rule-input" min="0" max="5" value="${data.g2Min}" data-cls="${cls}" data-stream="${stream}" data-type="g2Min">
                   <span class="field-hint">G2 Max</span><input type="number" class="rule-input" min="0" max="5" value="${data.g2Max}" data-cls="${cls}" data-stream="${stream}" data-type="g2Max">
                 </div>`;
                    } else if (group === 'compulsory') {
                        rulesInline = `<div class="rules-inline">
                   <span class="field-hint">Count</span><span>${subjects.length}</span>
                 </div>`;
                    }
                    return `
              <div class="subject-group-list" title="Click the edit icon to modify ${title} for ${cls} ${stream}">
                <h5>${title} <span class="meta">${cls} ? ${stream}</span> <span class="material-icons edit-icon" onclick="handleOpenSubjectEditor('${cls}', '${stream}', '${group}')">edit</span></h5>
                <div>${subjects.length > 0 ? subjects.map(s => `<span class="subject-badge">${s}</span>`).join('') : '<span class="field-hint">Click to add</span>'}</div>
                ${rulesInline}
              </div>
            `;
                };
                contentHtml += `
            <div class="subjects-config-row" data-class="${cls}" data-stream="${stream}">
              <div class="class-col" style="display:none;">${cls}</div> <!-- Hidden as tab context implies class -->
              <div style="font-weight:600; color:var(--primary); margin-bottom:0.5rem;">${stream} Stream</div>
              <div>
                <div class="rules-inline">
                  <span class="field-hint">Min Subjects</span>
                  <input type="number" class="rule-input" min="0" max="10" value="${data.minTotal ?? 0}" data-cls="${cls}" data-stream="${stream}" data-type="minTotal">
                </div>
              </div>
              <div>
                <div class="rules-inline">
                  <span class="field-hint">Max Subjects</span>
                  <input type="number" class="rule-input" min="4" max="10" value="${data.maxTotal}" data-cls="${cls}" data-stream="${stream}" data-type="maxTotal">
                </div>
              </div>
              ${renderGroup('compulsory', 'Group A (Compulsory)')}
              ${renderGroup('group1', 'Group B')}
              ${renderGroup('group2', 'Group C')}
            </div>
          `;
            });
            contentHtml += '</div>'; // End tab pane
        });

        dom.subjectsConfigContainer.innerHTML = tabsHtml + contentHtml;

        // Add Event Listeners for Tabs
        const tabBtns = dom.subjectsConfigContainer.querySelectorAll('.tab-btn');
        tabBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                // Deactivate all
                tabBtns.forEach(b => b.classList.remove('active'));
                dom.subjectsConfigContainer.querySelectorAll('.subject-tab-pane').forEach(p => p.classList.add('hidden'));

                // Activate clicked
                e.target.classList.add('active');
                const targetId = e.target.getAttribute('data-target');
                document.getElementById(targetId).classList.remove('hidden');
            });
        });
    }
    function sync10thSubjectsWith9th() {
        try {
            const currentClass = state.editingFormData?.['Admission sought for class'] || state.selectedClassForNewApp || '';
            if (currentClass !== '10th') return;
            let src = document.querySelector('.subjects-section[data-field-name="Subjects Studied in Class 9th"]');
            let dst = document.querySelector('.subjects-section[data-field-name="Subjects to be taken in Class 10th"]');
            if (!src || !dst) {
                src = document.querySelector('.subjects-section[data-grade="9th"]');
                dst = document.querySelector('.subjects-section[data-grade="10th"]');
            }
            if (!src || !dst) return;
            const srcChecks = src.querySelectorAll('input[type="checkbox"]');
            const dstChecks = dst.querySelectorAll('input[type="checkbox"]');
            const chosen = new Set(Array.from(srcChecks).filter(cb => cb.checked).map(cb => cb.value));
            // Only lock if there is a non-empty selection in Class 9th
            if (chosen.size > 0) {
                dstChecks.forEach(cb => {
                    cb.checked = chosen.has(cb.value);
                    cb.disabled = true;
                    cb.title = 'Locked to match Class 9th selection';
                });
                const msg = dst.querySelector('.validation-msg');
                if (msg) { msg.textContent = 'Subjects locked to match Class 9th selection.'; msg.className = 'validation-msg info'; }
            } else {
                dstChecks.forEach(cb => { cb.disabled = false; cb.title = ''; });
                const msg = dst.querySelector('.validation-msg');
                if (msg) { msg.textContent = 'Select subjects as required'; msg.className = 'validation-msg info'; }
            }
        } catch (e) { }
    }
    function warnIfNonUrduInGroupB9th10th() {
        try {
            const sections = document.querySelectorAll('.subjects-section[data-grade="9th"], .subjects-section[data-grade="10th"]');
            sections.forEach(sec => {
                const groupB = sec.querySelector('[data-group="group1"]');
                if (!groupB) return;
                const selected = Array.from(groupB.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value);
                if (selected.length && !selected.includes('Urdu')) {
                    const msg = sec.querySelector('.validation-msg') || document.createElement('div');
                    msg.className = 'validation-msg warning';
                    msg.textContent = 'There is no teacher for this language in the school.';
                    groupB.appendChild(msg);
                }
            });
        } catch (e) { }
    }
    // [ENHANCED] Saves subjects config with confirmation
    function handleSaveSubjects() {
        if (!state.currentUser) {
            showAlert('admin-alert', 'Session expired. Please log in again.', 'danger');
            return;
        }
        showConfirm('Are you sure you want to save the subjects configuration? This will update the Subjects_Config sheet.')
            .then(() => {
                setBtnLoading(document.getElementById('saveSubjectsBtn'), true, 'Saving...');
                // State is already updated by inputs, just save it
                // [Fix] Stringify user object to prevent valid object from being dropped by google.script.run
                runServerFunction('saveSubjectsConfig', state.adminData.subjectsConfig, JSON.stringify(state.currentUser))
                    .then(response => {
                        if (response?.success) {
                            showAlert('admin-alert', '[OK] ' + response.message + ' The changes are now live!', 'success');
                        } else throw new Error(response?.message || 'Failed to save');
                    })
                    .catch(handleError)
                    .finally(() => setBtnLoading(document.getElementById('saveSubjectsBtn'), false, 'Save Subjects Config (v2)'));
            })
            .catch(() => {
                console.log('Save cancelled');
            });
    }

    // Handle Generate Subject Lists
    function handleGenerateSubjectLists() {
        try {
            // [FIX] Use getMultiSelectValues for multi-select containers
            const sessionVals = getMultiSelectValues('subjectListSession');
            const classVals = getMultiSelectValues('subjectListClass');
            const statusVals = getMultiSelectValues('subjectListStatus');
            const order = document.getElementById('subjectListOrder')?.value || 'form_number';

            const selectedCols = Array.from(document.querySelectorAll('.subject-col-toggle:checked'))
                .map(cb => cb.value);

            if (!state.adminData.applications || state.adminData.applications.length === 0) {
                showAlert('admin-alert', 'No data available. Visit Apps tab first.', 'warning');
                return;
            }

            // [NEW] Check for recent subject list reports
            checkRecentAndProceed('Subject Lists', async () => {
                setLoadingMessage(`Generating subject-wise lists...`);
                setLoading(true);
                const requestData = {
                    session: sessionVals,
                    classFilter: classVals,
                    status: statusVals,
                    order: order,
                    columns: selectedCols,
                    applications: state.adminData.applications
                };

                try {
                    const response = await runServerFunction('generateSubjectLists', requestData, JSON.stringify(state.currentUser));
                    if (response?.success) {
                        showAlert('admin-alert', `[OK] ${response.message}`, 'success');
                        const resultsContainer = document.getElementById('subjectListResults');
                        const resultsLog = document.getElementById('subjectListLog');

                        if (resultsContainer && resultsLog) {
                            resultsContainer.style.display = 'block';
                            if (response.folderId) {
                                const zipBtn = document.getElementById('downloadSubjectListsZipBtn');
                                if (zipBtn) {
                                    zipBtn.style.display = 'inline-flex';
                                    zipBtn.onclick = () => downloadFolderAsZip(response.folderId, 'Subject_Wise_Lists');
                                }
                            }
                            if (response.pdfFiles && response.pdfFiles.length > 0) {
                                let linksHtml = response.pdfFiles.map((item, idx) => {
                                    const safeTitle = (item.title || 'Report').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
                                    return `<a href="${item.driveUrl}" target="_blank" rel="noopener" style="padding:0.3rem 0.7rem; margin:3px; background:var(--bg-card); border:1px solid var(--border); border-radius:4px; font-size:0.75rem; display:inline-flex; align-items:center; gap:4px; text-decoration:none; color:inherit;">
                                        <span class="material-icons" style="font-size:0.85rem; color:#8b5cf6;">picture_as_pdf</span>
                                        ${idx + 1}. ${safeTitle}
                                    </a>`;
                                }).join('');

                                if (response.folderUrl) {
                                    linksHtml += `<a href="${response.folderUrl}" target="_blank" style="padding:0.3rem 0.7rem; margin:3px; border-radius:4px; font-size:0.75rem; display:inline-flex; align-items:center; text-decoration:none; color:var(--primary);">
                                        <span class="material-icons" style="font-size:0.85rem;">folder_open</span>
                                        Open Result Folder
                                    </a>`;
                                }

                                resultsLog.innerHTML = `<div style="display:flex; flex-wrap:wrap; gap:4px; margin-top:10px;">${linksHtml}</div>`;
                            }
                        }
                    } else throw new Error(response?.message || 'Generation failed');
                } catch (err) {
                    handleError(err);
                } finally {
                    setLoading(false);
                }
            });
        } catch (e) {
            handleError(e);
            setLoading(false);
        }
    }

    // [MODIFIED] Form Editor - Enhanced populate and validation
    function renderFormEditor(instructionsAgreed = false) {
        try {
            // Use global cleanup function to ensure Tools content is completely hidden
            forceHideAllTools();

            // Skip instructions modal and render directly
            dom.formEditorTitle.textContent = state.isEditing ? 'Admission Application' : 'Admission Application';
            const subtitle = document.getElementById('formEditorSubtitle');
            if (subtitle) {
                subtitle.textContent = state.isEditing ? `Editing Application #${state.editingFormData?.['Form Number'] || 'N/A'}` : '';
            }
            state.subjectError = false; // Reset subject error on render
            dom.formFieldsContainer.innerHTML = '';

            // [NEW] Safety check: If form structure is missing, attempt to fetch it
            if (!state.formStructure || state.formStructure.length === 0) {
                console.warn('Form structure missing, attempting to fetch...');
                dom.formFieldsContainer.innerHTML = `
                    <div style="padding:4rem 2rem; text-align:center;">
                        <div class="spinner-small" style="display:inline-block; margin-bottom:1.5rem; width:40px; height:40px; border-width:3px;"></div>
                        <h3 style="color:var(--primary); margin-bottom:0.5rem;">Synchronizing Layout</h3>
                        <p style="color:var(--text-secondary); max-width:300px; margin:0 auto;">Connecting to Secure Form Server to fetch the latest application structure...</p>
                    </div>`;

                runServerFunction('getFormStructure').then(struct => {
                    if (struct && struct.length > 0) {
                        console.log('Form structure recovered successfully.');
                        state.formStructure = struct;
                        renderFormEditor(instructionsAgreed);
                    } else {
                        throw new Error('The Admission Form structure is empty on the server. Please check the "Form_Structure" sheet.');
                    }
                }).catch(err => {
                    console.error('Layout synchronization failed:', err);
                    dom.formFieldsContainer.innerHTML = `<div class="alert alert-danger" style="margin:2rem; padding:2rem; text-align:center; border-radius:12px; border-left:8px solid var(--danger);">
                        <span class="material-icons" style="font-size:3rem; margin-bottom:1rem;">error_outline</span>
                        <h3 style="margin-bottom:0.5rem;">Structure Load Failure</h3>
                        <p style="margin-bottom:1.5rem;">The admission form could not be loaded because the server returned an empty or invalid configuration.</p>
                        <div style="display:flex; justify-content:center; gap:10px;">
                            <button onclick="renderFormEditor()" class="btn btn-secondary">Retry Sync</button>
                            <button onclick="location.reload()" class="btn btn-primary">Full Reload</button>
                        </div>
                    </div>`;
                });
                return;
            }
        } catch (err) {
            console.error('[UI] Form Editor Initialization Failed:', err);
            showGlobalError('Failed to initialize the form editor. Please try refreshing the page.');
            return;
        }

        // Start countdown timer if editing an unlocked form
        if (state.isEditing && state.editingFormData?.unlockExpiry) {
            const expiryTime = new Date(state.editingFormData.unlockExpiry).getTime();
            if (expiryTime > Date.now()) {
                startCountdownTimer(expiryTime);
            } else {
                stopCountdownTimer();
            }
        } else {
            stopCountdownTimer();
        }
        let currentData = state.editingFormData || {};
        const currentClass = currentData['Admission sought for class'] || state.selectedClassForNewApp || '';
        const currentStream = currentData['Stream for Class 11th'] || currentData['Stream opted in Class 11th'] || '';

        // Update sticky header info
        const formInfoClass = document.getElementById('formInfoClass');
        const formInfoForm = document.getElementById('formInfoForm');
        const formInfoEmail = document.getElementById('formInfoEmail');
        if (formInfoClass) formInfoClass.innerHTML = `<strong>Class:</strong> ${currentClass || 'Not selected'}`;
        if (formInfoForm) formInfoForm.innerHTML = `<strong>Form Number:</strong> ${currentData['Form Number'] || 'New'}`;
        const formInfoSession = document.getElementById('formInfoSession');
        const formInfoStatus = document.getElementById('formInfoStatus');
        if (formInfoSession) formInfoSession.innerHTML = `<strong>Session:</strong> ${state.adminData?.settings?.session || '2025-26'}`;
        if (formInfoStatus) {
            const unlocked = !!currentData.isUnlockedEditMode && (!!currentData.unlockExpiry && new Date(currentData.unlockExpiry).getTime() > Date.now());
            const statusLabel = (currentData['Status'] === 'Submitted' && state.isEditing)
                ? (unlocked ? 'Submitted (Editing Unlocked)' : 'Submitted (Read-only)')
                : (currentData['Status'] || (state.isEditing ? 'Draft' : 'Draft'));
            formInfoStatus.innerHTML = `<strong>Status:</strong> ${statusLabel}`;
        }
        // Set header logo if provided via settings
        try {
            // Default logo from drive id if admin hasn't set one
            const defaultDriveLogo = 'https://raw.githubusercontent.com/admexamhssshangus-dot/hss.shangus_website/refs/heads/main/public/logo.png';
            const url = state.adminData?.settings?.logo_url_resolved || state.adminData?.settings?.logo_url || state.adminData?.settings?.logoUrl || defaultDriveLogo;
            if (dom.schoolLogo) {
                if (url) {
                    dom.schoolLogo.src = url;
                    dom.schoolLogo.style.display = 'inline-block';
                } else {
                    dom.schoolLogo.style.display = 'none';
                }
            }
        } catch (e) { /* ignore */ }
        const viewOnly = !state.isEditing;
        const upgradeActive = !!currentData.isUpgradeFlow;
        const upgradeAllowed = null; // Removed upgradeAllowed logic to enable full editing
        // Prefill class for new app even in edit mode so stream/subjects render correctly
        if (state.selectedClassForNewApp) {
            currentData['Admission sought for class'] = state.selectedClassForNewApp;
        }
        const sections = {
            'personal': { title: '1. Personal Details', fields: ["Student's Name (as per school records)", "DoB (as per school records)", 'Gender', "Father's/Guardian's Name (as per school records)", "Mother's Name (as per school records)", "Father's/Guardian's Occupation"], gridClass: 'grid-3', visible: true },
            'contact': { title: '2. Contact & Address Details', fields: ['Mobile No. (with working WhatsApp)', "Parent's Mobile No. (must be working)", 'Aadhar No.', 'House No.', 'Name of your village', 'Block', 'Tehsil', 'District', 'State/UT', 'PIN code', 'Email Address'], gridClass: 'grid-3', visible: true },
            'physical': { title: '3. Physical & Socio-Economic Details', fields: ['Height (cm)', 'Weight (kg)', 'Blood Group', 'Your Mother Tongue', 'Religion', 'Social category', 'Socio-economic category', 'Whether Any Disability', 'Type of Disability'], gridClass: 'grid-3', visible: true },
            'admission': { title: '4. Admission & Scholarship Details', fields: ['Admission sought for class', 'Whether scholarship received in previous academic year', 'Type of scholarship received', 'Amount received (INR)', 'Bank Account No.', 'Name of Bank', 'IFSC code'], gridClass: 'grid-3', visible: true },
            'academic9th': { title: '5. Academic Details', fields: ['DIET Registration No.', 'Year of Passing Class 8th', 'Name of Previous School (Class 8th)', 'Board (Class 8th)', 'Total Marks Obtained in Class 8th', 'Total Max. Marks in Class 8th', 'Subjects Studied in Class 8th', 'Subjects to be taken in Class 9th', 'Name of Previous Complex Head'], gridClass: 'grid-2', visible: false },
            'academic10th': { title: '5. Academic Details', fields: ['Board Registration No. (Class 9th)', 'Year of Passing Class 9th', 'Name of Previous School (Class 9th)', 'Board (Class 9th)', 'Total Max. Marks in Class 9th', 'Total Marks Obtained in Class 9th', 'Subjects Studied in Class 9th', 'Subjects to be taken in Class 10th'], gridClass: 'grid-2', visible: false },
            'academic11th': { title: '5. Academic Details (Class 11th)', fields: ['Admission Type (Class 11th)', 'Reason for Provisional (Class 11th)', 'Board Registration No. (Class 10th)', 'Exam Roll Number of Class 10th', 'Year of Passing Class 10th', 'Year of Appearing (Class 10th)', 'Total Marks Obtained in Class 10th', 'Total Max. Marks in Class 10th', 'Subjects Studied in Class 10th', 'Stream for Class 11th', 'Subjects to be taken in Class 11th', 'Subjects to Reappear (Class 10th)', 'Name of Previous School (Class 10th)', 'Board (Class 10th)'], gridClass: 'grid-2', visible: false },
            'academic12th': { title: '5. Academic Details (Class 12th)', fields: ['Admission Type (Class 12th)', 'Reason for Provisional (Class 12th)', 'Board Registration No. (Class 11th)', 'Exam Roll Number of Class 11th', 'Year of Passing Class 11th', 'Year of Appearing (Class 11th)', 'Board (Class 11th)', 'Total Marks Obtained in Class 11th', 'Total Max. Marks in Class 11th', 'Stream opted in Class 11th', 'Subjects Studied in Class 11th', 'Stream & Subjects for Class 12th', 'Subjects to Reappear (Class 11th)', 'Name of Previous School (Class 11th)'], gridClass: 'grid-2', visible: false },
            'vocational': { title: '6. Vocational Details', fields: ['Vocational subject in previous class', 'Percentage Obtained in Vocational Subject'], gridClass: 'grid-2', visible: true },
            'additional': { title: '7. Additional Information', fields: ['Passport No. (if available)', 'Identification Mark (if any)', 'Previous participation in sports (if any)', 'Games to participate', 'PEN Number (given by UDISE portal)', 'APAAR ID'], gridClass: 'grid-3', visible: true },
            'uploads': { title: '8. Uploads & Remarks', fields: ['Student Photo', 'Remarks/Feedback (if any)'], gridClass: 'grid-end', visible: true },
            'declaration': { title: '9. Declaration', fields: ['Declaration'], gridClass: 'grid-1', visible: true }
        };
        // Render sections
        Object.entries(sections).forEach(([key, section]) => {
            const fieldset = document.createElement('fieldset');
            fieldset.id = `section-${key}`;
            fieldset.style.display = section.visible ? 'block' : 'none';
            const legend = document.createElement('legend');
            legend.textContent = section.title;
            fieldset.appendChild(legend);
            const container = document.createElement('div');
            container.className = section.gridClass || '';
            if (key === 'academic11th') {
                container.style.rowGap = '0.25rem';
            }
            // [MODIFIED] Special handling for the 3-column upload section
            if (key === 'uploads') {
                const photoConfig = state.formStructure.find(f => f.fieldName === 'Student Photo');
                const photoVal = currentData['Student Photo'] || '';
                const photoDisabled = viewOnly || (upgradeAllowed && state.currentUser?.role !== 'Admin' && !upgradeAllowed.has('Student Photo'));
                const photoUploadHtml = photoConfig ? createFormField('Student Photo', photoConfig, photoVal, photoDisabled, currentClass, currentStream) : '<div class="form-group error">Missing Student Photo config</div>';
                const photoPreviewHtml = `
        <div class="form-group">
          <label>Photo Preview</label>
          <img id="photo-preview" src="${state.oldPhotoUrl || ''}" alt="Photo Preview" style="display: ${state.oldPhotoUrl ? 'block' : 'none'};">
          ${viewOnly ? '' : '<button type="button" id="deletePhotoBtn" class="btn btn-danger btn-small" style="margin-top:0.5rem;">Delete Photo</button>'}
        </div>
      `;
                const remarksConfig = state.formStructure.find(f => f.fieldName === 'Remarks/Feedback (if any)');
                const remarksVal = currentData['Remarks/Feedback (if any)'] || '';
                const remarksDisabled = viewOnly || (upgradeAllowed && state.currentUser?.role !== 'Admin' && !upgradeAllowed.has('Remarks/Feedback (if any)'));
                const remarksHtml = remarksConfig ? createFormField('Remarks/Feedback (if any)', remarksConfig, remarksVal, remarksDisabled, currentClass, currentStream) : '<div class="form-group error">Missing Remarks config</div>';
                container.innerHTML += photoUploadHtml + photoPreviewHtml + remarksHtml;
            } else {
                // Default rendering for all other sections
                let inlineReason11Rendered = false;
                section.fields.forEach(fieldName => {
                    // Special inline pair: Admission Type (Class 11th) + Reason for Provisional (Class 11th)
                    if (key === 'academic11th' && fieldName === 'Admission Type (Class 11th)') {
                        const admCfg = state.formStructure.find(f => f.fieldName === 'Admission Type (Class 11th)');
                        const reasonCfg = state.formStructure.find(f => f.fieldName === 'Reason for Provisional (Class 11th)');
                        const admVal = currentData['Admission Type (Class 11th)'] || '';
                        const reasonVal = currentData['Reason for Provisional (Class 11th)'] || '';
                        const admDisabled = viewOnly || (upgradeAllowed && state.currentUser?.role !== 'Admin' && !upgradeAllowed.has('Admission Type (Class 11th)'));
                        const reasonDisabled = viewOnly || (upgradeAllowed && state.currentUser?.role !== 'Admin' && !upgradeAllowed.has('Reason for Provisional (Class 11th)'));
                        const admHtml = admCfg ? createFormField('Admission Type (Class 11th)', admCfg, admVal, admDisabled, currentClass, currentStream) : '';
                        const reasonHtml = reasonCfg ? createFormField('Reason for Provisional (Class 11th)', reasonCfg, reasonVal, reasonDisabled, currentClass, currentStream) : '';
                        const inlineCls = (admVal === 'Provisional') ? 'inline-2 two' : 'inline-2 one';
                        container.innerHTML += `<div class="${inlineCls}">${admHtml}${reasonHtml}</div>`;
                        inlineReason11Rendered = true;
                        return; // Skip normal rendering for this field
                    }
                    if (key === 'academic11th' && fieldName === 'Reason for Provisional (Class 11th)' && inlineReason11Rendered) {
                        return; // Already rendered inline next to Admission Type
                    }
                    const fieldConfig = state.formStructure.find(f => f.fieldName === fieldName);
                    if (fieldConfig) {
                        const value = currentData[fieldName] || '';
                        const isDisabled = viewOnly || (fieldName === 'Admission sought for class' && (state.currentUser?.role !== 'Admin')) || (upgradeAllowed && state.currentUser?.role !== 'Admin' && !upgradeAllowed.has(fieldName));

                        // Special label for provisional years
                        let displayName = fieldName;
                        if (currentClass.includes('-Provisional')) {
                            if (fieldName === 'Year of Passing Class 10th') displayName = 'Year of Appearing Class 10th';
                            if (fieldName === 'Year of Passing Class 11th') displayName = 'Year of Appearing Class 11th';
                        }

                        container.innerHTML += createFormField(displayName, fieldConfig, value, isDisabled, currentClass, currentStream);
                    }
                });
            }
            fieldset.appendChild(container);
            dom.formFieldsContainer.appendChild(fieldset);
        });
        // Setup conditionals
        setupConditionals();
        // Handle class change (prefilled, so initial call)
        const classSelect = document.querySelector('[name="Admission sought for class"]');
        if (classSelect) {
            const status = currentData['Status'] || 'Draft';
            classSelect.disabled = viewOnly || (state.currentUser?.role !== 'Admin');
            handleClassChange({ target: { value: currentClass } });
        }
        // Handle stream change
        const streamFieldName = currentClass === '11th' ? 'Stream for Class 11th' : currentClass === '12th' ? 'Stream opted in Class 11th' : null;
        if (streamFieldName) {
            const streamSelect = document.querySelector(`[name="${streamFieldName}"]`);
            if (streamSelect) {
                streamSelect.addEventListener('change', handleStreamChange);
                if (currentStream) handleStreamChange({ target: { value: currentStream } });
            }
        }
        // Photo upload listener (it's in the 'uploads' section now)
        const photoInput = document.querySelector('[name="Student Photo"]');
        if (photoInput) {
            photoInput.addEventListener('change', handlePhotoUpload);
        }
        if (!viewOnly) document.getElementById('deletePhotoBtn')?.addEventListener('click', handlePhotoDelete);
        // Real-time validation
        setupRealTimeValidation();
        setupLocationHints();
        setupBackButtonConfirm();
        // [NEW] Setup school name autocomplete  
        setupSchoolAutocomplete();
        const saveDraftBtn = document.getElementById('saveDraftBtn');
        const finalSubmitBtn = document.getElementById('finalSubmitBtn');
        if (saveDraftBtn) saveDraftBtn.style.display = upgradeActive ? 'none' : '';
        if (finalSubmitBtn) finalSubmitBtn.textContent = upgradeActive ? 'Submit Full Admission Form' : 'Final Submit';

        // Disable autosave: rely on explicit Save Draft

        // Skip autosave restore prompt

        // Show helpful message for new applications
        // Remove filling instructions alert
    }
    // [MODIFIED] Conditional Logic - Enhanced for reappear and provisional
    function setupConditionals() {
        // Disability
        const disabilitySelect = document.querySelector('[name="Whether Any Disability"]');
        const disabilityTypeGroup = document.querySelector('[name="Type of Disability"]')?.closest('.form-group');
        if (disabilitySelect && disabilityTypeGroup) {
            function toggleDisabilityType() {
                const hasDisability = disabilitySelect.value === 'Yes';
                const disabilityTypeInput = disabilityTypeGroup.querySelector('input, select, textarea');
                if (disabilityTypeInput) disabilityTypeInput.disabled = !hasDisability;
                disabilityTypeGroup.style.display = hasDisability ? 'block' : 'none';

                const config = state.formStructure.find(f => f.fieldName === 'Type of Disability');
                if (config) config.required = hasDisability; // Dynamically set required

                if (disabilityTypeInput && !hasDisability) disabilityTypeInput.value = '';
                if (disabilityTypeInput) validateField(disabilityTypeInput, config, document.getElementById(`hint-${disabilityTypeInput.id}`));
            }
            disabilitySelect.addEventListener('change', toggleDisabilityType);
            toggleDisabilityType(); // Initial
        }
        // Scholarship
        const scholarshipSelect = document.querySelector('[name="Whether scholarship received in previous academic year"]');
        const scholarshipTypeGroup = document.querySelector('[name="Type of scholarship received"]')?.closest('.form-group');
        const amountInputGroup = document.querySelector('[name="Amount received (INR)"]')?.closest('.form-group');
        if (scholarshipSelect && scholarshipTypeGroup && amountInputGroup) {
            function toggleScholarshipFields() {
                const received = scholarshipSelect.value === 'Yes';
                const typeInput = scholarshipTypeGroup.querySelector('input, select, textarea');
                const amountInput = amountInputGroup.querySelector('input, select, textarea');
                if (typeInput) typeInput.disabled = !received;
                if (amountInput) amountInput.disabled = !received;
                scholarshipTypeGroup.style.display = received ? 'block' : 'none';
                amountInputGroup.style.display = received ? 'block' : 'none';

                const typeConfig = state.formStructure.find(f => f.fieldName === 'Type of scholarship received');
                if (typeConfig) typeConfig.required = received;
                const amountConfig = state.formStructure.find(f => f.fieldName === 'Amount received (INR)');
                if (amountConfig) amountConfig.required = received;
                if (!received) {
                    if (typeInput) typeInput.value = '';
                    if (amountInput) amountInput.value = '';
                }
                if (typeInput) validateField(typeInput, typeConfig, document.getElementById(`hint-${typeInput.id}`));
                if (amountInput) validateField(amountInput, amountConfig, document.getElementById(`hint-${amountInput.id}`));
            }
            scholarshipSelect.addEventListener('change', toggleScholarshipFields);
            toggleScholarshipFields(); // Initial
        }
        // Vocational
        const vocationalSelect = document.querySelector('[name="Vocational subject in previous class"]');
        const vocationalPctGroup = document.querySelector('[name="Percentage Obtained in Vocational Subject"]')?.closest('.form-group');
        if (vocationalSelect && vocationalPctGroup) {
            function toggleVocationalPct() {
                const hasVocational = vocationalSelect.value === 'Yes';
                const pctInput = vocationalPctGroup.querySelector('input, select, textarea');
                if (pctInput) pctInput.disabled = !hasVocational;
                vocationalPctGroup.style.display = hasVocational ? 'block' : 'none';

                const pctConfig = state.formStructure.find(f => f.fieldName === 'Percentage Obtained in Vocational Subject');
                if (pctConfig) pctConfig.required = hasVocational;

                if (pctInput && !hasVocational) pctInput.value = '';
                if (pctInput) validateField(pctInput, pctConfig, document.getElementById(`hint-${pctInput.id}`));
            }
            vocationalSelect.addEventListener('change', toggleVocationalPct);
            toggleVocationalPct(); // Initial
        }

        // Class 11th Admission Type Logic
        const admType11Field = document.querySelector('[name="Admission Type (Class 11th)"]');
        const reason11Field = document.querySelector('[name="Reason for Provisional (Class 11th)"]');

        if (admType11Field) {
            function toggleClass11Fields() {
                const isProvisional = admType11Field.value === 'Provisional';
                const isFull = admType11Field.value === 'Full';
                const isReappear = reason11Field ? reason11Field.value === 'Reappear Candidate' : false;
                const inlineContainer = admType11Field.closest('.inline-2');
                if (inlineContainer) {
                    inlineContainer.classList.toggle('two', isProvisional);
                    inlineContainer.classList.toggle('one', !isProvisional);
                }

                // Show/hide Reason field
                if (reason11Field) {
                    const reasonGroup = reason11Field.closest('.form-group');
                    if (reasonGroup) {
                        reasonGroup.style.display = isProvisional ? 'block' : 'none';
                        if (!isProvisional) reason11Field.value = '';
                    }
                }

                // Show/hide Subjects to Reappear
                const reappear10Section = document.querySelector('[data-field-name="Subjects to Reappear (Class 10th)"]');
                const reappear10Group = reappear10Section ? reappear10Section.closest('.form-group') : null;
                if (reappear10Group) {
                    reappear10Group.style.display = (isProvisional && isReappear) ? 'block' : 'none';
                    if (!isProvisional || !isReappear) {
                        const checks = reappear10Group.querySelectorAll('input[type="checkbox"]');
                        checks.forEach(cb => { cb.checked = false; });
                        const fieldName = 'Subjects to Reappear (Class 10th)';
                        const hiddenInput = document.querySelector(`[name="${fieldName}"]`);
                        if (hiddenInput) hiddenInput.value = '';
                        const msg = reappear10Group.querySelector('.validation-msg');
                        if (msg) { msg.className = 'validation-msg info'; msg.textContent = 'Only if Reappear Candidate'; }
                    }
                }

                // Toggle Year fields
                const yearPassingGroup = document.querySelector('[name="Year of Passing Class 10th"]')?.closest('.form-group');
                const yearAppearingGroup = document.querySelector('[name="Year of Appearing (Class 10th)"]')?.closest('.form-group');
                if (yearPassingGroup) yearPassingGroup.style.display = isFull ? 'block' : 'none';
                if (yearAppearingGroup) yearAppearingGroup.style.display = isProvisional ? 'block' : 'none';
                if (yearPassingGroup && !isFull) {
                    const inp = yearPassingGroup.querySelector('input, select, textarea');
                    if (inp) inp.value = '';
                }
                if (yearAppearingGroup && !isProvisional) {
                    const inp = yearAppearingGroup.querySelector('input, select, textarea');
                    if (inp) inp.value = '';
                }
                if (yearPassingGroup && !isFull) {
                    const inp = yearPassingGroup.querySelector('input, select, textarea');
                    if (inp) inp.value = '';
                }
                if (yearAppearingGroup && !isProvisional) {
                    const inp = yearAppearingGroup.querySelector('input, select, textarea');
                    if (inp) inp.value = '';
                }

                // Toggle Marks fields (only for Full)
                const marksGroup = document.querySelector('[name="Total Marks Obtained in Class 10th"]')?.closest('.form-group');
                const maxMarksGroup = document.querySelector('[name="Total Max. Marks in Class 10th"]')?.closest('.form-group');
                if (marksGroup) marksGroup.style.display = isFull ? 'block' : 'none';
                if (maxMarksGroup) maxMarksGroup.style.display = isFull ? 'block' : 'none';
                if (marksGroup && !isFull) { const inp = marksGroup.querySelector('input'); if (inp) inp.value = ''; }
                if (maxMarksGroup && !isFull) { const inp = maxMarksGroup.querySelector('input'); if (inp) inp.value = ''; }
                if (marksGroup && !isFull) { const inp = marksGroup.querySelector('input'); if (inp) inp.value = ''; }
                if (maxMarksGroup && !isFull) { const inp = maxMarksGroup.querySelector('input'); if (inp) inp.value = ''; }
                enforceAcademic11thRequired();
            }

            admType11Field.addEventListener('change', toggleClass11Fields);
            if (reason11Field) reason11Field.addEventListener('change', toggleClass11Fields);
            toggleClass11Fields(); // Initial
        }

        // Class 12th Admission Type Logic
        const admType12Field = document.querySelector('[name="Admission Type (Class 12th)"]');
        const reason12Field = document.querySelector('[name="Reason for Provisional (Class 12th)"]');

        if (admType12Field) {
            function toggleClass12Fields() {
                const isProvisional = admType12Field.value === 'Provisional';
                const isFull = admType12Field.value === 'Full';
                const isReappear = reason12Field ? reason12Field.value === 'Reappear Candidate' : false;

                // Show/hide Reason field
                if (reason12Field) {
                    const reasonGroup = reason12Field.closest('.form-group');
                    if (reasonGroup) {
                        reasonGroup.style.display = isProvisional ? 'block' : 'none';
                        if (!isProvisional) reason12Field.value = '';
                    }
                }

                // Show/hide Subjects to Reappear
                const reappear11Section = document.querySelector('[data-field-name="Subjects to Reappear (Class 11th)"]');
                const reappear11Group = reappear11Section ? reappear11Section.closest('.form-group') : null;
                if (reappear11Group) {
                    reappear11Group.style.display = (isProvisional && isReappear) ? 'block' : 'none';
                    if (!isProvisional || !isReappear) {
                        const checks = reappear11Group.querySelectorAll('input[type="checkbox"]');
                        checks.forEach(cb => { cb.checked = false; });
                        const fieldName = 'Subjects to Reappear (Class 11th)';
                        const hiddenInput = document.querySelector(`[name="${fieldName}"]`);
                        if (hiddenInput) hiddenInput.value = '';
                        const msg = reappear11Group.querySelector('.validation-msg');
                        if (msg) { msg.className = 'validation-msg info'; msg.textContent = 'Only if Reappear Candidate'; }
                    }
                }

                // Toggle Year fields
                const yearPassingGroup = document.querySelector('[name="Year of Passing Class 11th"]')?.closest('.form-group');
                const yearAppearingGroup = document.querySelector('[name="Year of Appearing (Class 11th)"]')?.closest('.form-group');
                if (yearPassingGroup) yearPassingGroup.style.display = isFull ? 'block' : 'none';
                if (yearAppearingGroup) yearAppearingGroup.style.display = isProvisional ? 'block' : 'none';
                if (yearPassingGroup && !isFull) {
                    const inp = yearPassingGroup.querySelector('input, select, textarea');
                    if (inp) inp.value = '';
                }
                if (yearAppearingGroup && !isProvisional) {
                    const inp = yearAppearingGroup.querySelector('input, select, textarea');
                    if (inp) inp.value = '';
                }

                // Toggle Marks fields (only for Full)
                const marksGroup = document.querySelector('[name="Total Marks Obtained in Class 11th"]')?.closest('.form-group');
                const maxMarksGroup = document.querySelector('[name="Total Max. Marks in Class 11th"]')?.closest('.form-group');
                if (marksGroup) marksGroup.style.display = isFull ? 'block' : 'none';
                if (maxMarksGroup) maxMarksGroup.style.display = isFull ? 'block' : 'none';
                if (marksGroup && !isFull) { const inp = marksGroup.querySelector('input'); if (inp) inp.value = ''; }
                if (maxMarksGroup && !isFull) { const inp = maxMarksGroup.querySelector('input'); if (inp) inp.value = ''; }

                enforceAcademic12thRequired();
            }

            admType12Field.addEventListener('change', toggleClass12Fields);
            if (reason12Field) reason12Field.addEventListener('change', toggleClass12Fields);
            toggleClass12Fields(); // Initial
        }
    }
    // [NEW] Setup school name autocomplete for "Name of Previous School" fields
    function setupSchoolAutocomplete() {
        // Get school names from config (comma-separated string)
        const schoolNamesRaw = state.adminData?.settings?.school_names || '';
        if (!schoolNamesRaw) return; // No school names configured

        const schoolNames = schoolNamesRaw.split(',').map(s => s.trim()).filter(Boolean);
        if (schoolNames.length === 0) return;

        // Find all school name input fields
        const schoolFields = [
            'Name of Previous School (Class 8th)',
            'Name of Previous School (Class 9th)',
            'Name of Previous School (Class 10th)',
            'Name of Previous School (Class 11th)'
        ];

        schoolFields.forEach(fieldName => {
            const input = document.querySelector(`[name="${fieldName}"]`);
            if (!input || input.disabled) return;

            // Skip if already has checklist
            if (input.parentElement?.querySelector('.school-checklist')) return;

            const formGroup = input.closest('.form-group');
            if (!formGroup) return;

            // Create checklist container below the input
            const checklistDiv = document.createElement('div');
            checklistDiv.className = 'school-checklist';

            // Build checkbox list
            schoolNames.forEach((name, idx) => {
                const label = document.createElement('label');
                label.className = 'school-checklist-item';
                label.innerHTML = `
            <input type="checkbox" name="school-radio-${fieldName.replace(/\s/g, '-')}" value="${name}" />
            <span>${name}</span>
          `;
                const checkbox = label.querySelector('input');

                // Check if this is the current value
                if (input.value.trim().toLowerCase() === name.toLowerCase()) {
                    checkbox.checked = true;
                }

                checkbox.addEventListener('change', () => {
                    if (checkbox.checked) {
                        // Uncheck others
                        checklistDiv.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                            if (cb !== checkbox) cb.checked = false;
                        });
                        input.value = name;
                        input.dispatchEvent(new Event('input', { bubbles: true }));
                    } else {
                        // If unchecking, clear input (or leave it? user said allow uncheck, usually implies clearing)
                        if (input.value === name) {
                            input.value = '';
                            input.dispatchEvent(new Event('input', { bubbles: true }));
                        }
                    }
                });

                checklistDiv.appendChild(label);
            });

            // Add "Other" option for custom school
            const otherLabel = document.createElement('label');
            otherLabel.className = 'school-checklist-item school-other';
            otherLabel.innerHTML = `
          <input type="checkbox" name="school-radio-${fieldName.replace(/\s/g, '-')}" value="__other__" />
          <span>Other (type in the field above)</span>
        `;
            const otherCheckbox = otherLabel.querySelector('input');

            // Check "other" if current value doesn't match any predefined school
            const isCustomValue = input.value.trim() && !schoolNames.some(n => n.toLowerCase() === input.value.trim().toLowerCase());
            if (isCustomValue) {
                otherCheckbox.checked = true;
            }

            otherCheckbox.addEventListener('change', () => {
                if (otherCheckbox.checked) {
                    // Uncheck others
                    checklistDiv.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                        if (cb !== otherCheckbox) cb.checked = false;
                    });
                    input.focus();
                }
            });

            checklistDiv.appendChild(otherLabel);

            // Insert checklist after input
            formGroup.appendChild(checklistDiv);

            // When user types in the input, select "Other" and filter visible items
            input.addEventListener('input', (e) => {
                const val = e.target.value.trim().toLowerCase();
                const words = val.split(/\s+/).filter(Boolean);
                const items = Array.from(checklistDiv.querySelectorAll('.school-checklist-item:not(.school-other)'));

                if (val.length === 0) {
                    items.forEach(item => item.style.display = '');
                    checklistDiv.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
                    return;
                }

                // Scoring logic
                const scored = items.map(item => {
                    const text = item.querySelector('span').textContent.toLowerCase();
                    const radio = item.querySelector('input');
                    let score = 0;

                    if (text === val) score = 100;
                    else if (text.startsWith(val)) score = 80;
                    else {
                        const allWordsMatch = words.every(w => text.includes(w));
                        if (allWordsMatch) score = 60;
                        else {
                            const matchCount = words.filter(w => text.includes(w)).length;
                            if (matchCount > 0) score = 20 + matchCount;
                        }
                    }
                    return { item, score, radio, text };
                });

                // Sort by score and visibility
                scored.sort((a, b) => b.score - a.score);

                let matchFound = false;
                scored.forEach(s => {
                    if (s.score > 0) {
                        s.item.style.display = '';
                        checklistDiv.appendChild(s.item); // Reorder by score
                        if (s.text === val) {
                            s.radio.checked = true;
                            matchFound = true;
                        }
                    } else {
                        s.item.style.display = 'none';
                    }
                });

                // Re-append "Other" at the end
                checklistDiv.appendChild(otherLabel);

                if (!matchFound) {
                    otherRadio.checked = true;
                }
            });
        });
    }
    // [MODIFIED] createFormField - Enhanced for populate and rules
    function createFormField(fieldName, config, value, isDisabled = false, currentClass = '', currentStream = '', prevClass = null) {
        if (!config) {
            console.error('Field configuration missing for:', fieldName);
            return `<div class="form-group error" style="border: 1px solid var(--danger); padding: 0.5rem; border-radius: 4px; background: rgba(220, 38, 38, 0.05);">
                        <label style="color: var(--danger); font-weight: 600;">[ERROR] Configuration Missing</label>
                        <div style="font-size: 0.8rem; color: var(--text-secondary);">The field "${fieldName}" could not be rendered because its configuration is missing. Please contact Admin.</div>
                    </div>`;
        }
        // Apply formatting based on field name
        const properCaseFields = [
            "Student's Name (as per school records)",
            "Father's/Guardian's Name (as per school records)",
            "Mother's Name (as per school records)",
            "Name of your village",
            "Block",
            "Tehsil",
            "District"
        ];

        if (properCaseFields.includes(fieldName)) {
            value = toProperCase(value);
        } else if (fieldName === 'Email Address') {
            value = toLowerCase(value);
        }

        const id = `field-${fieldName.replace(/[^a-zA-Z0-9]/g, '-')}`;
        let required = config.required ? '<span class="required">*</span>' : '';
        let requiredAttr = config.required ? 'required' : '';
        // [Modified] Allow Admins to edit even if form is locked (isDisabled passed as true)
        const disabledAttr = (isDisabled && state.currentUser?.role !== 'Admin') ? 'disabled' : '';
        let displayLabel = fieldName;
        const emphasizeList = [
            '(as per school records)',
            '(with working WhatsApp)',
            '(must be working)',
            '(cm)',
            '(kg)',
            '(Class 8th)',
            '(Class 9th)',
            '(Class 10th)',
            '(Class 11th)',
            '(Class 12th)',
            'Class 8th',
            'Class 9th',
            'Class 10th',
            'Class 11th',
            'Class 12th'
        ];
        emphasizeList.forEach(tag => {
            if (displayLabel.includes(tag)) {
                displayLabel = displayLabel.replace(tag, `<span class="emphasized-text">${tag}</span>`);
            }
        });
        // Handle dynamic required status
        if (fieldName === 'Type of Disability') {
            const parentVal = document.querySelector('[name="Whether Any Disability"]')?.value;
            if (parentVal !== 'Yes') { required = ''; requiredAttr = ''; }
        }
        if (fieldName === 'Type of scholarship received' || fieldName === 'Amount received (INR)') {
            const parentVal = document.querySelector('[name="Whether scholarship received in previous academic year"]')?.value;
            if (parentVal !== 'Yes') { required = ''; requiredAttr = ''; }
        }
        if (fieldName === 'Percentage Obtained in Vocational Subject') {
            const parentVal = document.querySelector('[name="Vocational subject in previous class"]')?.value;
            if (parentVal !== 'Yes') { required = ''; requiredAttr = ''; }
        }
        // DoB remains mandatory as per latest requirement
        let isDobField = (fieldName === 'DoB (as per school records)');
        let inputHtml = '';
        const targetClassForField = {
            'Subjects Studied in Class 8th': '8th',
            'Subjects to be taken in Class 9th': '9th',
            'Subjects Studied in Class 9th': '9th',
            'Subjects to be taken in Class 10th': '10th',
            'Subjects Studied in Class 10th': '10th',
            'Subjects to be taken in Class 11th': '11th',
            'Subjects Studied in Class 11th': '11th',
            'Stream & Subjects for Class 12th': '12th'
        };
        const targetClass = targetClassForField[config.fieldName] || currentClass;
        // Handle stream logic for 9th/10th
        let effectiveStream = currentStream;
        if (targetClass === '8th' || targetClass === '9th' || targetClass === '10th') {
            effectiveStream = 'General';
        }
        const cfgRoot = (state.subjectsConfig && Object.keys(state.subjectsConfig).length > 0)
            ? state.subjectsConfig
            : (state.adminData?.subjectsConfig || {});
        const dynConfig = cfgRoot[targetClass]?.[effectiveStream];
        // Special handling for Stream & Subjects for Class 12th
        if (config.fieldName === 'Stream & Subjects for Class 12th') {
            if (isAnyAdmin()) {
                inputHtml = `<input type="text" id="${id}" name="${config.fieldName}" value="${value || 'Same as in class 11th'}" ${requiredAttr}>`;
                const hint = '<div class="field-hint">Admins may adjust; defaults to same as Class 11th</div>';
                return `
            <div class="form-group">
              <label for="${id}">${fieldName}</label>
              ${inputHtml}
              ${hint}
              <div id="hint-${id}" class="field-hint"></div>
            </div>
          `;
            } else {
                inputHtml = `<input type="text" id="${id}" name="${config.fieldName}" value="Same as in class 11th" readonly disabled style="background: var(--bg); cursor: not-allowed; color: var(--text-secondary);">`;
                const hint = '<div class="field-hint">Stream and subjects remain same as Class 11th</div>';
                return `
            <div class="form-group">
              <label for="${id}">${fieldName}</label>
              ${inputHtml}
              ${hint}
              <div id="hint-${id}" class="field-hint"></div>
            </div>
          `;
            }
        }

        // If stream missing, try to read current select value directly (robust to timing)
        if ((!effectiveStream) && (targetClass === '11th' || targetClass === '12th')) {
            const liveStreamFieldName = targetClass === '11th' ? 'Stream for Class 11th' : 'Stream opted in Class 11th';
            const liveStream = document.querySelector(`[name="${liveStreamFieldName}"]`)?.value || '';
            if (liveStream) {
                effectiveStream = liveStream;
            }
        }

        const maxMarksKeyMap = {
            'Total Max. Marks in Class 8th': 'max_marks_allowed_8th',
            'Total Max. Marks in Class 9th': 'max_marks_allowed_9th',
            'Total Max. Marks in Class 10th': 'max_marks_allowed_10th',
            'Total Max. Marks in Class 11th': 'max_marks_allowed_11th',
            'Total Max. Marks in Class 12th': 'max_marks_allowed_12th'
        };
        const maxMarksKey = maxMarksKeyMap[config.fieldName];
        let maxMarksOptions = [];
        if (maxMarksKey) {
            const settings = state.adminData?.settings || {};
            const raw = settings[maxMarksKey];
            maxMarksOptions = raw ? String(raw).split(',').map(s => s.trim()).filter(Boolean) : ['500', '600'];
        }

        switch (config.fieldType) {
            case 'text':
            case 'text_numeric':
                const maxLength = config.options || '100';
                const pattern = config.fieldType === 'text_numeric' ? `pattern="[0-9]{${maxLength}}"` : '';
                inputHtml = `<input type="text" id="${id}" name="${config.fieldName}" value="${value}" ${requiredAttr} maxlength="${maxLength}" ${pattern} ${disabledAttr}>`;
                break;
            case 'date':
                // Special modern UI for DoB: separate day-month-year, show dd-mm-yyyy
                if (config.fieldName === "DoB (as per school records)") {
                    let d = '', m = '', y = '';
                    if (value) {
                        const v = String(value).trim();
                        const ddmmyyyy = v.match(/^([0-9]{2})-([0-9]{2})-([0-9]{4})$/);
                        const yyyymmdd = v.match(/^([0-9]{4})-([0-9]{2})-([0-9]{2})$/);
                        if (ddmmyyyy) { d = ddmmyyyy[1]; m = ddmmyyyy[2]; y = ddmmyyyy[3]; }
                        else if (yyyymmdd) { d = yyyymmdd[3]; m = yyyymmdd[2]; y = yyyymmdd[1]; }
                    }
                    let dayOptions = '<option value="">DD</option>';
                    for (let i = 1; i <= 31; i++) {
                        const val = String(i).padStart(2, '0');
                        dayOptions += `<option value="${val}" ${d === val ? 'selected' : ''}>${val}</option>`;
                    }
                    let monthOptions = '<option value="">MM</option>';
                    for (let i = 1; i <= 12; i++) {
                        const val = String(i).padStart(2, '0');
                        monthOptions += `<option value="${val}" ${m === val ? 'selected' : ''}>${val}</option>`;
                    }
                    const currentYear = new Date().getFullYear();
                    let yearOptions = '<option value="">YYYY</option>';
                    for (let yy = currentYear; yy >= 1970; yy--) {
                        yearOptions += `<option value="${yy}" ${y == yy ? 'selected' : ''}>${yy}</option>`;
                    }
                    inputHtml = `
              <div class="dob-group" data-field-name="${config.fieldName}">
                <select id="${id}-day" class="dob-input" ${requiredAttr} ${disabledAttr} aria-label="Day">${dayOptions}</select>
                <span class="dob-sep">-</span>
                <select id="${id}-month" class="dob-input" ${requiredAttr} ${disabledAttr} aria-label="Month">${monthOptions}</select>
                <span class="dob-sep">-</span>
                <select id="${id}-year" class="dob-input" ${requiredAttr} ${disabledAttr} aria-label="Year">${yearOptions}</select>
                <input type="hidden" id="${id}" name="${config.fieldName}" value="${value}">
              </div>
              <div class="field-hint">Enter DoB in dd-mm-yyyy format.</div>`;
                } else {
                    const maxDate = new Date().toISOString().split('T')[0];
                    inputHtml = `<input type="date" id="${id}" name="${config.fieldName}" value="${value}" ${requiredAttr} max="${maxDate}" ${disabledAttr}>`;
                }
                break;
            case 'list':
                if ((config.fieldName === 'Whether scholarship received in previous academic year' || config.fieldName === 'Vocational subject in previous class' || config.fieldName === 'Whether Any Disability') && (!value || value === '')) {
                    value = 'No';
                }
                const allowedVals = config.options.split(',').map(opt => opt.trim());
                const isCustom = value && !allowedVals.includes(value);
                const selectVal = isCustom ? 'Other' : value;
                const options = allowedVals.map(opt => `<option value="${opt}" ${selectVal === opt ? 'selected' : ''}>${opt}</option>`).join('');
                const otherDisplay = selectVal === 'Other' ? 'block' : 'none';
                const otherValue = isCustom ? value : '';
                inputHtml = `<div class="list-with-other"><select id="${id}" name="${config.fieldName}" ${requiredAttr} ${disabledAttr}>
            <option value="">-- Select --</option>${options}</select>
            <input type="text" id="${id}-other" class="other-input" placeholder="Please specify *" value="${otherValue}" style="display:${otherDisplay};" ${disabledAttr}></div>`;
                break;
            case 'number':
                if (maxMarksKey && maxMarksOptions.length > 0) {
                    const strVal = value ? String(value).trim() : '';
                    const options = [];
                    options.push('<option value="">-- Select --</option>');
                    if (strVal && !maxMarksOptions.includes(strVal)) {
                        options.push(`<option value="${strVal}" selected>${strVal}</option>`);
                    }
                    maxMarksOptions.forEach(opt => {
                        options.push(`<option value="${opt}" ${strVal === opt ? 'selected' : ''}>${opt}</option>`);
                    });
                    inputHtml = `<select id="${id}" name="${config.fieldName}" ${requiredAttr} ${disabledAttr}>${options.join('')}</select>`;
                    break;
                }
                if (config.options === '2000-2025' || (config.fieldName.toLowerCase().includes('year') && config.options.startsWith('2000-'))) {
                    // Dropdown for years
                    let yearOptions = '<option value="">-- Select Year --</option>';
                    const currentYear = new Date().getFullYear();
                    const minYear = parseInt(config.options.split('-')[0]) || 2000;
                    for (let y = currentYear; y >= minYear; y--) {
                        yearOptions += `<option value="${y}" ${value == y ? 'selected' : ''}>${y}</option>`;
                    }
                    inputHtml = `<select id="${id}" name="${config.fieldName}" ${requiredAttr} ${disabledAttr}>${yearOptions}</select>`;
                } else {
                    inputHtml = `<input type="number" id="${id}" name="${config.fieldName}" value="${value}" ${requiredAttr} ${disabledAttr}>`;
                }
                break;
            // [NEW] Declaration checkbox
            case 'checkbox_declaration':
                inputHtml = `
            <div class="declaration-group">
              <p>${config.options}</p>
              <label>
                <input type="checkbox" id="${id}" name="${config.fieldName}" value="TRUE" ${value === 'TRUE' || value === true ? 'checked' : ''} ${requiredAttr}>
                I Understand and Agree
              </label>
            </div>
          `;
                break;
            case 'checkbox_dynamic':
                // Handle Games and Previous participation specially (fixed list, max 3)
                if (config.fieldName === 'Games to participate' || config.fieldName === 'Previous participation in sports (if any)') {
                    const GAMES = ['Kho-Kho', 'Kabaddi', 'Volleyball', 'Cricket', 'Football', 'Badminton', 'Table Tennis', 'Tug of War'];
                    const checkedValues = value ? value.split(',').map(s => s.trim()) : [];
                    let html = `<div class="games-section" data-field-name="${config.fieldName}">`;
                    html += `<h5>${config.fieldName} <small class="field-hint">(Select up to 3)</small></h5>`;
                    html += '<div class="checkbox-group">';
                    GAMES.forEach(g => {
                        html += `<label><input type="checkbox" name="${config.fieldName}[]" value="${g}" ${checkedValues.includes(g) ? 'checked' : ''}> ${g}</label>`;
                    });
                    html += '</div>';
                    html += `<div id="validation-field-${config.fieldName.replace(/[^a-zA-Z0-9]/g, '-')}" class="validation-msg info">Select up to 3 games</div>`;
                    html += '</div>';
                    inputHtml = html;
                    break;
                }
                // Handle Subjects to Reappear specially
                if (config.fieldName.includes('Subjects to Reappear')) {
                    // Use fixed lists independent of stream selection
                    const REAPPEAR_10 = ['English', 'Mathematics', 'Science', 'Social Studies', 'Urdu', 'Arabic', 'Hindi', 'Kashmiri', 'Healthcare', 'IT and ITES'];
                    const REAPPEAR_11 = ['General English', 'Physics', 'Chemistry', 'Biology', 'Mathematics', 'Urdu', 'Economics', 'Education', 'History', 'Political Science', 'Environmental Science', 'Physical Education', 'IT and ITES', 'Healthcare'];
                    const isClass10Reappear = (currentClass === '11th') || config.fieldName.includes('Class 10th');
                    const allReappearOptions = (isClass10Reappear ? REAPPEAR_10 : REAPPEAR_11);
                    const checkedValues = value ? value.split(',').map(s => s.trim()) : [];
                    let html = `<div class="subjects-section reappear" data-class="${currentClass}" data-field-name="${config.fieldName}">`;
                    html += '<h5>Subjects to Reappear (Max 5) <a href="#" class="clear-group" data-group="reappear">Clear</a></h5>';
                    html += '<div class="checkbox-group">';
                    allReappearOptions.forEach(sub => {
                        html += `<label><input type="checkbox" name="${config.fieldName}[]" value="${sub}" ${checkedValues.includes(sub) ? 'checked' : ''}> ${sub}</label>`;
                    });
                    html += '</div>';
                    html += `<div id="validation-${id}" class="validation-msg info">Only if Reappear Candidate</div>`;
                    html += '</div>';
                    inputHtml = html;
                    break;
                }
                // Handle no stream selected
                if (!effectiveStream) {
                    inputHtml = `<div class="subjects-section" data-class="${targetClass}" data-stream="" data-field-name="${config.fieldName}">
               <div class="field-hint warning">Please select a Stream first to see subject options.</div>
             </div>`;
                } else if (!dynConfig) {
                    inputHtml = `<div class="subjects-section" data-class="${targetClass}" data-stream="${effectiveStream}" data-field-name="${config.fieldName}">
              <div class="field-hint error">No subjects configured for ${targetClass} ${effectiveStream}. Please contact administrator.</div>
            </div>`;
                } else {
                    let html = `<div class="subjects-section" id="subjects-section" data-grade="${targetClass}" data-class="${targetClass}" data-stream="${effectiveStream}" data-field-name="${config.fieldName}">`;
                    const checkedValues = value ? value.split(',').map(s => s.trim()) : [];
                    // Compulsory
                    if (dynConfig.compulsory?.length > 0) {
                        html += '<div class="group compulsory"><h5>Group A (Compulsory)</h5><div class="checkbox-group">';
                        dynConfig.compulsory.forEach(sub => {
                            html += `<label><input type="checkbox" name="${config.fieldName}[]" value="${sub}" checked disabled> ${sub}</label>`; // Always checked and disabled
                        });
                        html += '</div></div>';
                    }
                    // Group B
                    if (dynConfig.group1?.length > 0) {
                        html += `<div class="group group1" data-group="group1"><h5>Group B Options <a href="#" class="clear-group" data-group="group1">Clear</a></h5><div class="checkbox-group">`;
                        dynConfig.group1.forEach(sub => {
                            html += `<label><input type="checkbox" name="${config.fieldName}[]" value="${sub}" ${checkedValues.includes(sub) ? 'checked' : ''}> ${sub}</label>`;
                        });
                        html += '</div></div>';
                    }
                    // Group C
                    if (dynConfig.group2?.length > 0) {
                        html += `<div class="group group2" data-group="group2"><h5>Group C Options <a href="#" class="clear-group" data-group="group2">Clear</a></h5><div class="checkbox-group">`;
                        dynConfig.group2.forEach(sub => {
                            html += `<label><input type="checkbox" name="${config.fieldName}[]" value="${sub}" ${checkedValues.includes(sub) ? 'checked' : ''}> ${sub}</label>`;
                        });
                        html += '</div></div>';
                    }
                    // Initial validation msg
                    html += `<div id="validation-${id}" class="validation-msg info">Select at least ${dynConfig.minTotal} and at most ${dynConfig.maxTotal} subjects</div>`;
                    html += '</div>';
                    inputHtml = html;
                }
                break;
            case 'number_range':
                let [rangeMin, rangeMax] = config.options.split('-').map(n => n.trim());
                const currentYearRange = new Date().getFullYear();
                if (config.fieldName.toLowerCase().includes('year') && parseInt(rangeMax) < currentYearRange) {
                    rangeMax = currentYearRange.toString();
                }
                inputHtml = `<input type="number" id="${id}" name="${config.fieldName}" value="${value}" ${requiredAttr} min="${rangeMin}" max="${rangeMax}" ${disabledAttr}>`;
                break;
            case 'image':
                // Just the input. Preview is handled by renderFormEditor
                inputHtml = `<input type="file" id="${id}" name="${config.fieldName}" accept="image/*">`;
                break;
            case 'textarea':
                const taMaxLength = config.options || '500';
                inputHtml = `<textarea id="${id}" name="${config.fieldName}" ${requiredAttr} maxlength="${taMaxLength}" ${disabledAttr}>${value}</textarea>`;
                break;
            case 'autogen':
            case 'autogen_email':
            case 'autogen_number':
                inputHtml = `<input type="text" id="${id}" name="${config.fieldName}" value="${value}" readonly style="background: var(--bg); cursor: not-allowed;">`;
                break;
            default:
                const isPen = (config.fieldName === 'PEN number (given by UDISE portal)');
                const isApaar = (config.fieldName === 'APAAR ID');
                const maxLen = isPen ? 11 : (isApaar ? 12 : null);
                const extraAttrs = maxLen ? `inputmode="numeric" maxlength="${maxLen}"` : '';
                inputHtml = `<input type="text" id="${id}" name="${config.fieldName}" value="${value}" ${requiredAttr} ${disabledAttr} ${extraAttrs}>`;
        }
        // Style Admission Type help text similar to 'Please select a Stream first...' (warning color)
        const blueHintFields = ['Mobile No. (with working WhatsApp)', "Parent's Mobile No. (must be working)", 'Aadhar No.', 'PIN code', 'E-mail ID', 'Height (cm)', 'Weight (kg)', 'Bank Account No.', 'IFSC code'];
        const needsBlue = blueHintFields.includes(config.fieldName);
        const hintClass = (config.fieldName && config.fieldName.startsWith('Admission Type')) ? 'field-hint warning' : (needsBlue ? 'field-hint blue' : 'field-hint');
        // [FIX] Suppress static help text for Declaration field (validation hint handles it)
        const hint = (config.helpText && config.fieldName !== 'Declaration') ? `<div class="${hintClass}">${config.helpText}</div>` : '';
        // Hide fields that are not relevant for the current class
        const allowedClasses = config.classes.split(',').map(c => c.trim());
        const isVisible = (allowedClasses.length === 0 || allowedClasses.includes(currentClass));
        // No optional marker for DoB (mandatory)
        const optionalText = '';
        const styleParts = [];
        if (!isVisible) styleParts.push('display: none;');
        if (currentClass === '11th' && config.fieldName === 'Subjects Studied in Class 10th') {
            styleParts.push('grid-row: span 2;');
        }
        const styleAttr = styleParts.length ? ` style="${styleParts.join(' ')}"` : '';
        return `
        <div class="form-group" data-field-name="${config.fieldName}"${styleAttr}>
          <label for="${id}">${displayLabel}${required}${optionalText}</label>
          ${inputHtml}
          ${hint}
          <div id="hint-${id}" class="field-hint"></div>
        </div>
      `;
    }
    // [MODIFIED] Real-time validation - Uses form_structure required
    function setupRealTimeValidation() {
        document.querySelectorAll('#admissionForm .form-group input, #admissionForm .form-group select, #admissionForm .form-group textarea').forEach(el => {
            if (el.type === 'file' || el.type === 'checkbox') return; // Handled separately
            const fieldName = el.name;
            const config = state.formStructure.find(f => f.fieldName === fieldName);
            if (!config) return;
            const hintEl = document.getElementById(`hint-${el.id}`);
            if (!hintEl) return;
            const validate = () => validateField(el, config, hintEl);
            el.addEventListener('blur', validate);
            el.addEventListener('input', validate);
            el.addEventListener('change', validate);
        });
        document.querySelectorAll('#admissionForm .form-group select').forEach(sel => {
            const otherEl = document.getElementById(`${sel.id}-other`);
            if (!otherEl) return;
            const cfg = state.formStructure.find(f => f.fieldName === sel.name);
            const hintEl = document.getElementById(`hint-${sel.id}`);
            const toggle = () => {
                const show = sel.value === 'Other';
                otherEl.style.display = show ? 'block' : 'none';
                if (!show) otherEl.value = '';
                if (cfg && hintEl) validateField(sel, cfg, hintEl);
            };
            sel.addEventListener('change', toggle);
            otherEl.addEventListener('input', () => { if (cfg && hintEl) validateField(sel, cfg, hintEl); });
            toggle();
        });
        // [NEW] Wire composite DoB selects
        const dobHidden = document.querySelector('[name="DoB (as per school records)"]');
        if (dobHidden) {
            const baseId = dobHidden.id;
            const dayEl = document.getElementById(`${baseId}-day`);
            const monthEl = document.getElementById(`${baseId}-month`);
            const yearEl = document.getElementById(`${baseId}-year`);
            const hintEl = document.getElementById(`hint-${baseId}`);
            const cfg = state.formStructure.find(f => f.fieldName === 'DoB (as per school records)');
            const recompute = () => {
                const dd = dayEl?.value || '';
                const mm = monthEl?.value || '';
                const yy = yearEl?.value || '';
                const val = (dd && mm && yy) ? `${dd}-${mm}-${yy}` : '';
                dobHidden.value = val;
                // [MODIFIED] Trigger input event on hidden field for better sync and validation
                dobHidden.dispatchEvent(new Event('input', { bubbles: true }));
                validateField(dobHidden, cfg, hintEl);
            };
            dayEl?.addEventListener('change', recompute);
            monthEl?.addEventListener('change', recompute);
            yearEl?.addEventListener('change', recompute);
            // Initial sync without triggering validation to avoid flash on load
            const dd = dayEl?.value || '';
            const mm = monthEl?.value || '';
            const yy = yearEl?.value || '';
            if (dd && mm && yy) dobHidden.value = `${dd}-${mm}-${yy}`;
        }
        // For dynamic subjects checkboxes
        document.querySelectorAll('.subjects-section input[type="checkbox"]').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => validateSubjects(e.target));
            // [NEW] Group1 change toggles Group2 disable
            if (checkbox.closest('.group1')) {
                checkbox.addEventListener('change', toggleGroup2Disable);
            }
            // [NEW] Sync 10th subjects and warn for non-Urdu in Group B
            checkbox.addEventListener('change', () => { sync10thSubjectsWith9th(); warnIfNonUrduInGroupB9th10th(); });
        });
        // Clear selection links
        document.querySelectorAll('.subjects-section .clear-group').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const group = e.target.closest('.group') || e.target.closest('.subjects-section');
                if (!group) return;
                group.querySelectorAll('input[type="checkbox"]').forEach(cb => { cb.checked = false; cb.disabled = false; cb.title = ''; });
                const anyCb = group.querySelector('input[type="checkbox"]');
                if (anyCb) validateSubjects(anyCb);
                const section = group.closest('.subjects-section');
                // If clearing in 10th subjects section, immediately re-sync and re-lock to 9th selection
                if (section && (section.dataset.fieldName === 'Subjects to be taken in Class 10th' || section.dataset.grade === '10th')) {
                    sync10thSubjectsWith9th();
                    warnIfNonUrduInGroupB9th10th();
                }
            });
        });
        // For games/previous participation checkbox groups - limit selection to 3
        document.querySelectorAll('.games-section .checkbox-group input[type="checkbox"]').forEach(cb => {
            cb.addEventListener('change', (e) => {
                const group = e.target.closest('.games-section');
                if (!group) return;
                const max = 3;
                const checked = group.querySelectorAll('input[type="checkbox"]:checked');
                if (checked.length > max) {
                    // Undo the last check and show a hint
                    e.target.checked = false;
                    const hint = group.querySelector('.validation-msg');
                    if (hint) {
                        hint.textContent = `You can select up to ${max} options only.`;
                        hint.classList.remove('info');
                        hint.classList.add('error');
                        setTimeout(() => { hint.textContent = `Select up to ${max}`; hint.classList.remove('error'); hint.classList.add('info'); }, 3000);
                    }
                }
            });
        });
        // [NEW] For declaration checkbox
        const declCheckbox = document.getElementById('field-Declaration');
        if (declCheckbox) {
            declCheckbox.addEventListener('change', (e) => {
                const hintEl = document.getElementById('hint-field-Declaration');
                const config = state.formStructure.find(f => f.fieldName === 'Declaration');
                validateField(e.target, config, hintEl);
            });
        }
        // Run initial validation for all subject groups
        document.querySelectorAll('.subjects-section').forEach(section => {
            const firstCheckbox = section.querySelector('input[type="checkbox"]');
            if (firstCheckbox) {
                validateSubjects(firstCheckbox);
                toggleGroup2Disable({ target: firstCheckbox }); // Initial disable check
                // Initial sync and warning
                sync10thSubjectsWith9th();
                warnIfNonUrduInGroupB9th10th();
            }
        });
        // Digits-only inputs with max length: PEN (11), APAAR (12)
        const limitDigits = (el, max, label) => {
            if (!el) return;
            el.setAttribute('inputmode', 'numeric');
            el.addEventListener('input', () => {
                const cleaned = (el.value || '').replace(/\D+/g, '').slice(0, max);
                if (el.value !== cleaned) el.value = cleaned;
                const hintEl = document.getElementById(`hint-${el.id}`);
                if (hintEl) {
                    hintEl.textContent = cleaned.length >= max ? `Max ${max} digits reached` : `Enter up to ${max} digits (${label})`;
                    hintEl.className = 'field-hint';
                }
            });
        };
        limitDigits(document.querySelector('[name="PEN number (given by UDISE portal)"]'), 11, 'PEN');
        limitDigits(document.querySelector('[name="APAAR ID"]'), 12, 'APAAR');
    }
    // [NEW] Toggle Group2 based on Group1 count
    function toggleGroup2Disable(e) {
        const checkbox = e && e.target ? e.target : null;
        const section = checkbox.closest('.subjects-section');
        if (!section) return;
        const targetClass = section.dataset['class'];
        const stream = section.dataset.stream;
        const data = state.subjectsConfig[targetClass]?.[stream];
        if (!data) return;
        const group1Checkboxes = section.querySelectorAll('.group1 input[type="checkbox"]');
        const g1count = Array.from(group1Checkboxes).filter(cb => cb.checked).length;
        const group2Checkboxes = section.querySelectorAll('.group2 input[type="checkbox"]');
        const isMaxG1 = (g1count === data.g1Max) && (data.g1Min < data.g1Max);
        group2Checkboxes.forEach(cb => {
            cb.disabled = isMaxG1;
            if (isMaxG1) cb.checked = false; // Uncheck when disabling
        });
        // Re-validate
        validateSubjects(checkbox);
    }
    // [MODIFIED] Field validation with better messages - Uses config.required
    function validateField(el, config, hintEl) {
        if (!el || !config || !hintEl) return true;
        // Ignore disabled elements (they are not required while disabled)
        if (el.disabled) {
            el.classList.remove('is-invalid');
            hintEl.textContent = '';
            hintEl.className = 'field-hint';
            return true;
        }
        const value = el.value.trim();

        // Check if required (considering dynamic required status)
        let isRequired = config.required;

        // Dynamic required logic
        if (config.fieldName === 'Type of Disability') {
            isRequired = document.querySelector('[name="Whether Any Disability"]')?.value === 'Yes';
        } else if (config.fieldName === 'Type of scholarship received' || config.fieldName === 'Amount received (INR)') {
            isRequired = document.querySelector('[name="Whether scholarship received in previous academic year"]')?.value === 'Yes';
        } else if (config.fieldName === 'Percentage Obtained in Vocational Subject') {
            isRequired = document.querySelector('[name="Vocational subject in previous class"]')?.value === 'Yes';
        }

        if (isRequired && !value && el.type !== 'checkbox') {
            el.classList.add('is-invalid');
            el.classList.remove('is-valid');
            hintEl.textContent = '[!] This field is required.';
            hintEl.className = 'field-hint error';
            return false;
        }
        // [NEW] Check declaration
        if (isRequired && el.type === 'checkbox' && !el.checked) {
            el.classList.add('is-invalid');
            el.classList.remove('is-valid');
            hintEl.textContent = 'You must agree to this declaration to submit the form';
            hintEl.className = 'field-hint error';
            return false;
        }

        // Additional validations
        if (value && (config.fieldType === 'number' || config.fieldType === 'number_range')) {
            const num = parseFloat(value);
            if (config.options) {
                let [min, max] = config.options.split('-').map(Number);
                // [NEW] Dynamic Max Year: If it's a year field, set max to current year dynamically
                const currentYear = new Date().getFullYear();
                if (config.fieldName.toLowerCase().includes('year') && max < currentYear) {
                    max = currentYear;
                }
                if (num < min || num > max) {
                    el.classList.add('is-invalid');
                    hintEl.textContent = `[!] Value must be between ${min} and ${max}.`;
                    hintEl.className = 'field-hint error';
                    return false;
                }
            }
        }
        // [NEW] Marks validation
        else if (config.fieldName.includes('Total Marks Obtained')) {
            const maxMarksField = document.querySelector(`[name="${config.fieldName.replace('Obtained', 'Max.')}"]`);
            if (maxMarksField) {
                const obtained = parseFloat(value);
                if (!isNaN(obtained) && !Number.isInteger(obtained)) {
                    el.classList.add('is-invalid');
                    hintEl.textContent = '[!] Marks must be a whole number.';
                    hintEl.className = 'field-hint error';
                    return false;
                }
                const max = parseFloat(maxMarksField.value);
                if (!isNaN(obtained) && !isNaN(max) && obtained > max) {
                    el.classList.add('is-invalid');
                    hintEl.textContent = '[!] Marks obtained cannot be greater than max marks.';
                    hintEl.className = 'field-hint error';
                    return false;
                }
            }
        } else if (config.fieldName.includes('Total Max. Marks')) {
            const obtainedMarksField = document.querySelector(`[name="${config.fieldName.replace('Max.', 'Obtained')}"]`);
            if (obtainedMarksField) {
                const max = parseFloat(value);
                if (!isNaN(max) && !Number.isInteger(max)) {
                    el.classList.add('is-invalid');
                    hintEl.textContent = '[!] Max marks must be a whole number.';
                    hintEl.className = 'field-hint error';
                    return false;
                }
                const obtained = parseFloat(obtainedMarksField.value);
                if (!isNaN(obtained) && !isNaN(max) && obtained > max) {
                    el.classList.add('is-invalid');
                    hintEl.textContent = '[!] Max marks cannot be less than marks obtained.';
                    hintEl.className = 'field-hint error';
                    return false;
                }
            }
        }
        // Guidance only: Max digits limits handled by input listener
        if (config.fieldName === 'PEN number (given by UDISE portal)') {
            const pen = value.replace(/\s+/g, '');
            if (pen && pen.length < 11) {
                hintEl.textContent = 'Enter up to 11 digits (PEN)';
                hintEl.className = 'field-hint';
            }
        }
        if (config.fieldName === 'APAAR ID') {
            const apaar = value.replace(/\s+/g, '');
            if (apaar && apaar.length < 12) {
                hintEl.textContent = 'Enter up to 12 digits (APAAR)';
                hintEl.className = 'field-hint';
            }
        }
        // [NEW] Composite DoB validity (dd-mm-yyyy)
        if (config.fieldName === 'DoB (as per school records)') {
            if (isRequired && !value) {
                el.classList.add('is-invalid');
                hintEl.textContent = '[!] Please enter DoB in dd-mm-yyyy.';
                hintEl.className = 'field-hint error';
                return false;
            }
            if (value) {
                const m = value.match(/^([0-9]{2})-([0-9]{2})-([0-9]{4})$/);
                if (!m) {
                    el.classList.add('is-invalid');
                    hintEl.textContent = '[!] Use dd-mm-yyyy format.';
                    hintEl.className = 'field-hint error';
                    return false;
                }
                const dd = parseInt(m[1], 10), mm = parseInt(m[2], 10) - 1, yy = parseInt(m[3], 10);
                const dt = new Date(yy, mm, dd);
                if (!(dt.getFullYear() === yy && dt.getMonth() === mm && dt.getDate() === dd)) {
                    el.classList.add('is-invalid');
                    hintEl.textContent = '[!] Invalid date. Please check day/month/year.';
                    hintEl.className = 'field-hint error';
                    return false;
                }
            }
        }
        // [NEW] Village name must be letters only (no digits)
        if (config.fieldName === 'Name of your village' && value) {
            if (!/^[A-Za-z\s'\-]+$/.test(value)) {
                el.classList.add('is-invalid');
                hintEl.textContent = '[!] Use letters only (no numbers).';
                hintEl.className = 'field-hint error';
                return false;
            }
        }
        // [NEW] PIN must be exactly 6 digits
        if (config.fieldName === 'PIN code' && value) {
            if (!/^\d{6}$/.test(value)) {
                el.classList.add('is-invalid');
                hintEl.textContent = '[!] Enter a valid 6-digit PIN code.';
                hintEl.className = 'field-hint error';
                return false;
            }
        }
        // [NEW] Indian mobile validations
        if (config.fieldName === 'Mobile No. (with working WhatsApp)' || config.fieldName === "Parent's Mobile No. (must be working)") {
            if (isRequired && !value) {
                el.classList.add('is-invalid');
                hintEl.textContent = '[!] Mobile number is required.';
                hintEl.className = 'field-hint error';
                return false;
            }
            if (value && !/^[6-9]\d{9}$/.test(value)) {
                el.classList.add('is-invalid');
                hintEl.textContent = '[!] Enter a valid 10-digit Indian mobile (starts 6-9).';
                hintEl.className = 'field-hint error';
                return false;
            }
            const otherName = config.fieldName === 'Mobile No. (with working WhatsApp)' ? "Parent's Mobile No. (must be working)" : 'Mobile No. (with working WhatsApp)';
            const otherVal = document.querySelector(`[name="${otherName}"]`)?.value.trim() || '';
            if (value && otherVal && value === otherVal) {
                el.classList.add('is-invalid');
                hintEl.textContent = '[!] Your mobile and parent?s mobile cannot be same.';
                hintEl.className = 'field-hint error';
                document.querySelector(`[name="${otherName}"]`)?.classList.add('is-invalid');
                return false;
            }
        }
        // [NEW] Aadhaar validations (12 digits)
        if (config.fieldName === 'Aadhar No.') {
            if (isRequired && !value) {
                el.classList.add('is-invalid');
                hintEl.textContent = '[!] Aadhaar is mandatory.';
                hintEl.className = 'field-hint error';
                return false;
            }
            if (value && !/^\d{12}$/.test(value)) {
                el.classList.add('is-invalid');
                hintEl.textContent = '[!] Enter a valid 12-digit Aadhaar number.';
                hintEl.className = 'field-hint error';
                return false;
            }
        }
        if ((config.fieldName === 'Board Registration No. (Class 10th)' || config.fieldName === 'Board Registration No. (Class 11th)') && value) {
            const REG_REGEX = /^(?:[A-Za-z]\d{11}|\d{16})$/;
            if (!REG_REGEX.test(value)) {
                el.classList.add('is-invalid');
                hintEl.textContent = '[!] Enter a valid registration number.';
                hintEl.className = 'field-hint error';
                return false;
            }
        }
        if ((config.fieldName === 'Exam Roll Number of Class 10th' || config.fieldName === 'Exam Roll Number of Class 11th') && value) {
            if (!/^\d{9}$/.test(value)) {
                el.classList.add('is-invalid');
                hintEl.textContent = '[!] Enter a 9-digit exam roll number.';
                hintEl.className = 'field-hint error';
                return false;
            }
        }
        if (config.fieldType === 'list') {
            const allowed = config.options.split(',').map(s => s.trim());
            if (value === 'Other') {
                const otherEl = document.getElementById(`${el.id}-other`);
                const otherVal = otherEl ? otherEl.value.trim() : '';
                // [Modified] Allow empty; if empty, it means just "Other"
                if (otherVal && !/^[A-Za-z\s'\-]+$/.test(otherVal)) {
                    el.classList.add('is-invalid');
                    hintEl.textContent = '[!] Use letters only (no numbers).';
                    hintEl.className = 'field-hint error';
                    return false;
                }
            }
        }
        // [NEW] Email validation
        if (config.fieldName === 'E-mail ID' && value) {
            if (!validateEmail(value)) {
                el.classList.add('is-invalid');
                hintEl.textContent = '[!] Enter a valid email address.';
                hintEl.className = 'field-hint error';
                return false;
            }
        }

        // Valid state
        el.classList.remove('is-invalid');
        if ((config.fieldType === 'list' && value === 'Other' && document.getElementById(`${el.id}-other`)?.value.trim()) || value || el.checked) {
            el.classList.add('is-valid');
            hintEl.textContent = ''; // [REMOVED] [OK] to prevent layout shift
            hintEl.className = 'field-hint success';
        } else {
            el.classList.remove('is-valid');
            hintEl.textContent = '';
            hintEl.className = 'field-hint';
        }
        return true;
    }
    // [NEW] District -> PIN code hint
    const DISTRICT_PIN_PREFIX = {
        'Srinagar': ['190'],
        'Baramulla': ['193'],
        'Budgam': ['191'],
        'Anantnag': ['192'],
        'Pulwama': ['192'],
        'Shopian': ['192'],
        'Bandipora': ['193'],
        'Kupwara': ['193'],
        'Ganderbal': ['191'],
        'Jammu': ['180'],
        'Kathua': ['184'],
        'Udhampur': ['182']
    };
    function setupLocationHints() {
        const distEl = document.querySelector('[name="District"]');
        const pinEl = document.querySelector('[name="PIN code"]');
        if (!distEl || !pinEl) return;
        const hintEl = document.getElementById(`hint-${pinEl.id}`);
        const updateHint = () => {
            const d = distEl.value.trim();
            const prefixes = DISTRICT_PIN_PREFIX[d];
            if (prefixes && hintEl) {
                hintEl.textContent = `Typical PIN prefix for ${d}: ${prefixes.join(', ')}xxxx`;
                hintEl.className = 'field-hint';
            } else if (hintEl) {
                hintEl.textContent = '';
            }
        };
        distEl.addEventListener('change', updateHint);
        updateHint();
    }
    // [MODIFIED] Subject validation - Uses numeric rules, conditional G2
    function validateSubjects(checkbox) {
        const section = checkbox.closest('.subjects-section');
        if (!section) return;
        const fieldName = section.dataset.fieldName;
        const validationEl = section.querySelector('.validation-msg');
        if (!validationEl) return;
        if (section.classList.contains('reappear')) {
            // Special for reappear
            const checked = section.querySelectorAll('input:checked').length;
            if (checked === 0) {
                validationEl.className = 'validation-msg error';
                validationEl.innerHTML = 'At least 1 subject must be selected for reappear.';
                state.subjectError = true;
            } else if (checked > 5) {
                validationEl.className = 'validation-msg error';
                validationEl.innerHTML = `Max 5 subjects allowed (Selected: ${checked}).`;
                state.subjectError = true;
            } else {
                validationEl.className = 'validation-msg success';
                validationEl.innerHTML = `Selected: ${checked} subjects.`;
                state.subjectError = false;
            }
            return;
        }
        const targetClass = section.dataset['class'];
        const stream = section.dataset.stream;
        const cfgRoot = (state.subjectsConfig && Object.keys(state.subjectsConfig).length > 0)
            ? state.subjectsConfig
            : (state.adminData?.subjectsConfig || {});
        const data = cfgRoot[targetClass]?.[stream];
        if (!data) return;
        // Counts
        const compulsoryCount = data.compulsory.length; // Assume all selected
        const group1Checkboxes = section.querySelectorAll('.group1 input:checked');
        const g1count = group1Checkboxes.length;
        const group2Checkboxes = section.querySelectorAll('.group2 input:checked');
        const g2count = group2Checkboxes.length;
        const total = compulsoryCount + g1count + g2count;
        // Effective G2 min
        const g2MinEff = (g1count === data.g1Max && data.g1Min < data.g1Max) ? 0 : data.g2Min;
        const group1RangeText = `${data.g1Min}-${data.g1Max}`;
        const group2RangeText = `${g2MinEff}-${data.g2Max}`;
        // Disable unchecked boxes when reaching max per group
        const g1Boxes = section.querySelectorAll('.group1 input[type="checkbox"]');
        const g2Boxes = section.querySelectorAll('.group2 input[type="checkbox"]');
        const g1AtMax = g1count >= data.g1Max;
        const g2AtMax = g2count >= data.g2Max;
        g1Boxes.forEach(cb => { const shouldDisable = (!cb.checked && g1AtMax); cb.disabled = shouldDisable; cb.title = shouldDisable ? `You can opt max ${data.g1Max} subject(s) from Group B` : ''; });
        g2Boxes.forEach(cb => { const shouldDisable = (!cb.checked && g2AtMax); cb.disabled = shouldDisable; cb.title = shouldDisable ? `You can opt max ${data.g2Max} subject(s) from Group C` : ''; });
        if (g1count < data.g1Min || g1count > data.g1Max) {
            validationEl.className = 'validation-msg error';
            const ruleText = (data.g1Min === data.g1Max)
                ? `Select exactly ${data.g1Min} subject in Group B.`
                : `Select between ${data.g1Min} and ${data.g1Max} subjects in Group B.`;
            validationEl.innerHTML = ruleText;
            state.subjectError = true;
            return;
        }
        if (g2count < g2MinEff || g2count > data.g2Max) {
            validationEl.className = 'validation-msg error';
            const ruleText = (g2MinEff === data.g2Max)
                ? `Select exactly ${g2MinEff} subject in Group C.`
                : `Select between ${g2MinEff} and ${data.g2Max} subjects in Group C.`;
            validationEl.innerHTML = ruleText;
            state.subjectError = true;
            return;
        }
        if (total < (data.minTotal ?? 0)) {
            validationEl.className = 'validation-msg error';
            validationEl.innerHTML = `Error: total subjects to be taken is <span class="count">${data.minTotal}</span> (Group A - <span class="count">${compulsoryCount}</span>, Group B - <span class="count">${g1count}</span> and Group C - <span class="count">${g2count}</span>). Currently: <span class="count">${total}</span>.`;
            state.subjectError = true;
            return;
        }
        if (total > data.maxTotal) {
            validationEl.className = 'validation-msg error';
            validationEl.innerHTML = `Error: maximum subjects allowed: <span class="count">${data.maxTotal}</span>. (Group A - <span class="count">${compulsoryCount}</span>, Group B - <span class="count">${g1count}</span>, Group C - <span class="count">${g2count}</span>). Currently: <span class="count">${total}</span>.`;
            state.subjectError = true;
            return;
        }
        validationEl.className = 'validation-msg success';
        validationEl.innerHTML = `<small>Correct Subject Combination <br>Group A: <span class="count">${compulsoryCount}</span>, Group B: <span class="count">${g1count}</span>, Group C: <span class="count">${g2count}</span> -- Total: <span class="count">${total}</span> (Allowed ${data.minTotal}-${data.maxTotal}).</small>`;
        state.subjectError = false;
    }
    function enforceAcademic9thRequired() {
        const currentClass = document.querySelector('[name="Admission sought for class"]').value;
        if (currentClass !== '9th') return;
        const fieldset = document.getElementById('section-academic9th');
        if (!fieldset || fieldset.style.display === 'none') return;
        const groups = fieldset.querySelectorAll('.form-group');
        groups.forEach(group => {
            if (group.style.display === 'none') return;
            const subjectsSection = group.querySelector('.subjects-section');
            if (subjectsSection) {
                const fieldName = subjectsSection.dataset.fieldName;
                const cfg = state.formStructure.find(f => f.fieldName === fieldName);
                if (cfg) cfg.required = true;
                return;
            }
            const el = group.querySelector('input, select, textarea');
            if (!el || el.disabled || el.type === 'file') return;
            const cfg = state.formStructure.find(f => f.fieldName === el.name);
            if (cfg) cfg.required = true;
            try {
                el.setAttribute('required', 'required');
                const label = group.querySelector('label');
                if (label && !label.querySelector('.required')) {
                    const star = document.createElement('span');
                    star.className = 'required';
                    star.textContent = '*';
                    label.appendChild(star);
                }
            } catch (e) { /* no-op */ }
        });
    }
    function enforceAcademic10thRequired() {
        const currentClass = document.querySelector('[name="Admission sought for class"]').value;
        if (currentClass !== '10th') return;
        const fieldset = document.getElementById('section-academic10th');
        if (!fieldset || fieldset.style.display === 'none') return;
        const groups = fieldset.querySelectorAll('.form-group');
        groups.forEach(group => {
            if (group.style.display === 'none') return;
            const subjectsSection = group.querySelector('.subjects-section');
            if (subjectsSection) {
                const fieldName = subjectsSection.dataset.fieldName;
                const cfg = state.formStructure.find(f => f.fieldName === fieldName);
                if (cfg) cfg.required = true;
                return;
            }
            const el = group.querySelector('input, select, textarea');
            if (!el || el.disabled || el.type === 'file') return;
            const cfg = state.formStructure.find(f => f.fieldName === el.name);
            if (cfg) cfg.required = true;
            try {
                el.setAttribute('required', 'required');
                const label = group.querySelector('label');
                if (label && !label.querySelector('.required')) {
                    const star = document.createElement('span');
                    star.className = 'required';
                    star.textContent = '*';
                    label.appendChild(star);
                }
            } catch (e) { /* no-op */ }
        });
    }
    function enforceAcademic11thRequired() {
        const currentClass = document.querySelector('[name="Admission sought for class"]').value;
        if (currentClass !== '11th') return;
        const fieldset = document.getElementById('section-academic11th');
        if (!fieldset || fieldset.style.display === 'none') return;
        const groups = fieldset.querySelectorAll('.form-group');
        groups.forEach(group => {
            if (group.style.display === 'none') return;
            const subjectsSection = group.querySelector('.subjects-section');
            if (subjectsSection) {
                const fieldName = subjectsSection.dataset.fieldName;
                const cfg = state.formStructure.find(f => f.fieldName === fieldName);
                if (cfg) cfg.required = true;
                return;
            }
            const el = group.querySelector('input, select, textarea');
            if (!el || el.disabled || el.type === 'file') return;
            const cfg = state.formStructure.find(f => f.fieldName === el.name);
            if (cfg) cfg.required = true;
            try {
                el.setAttribute('required', 'required');
                const label = group.querySelector('label');
                if (label && !label.querySelector('.required')) {
                    const star = document.createElement('span');
                    star.className = 'required';
                    star.textContent = '*';
                    label.appendChild(star);
                }
            } catch (e) { /* no-op */ }
        });
    }

    function enforceAcademic12thRequired() {
        const currentClass = document.querySelector('[name="Admission sought for class"]').value;
        if (currentClass !== '12th') return;
        const fieldset = document.getElementById('section-academic12th');
        if (!fieldset || fieldset.style.display === 'none') return;
        const groups = fieldset.querySelectorAll('.form-group');
        groups.forEach(group => {
            if (group.style.display === 'none') return;
            const subjectsSection = group.querySelector('.subjects-section');
            if (subjectsSection) {
                const fieldName = subjectsSection.dataset.fieldName;
                const cfg = state.formStructure.find(f => f.fieldName === fieldName);
                if (cfg) cfg.required = true;
                return;
            }
            const el = group.querySelector('input, select, textarea');
            if (!el || el.disabled || el.type === 'file') return;
            const cfg = state.formStructure.find(f => f.fieldName === el.name);
            if (cfg) cfg.required = true;
            try {
                el.setAttribute('required', 'required');
                const label = group.querySelector('label');
                if (label && !label.querySelector('.required')) {
                    const star = document.createElement('span');
                    star.className = 'required';
                    star.textContent = '*';
                    label.appendChild(star);
                }
            } catch (e) { /* no-op */ }
        });
    }
    // Class change handler
    function handleClassChange(e) {
        const selectedClass = e.target.value;

        // Check if class is allowed and show validation message
        function isClassAllowed(className) {
            const settings = state.adminData.settings || {};
            const classKeyMap = { '9th': 'allow_9th', '10th': 'allow_10th', '11th': 'allow_11th', '12th': 'allow_12th' };
            const settingKey = classKeyMap[className];
            return settingKey ? settings[settingKey] === true : false;
        }

        // Show or hide class validation message in form
        const existingMsg = document.getElementById('formClassValidationMsg');
        if (existingMsg) existingMsg.remove();

        if (selectedClass && !isClassAllowed(selectedClass) && state.currentUser?.role !== 'Admin') {
            const classField = document.querySelector('[name="Admission sought for class"]');
            if (classField && classField.parentElement) {
                const validationDiv = document.createElement('div');
                validationDiv.id = 'formClassValidationMsg';
                validationDiv.style.cssText = 'margin-top: 0.5rem; padding: 0.75rem; border-radius: 8px; font-size: 0.875rem; background: #fff1f2; color: #9f1239; border: 1px solid #fda4af; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);';
                validationDiv.innerHTML = `
                    <div style="display:flex; align-items:start; gap:8px;">
                        <span class="material-icons" style="font-size:1.25rem;">report_problem</span>
                        <div>
                            <div style="font-weight:700; margin-bottom:2px;">[!] Admission Closed for ${selectedClass} Class</div>
                            <div style="opacity:0.9;">Admissions for ${selectedClass} class are currently closed. If you believe this is an error, please contact the school administration.</div>
                        </div>
                    </div>
                `;
                classField.parentElement.appendChild(validationDiv);
            }
        }

        const sectionVisibility = {
            '9th': ['personal', 'contact', 'physical', 'admission', 'academic9th', 'vocational', 'additional', 'declaration', 'uploads'],
            '10th': ['personal', 'contact', 'physical', 'admission', 'academic10th', 'vocational', 'additional', 'declaration', 'uploads'],
            '11th': ['personal', 'contact', 'physical', 'admission', 'academic11th', 'vocational', 'additional', 'declaration', 'uploads'],
            '12th': ['personal', 'contact', 'physical', 'admission', 'academic12th', 'vocational', 'additional', 'declaration', 'uploads']
        };
        const role = state.currentUser?.role;
        const isAdmin = (role === 'Admin' || role === 'SuperAdmin' || role === 'President');
        const visibleSections = isAdmin
            ? ['personal', 'contact', 'physical', 'admission', 'academic9th', 'academic10th', 'academic11th', 'academic12th', 'vocational', 'additional', 'declaration', 'uploads']
            : (sectionVisibility[selectedClass] || ['personal', 'contact', 'physical', 'admission', 'vocational', 'additional', 'declaration', 'uploads']);
        // All possible sections
        const allSections = ['personal', 'contact', 'physical', 'admission', 'academic9th', 'academic10th', 'academic11th', 'academic12th', 'vocational', 'additional', 'declaration', 'uploads'];
        allSections.forEach(section => {
            const fieldset = document.getElementById(`section-${section}`);
            if (fieldset) {
                fieldset.style.display = visibleSections.includes(section) ? 'block' : 'none';
            }
        });
        // Re-render academic fields for class-specific labels and visibility
        renderFormFieldsForClass(selectedClass);
        // Update sticky header (so it reflects changes immediately)
        const formInfoClass = document.getElementById('formInfoClass');
        if (formInfoClass) formInfoClass.innerHTML = `<strong>Class:</strong> ${selectedClass || 'Not selected'}`;
        enforceAcademic9thRequired();
        enforceAcademic10thRequired();
        enforceAcademic11thRequired();
        enforceAcademic12thRequired();
        const messages = {
            '9th': 'For 9th: All Academic Details fields and Photo are mandatory.',
            '10th': 'For 10th: All Academic Details fields and Photo are mandatory.',
            '11th': 'For 11th: All Academic Details fields and Photo are mandatory.',
            '12th': 'For 12th: Provide Class 11th details, select adm type, stream and subjects.'
        };
        if (messages[selectedClass] && document.getElementById('form-alert').classList.contains('hidden')) {
            showAlert('form-alert', messages[selectedClass], 'info');
        }
        // Clear any previous validation errors when class changes
        try {
            state.subjectError = false;
            const formAlert = document.getElementById('form-alert');
            if (formAlert) { formAlert.classList.add('hidden'); formAlert.innerHTML = ''; }
            // Remove invalid class from inputs/selects and clear hints
            document.querySelectorAll('#admissionForm .is-invalid').forEach(el => el.classList.remove('is-invalid'));
            document.querySelectorAll('#admissionForm .field-hint').forEach(h => {
                // reset only those hints that were errors
                if (h.classList.contains('error')) {
                    h.className = 'field-hint';
                    h.textContent = '';
                }
            });
            // Reset subject validation messages
            document.querySelectorAll('.subjects-section .validation-msg').forEach(vm => {
                vm.className = 'validation-msg info';
                // attempt to reset to a helpful default if data exists
                const sect = vm.closest('.subjects-section');
                if (sect) {
                    const cls = sect.dataset['class'];
                    const strm = sect.dataset.stream;
                    const cfg = state.subjectsConfig[cls]?.[strm];
                    if (cfg) vm.textContent = `Select at least ${cfg.minTotal} and at most ${cfg.maxTotal} subjects`;
                    else vm.textContent = 'Select subjects as required';
                }
            });
        } catch (err) { console.error('Error clearing validation on class change', err); }
    }
    // [MODIFIED] Stream change handler - Re-render subjects with new config
    function handleStreamChange(e) {
        const selectedStream = e.target.value;
        const currentClass = document.querySelector('[name="Admission sought for class"]').value;
        // Persist selection into editing data so future renders know the stream
        if (!state.editingFormData) state.editingFormData = {};
        if (currentClass === '11th') {
            state.editingFormData['Stream for Class 11th'] = selectedStream;
        } else if (currentClass === '12th') {
            state.editingFormData['Stream opted in Class 11th'] = selectedStream;
        }

        // Re-render subjects based on the new stream
        if (currentClass === '11th') {
            // For Class 11th: re-render "Subjects to be taken in Class 11th"
            const fieldName = 'Subjects to be taken in Class 11th';
            const group = document.querySelector(`.form-group[data-field-name="${fieldName}"]`);
            if (group) {
                const fieldConfig = state.formStructure.find(f => f.fieldName === fieldName);
                if (fieldConfig) {
                    const value = state.editingFormData[fieldName] || '';
                    const newFieldHtml = createFormField(fieldName, fieldConfig, value, false, currentClass, selectedStream);
                    group.outerHTML = newFieldHtml;
                }
            }
        } else if (currentClass === '12th') {
            // For Class 12th: re-render "Subjects Studied in Class 11th" based on the stream
            const studiedFieldName = 'Subjects Studied in Class 11th';
            const studiedGroup = document.querySelector(`.form-group[data-field-name="${studiedFieldName}"]`);
            if (studiedGroup) {
                const fieldConfig = state.formStructure.find(f => f.fieldName === studiedFieldName);
                if (fieldConfig) {
                    const value = state.editingFormData[studiedFieldName] || '';
                    const newFieldHtml = createFormField(studiedFieldName, fieldConfig, value, false, currentClass, selectedStream, '11th');
                    studiedGroup.outerHTML = newFieldHtml;
                }
            }

            // Also re-render "Subjects to Reappear (Class 11th)" if visible
            const reappearFieldName = 'Subjects to Reappear (Class 11th)';
            const reappearGroup = document.querySelector(`.form-group[data-field-name*="Subjects to Reappear"]`);
            if (reappearGroup && reappearGroup.style.display !== 'none') {
                const fieldConfig = state.formStructure.find(f => f.fieldName === reappearFieldName);
                if (fieldConfig) {
                    const value = state.editingFormData[reappearFieldName] || '';
                    const newFieldHtml = createFormField(reappearFieldName, fieldConfig, value, false, currentClass, selectedStream, '11th');
                    reappearGroup.outerHTML = newFieldHtml;
                }
            }
        }

        // After re-rendering, re-attach listeners and conditionals
        setupRealTimeValidation();
        setupLocationHints();
        setupBackButtonConfirm();
        setupConditionals();
    }
    function renderFormFieldsForClass(selectedClass) {
        // This function ensures individual fields within shared sections are hidden/shown
        document.querySelectorAll('#admissionForm .form-group').forEach(group => {
            const input = group.querySelector('input, select, textarea, .subjects-section, .declaration-group');
            if (!input) return;
            let fieldName = input.name;
            if (input.classList.contains('subjects-section')) {
                fieldName = input.dataset.fieldName;
            } else if (input.classList.contains('declaration-group')) {
                fieldName = 'Declaration';
            } else if (input.type === 'checkbox') {
                fieldName = input.name.replace('[]', '');
            }
            const fieldConfig = state.formStructure.find(f => f.fieldName === fieldName);
            if (fieldConfig) {
                const allowedClasses = fieldConfig.classes.split(',').map(c => c.trim());
                if (allowedClasses.length > 0 && !allowedClasses.includes(selectedClass)) {
                    group.style.display = 'none';
                    return;
                }
                // Check parent section visibility
                const parentSection = group.closest('fieldset');
                if (parentSection.style.display !== 'none') {
                    group.style.display = 'block';
                }
            }
        });
        // After toggling visibility, re-run conditional logic
        setupConditionals();
    }
    function handlePhotoUpload(e) {
        const file = e.target.files[0];
        if (!file) {
            state.photoFileData = null;
            return;
        }
        const preview = document.getElementById('photo-preview');
        if (!file.type || !file.type.startsWith('image/')) {
            showPopup('<strong>Photo upload failed</strong><br>Please upload a valid image file.', { autoClose: false });
            e.target.value = '';
            if (preview) { preview.src = ''; preview.style.display = 'none'; }
            state.photoFileData = null;
            return;
        }
        const dataUrlToBlob = (dataUrl) => {
            const parts = dataUrl.split(',');
            const mimeMatch = parts[0].match(/:(.*?);/);
            const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
            const bstr = atob(parts[1]);
            let n = bstr.length;
            const u8arr = new Uint8Array(n);
            while (n--) u8arr[n] = bstr.charCodeAt(n);
            return new Blob([u8arr], { type: mime });
        };
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const maxBytes = 200 * 1024;
                const maxDim = 1200;
                const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
                const canvas = document.createElement('canvas');
                canvas.width = Math.round(img.width * scale);
                canvas.height = Math.round(img.height * scale);
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                let quality = 0.9;
                let dataUrl = '';
                let blob = null;
                while (quality >= 0.5) {
                    dataUrl = canvas.toDataURL('image/jpeg', quality);
                    blob = dataUrlToBlob(dataUrl);
                    if (blob.size <= maxBytes) break;
                    quality -= 0.1;
                }
                if (!blob || blob.size > maxBytes) {
                    showPopup('<strong>Photo upload failed</strong><br>Photo must be under 200KB', { autoClose: false });
                    e.target.value = '';
                    if (preview) { preview.src = ''; preview.style.display = 'none'; }
                    state.photoFileData = null;
                    return;
                }
                if (preview) {
                    preview.src = dataUrl;
                    preview.style.display = 'block';
                }
                const baseName = (file.name || 'photo').replace(/\.[^/.]+$/, '');
                state.photoFileData = {
                    base64Data: dataUrl.split(',')[1],
                    mimeType: 'image/jpeg',
                    fileName: `${baseName}.jpg`
                };
                state.deletePhoto = false;
            };
            img.onerror = () => {
                showPopup('<strong>Photo upload failed</strong><br>Please upload a JPG or PNG image.', { autoClose: false });
                e.target.value = '';
                if (preview) { preview.src = ''; preview.style.display = 'none'; }
                state.photoFileData = null;
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    }
    function handlePhotoDelete() {
        const preview = document.getElementById('photo-preview');
        const input = document.querySelector('[name="Student Photo"]');
        if (preview) { preview.src = ''; preview.style.display = 'none'; }
        if (input) { input.value = ''; }
        state.photoFileData = null;
        // keep oldPhotoUrl so server can trash it
        state.deletePhoto = true;
        showAlert('form-alert', 'Photo cleared. It will be removed on save.', 'warning');
    }
    // Admin Actions - Unchanged except saveSubjects
    function handleSaveSettings() {
        const settings = {};
        document.querySelectorAll('#admissionToggles input[type="checkbox"], #emailToggles input[type="checkbox"]').forEach(toggle => {
            settings[toggle.dataset.key] = toggle.checked;
        });
        // Include session value (string) so admin can control session without touching the template
        const sessionVal = document.getElementById('sessionInput')?.value?.trim();
        if (sessionVal) settings['session'] = sessionVal;
        const printOrderVal = document.getElementById('printOrderSelect')?.value?.trim();
        if (printOrderVal) settings['print_sort_by'] = printOrderVal;
        const logoVal = document.getElementById('logoUrlInput')?.value?.trim();
        if (logoVal) settings['logo_url'] = logoVal;
        setLoading(true);
        runServerFunction('saveAppSettings', settings, state.currentUser)
            .then(res => {
                if (res.success) {
                    showAlert('admin-alert', res.message, 'success');
                    state.adminData.settings = { ...state.adminData.settings, ...settings };
                } else throw new Error(res.message);
            })
            .catch(handleError)
            .finally(() => setLoading(false));
    }

    // Clear ID Card results function - defined early to avoid reference errors
    function clearIdCardResults() {
        const idCardResultContainer = document.getElementById('idCardResultContainer');
        const idCardResultLog = document.getElementById('idCardResultLog');
        const idCardDownloadBtn = document.getElementById('downloadIdCardDataBtn');
        const toggleBtn = document.getElementById('toggleIdCardLogBtn');

        if (idCardResultContainer) {
            idCardResultContainer.style.display = 'none';
        }
        if (idCardResultLog) {
            idCardResultLog.innerHTML = '';
            idCardResultLog.style.display = 'block'; // Reset to visible
        }
        if (idCardDownloadBtn) {
            idCardDownloadBtn.style.display = 'none'; // Hide download button
        }
        if (toggleBtn) {
            toggleBtn.textContent = 'Show'; // Reset toggle button text
        }
    }

    function handleAdminSearch(e) {
        const query = e.target.value.toLowerCase().trim();

        // [NEW] Sync both search inputs (main and header)
        const mainInput = document.getElementById('searchInput');
        const headerInput = document.getElementById('headerSearchInput');
        if (mainInput && mainInput !== e.target) mainInput.value = e.target.value;
        if (headerInput && headerInput !== e.target) headerInput.value = e.target.value;

        // Store search query separately
        state.adminData.searchQuery = query;
        state.adminData.page = 1;
        clearIdCardResults(); // Clear ID Card results when searching

        // [FIX] Routing Logic
        const activeTabBtn = document.querySelector('#adminTabs .active[data-tab]');
        if (activeTabBtn && activeTabBtn.dataset.tab !== 'apps') {
            window.switchAdminTab('apps');
        } else {
            renderAdminDashboard();
        }
    }

    // Initialize Email Composer
    function initEmailComposer() {
        // [FIX] Populate Email Filters using Multi-Select component
        if (state.adminData.applications) {
            const sessions = [...new Set(state.adminData.applications.map(app => app['Session'] || '').filter(s => s))].sort().reverse();
            renderMultiSelect('emailSessionFilter', sessions, 'Sessions');
            renderMultiSelect('emailClassFilter', ['9th', '10th', '11th', '12th'], 'Classes');
        }

        // Show admin email
        const adminEmailDisplay = document.getElementById('adminEmailDisplay');
        if (adminEmailDisplay && state.currentUser?.email) adminEmailDisplay.textContent = state.currentUser.email;

        // Default footer
        const defaultFooter = state.adminData.settings?.emailFooter || 'Best regards,\nAdms. Sec. HSS Shangus';
        const footerDisplay = document.getElementById('emailFooterDisplay');
        const emailFooterEl = document.getElementById('emailFooter');
        if (footerDisplay) footerDisplay.textContent = defaultFooter;
        if (emailFooterEl && !emailFooterEl.value) emailFooterEl.value = defaultFooter;

        function updateFooterPreview() {
            const el = document.getElementById('emailFooterDisplay');
            if (!el) return;
            const isCustom = document.getElementById('useCustomFooter')?.checked;
            el.textContent = isCustom ? (document.getElementById('emailFooter')?.value || '') : defaultFooter;
        }

        const useCustomFooter = document.getElementById('useCustomFooter');
        if (useCustomFooter && emailFooterEl) {
            useCustomFooter.addEventListener('change', () => {
                emailFooterEl.style.display = useCustomFooter.checked ? 'block' : 'none';
                updateFooterPreview();
            });
            emailFooterEl.addEventListener('input', updateFooterPreview);
        }

        // Formatting toolbar
        document.querySelectorAll('.fmt-btn').forEach(btn => {
            btn.addEventListener('mousedown', (e) => {
                e.preventDefault();
                document.execCommand(btn.dataset.cmd, false, null);
                document.getElementById('emailBodyEditor')?.focus();
            });
        });
        document.getElementById('emailFontSize')?.addEventListener('change', (e) => {
            document.execCommand('fontSize', false, e.target.value);
            document.getElementById('emailBodyEditor')?.focus();
        });

        // Toggle recipients manage panel
        const toggleBtn = document.getElementById('toggleRecipientsListBtn');
        if (toggleBtn && !toggleBtn.dataset.bound) {
            toggleBtn.dataset.bound = 'true';
            toggleBtn.addEventListener('click', (e) => {
                e.preventDefault();
                const container = document.getElementById('customSelectionContainer');
                if (!container) return;
                const isVisible = container.style.display !== 'none';
                container.style.display = isVisible ? 'none' : 'block';
                if (!isVisible) loadFilteredRecipients();
            });
        }

        // Status filter: hide additional filters for custom mode
        const statusFilter = document.getElementById('emailStatusFilter');
        statusFilter?.addEventListener('change', () => {
            const isCustom = statusFilter.value === 'custom';
            const addFilters = document.getElementById('emailAdditionalFiltersDiv');
            if (addFilters) addFilters.style.display = isCustom ? 'none' : '';
            const container = document.getElementById('customSelectionContainer');
            if (container && container.style.display !== 'none') loadFilteredRecipients();
            updateRecipientCount();
        });

        // Select / Deselect all
        document.getElementById('selectAllRecipientsBtn')?.addEventListener('click', () => {
            document.querySelectorAll('#customRecipientsList input[type="checkbox"]:not(:disabled)').forEach(cb => cb.checked = true);
            updateCustomRecipientCount();
        });
        document.getElementById('deselectAllRecipientsBtn')?.addEventListener('click', () => {
            document.querySelectorAll('#customRecipientsList input[type="checkbox"]:not(:disabled)').forEach(cb => cb.checked = false);
            updateCustomRecipientCount();
        });

        // Search in recipient list
        document.getElementById('customRecipientSearch')?.addEventListener('input', (e) => {
            filterCustomRecipients(e.target.value.toLowerCase().trim());
        });

        // Class/session filter listeners
        document.getElementById('emailClassFilter')?.addEventListener('change', () => {
            updateRecipientCount();
            const c = document.getElementById('customSelectionContainer');
            if (c && c.style.display !== 'none') loadFilteredRecipients();
        });
        document.getElementById('emailSessionFilter')?.addEventListener('change', () => {
            updateRecipientCount();
            const c = document.getElementById('customSelectionContainer');
            if (c && c.style.display !== 'none') loadFilteredRecipients();
        });

        updateRecipientCount();

        document.getElementById('previewEmailBtn')?.addEventListener('click', handlePreviewEmail);
        document.getElementById('sendEmailBtn')?.addEventListener('click', handleSendEmail);
    }

    function getFilteredApplications() {
        const mode = document.getElementById('emailStatusFilter')?.value || 'all';
        const classFilter = getMultiSelectValues('emailClassFilter');
        const sessionFilter = getMultiSelectValues('emailSessionFilter');
        let apps = state.adminData.applications || [];

        if (mode === 'draft') apps = apps.filter(a => (a['Status'] || '') === 'Draft' && !a.rejectionReason);
        else if (mode === 'submitted') apps = apps.filter(a => (a['Status'] || '') === 'Submitted' && !a.rejectionReason);
        else if (mode === 'rejected') apps = apps.filter(a => !!(a.rejectionReason));
        else if (mode === 'confirmed') apps = apps.filter(a => !!(a['Class Roll No']));

        if (classFilter.length > 0) apps = apps.filter(a => classFilter.includes(a['Admission sought for class'] || ''));
        if (sessionFilter.length > 0) apps = apps.filter(a => sessionFilter.includes(a['Session'] || ''));
        return apps;
    }

    // Update recipient count function - globally accessible
    function updateRecipientCount() {
        const status = document.getElementById('emailStatusFilter')?.value || 'all';
        let count;
        if (status === 'custom') {
            count = document.querySelectorAll('#customRecipientsList input[type="checkbox"]:checked').length;
        } else {
            // Count checked items if panel is open (exclusions), else full filtered count
            const container = document.getElementById('customSelectionContainer');
            if (container && container.style.display !== 'none') {
                count = document.querySelectorAll('#customRecipientsList input[type="checkbox"]:checked').length;
            } else {
                count = getFilteredApplications().length;
            }
        }
        const countText = document.getElementById('emailRecipientCountText');
        if (countText) {
            countText.textContent = `${count} recipient${count !== 1 ? 's' : ''}`;
        }
    }

    // Load recipients list (works for all filter modes -- checked = included, uncheck to exclude)
    function loadFilteredRecipients() {
        const recipientsList = document.getElementById('customRecipientsList');
        if (!recipientsList) return;

        const status = document.getElementById('emailStatusFilter')?.value || 'all';
        // For 'custom' mode show all apps; for other modes show only filtered apps
        const applications = status === 'custom'
            ? (state.adminData.applications || [])
            : getFilteredApplications();

        recipientsList.innerHTML = applications.map((app, index) => {
            const name = app["Student's Name (as per school records)"] || 'Unknown';
            const email = app['Email Address'] || 'No email';
            const formNumber = app['Form Number'] || 'N/A';
            const cls = app['Admission sought for class'] || '';
            const hasRollNo = !!(app['Class Roll No']);
            const isRejected = !!(app.rejectionReason);
            const appStatus = app['Status'] || 'Draft';

            let badge = '';
            if (isRejected) badge = `<span style="padding:1px 5px; background:var(--danger); color:white; border-radius:3px; font-size:0.68rem;">Rej</span>`;
            else if (hasRollNo) badge = `<span style="padding:1px 5px; background:var(--success); color:white; border-radius:3px; font-size:0.68rem;">[OK]</span>`;
            else if (appStatus === 'Submitted') badge = `<span style="padding:1px 5px; background:var(--primary); color:white; border-radius:3px; font-size:0.68rem;">Sub</span>`;
            else badge = `<span style="padding:1px 5px; background:var(--text-secondary); color:white; border-radius:3px; font-size:0.68rem;">Draft</span>`;

            // Store real index into applications array for retrieval later
            const realIndex = state.adminData.applications?.indexOf(app) ?? index;
            return `
          <label style="display:flex; align-items:center; gap:0.5rem; padding:0.3rem 0.4rem; background:var(--bg-primary); border:1px solid var(--border); border-radius:5px; cursor:pointer;">
            <input type="checkbox" value="${realIndex}" ${email !== 'No email' ? 'checked' : 'disabled'} style="flex-shrink:0;">
            <div style="flex:1; min-width:0; overflow:hidden;">
              <div style="font-weight:500; font-size:0.78rem; color:var(--text-primary); white-space:normal; overflow-wrap:anywhere;">${name} <span style="font-size:0.7rem; color:var(--text-secondary);">#${formNumber} ${cls}</span></div>
              <div style="font-size:0.72rem; color:var(--text-secondary); white-space:normal; overflow-wrap:anywhere;">${email}</div>
            </div>
            ${badge}
          </label>
        `;
        }).join('');

        recipientsList.querySelectorAll('input[type="checkbox"]').forEach(cb => {
            cb.addEventListener('change', updateCustomRecipientCount);
        });

        updateCustomRecipientCount();
    }

    // Keep old name as alias for any residual calls
    function loadCustomRecipients() { loadFilteredRecipients(); }

    // Update custom recipient count function
    function updateCustomRecipientCount() {
        updateRecipientCount();
    }

    // Filter recipients based on search
    function filterCustomRecipients(searchTerm) {
        const items = document.querySelectorAll('#customRecipientsList label');
        items.forEach(item => {
            const text = item.textContent.toLowerCase();
            item.style.display = (!searchTerm || text.includes(searchTerm)) ? '' : 'none';
        });
        updateRecipientCount();
    }

    // Email Handler Functions
    function handlePreviewEmail() {
        const subject = document.getElementById('emailSubject')?.value || '';
        const bodyHtml = document.getElementById('emailBodyEditor')?.innerHTML || '';
        const useCustomFooter = document.getElementById('useCustomFooter')?.checked || false;
        const customFooter = document.getElementById('emailFooter')?.value || '';
        const sendTestFirst = document.getElementById('sendTestFirstCheckbox')?.checked || false;


        if (!subject.trim()) { showAlert('admin-alert', 'Please enter an email subject', 'danger'); return; }
        if (!document.getElementById('emailBodyEditor')?.textContent?.trim()) { showAlert('admin-alert', 'Please enter an email body', 'danger'); return; }

        // Get recipients -- if manage panel is open use checked items; else use filters
        const container = document.getElementById('customSelectionContainer');
        let recipients = [];
        if (container && container.style.display !== 'none') {
            recipients = Array.from(document.querySelectorAll('#customRecipientsList input[type="checkbox"]:checked'))
                .map(cb => state.adminData.applications[parseInt(cb.value)]).filter(app => app && app['Email Address']);
        } else {
            recipients = getFilteredApplications().filter(a => a['Email Address']);
        }
        if (recipients.length === 0) { showAlert('admin-alert', 'No recipients found', 'warning'); return; }

        const defaultFooter = state.adminData.settings?.emailFooter || 'Best regards,\nAdms. Sec. HSS Shangus';
        const fullFooter = useCustomFooter ? customFooter : defaultFooter;
        const recipientList = recipients.slice(0, 10).map(r => `? ${r["Student's Name (as per school records)"]} (${r['Email Address']})`).join('\n');

        const modal = document.createElement('div');
        modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:10000;';
        const mc = document.createElement('div');
        mc.style.cssText = 'background:var(--bg-primary);border-radius:12px;padding:1.25rem;max-width:580px;width:95%;max-height:80vh;overflow-y:auto;box-shadow:0 20px 25px rgba(0,0,0,0.15);';
        mc.innerHTML = `
        <h3 style="margin:0 0 0.75rem 0;font-size:1rem;color:var(--text-primary);">[EMAIL] Email Preview</h3>
        ${sendTestFirst ? '<div style="margin-bottom:0.5rem;padding:0.4rem 0.6rem;background:rgba(59,130,246,0.1);border-radius:5px;color:var(--primary);font-size:0.8rem;">[!] Test email will be sent to admin first</div>' : ''}
        <div style="margin-bottom:0.5rem;font-size:0.85rem;"><strong>Recipients:</strong> ${recipients.length} student${recipients.length !== 1 ? 's' : ''}</div>
        <div style="margin-bottom:0.5rem;font-size:0.76rem;color:var(--text-secondary);white-space:pre-wrap;max-height:80px;overflow-y:auto;">${recipientList}${recipients.length > 10 ? '\n... and ' + (recipients.length - 10) + ' more' : ''}</div>
        <div style="margin-bottom:0.5rem;font-size:0.85rem;"><strong>Subject:</strong> ${subject}</div>
        <div style="margin-bottom:0.5rem;font-size:0.85rem;"><strong>Body:</strong>
          <div style="background:var(--bg-card);padding:0.6rem;border-radius:6px;margin-top:0.3rem;">${bodyHtml}</div>
        </div>
        <div style="font-style:italic;color:#999;font-size:0.78rem;padding:0.4rem 0.6rem;border:1px dashed var(--border);border-radius:5px;margin-bottom:0.6rem;">${fullFooter.replace(/\n/g, '<br>')}</div>
        <div style="display:flex;justify-content:flex-end;"><button id="closePreviewBtn" class="btn btn-secondary">Close</button></div>
      `;
        modal.appendChild(mc); document.body.appendChild(modal);
        document.getElementById('closePreviewBtn').addEventListener('click', () => document.body.removeChild(modal));
        modal.addEventListener('click', e => { if (e.target === modal) document.body.removeChild(modal); });
    }

    function handleSendEmail() {
        const subject = document.getElementById('emailSubject')?.value || '';
        const bodyHtml = document.getElementById('emailBodyEditor')?.innerHTML || '';
        const bodyText = document.getElementById('emailBodyEditor')?.textContent?.trim() || '';
        const useCustomFooter = document.getElementById('useCustomFooter')?.checked || false;
        const customFooter = document.getElementById('emailFooter')?.value || '';
        const sendTestFirst = document.getElementById('sendTestFirstCheckbox')?.checked || false;

        if (!subject.trim()) { showAlert('admin-alert', 'Please enter an email subject', 'danger'); return; }
        if (!bodyText) { showAlert('admin-alert', 'Please enter an email body', 'danger'); return; }

        const container = document.getElementById('customSelectionContainer');
        let recipients = [];
        if (container && container.style.display !== 'none') {
            recipients = Array.from(document.querySelectorAll('#customRecipientsList input[type="checkbox"]:checked'))
                .map(cb => state.adminData.applications[parseInt(cb.value)]).filter(app => app && app['Email Address']);
        } else {
            recipients = getFilteredApplications().filter(a => a['Email Address']);
        }
        if (recipients.length === 0) { showAlert('admin-alert', 'No recipients found for the selected filters', 'warning'); return; }

        const testMessage = sendTestFirst ? '\n[!] Test email will be sent to admin first' : '';
        if (!confirm(`Send this email to ${recipients.length} recipients?${testMessage}`)) return;

        setLoading(true);
        setLoadingMessage('Sending emails...');

        const defaultFooter = state.adminData.settings?.emailFooter || 'Best regards,\nAdms. Sec. HSS Shangus';
        const emailData = {
            recipients: recipients.map(r => ({ email: r['Email Address'], name: r["Student's Name (as per school records)"], formNumber: r['Form Number'] })),
            subject,
            body: bodyHtml,
            useCustomFooter,
            customFooter: useCustomFooter ? customFooter : defaultFooter,
            sendTestFirst
        };

        runServerFunction('sendBulkEmail', emailData, state.currentUser)
            .then(response => {
                if (response?.success) {
                    let message = `[OK] ${response.message}`;
                    if (sendTestFirst && response.testEmailSent) {
                        message += '\n[OK] Test email sent to admin first';
                    }
                    showAlert('admin-alert', message, 'success');
                    // Clear form after successful send
                    document.getElementById('emailSubject').value = '';
                    const ed = document.getElementById('emailBodyEditor');
                    if (ed) ed.innerHTML = '';
                    document.getElementById('emailFooter').value = '';
                    document.getElementById('useCustomFooter').checked = false;
                    document.getElementById('emailFooter').style.display = 'none';
                    document.getElementById('sendTestFirstCheckbox').checked = false;
                    // Reset footer display to default
                    const defFooter = state.adminData.settings?.emailFooter || 'Best regards,\nAdms. Sec. HSS Shangus';
                    const fdEl = document.getElementById('emailFooterDisplay');
                    if (fdEl) fdEl.textContent = defFooter;
                } else {
                    throw new Error(response?.message || 'Failed to send emails');
                }
            })
            .catch(handleError)
            .finally(() => setLoading(false));
    }

    function handleTestEmail() {
        const subject = document.getElementById('emailSubject')?.value || '';
        const body = document.getElementById('emailBody')?.value || '';
        const useCustomFooter = document.getElementById('useCustomFooter')?.checked || false;
        const customFooter = document.getElementById('emailFooter')?.value || '';

        if (!subject.trim()) {
            showAlert('admin-alert', 'Please enter an email subject', 'danger');
            return;
        }

        if (!body.trim()) {
            showAlert('admin-alert', 'Please enter an email body', 'danger');
            return;
        }

        setLoading(true);
        setLoadingMessage('Sending test email...');

        const emailData = {
            subject: subject,
            body: body,
            useCustomFooter: useCustomFooter,
            customFooter: customFooter,
            isTest: true
        };

        runServerFunction('sendBulkEmail', emailData, state.currentUser)
            .then(response => {
                if (response?.success) {
                    showAlert('admin-alert', `[OK] Test email sent to your account: ${state.currentUser.email}`, 'success');
                } else {
                    throw new Error(response?.message || 'Failed to send test email');
                }
            })
            .catch(handleError)
            .finally(() => setLoading(false));
    }

    // Initialize Subject Lists functionality  
    function initSubjectLists() {
        try {
            console.log('=== initSubjectLists called ===');
            if (state.adminData.applications) {
                const sessions = [...new Set(state.adminData.applications.map(app => app['Session'] || '').filter(s => s))].sort().reverse();
                // [FIX] Use multi-select component (was treating as <select> element)
                renderMultiSelect('subjectListSession', sessions, 'Sessions');
                renderMultiSelect('subjectListClass', ['9th', '10th', '11th', '12th'], 'Classes');
                renderMultiSelect('subjectListStatus', [
                    { value: 'Submitted', label: 'Submitted' },
                    { value: 'AssignedRollNos', label: 'Roll Assigned' }
                ], 'Statuses');
            }

            // Populate static dropdown for report type
            const rtSelect = document.getElementById('subjectListReportType');
            if (rtSelect && !rtSelect.options.length) {
                rtSelect.innerHTML = `
                    <option value="subject-wise">Subject-wise (for Teachers)</option>
                    <option value="class-wise">Class-wise (All Students)</option>
                    <option value="stream-wise">Stream-wise (Arts/Science/Commerce)</option>
                    <option value="combination-wise">Subject Combination-wise</option>
                `;
            }

            // Setup listeners
            const reportTypeSelect = document.getElementById('subjectListReportType');
            const groupBySubjectCheckbox = document.getElementById('groupBySubject')?.parentElement;
            if (reportTypeSelect && groupBySubjectCheckbox) {
                reportTypeSelect.addEventListener('change', (e) => {
                    groupBySubjectCheckbox.style.display = e.target.value === 'subject-wise' ? 'flex' : 'none';
                    if (e.target.value !== 'subject-wise') document.getElementById('groupBySubject').checked = false;
                });
                groupBySubjectCheckbox.style.display = reportTypeSelect.value === 'subject-wise' ? 'flex' : 'none';
            }

            const generateBtn = document.getElementById('generateSubjectListsBtn');
            if (generateBtn && !generateBtn.dataset.bound) {
                generateBtn.addEventListener('click', handleGenerateSubjectLists);
                generateBtn.dataset.bound = 'true';
            }
        } catch (e) { console.error('Error init subject lists:', e); }
    }

    function populateSubjectListFilters() {
        initSubjectLists();
    }

    async function handleAdminEdit(e) {
        const formNumber = e.target.closest('tr').dataset.formNumber;
        const appData = state.adminData.applications.find(app => String(app['Form Number']) === formNumber);
        if (!appData) {
            showAlert('admin-alert', 'Application not found', 'danger');
            return;
        }
        const isSubmitted = (appData['Status'] || '') === 'Submitted';
        const isUnlocked = !!appData.isUnlockedEditMode && (!!appData.unlockExpiry && new Date(appData.unlockExpiry).getTime() > Date.now());
        try {
            await showConfirm(`Temporarily unlock #${formNumber} for this admin session and open for edit?`);
        } catch (err) {
            return; // Do not open editor if admin declined
        }
        if (isSubmitted && !isUnlocked) {
            try {
                setLoadingMessage('Unlocking and loading application...');
                setLoading(true);
                await runServerFunction('unlockForSession', formNumber, state.currentUser);
                const latest = await runServerFunction('getInitialDataForUser', state.currentUser);
                handleInitialData(latest);
            } catch (err) {
                handleError(err);
                return;
            } finally {
                setLoading(false);
            }
        }
        setLoading(true);
        try { await runServerFunction('logActivity', 'View/Edit Application', state.currentUser, `Form ${formNumber} -- ${(appData["Student's Name (as per school records)"] || 'Unknown')} (${appData['Admission sought for class'] || 'N/A'})`); } catch (e) { }
        const refreshed = state.adminData.applications.find(app => String(app['Form Number']) === formNumber) || appData;
        state.isEditing = true;
        state.editingFormData = { ...refreshed };
        state.oldPhotoUrl = refreshed['Student Photo'] || null;
        state.currentView = 'formEditor';
        render(true);
        setLoading(false);
    }
    // Candidate Snapshot logic removed temporarily to resolve parsing conflicts.
    async function handleAdminView(e) {
        showAlert('admin-alert', 'Detailed view is temporarily disabled for maintenance.', 'info');
    }
    function handleAdminDownloadPDF(e) {
        if (e) { e.preventDefault(); e.stopPropagation(); }
        const formNumber = e.currentTarget.dataset.form || e.target.closest('[data-form]')?.dataset.form;
        const app = state.adminData.applications.find(a => String(a['Form Number']) === formNumber);
        if (app && app['PDF URL']) {
            downloadFile(app['PDF URL'], `Form_${formNumber}.pdf`);
            return;
        }
        setLoading(true);
        runServerFunction('generatePdfForForm', formNumber, state.currentUser)
            .then(response => {
                if (response.success) {
                    downloadFile(response.pdfUrl, response.pdfName);
                } else throw new Error(response.message);
            })
            .catch(handleError)
            .finally(() => setLoading(false));
    }

    function handleAdminViewPDF(e) {
        if (e) { e.preventDefault(); e.stopPropagation(); }
        const formNumber = e.currentTarget.dataset.form || e.target.closest('[data-form]')?.dataset.form;
        const appView = state.adminData.applications.find(a => String(a['Form Number']) === formNumber);
        if (appView && appView['PDF URL']) {
            window.open(appView['PDF URL'], '_blank');
            return;
        }
        setLoading(true);
        runServerFunction('generatePdfForForm', formNumber, state.currentUser)
            .then(response => {
                if (response.success) {
                    window.open(response.pdfUrl, '_blank');
                    if (appView) appView['PDF URL'] = response.pdfUrl;
                } else throw new Error(response.message);
            })
            .catch(handleError)
            .finally(() => setLoading(false));
    }
    async function handleAdminUnlock(e) {
        const formNumber = e.target.closest('tr').dataset.formNumber;
        const appDataUnlock = state.adminData.applications.find(app => String(app['Form Number']) === formNumber);
        const nameUnlock = appDataUnlock ? (appDataUnlock["Student's Name (as per school records)"] || 'Unknown') : 'Unknown';
        const clsUnlock = appDataUnlock ? (appDataUnlock['Admission sought for class'] || 'N/A') : 'N/A';
        const now = new Date();
        const defaultExpiry = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        const defaultStr = defaultExpiry.toISOString().slice(0, 16); // Format YYYY-MM-DDTHH:MM
        try {
            await showConfirm(`Unlock Application #${formNumber}?<br><small>${nameUnlock} -- ${clsUnlock}</small>`);
            const expiryStr = await showInputModal(
                `Unlock Application #${formNumber} -- ${nameUnlock} (${clsUnlock})`,
                'Enter expiry date and time:',
                'Expiry Date/Time',
                defaultStr,
                'datetime-local' // [NEW] Use datetime-local
            );
            setLoading(true);
            runServerFunction('unlockWithExpiry', formNumber, expiryStr, state.currentUser)
                .then(response => {
                    if (response?.success) {
                        showAlert('admin-alert', response.message, 'success');
                        // Immediately fetch latest data which includes updated unlock status
                        return runServerFunction('getInitialDataForUser', state.currentUser);
                    }
                    throw new Error(response?.message || 'Unlock failed');
                })
                .then(handleInitialData)
                .catch(handleError)
                .finally(() => setLoading(false));
        } catch (err) {
            if (err.message !== 'Cancelled') {
                showAlert('admin-alert', err.message, 'warning');
            }
        }
    }
    async function handleAdminLockNow(e) {
        const formNumber = e.target.closest('tr').dataset.formNumber;
        const appDataLock = state.adminData.applications.find(app => String(app['Form Number']) === formNumber);
        const nameLock = appDataLock ? (appDataLock["Student's Name (as per school records)"] || 'Unknown') : 'Unknown';
        const clsLock = appDataLock ? (appDataLock['Admission sought for class'] || 'N/A') : 'N/A';
        try {
            await showConfirm(`Lock Application #${formNumber} immediately? This will end the edit window.<br><small>${nameLock} -- ${clsLock}</small>`);
            setLoading(true);
            runServerFunction('lockImmediately', formNumber, state.currentUser)
                .then(response => {
                    if (response?.success) {
                        showAlert('admin-alert', response.message, 'success');
                        return runServerFunction('getInitialDataForUser', state.currentUser);
                    }
                    throw new Error(response?.message || 'Lock failed');
                })
                .then(handleInitialData)
                .catch(handleError)
                .finally(() => setLoading(false));
        } catch (err) {
            if (err.message !== 'Cancelled') {
                showAlert('admin-alert', err.message, 'warning');
            }
        }
    }
    async function handleAdminSendPassword(e) {
        const row = e.target.closest('tr');
        const formNumber = row?.dataset?.formNumber;
        // Get email from application data for reliability
        const appData = state.adminData.applications.find(app => String(app['Form Number']) === formNumber);
        const email = appData?.['Email Address'] || (row ? row.querySelectorAll('td')[4]?.innerText?.trim() : null);
        const studentName = appData?.["Student's Name (as per school records)"] || 'Unknown';
        if (!email) {
            showAlert('admin-alert', 'Could not determine user email', 'danger');
            return;
        }
        try {
            await showConfirm(`Send password to <strong>${studentName}</strong>?<br><small>${email}</small>`);
            setLoading(true);
            const response = await runServerFunction('sendPasswordToUser', email, state.currentUser);
            if (response?.success) showAlert('admin-alert', response.message, 'success');
            else throw new Error(response?.message || 'Failed to send');
        } catch (err) {
            handleError(err);
        } finally {
            setLoading(false);
        }
    }
    async function handleAdminDelete(e) {
        const formNumber = e.target.closest('tr').dataset.formNumber;
        const appDataDel = state.adminData.applications.find(app => String(app['Form Number']) === formNumber);
        const nameDel = appDataDel ? (appDataDel["Student's Name (as per school records)"] || 'Unknown') : 'Unknown';
        const clsDel = appDataDel ? (appDataDel['Admission sought for class'] || 'N/A') : 'N/A';
        try {
            await showConfirm(`Delete application #${formNumber}? This cannot be undone.<br><small>${nameDel} -- ${clsDel}</small>`);
            setLoading(true);
            runServerFunction('deleteApplication', formNumber, state.currentUser)
                .then(response => {
                    if (response?.success) {
                        showAlert('admin-alert', response.message, 'success');
                        return runServerFunction('getInitialDataForUser', state.currentUser);
                    }
                    throw new Error(response?.message || 'Delete failed');
                })
                .then(handleInitialData)
                .catch(handleError)
                .finally(() => setLoading(false));
        } catch (err) {
            if (err.message !== 'Cancelled') {
                showAlert('admin-alert', err.message, 'warning');
            }
        }
    }
    // Guard to prevent multiple simultaneous WhatsApp calls (fixes "written twice" issue)
    let isWhatsAppProcessing = false;

    async function handleAdminSendWhatsApp(e) {
        if (isWhatsAppProcessing) return;

        const row = e.target.closest('tr');
        const formNumber = row?.dataset?.formNumber;
        if (!formNumber) return;
        const appData = state.adminData.applications.find(app => String(app['Form Number']) === String(formNumber));
        const studentName = appData?.["Student's Name (as per school records)"] || 'Unknown';
        const mobile = (appData && (appData['Mobile No. (with working WhatsApp)'] || appData['Account Mobile'] || appData['Mobile'] || '')) || '';
        const reason = appData?.rejectionReason || appData?.['Rejection Reason'] || '';
        if (!mobile) {
            showAlert('admin-alert', 'No WhatsApp-enabled mobile number found for this application.', 'warning');
            return;
        }

        isWhatsAppProcessing = true;
        try {
            // Build contextual message depending on status (robust detection)
            const status = (appData && (appData['Status'] || appData.status)) || '';
            let pdfUrl = appData && (appData['PDF URL'] || appData['PDF_URL'] || appData.PDF_URL || appData.PDF_URL);
            const statusNorm = String(status || '').toLowerCase().trim();
            const isRejected = /reject|rejected/.test(statusNorm) || !!reason;
            const isSubmitted = /submit/.test(statusNorm);

            // If rejected, show rejection template (Check this FIRST as rejected forms might still have "Submitted" status)
            if (isRejected) {
                let defaultReject = [
                    `Dear ${studentName || 'Applicant'},`,
                    ``,
                    `We regret to inform you that your admission application (Form No. ${formNumber}) to HSS Shangus has been *rejected*.`,
                    ``,
                    `*Reason:* ${reason || 'Not specified'}`,
                    ``,
                    `What you can do: Your form has been unlocked for editing. Please log in to the admission portal at https://sites.google.com/view/hssshangus/login, correct the issues, and resubmit your application.`,
                    ``,
                    `If you need any assistance, contact Admissions at 7006034501.`,
                    ``,
                    `Regards,`,
                    `HSS Shangus Admissions`
                ].join('\n');

                try {
                    const edited = await showInputModal(`Send WhatsApp to ${studentName}`, 'Edit message to send (WhatsApp text):', 'Message', defaultReject, 'textarea');
                    await openWhatsApp(mobile, edited);
                } catch (err) {
                    // cancelled
                }
                return;
            }

            // If submitted and no PDF URL available, attempt to generate one on the server
            if (isSubmitted) {
                if (!pdfUrl) {
                    setLoading(true);
                    try {
                        const gen = await runServerFunction('generatePdfForForm', formNumber, state.currentUser);
                        if (gen && gen.success && gen.pdfUrl) pdfUrl = gen.pdfUrl;
                    } catch (err) {
                        // ignore generation failure, proceed without pdf
                    } finally {
                        setLoading(false);
                    }
                }

                // Default submission message
                let defaultMsg = `Dear ${studentName || 'Applicant'},\n\nYour admission application (Form No. ${formNumber}) has been *submitted* successfully.`;
                if (pdfUrl) defaultMsg += `\n\nYou can view/download your application PDF here: ${pdfUrl}`;
                defaultMsg += `\n\nIf you need assistance, contact Admissions at 7006034501.\n\nRegards,\nHSS Shangus Admissions`;

                // Allow admin to edit message before sending
                try {
                    const edited = await showInputModal(`Send WhatsApp to ${studentName}`, 'Edit message to send (WhatsApp text):', 'Message', defaultMsg, 'textarea');
                    await openWhatsApp(mobile, edited);
                } catch (err) {
                    // Cancelled
                }
                return;
            }

            // Fallback message for other statuses
            let defaultOther = `Dear ${studentName || 'Applicant'},\n\nYour application (Form No. ${formNumber}) status is: ${status || 'Unknown'}.\n\nIf you need assistance, contact Admissions at 7006034501.\n\nRegards,\nHSS Shangus Admissions`;
            try {
                const edited = await showInputModal(`Send WhatsApp to ${studentName}`, 'Edit message to send (WhatsApp text):', 'Message', defaultOther, 'textarea');
                await openWhatsApp(mobile, edited);
            } catch (err) {
                // cancelled
            }
        } catch (err) {
            // Handle cancel or error
        } finally {
            isWhatsAppProcessing = false;
        }
    }

    /**
     * Unified WhatsApp opener function with protocol-first logic
     */
    async function openWhatsApp(mobile, message) {
        // Prepare phone number
        let cleanNumber = String(mobile || '').replace(/\D/g, '');
        if (cleanNumber.startsWith('0')) {
            cleanNumber = '91' + cleanNumber.substring(1);
        } else if (!cleanNumber.startsWith('91') && cleanNumber.length === 10) {
            cleanNumber = '91' + cleanNumber;
        }

        if (cleanNumber.length < 10) {
            showAlert('admin-alert', 'Invalid mobile number: ' + mobile, 'warning');
            return;
        }

        const waMeLink = `https://wa.me/${cleanNumber}?text=${encodeURIComponent(message)}`;
        const appLink = `whatsapp://send?phone=${cleanNumber}&text=${encodeURIComponent(message)}`;

        // Copy to clipboard for safety
        try {
            if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
                await navigator.clipboard.writeText(message);
                showAlert('admin-alert', 'Message copied to clipboard. Opening WhatsApp...', 'success');
            } else {
                showAlert('admin-alert', 'Opening WhatsApp...', 'info');
            }
        } catch (err) {
            showAlert('admin-alert', 'Opening WhatsApp...', 'info');
        }

        // Execution logic
        const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
        if (isMobile) {
            window.location.href = appLink;
            setTimeout(() => {
                if (document.visibilityState === 'visible') {
                    window.open(waMeLink, '_blank');
                }
            }, 2500);
        } else {
            // Desktop: Protocol link to avoid background tabs
            window.location.href = appLink;
            // No automated web fallback on desktop to strictly avoid "written twice" behavior
        }
    }
    function handleExport() {
        setLoadingMessage('Exporting CSV...');
        setLoading(true);
        const requestData = {
            session: getMultiSelectValues('subjectListSession'),
            classFilter: getMultiSelectValues('subjectListClass'),
            statusFilter: getMultiSelectValues('subjectListStatus'),
            order: document.getElementById('subjectListOrder')?.value || 'form_number',
            columns: Array.from(document.querySelectorAll('.subject-col-toggle:checked')).map(cb => cb.value)
        };
        runServerFunction('exportApplicationsToCSV', requestData, JSON.stringify(state.currentUser))
            .then(response => {
                if (response?.success && response.csvContent) {
                    const blob = new Blob([response.csvContent], { type: 'text/csv;charset=utf-8;' });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement("a");
                    link.setAttribute("href", url);
                    link.setAttribute("download", response.filename || "applications_export.csv");
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    showAlert('admin-alert', '[OK] Export completed!', 'success');
                } else throw new Error(response?.message || 'Export failed');
            })
            .catch(handleError)
            .finally(() => setLoading(false));
    }


    // [NEW] Handle Bulk Save Contacts
    async function handleSaveContacts() {
        const input = document.getElementById('toolsFormNumbers');
        const logDiv = document.getElementById('toolsResultLog');
        const resultContainer = document.getElementById('toolsResultContainer');
        const val = input.value.trim();

        if (!val) {
            showAlert('admin-alert', 'Please enter at least one form number.', 'warning');
            return;
        }

        setLoading(true);
        setLoadingMessage('Validating roll numbers...');

        // First, validate that all form numbers have roll numbers assigned
        try {
            const validationResponse = await runServerFunction('validateStudentsHaveRollNos', val, state.currentUser);

            if (!validationResponse.success) {
                throw new Error(validationResponse.message || 'Validation failed');
            }

            // Check if any students are missing roll numbers
            const studentsWithoutRollNo = validationResponse.studentsWithoutRollNo || [];
            const studentsWithRollNo = validationResponse.studentsWithRollNo || [];

            if (studentsWithoutRollNo.length > 0) {
                setLoading(false);

                // Show warning in results
                resultContainer.style.display = 'block';
                let html = `<div style="color:var(--warning); font-weight:bold; margin-bottom:12px;">[!] ${studentsWithoutRollNo.length} student(s) do not have Class Roll Numbers assigned!</div>`;
                html += `<div style="background:var(--danger-light); padding:12px; border-radius:6px; margin-bottom:12px;">`;
                html += `<strong>Students missing roll numbers:</strong><br>`;
                studentsWithoutRollNo.forEach(s => {
                    html += `<div style="margin:4px 0;">- Form ${s.formNo} (${s.name}, Class: ${s['class']})</div>`;
                });
                html += `</div>`;
                html += `<div style="background:var(--info-light); padding:12px; border-radius:6px;">`;
                html += `<strong>Please assign roll numbers first using the "Bulk Roll No Assigner" tool before saving contacts.</strong><br>`;
                html += `<div style="margin-top:8px;">Go to Tools -> Bulk Roll No Assigner -> Load Students -> Assign Roll Numbers -> Save</div>`;
                html += `</div>`;
                logDiv.innerHTML = html;

                showAlert('admin-alert', `${studentsWithoutRollNo.length} student(s) missing roll numbers. Please assign them first.`, 'warning');
                return;
            }

            if (studentsWithRollNo.length === 0) {
                setLoading(false);
                showAlert('admin-alert', 'No valid students found with roll numbers.', 'warning');
                return;
            }

            // All students have roll numbers, proceed with saving
            checkRecentAndProceed('Excel Export', async () => {
                try {
                    setProgressBar(true);
                    updateGlobalProgress('Validating students...', 5);
                    const taskId = 'contacts_' + Date.now();
                    startProgressPolling(taskId, 2000);

                    const response = await runServerFunction('saveContactsToCSV', val, state.currentUser, taskId);

                    if (response.success) {
                        showAlert('admin-alert', response.message, 'success');

                        // Also save the form numbers configuration
                        const config = { 'All': val };
                        runServerFunction('saveBulkRollNoConfig', config, state.currentUser)
                            .then(configResponse => {
                                if (configResponse.success) {
                                    console.log('Form numbers configuration saved successfully');
                                }
                            })
                            .catch(configError => {
                                console.error('Failed to save form numbers configuration:', configError);
                            });

                        // Show detailed log
                        resultContainer.style.display = 'block';
                        let html = `<div style="color:var(--success); font-weight:bold;">[DONE] Successfully Saved: ${response.savedCount}</div>`;

                        if (response.csvFileUrl) {
                            html += `<div style="margin-top:12px; padding:12px; background:var(--info-light); border-radius:6px; border-left:4px solid var(--info);">
                      <strong>? CSV File Created!</strong><br>
                      <small>Since direct contact creation is not available, a CSV file has been created for you to import into Google Contacts.</small><br>
                      <a href="${response.csvDownloadUrl}" target="_blank" style="color:var(--info); text-decoration:underline; font-weight:600;">
                        [IN] Download CSV File
                      </a>
                      <br><small style="color:var(--text-secondary);">Right-click -> Save Link As...</small>
                    </div>`;

                            html += `<div style="margin-top:12px; padding:12px; background:var(--bg-secondary); border-radius:6px;">
                      <strong>[LIST] How to import into Google Contacts:</strong>
                      <ol style="margin:8px 0; padding-left:20px; font-size:0.85rem;">
                        <li>Download the CSV file above</li>
                        <li>Go to <a href="https://contacts.google.com" target="_blank" style="color:var(--primary);">Google Contacts</a></li>
                        <li>Click "Import" in the left sidebar</li>
                        <li>Select the downloaded CSV file</li>
                        <li>Click "Import" to add all contacts</li>
                      </ol>
                    </div>`;
                        }

                        if (response.skipped && response.skipped.length > 0) {
                            html += `<div style="margin-top:8px; color:var(--warning); font-weight:bold;">[!] Skipped (Already exist): ${response.skipped.length}</div>`;
                            html += `<div style="margin-top:4px; max-height:100px; overflow-y:auto; background:var(--bg-card); padding:8px; border-radius:4px; font-size:0.8rem;">`;
                            response.skipped.slice(0, 10).forEach(s => html += `<div style="margin:2px 0;">- ${s}</div>`);
                            if (response.skipped.length > 10) {
                                html += `<div style="margin-top:4px; font-style:italic;">... and ${response.skipped.length - 10} more</div>`;
                            }
                            html += `</div>`;
                        }

                        if (response.errors && response.errors.length > 0) {
                            html += `<div style="margin-top:8px; color:var(--danger); font-weight:bold;">[X] Errors: ${response.errors.length}</div>`;
                            html += `<div style="margin-top:4px; max-height:100px; overflow-y:auto; background:var(--danger-light); padding:8px; border-radius:4px; font-size:0.8rem;">`;
                            response.errors.slice(0, 10).forEach(e => html += `<div style="margin:2px 0;">- ${e}</div>`);
                            if (response.errors.length > 10) {
                                html += `<div style="margin-top:4px; font-style:italic;">... and ${response.errors.length - 10} more</div>`;
                            }
                            html += `</div>`;
                        }

                        if (response.savedCount === 0 && (!response.errors || response.errors.length === 0) && (!response.skipped || response.skipped.length === 0)) {
                            html += `<div>No actions taken.</div>`;
                        }

                        logDiv.innerHTML = html;

                        // Auto-scroll to results
                        resultContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

                    } else {
                        showAlert('admin-alert', response.message, 'danger');
                        resultContainer.style.display = 'block';
                        logDiv.innerHTML = `<div style="color:var(--danger);">[X] ${response.message}</div>`;
                    }
                } catch (error) {
                    showAlert('admin-alert', 'Failed to save contacts: ' + error.message, 'danger');
                    resultContainer.style.display = 'block';
                    logDiv.innerHTML = `<div style="color:var(--danger);">[X] Error: ${error.message}</div>`;
                } finally {
                    stopProgressPolling();
                    setProgressBar(false);
                }
            });
        } catch (error) {
            showAlert('admin-alert', 'Failed to save contacts: ' + error.message, 'danger');
            resultContainer.style.display = 'block';
            logDiv.innerHTML = `<div style="color:var(--danger);">[X] Error: ${error.message}</div>`;
        } finally {
            setLoading(false);
        }
    }
    function handleSaveAllWithRollNos() {
        const logDiv = document.getElementById('toolsResultLog');
        const resultContainer = document.getElementById('toolsResultContainer');

        setLoading(true);
        setLoadingMessage('Fetching all students with assigned roll numbers...');

        runServerFunction('getStudentsWithRollNos', state.currentUser)
            .then(response => {
                if (response.success && response.students && response.students.length > 0) {
                    const formNumbers = response.students.map(s => s.formNo).join(', ');

                    // Populate the textarea with the form numbers
                    document.getElementById('toolsFormNumbers').value = formNumbers;

                    showAlert('admin-alert', `Found ${response.students.length} students with roll numbers. Click "Save" to export them.`, 'success');

                    // Show preview in results
                    resultContainer.style.display = 'block';
                    let html = `<div style="color:var(--success); font-weight:bold;">[DONE] Found ${response.students.length} students with assigned roll numbers</div>`;
                    html += `<div style="margin-top:8px; font-size:0.85rem; color:var(--text-secondary);">Classes: ${[...new Set(response.students.map(s => s['class']))].join(', ')}</div>`;
                    html += `<div style="margin-top:8px; max-height:150px; overflow-y:auto; background:var(--bg-card); padding:8px; border-radius:4px; font-size:0.8rem;">`;
                    html += `<strong>Students found:</strong><br>`;
                    response.students.slice(0, 20).forEach(s => {
                        html += `<div style="margin:2px 0;">- Form ${s.formNo} (${s.name}, ${s['class']}, Roll: ${s.rollNo || 'N/A'})</div>`;
                    });
                    if (response.students.length > 20) {
                        html += `<div style="margin-top:4px; font-style:italic;">... and ${response.students.length - 20} more</div>`;
                    }
                    html += `</div>`;
                    html += `<div style="margin-top:12px; padding:12px; background:var(--info-light); border-radius:6px; border-left:4px solid var(--info);">
              <strong>Next Step:</strong> Click the "Save" button above to export these ${response.students.length} contacts to Google Contacts.
            </div>`;
                    logDiv.innerHTML = html;

                } else if (response.success && (!response.students || response.students.length === 0)) {
                    showAlert('admin-alert', 'No students with assigned roll numbers found.', 'warning');
                    resultContainer.style.display = 'block';
                    logDiv.innerHTML = `<div style="color:var(--warning);">[!] No students with assigned roll numbers found. Please assign roll numbers first.</div>`;
                } else {
                    showAlert('admin-alert', response.message || 'Failed to fetch students.', 'danger');
                    resultContainer.style.display = 'block';
                    logDiv.innerHTML = `<div style="color:var(--danger);">[X] ${response.message || 'Failed to fetch students'}</div>`;
                }
            })
            .catch(error => {
                showAlert('admin-alert', 'Failed to fetch students: ' + error.message, 'danger');
                resultContainer.style.display = 'block';
                logDiv.innerHTML = `<div style="color:var(--danger);">[X] Error: ${error.message}</div>`;
            })
            .finally(() => setLoading(false));
    }

    function handleSaveContactConfig() {
        const input = document.getElementById('toolsFormNumbers');
        const val = input.value.trim();

        if (!val) {
            showAlert('admin-alert', 'Please enter at least one form number.', 'warning');
            return;
        }

        setLoading(true);
        setLoadingMessage('Saving form numbers configuration...');

        // Create config object with all classes (for now, save as 'All')
        const config = {
            'All': val
        };

        runServerFunction('saveBulkRollNoConfig', config, state.currentUser)
            .then(response => {
                if (response.success) {
                    showAlert('admin-alert', response.message, 'success');
                } else {
                    showAlert('admin-alert', response.message, 'danger');
                }
            })
            .catch(err => {
                showAlert('admin-alert', 'Error sending bulk emails: ' + err.message, 'danger');
            })
            .finally(() => setLoading(false));
    }

    function loadContactConfig() {
        // [NEW] Populate Filter Dropdowns
        if (state.adminData) {
            // Sessions
            const sessions = new Set();
            if (state.adminData.settings && state.adminData.settings.session) sessions.add(state.adminData.settings.session);
            (state.adminData.applications || []).forEach(app => {
                const s = app.Session || app.session;
                if (s) sessions.add(s);
            });
            const sessionList = Array.from(sessions).sort().reverse();
            
            // Classes (Standard School Classes)
            const classList = ['9th', '10th', '11th', '12th'];
            
            // Streams (Science/Humanities/General)
            const streamList = ['Science', 'Humanities', 'General'];

            if (typeof renderMultiSelect === 'function') {
                renderMultiSelect('contactSaverSession', sessionList, 'Sessions');
                renderMultiSelect('contactSaverClass', classList, 'Classes');
                renderMultiSelect('contactSaverStream', streamList, 'Streams');
            }
        }

        // [NEW] Attach Event Listeners for Filters
        const loadBtn = document.getElementById('loadFilteredContactsBtn');
        if (loadBtn && !loadBtn.dataset.listenerAdded) {
            loadBtn.addEventListener('click', handleLoadFilteredContacts);
            loadBtn.dataset.listenerAdded = 'true';
        }

        const clearBtn = document.getElementById('toolsClearBtn');
        if (clearBtn && !clearBtn.dataset.listenerAdded) {
            clearBtn.addEventListener('click', () => {
                const input = document.getElementById('toolsFormNumbers');
                if (input) input.value = '';
                const result = document.getElementById('toolsResultContainer');
                if (result) result.style.display = 'none';
            });
            clearBtn.dataset.listenerAdded = 'true';
        }

        runServerFunction('loadBulkRollNoConfig', state.currentUser)
            .then(response => {
                if (response.success && response.config) {
                    const input = document.getElementById('toolsFormNumbers');
                    if (response.config['All']) {
                        input.value = response.config['All'];
                    }
                }
            })
            .catch(error => {
                console.error('Failed to load form numbers configuration:', error);
            });
    }

    /**
     * [NEW] Loads student form numbers into the textarea based on filters.
     */
    async function handleLoadFilteredContacts() {
        const btn = document.getElementById('loadFilteredContactsBtn');
        const input = document.getElementById('toolsFormNumbers');
        const onlyRollNos = document.getElementById('contactSaverOnlyRollNos').checked;
        
        // Helper to get multi-select values
        const getSelected = (id) => {
            const container = document.getElementById(id);
            if (!container) return [];
            return Array.from(container.querySelectorAll('input[type="checkbox"]:checked:not(.option-all-input)')).map(cb => cb.value);
        };

        const selSessions = getSelected('contactSaverSession');
        const selClasses = getSelected('contactSaverClass');
        const selStreams = getSelected('contactSaverStream');

        setBtnLoading(btn, true, 'Loading...');

        try {
            let students = state.adminData.applications || [];
            
            // 1. Session Filter
            if (selSessions.length > 0) {
                const sessSet = new Set(selSessions);
                students = students.filter(s => sessSet.has(s.Session || s.session));
            }

            // 2. Class Filter (Matches '11th' in '11th Prov', '11th Full' etc)
            if (selClasses.length > 0) {
                students = students.filter(s => {
                    const c = (s['Admission sought for class'] || s['class'] || '').toLowerCase();
                    return selClasses.some(sel => c.includes(sel.toLowerCase()));
                });
            }

            // 3. Stream Filter (Science/Humanities/General)
            if (selStreams.length > 0) {
                const streamSet = new Set(selStreams.map(v => v.toLowerCase()));
                students = students.filter(s => {
                    const cls = (s['Admission sought for class'] || s['class'] || '').toLowerCase();
                    const subjects = (s.Subjects || s.subs || '').toLowerCase();
                    
                    const is11or12 = cls.includes('11') || cls.includes('12');
                    const is9or10 = cls.includes('9') || cls.includes('10');
                    const hasScienceSubjects = subjects.includes('physics') && subjects.includes('chemistry');

                    // Science: 11th/12th with Physics & Chemistry
                    if (streamSet.has('science') && is11or12 && hasScienceSubjects) return true;
                    
                    // Humanities: 11th/12th without Science subjects
                    if (streamSet.has('humanities') && is11or12 && !hasScienceSubjects) return true;
                    
                    // General: 9th/10th
                    if (streamSet.has('general') && is9or10) return true;
                    
                    return false;
                });
            }

            // 4. Assigned Roll No Filter
            if (onlyRollNos) {
                students = students.filter(s => String(s['Class Roll No'] || s['class_r_no'] || '').trim() !== '');
            }

            if (students.length === 0) {
                showAlert('admin-alert', 'No students found matching your filter criteria.', 'warning');
                return;
            }

            const formNumbers = students.map(s => s['Form Number'] || s['form_no']).filter(v => v).join(', ');
            input.value = formNumbers;
            showAlert('admin-alert', `Loaded ${students.length} students into the list.`, 'success');
            
        } catch (e) {
            console.error('Filter Error:', e);
            showAlert('admin-alert', 'Filter Error: ' + e.message, 'danger');
        } finally {
            setBtnLoading(btn, false);
        }
    }

    // Batch processing state for ID Card Data
    let idCardBatchState = {
        isProcessing: false,
        processedCount: 0,
        totalCount: 0,
        folderId: null,
        timestamp: null,
        continuationToken: null
    };

    /**
     * Load recent ID Card folders (created in batchFolder) and render them in the ID Card Result container.
     */
    async function loadIdCardFolders() {
        try {
            const container = document.getElementById('idCardResultContainer');
            if (!container) return;
            container.style.display = 'block';

            let list = document.getElementById('idCardFoldersList');
            if (!list) {
                list = document.createElement('div');
                list.id = 'idCardFoldersList';
                list.style.marginBottom = '12px';
                container.insertBefore(list, container.firstChild);
            }
            list.innerHTML = '<div style="color:var(--text-secondary);">Loading recent ID Card folders...</div>';

            const resp = await runServerFunction('checkForRecentReports', state.currentUser);
            if (!resp || !resp.success) {
                list.innerHTML = '<div style="color:var(--error);">Unable to fetch folders.</div>';
                return;
            }

            const reports = (resp.reports || []).filter(r => r.type === 'ID Card Data' || r.type === 'ID Card PDFs');
            if (!reports.length) {
                list.innerHTML = '<div style="color:var(--text-secondary);">No recent ID Card folders found.</div>';
                return;
            }

            const itemsHtml = reports.map(r => {
                return `
                    <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; padding:8px 6px; border-radius:6px; background:var(--bg); border:1px solid var(--border); margin-bottom:8px;">
                        <div style="flex:1; min-width:0;">
                            <div style="font-weight:700; font-size:0.95rem; overflow:hidden; text-overflow:ellipsis; white-space:normal;">${r.name}</div>
                            <div style="font-size:0.82rem; color:var(--text-secondary);">${r.timeStr}</div>
                        </div>
                        <div style="display:flex; gap:6px; flex:0 0 auto;">
                            <button class="btn btn-secondary btn-open-folder" data-url="${r.url}">Open</button>
                            <button class="btn btn-secondary btn-copy-link" data-url="${r.url}">Copy Link</button>
                        </div>
                    </div>
                `;
            }).join('');

            list.innerHTML = itemsHtml;

            // Wire actions
            list.querySelectorAll('.btn-open-folder').forEach(b => b.addEventListener('click', (e) => {
                const url = e.currentTarget.dataset.url;
                if (url) window.open(url, '_blank');
            }));
            list.querySelectorAll('.btn-copy-link').forEach(b => b.addEventListener('click', async (e) => {
                const url = e.currentTarget.dataset.url;
                if (!url) return;
                try { await navigator.clipboard.writeText(url); showAlert('admin-alert', 'Link copied to clipboard', 'success'); } catch (err) { showToast('Unable to copy link', 'error'); }
            }));

        } catch (err) {
            console.error('loadIdCardFolders error:', err);
        }
    }

    /**
     * [NEW] Helper to check for existing recent reports before initiating new ones.
     * Prompts the user if matching recent folders are found.
     * context: optional string to match in folder name (e.g. "11th")
     */
    async function checkRecentAndProceed(reportType, callback, context = null) {
        try {
            setLoading(true);
            setLoadingMessage('Checking for recent reports...');
            const response = await runServerFunction('checkForRecentReports', state.currentUser);
            setLoading(false);

            if (response.success && response.reports && response.reports.length > 0) {
                // Filter reports that match the type AND context if provided
                const matching = response.reports.filter(r => {
                    const typeMatch = r.type === reportType;
                    const contextMatch = context ? r.name.includes(context) : true;
                    return typeMatch && contextMatch;
                });

                if (matching.length > 0) {
                    const newest = matching[0];
                    let html = `<div style="margin-bottom:12px;">A <strong>${reportType}</strong> report for <strong>${context || 'this category'}</strong> was already generated recently:</div>`;
                    html += `<div style="background:var(--info-light); padding:10px; border-radius:6px; margin-bottom:15px; border-left:4px solid var(--info);">`;
                    html += `<strong>Name:</strong> ${newest.name}<br>`;
                    html += `<strong>Created:</strong> ${newest.timeStr}`;
                    html += `</div>`;
                    html += `<div>Do you want to visit the <strong>existing folder</strong> instead of generating it again?</div>`;

                    showPopup(html, {
                        autoClose: false,
                        buttons: [
                            {
                                text: 'Generate New',
                                style: 'secondary',
                                onClick: () => { callback(); }
                            },
                            {
                                text: 'Open Existing Folder',
                                onClick: () => { window.open(newest.url, '_blank'); }
                            }
                        ]
                    });
                    return;
                }
            }
            // No matching recent report found, proceed
            callback();
        } catch (e) {
            console.warn('Recent report check failed:', e);
            callback(); // Proceed anyway if check fails
        }
    }

    async function handleGenerateIdCardData() {
        if (!state.currentUser) return;
        const btn = document.getElementById('generateIdCardDataBtn');
        const classFilter = getMultiSelectValues('idCardClassFilter');
        const classLabel = Array.isArray(classFilter) ? classFilter.join('+') : String(classFilter);

        checkRecentAndProceed('ID Card Data', async () => {
            const logDiv = document.getElementById('idCardLog');
            if (logDiv) logDiv.style.display = 'block';

            try {
                await showConfirm('Generate CSV and Photos for ' + (classLabel || 'All Classes') + '?');

                idCardBatchState.isProcessing = true;
                idCardBatchState.processedCount = 0;
                idCardBatchState.folderId = null;
                idCardBatchState.timestamp = null;

                setProgressBar(true);
                const taskId = 'id_data_' + Date.now();
                startProgressPolling(taskId, 2000);

                while (idCardBatchState.isProcessing) {
                    const result = await runServerFunction('generateIdCardData', {
                        classFilter: classFilter,
                        taskId,
                        batchSize: 100,
                        continuationToken: idCardBatchState.continuationToken,
                        folderId: idCardBatchState.folderId,
                        timestamp: idCardBatchState.timestamp
                    }, state.currentUser);

                    if (!result.success) throw new Error(result.message);

                    idCardBatchState.processedCount = result.count;
                    idCardBatchState.totalCount = result.totalCount;
                    idCardBatchState.folderId = result.folderId;
                    idCardBatchState.timestamp = result.timestamp;
                    idCardBatchState.continuationToken = result.continuationToken;
                    idCardBatchState.isProcessing = result.hasMore;

                    if (result.aborted) {
                        updateGlobalProgress('Data Export Stopped', 100);
                        showToast('Data generation halted.', 'info');
                        break;
                    }

                    if (!result.hasMore) {
                        updateGlobalProgress('ID Card Data Generated!', 100, result.folderUrl);
                        if (logDiv) {
                            logDiv.innerHTML += `
                                <div style="margin-top:15px; padding:15px; background:rgba(59, 130, 246, 0.1); border:1px solid rgba(59, 130, 246, 0.2); border-radius:12px;">
                                    <div style="display:flex; align-items:center; gap:10px; margin-bottom:10px; color:var(--primary);">
                                        <span class="material-icons" style="font-size:1.8rem;">archive</span>
                                        <span style="font-weight:700; font-size:1.1rem;">Data Files Ready!</span>
                                    </div>
                                    <div style="font-size:0.9rem; color:var(--text-primary); margin-bottom:12px;">
                                        CSV and Student Photos for <strong>${classLabel}</strong> are packaged and ready.
                                    </div>
                                    <a href="${result.folderUrl}" target="_blank" class="btn btn-primary btn-small" style="width:100%; display:flex; align-items:center; justify-content:center; gap:6px; padding:0.6rem;">
                                        <span class="material-icons" style="font-size:1rem;">folder_open</span>
                                        <span>View Data in Drive</span>
                                    </a>
                                </div>
                            `;
                        }
                    }
                }
            } catch (err) {
                console.error(err);
                if (logDiv) logDiv.innerHTML += '<div style="color:var(--error); margin-top:8px;">[X] Error: ' + err.message + '</div>';
                showToast(err.message, 'error');
            } finally {
                stopProgressPolling();
                setProgressBar(false);
                setLoading(false);
            }
        }, classLabel);
    }

    async function handleGenerateIdCardPdfs() {
        if (!state.currentUser) return;
        const btn = document.getElementById('generateIdCardPdfsBtn');
        const classFilter = getMultiSelectValues('idCardClassFilter');
        const classLabel = Array.isArray(classFilter) ? classFilter.join('+') : String(classFilter);
        const logDiv = document.getElementById('idCardLog');
        if (logDiv) logDiv.style.display = 'block';

        var startRollStr = document.getElementById('idCardRollStart').value;
        var endRollStr = document.getElementById('idCardRollEnd').value;
        var startRoll = startRollStr ? parseInt(startRollStr) : null;
        var endRoll = endRollStr ? parseInt(endRollStr) : null;

        var message = '';
        if (startRoll !== null && endRoll !== null) {
            message = 'Generate PDF ID Cards for ' + (classLabel || 'All') + ' students from Roll No ' + startRoll + ' to ' + endRoll + '?';
        } else {
            message = 'Generate PDF ID Cards for ALL students in ' + (classLabel || 'All Classes') + ' who have assigned roll numbers?';
        }

        try {
            await showConfirm(message);
            checkRecentAndProceed('ID Card PDFs', async () => {
                let idPdfBatchState = {
                    isProcessing: true,
                    processedCount: 0,
                    totalCount: 0,
                    folderId: null,
                    timestamp: null,
                    continuationToken: null
                };

                let batchNumber = 1;
                setProgressBar(true);
                const taskId = 'id_pdfs_' + Date.now();
                startProgressPolling(taskId, 2000);

                try {
                    btn.disabled = true;
                    btn.innerHTML = '<span class="spinner-small" style="width:14px; height:14px;"></span> Processing...';

                    const startRollCapture = startRoll;
                    const endRollCapture = endRoll;
                    const classFilterCapture = classFilter;

                    while (idPdfBatchState.isProcessing) {
                        const requestData = {
                            classFilter: classFilterCapture,
                            startRoll: startRollCapture,
                            endRoll: endRollCapture,
                            taskId,
                            batchSize: 50, // Increased for efficiency with server-side time loop
                            continuationToken: idPdfBatchState.continuationToken,
                            folderId: idPdfBatchState.folderId,
                            timestamp: idPdfBatchState.timestamp,
                            totalProcessed: idPdfBatchState.processedCount
                        };

                        const result = await runServerFunction('generateIdPdfsInRange', requestData, state.currentUser);
                        if (!result.success) throw new Error(result.message);

                        idPdfBatchState.processedCount = result.count;
                        idPdfBatchState.totalCount = result.totalCount;
                        idPdfBatchState.folderId = result.folderId;
                        idPdfBatchState.timestamp = result.timestamp;
                        idPdfBatchState.continuationToken = result.continuationToken;
                        idPdfBatchState.isProcessing = result.hasMore;

                        if (result.aborted) {
                            updateGlobalProgress('Task Stopped by User', 100);
                            if (logDiv) logDiv.innerHTML += '<div style="color:var(--warning); margin-top:8px; font-weight:600;">[ABORTED] Process terminated manually.</div>';
                            showToast('Tasks halted.', 'info');
                            break;
                        }

                        logDiv && (logDiv.innerHTML += `<div style="color:var(--info); margin-top:4px;">[OK] Batch ${batchNumber}: ${result.count}/${result.totalCount} PDFs</div>`);
                        if (logDiv) logDiv.scrollTop = logDiv.scrollHeight;

                        if (!result.hasMore) {
                            updateGlobalProgress('ID Card PDFs Created!', 100, result.folderUrl);
                            if (logDiv) {
                                logDiv.innerHTML += `
                                    <div style="margin-top:15px; padding:15px; background:rgba(16, 185, 129, 0.1); border:1px solid rgba(16, 185, 129, 0.2); border-radius:12px;">
                                        <div style="display:flex; align-items:center; gap:10px; margin-bottom:10px; color:var(--success);">
                                            <span class="material-icons" style="font-size:1.8rem;">check_circle</span>
                                            <span style="font-weight:700; font-size:1.1rem;">Generation Complete!</span>
                                        </div>
                                        <div style="font-size:0.9rem; color:var(--text-primary); margin-bottom:12px;">
                                            Successfully generated <strong>${result.count}</strong> Admit Card PDFs for Class <strong>${classFilterCapture}</strong>.
                                        </div>
                                        <div style="display:flex; gap:8px;">
                                            <a href="${result.folderUrl}" target="_blank" class="btn btn-primary btn-small" style="flex:1; display:flex; align-items:center; justify-content:center; gap:6px; padding:0.6rem;">
                                                <span class="material-icons" style="font-size:1rem;">folder_open</span>
                                                <span>Open in Drive</span>
                                            </a>
                                            <button onclick="window.location.reload()" class="btn btn-secondary btn-small" style="flex:1; display:flex; align-items:center; justify-content:center; gap:6px; padding:0.6rem;">
                                                <span class="material-icons" style="font-size:1rem;">refresh</span>
                                                <span>Reset View</span>
                                            </button>
                                        </div>
                                    </div>
                                `;
                            }
                            showToast('Successfully generated ' + result.count + ' ID Cards!', 'success');

                            // Don't auto-hide immediately if success, let them see the button
                            setTimeout(() => {
                                // Maybe keep it open for 5 seconds?
                            }, 5000);
                        }

                        batchNumber++;
                        if (result.hasMore) await new Promise(resolve => setTimeout(resolve, 500));
                    }
                } catch (err) {
                    if (logDiv) logDiv.innerHTML += '<div style="color:var(--error); margin-top:8px;">Server error: ' + err.message + '</div>';
                    showToast(err.message, 'error');
                } finally {
                    stopProgressPolling();
                    setProgressBar(false);
                    setLoading(false);
                    setLoadingMessage('');
                    btn.disabled = false;
                    btn.innerHTML = '<span class="material-icons" style="font-size:1.1rem;">picture_as_pdf</span><span>Generate PDFs</span>';
                }
            });
        } catch (e) {
            return;
        }
    }


    function handleDownloadIdCardData() {
        // This will open the generated folder in Google Drive
        // The actual folder ID is set during generation
        showAlert('admin-alert', 'Opening folder in Google Drive...', 'info');
    }

    /**
     * [NEW] Handles the generation and opening of the Admission Register.
     */
    function handleAdmissionRegister() {
        const session = document.getElementById('sessionInput')?.value || '';
        if (!session) {
            if (window.showAlert) showAlert('admin-alert', 'Please enter a session in Controls tab first.', 'warning');
            else alert('Please enter a session in Controls tab first.');
            return;
        }

        if (window.showLoading) showLoading();
        google.script.run
            .withSuccessHandler(html => {
                if (window.hideLoading) hideLoading();
                const win = window.open('', '_blank');
                if (win) {
                    win.document.write(html);
                    win.document.close();
                } else {
                    if (window.showAlert) showAlert('admin-alert', 'Pop-up blocked! Please allow pop-ups for this site.', 'error');
                    else alert('Pop-up blocked! Please allow pop-ups for this site.');
                }
            })
            .withFailureHandler(err => {
                if (window.hideLoading) hideLoading();
                if (window.showAlert) showAlert('admin-alert', 'Failed: ' + err.message, 'error');
                else alert('Failed: ' + err.message);
            })
            .getAdmissionRegisterHtml(session, state.user);
    }

    function openPrintSettings() {
        const sessionsSet = new Set((state.adminData.applications || []).map(a => a['Session']).filter(Boolean));
        const sortedSessions = Array.from(sessionsSet).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).reverse();
        const sessionOptions = ['<option value="">All Sessions</option>', ...sortedSessions.map(s => `<option value="${s}">${s}</option>`)];
        const classOptions = ['<option value="">All Classes</option>', '<option value="9th">9th</option>', '<option value="10th">10th</option>', '<option value="11th">11th</option>', '<option value="12th">12th</option>'];
        const typeOptions = ['<option value="">All Types</option>', '<option value="Full">Full</option>', '<option value="Provisional">Provisional</option>'];
        const statusOptions = [
            '<option value="">All Status</option>',
            '<option value="Submitted">Submitted</option>',
            '<option value="AssignedRollNos">Assigned Roll Nos</option>',
            '<option value="Draft">Draft</option>',
            '<option value="Rejected">Rejected</option>'
        ];
        const orderOptions = [
            { value: 'submitted_desc', label: 'Submitted: Newest' },
            { value: 'submitted_asc', label: 'Submitted: Oldest' },
            { value: 'form_asc', label: 'Form No: Asc' },
            { value: 'class_form', label: 'Class -> Form' },
            { value: 'class_roll', label: 'Class -> Roll No' },
            { value: 'roll_class', label: 'Roll No -> Class' }
        ];
        const defaultOrder = state.adminData?.settings?.print_sort_by || 'submitted_desc';
        const cols = [
            { key: 'sno', label: 'S.No.' },
            { key: 'form', label: 'Form No.' },
            { key: 'name', label: 'Name' },
            { key: 'parentage', label: 'Parentage' },
            { key: 'email', label: 'Email' },
            { key: 'profile_mobile', label: 'Profile M' },
            { key: 'mobile', label: 'Mobile' },
            { key: 'parent_mobile', label: 'Parent Mobile' },
            { key: 'residence', label: 'Residence' },
            { key: 'class', label: 'Class' },
            { key: 'adm_type', label: 'Adm Type' },
            { key: 'class_roll_no', label: 'Class Roll No' },
            { key: 'status', label: 'Form Status' },
            { key: 'submitted', label: 'Submitted On' },
            { key: 'actions', label: 'Actions' }
        ];
        const defaults = new Set(['sno', 'form', 'name', 'account_mobile', 'mobile', 'parent_mobile', 'adm_type', 'status']);
        const html = `
        <div style="display:flex;flex-direction:column;gap:0.75rem;">
          <div style="display:grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap:0.75rem; align-items:end;">
            <div style="display:flex; flex-direction:column; gap:0.25rem;">
               <label style="font-weight:600; font-size:0.85rem;">Session</label>
               <select id="print_session" style="width:100%; padding:0.5rem; border-radius:4px; border:1px solid var(--border);">${sessionOptions.join('')}</select>
            </div>
            <div style="display:flex; flex-direction:column; gap:0.25rem;">
               <label style="font-weight:600; font-size:0.85rem;">Class</label>
               <select id="print_class" style="width:100%; padding:0.5rem; border-radius:4px; border:1px solid var(--border);">${classOptions.join('')}</select>
            </div>
            <div style="display:flex; flex-direction:column; gap:0.25rem;">
               <label style="font-weight:600; font-size:0.85rem;">Type</label>
               <select id="print_type" style="width:100%; padding:0.5rem; border-radius:4px; border:1px solid var(--border);">${typeOptions.join('')}</select>
            </div>
            <div style="display:flex; flex-direction:column; gap:0.25rem;">
               <label style="font-weight:600; font-size:0.85rem;">Status</label>
               <select id="print_status" style="width:100%; padding:0.5rem; border-radius:4px; border:1px solid var(--border);">${statusOptions.join('')}</select>
            </div>
            <div style="display:flex; flex-direction:column; gap:0.25rem;">
               <label style="font-weight:600; font-size:0.85rem;">Order</label>
               <select id="print_order" style="width:100%; padding:0.5rem; border-radius:4px; border:1px solid var(--border);">${orderOptions.map(o => `<option value="${o.value}" ${o.value === defaultOrder ? 'selected' : ''}>${o.label}</option>`).join('')}</select>
            </div>
          </div>
          <div>
            <div style="font-weight:600; margin-bottom:0.5rem;">Columns</div>
            <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); gap:0.5rem;">
              ${cols.map(c => `<label style="display:flex; align-items:center; gap:8px; font-size:0.9rem; cursor:pointer;"><input type="checkbox" id="print_col_${c.key}" ${defaults.has(c.key) ? 'checked' : ''} style="width:14px; height:14px; padding:2px;">${c.label}</label>`).join('')}
            </div>
          </div>
        </div>
      `;
        showPopup(html, {
            autoClose: false,
            wide: true,
            buttons: [
                { text: 'Cancel', onClick: () => { } },
                {
                    text: 'Print', onClick: () => {
                        const session = document.getElementById('print_session')?.value || '';
                        const cls = document.getElementById('print_class')?.value || '';
                        const selected = cols.filter(c => document.getElementById('print_col_' + c.key)?.checked).map(c => c.key);
                        const order = document.getElementById('print_order')?.value || defaultOrder;
                        const type = document.getElementById('print_type')?.value || '';
                        const status = document.getElementById('print_status')?.value || '';
                        generatePrintReport({ session, cls, type, status, order, columns: selected });
                    }
                }
            ]
        });
    }

    function openSubjectListSettings() {
        const sessionsSet = new Set((state.adminData.applications || []).map(a => a['Session']).filter(Boolean));
        const sessionOptions = ['<option value="">All Sessions</option>', ...Array.from(sessionsSet).sort().map(s => `<option value="${s}">${s}</option>`)];
        const classOptions = ['<option value="">All Classes</option>', '<option value="9th">9th</option>', '<option value="10th">10th</option>', '<option value="11th">11th</option>', '<option value="12th">12th</option>'];
        const typeOptions = ['<option value="">All Types</option>', '<option value="Full">Full</option>', '<option value="Provisional">Provisional</option>'];
        const orderOptions = [
            { value: 'subject_name', label: 'Subject Name -> Name' },
            { value: 'class_subject', label: 'Class -> Subject -> Name' },
            { value: 'name_subject', label: 'Name -> Subject' },
            { value: 'form_subject', label: 'Form No -> Subject' }
        ];

        const html = `
        <div style="display:flex;flex-direction:column;gap:0.75rem;">
          <div style="display:grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap:0.75rem; align-items:end;">
            <div style="display:flex; flex-direction:column; gap:0.25rem;">
               <label style="font-weight:600; font-size:0.85rem;">Session</label>
               <select id="subject_session" style="width:100%; padding:0.5rem; border-radius:4px; border:1px solid var(--border);">${sessionOptions.join('')}</select>
            </div>
            <div style="display:flex; flex-direction:column; gap:0.25rem;">
               <label style="font-weight:600; font-size:0.85rem;">Class</label>
               <select id="subject_class" style="width:100%; padding:0.5rem; border-radius:4px; border:1px solid var(--border);">${classOptions.join('')}</select>
            </div>
            <div style="display:flex; flex-direction:column; gap:0.25rem;">
               <label style="font-weight:600; font-size:0.85rem;">Type</label>
               <select id="subject_type" style="width:100%; padding:0.5rem; border-radius:4px; border:1px solid var(--border);">${typeOptions.join('')}</select>
            </div>
            <div style="display:flex; flex-direction:column; gap:0.25rem;">
               <label style="font-weight:600; font-size:0.85rem;">Order</label>
               <select id="subject_order" style="width:100%; padding:0.5rem; border-radius:4px; border:1px solid var(--border);">${orderOptions.map(o => `<option value="${o.value}">${o.label}</option>`).join('')}</select>
            </div>
          </div>
        </div>
      `;

        showPopup(html, {
            autoClose: false,
            wide: true,
            buttons: [
                { text: 'Cancel', onClick: () => { } },
                {
                    text: 'Generate List', onClick: () => {
                        const session = document.getElementById('subject_session')?.value || '';
                        const cls = document.getElementById('subject_class')?.value || '';
                        const type = document.getElementById('subject_type')?.value || '';
                        const order = document.getElementById('subject_order')?.value || 'subject_name';
                        generateSubjectWiseList({ session, cls, type, order });
                    }
                }
            ]
        });
    }

    function generateSubjectWiseList(opts) {
        const session = opts?.session || '';
        const cls = opts?.cls || '';
        const type = opts?.type || '';
        const order = opts?.order || 'subject_name';

        let apps = state.adminData.applications || [];

        // Filter applications
        if (session) apps = apps.filter(a => (a['Session'] || '') === session);
        if (cls) apps = apps.filter(a => (a['Admission sought for class'] || '') === cls);
        if (type) {
            apps = apps.filter(a => {
                const classVal = a['Admission sought for class'] || '';
                let t = '';
                if (classVal === '11th') t = a['Admission Type (Class 11th)'] || '';
                else if (classVal === '12th') t = a['Admission Type (Class 12th)'] || '';
                return String(t || '').trim() === type;
            });
        }

        // Get all subjects from applications
        const subjectMap = new Map();
        apps.forEach(app => {
            const subjects = (app['Subjects'] || '').split(',').map(s => s.trim()).filter(Boolean);
            const classVal = app['Admission sought for class'] || '';
            const formNo = app['Form Number'] || '';
            const name = app['Student\'s Name (as per school records)'] || '';
            const rollNo = app['Class Roll No'] || '';

            subjects.forEach(subject => {
                if (!subjectMap.has(subject)) {
                    subjectMap.set(subject, []);
                }
                subjectMap.get(subject).push({
                    formNo,
                    name,
                    "class": classVal,
                    rollNo,
                    subjects: subjects.join(', ')
                });
            });
        });

        // Sort subjects based on order
        let sortedSubjects = Array.from(subjectMap.entries());
        if (order === 'subject_name') {
            sortedSubjects.sort((a, b) => a[0].localeCompare(b[0]));
        } else if (order === 'class_subject') {
            sortedSubjects.sort((a, b) => {
                const aClass = a[1][0] ? a[1][0]['class'] : '';
                const bClass = b[1][0] ? b[1][0]['class'] : '';
                if (aClass !== bClass) {
                    return aClass.localeCompare(bClass);
                }
                return a[0].localeCompare(b[0]);
            });
        }

        // Generate HTML content
        let html = '<div style="font-family: Arial, sans-serif; padding: 20px;">';
        html += '<h2 style="text-align: center; margin-bottom: 20px;">Subject-wise Student List</h2>';

        if (session) html += `<p><strong>Session:</strong> ${session}</p>`;
        if (cls) html += `<p><strong>Class:</strong> ${cls}</p>`;
        if (type) html += `<p><strong>Type:</strong> ${type}</p>`;

        let totalStudents = 0;
        sortedSubjects.forEach(([subject, students]) => {
            // Sort students within each subject
            if (order === 'name_subject') {
                students.sort((a, b) => a.name.localeCompare(b.name));
            } else if (order === 'form_subject') {
                students.sort((a, b) => String(a.formNo).localeCompare(String(b.formNo)));
            } else if (order === 'class_subject') {
                students.sort((a, b) => {
                    if (a['class'] !== b['class']) {
                        return a['class'].localeCompare(b['class']);
                    }
                    return a.name.localeCompare(b.name);
                });
            }

            html += `<div style="margin-bottom: 30px; page-break-inside: avoid;">`;
            html += `<h3 style="color: #1f2937; border-bottom: 2px solid #e5e7eb; padding-bottom: 5px;">${subject} (${students.length} students)</h3>`;
            html += `<table style="width: 100%; border-collapse: collapse; margin-top: 10px;">`;
            html += `<thead><tr style="background-color: #f3f4f6;">`;
            html += `<th style="border: 1px solid #d1d5db; padding: 8px; text-align: left;">S.No.</th>`;
            html += `<th style="border: 1px solid #d1d5db; padding: 8px; text-align: left;">Form No.</th>`;
            html += `<th style="border: 1px solid #d1d5db; padding: 8px; text-align: left;">Name</th>`;
            html += `<th style="border: 1px solid #d1d5db; padding: 8px; text-align: left;">Class</th>`;
            html += `<th style="border: 1px solid #d1d5db; padding: 8px; text-align: left;">Roll No.</th>`;
            html += `</tr></thead><tbody>`;

            students.forEach((student, index) => {
                html += `<tr>`;
                html += `<td style="border: 1px solid #d1d5db; padding: 6px; text-align: center;">${index + 1}</td>`;
                html += `<td style="border: 1px solid #d1d5db; padding: 6px;">${student.formNo}</td>`;
                html += `<td style="border: 1px solid #d1d5db; padding: 6px;">${student.name}</td>`;
                html += `<td style="border: 1px solid #d1d5db; padding: 6px; text-align: center;">${student['class']}</td>`;
                html += `<td style="border: 1px solid #d1d5db; padding: 6px; text-align: center;">${student.rollNo}</td>`;
                html += `</tr>`;
            });

            html += `</tbody></table></div>`;
            totalStudents += students.length;
        });

        html += `<div style="margin-top: 20px; text-align: center; font-weight: bold;">Total Students: ${totalStudents}</div>`;
        html += '</div>';

        // Create and display the content in a new window for printing
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Subject-wise Student List</title>
          <style>
            @media print {
              body { margin: 0.5in; }
              div[style*="page-break-inside: avoid"] { page-break-inside: avoid; }
            }
          </style>
        </head>
        <body>${html}</body>
        </html>
      `);
        printWindow.document.close();
        printWindow.print();

        showAlert('admin-alert', `Subject-wise list generated for ${sortedSubjects.length} subjects with ${totalStudents} total students`, 'success');
    }

    function generatePrintReport(opts) {
        const session = opts?.session || '';
        const cls = opts?.cls || '';
        const type = opts?.type || '';
        const statusFilter = opts?.status || '';
        let cols = Array.isArray(opts?.columns) ? opts.columns : [];
        if (!cols.length) cols = ['sno', 'form', 'name', 'account_mobile', 'mobile', 'parent_mobile', 'status'];
        let apps = state.adminData.applications || [];
        if (session) apps = apps.filter(a => (a['Session'] || '') === session);
        if (cls) apps = apps.filter(a => (a['Admission sought for class'] || '') === cls);
        if (type) {
            apps = apps.filter(a => {
                const classVal = a['Admission sought for class'] || '';
                let t = '';
                if (classVal === '11th') t = a['Admission Type (Class 11th)'] || '';
                else if (classVal === '12th') t = a['Admission Type (Class 12th)'] || '';
                return String(t || '').trim() === type;
            });
        }
        if (opts?.status) {
            const statusFilter = opts.status;
            if (statusFilter === 'Rejected') {
                apps = apps.filter(a => !!(a.rejectionReason));
            } else if (statusFilter === 'AssignedRollNos') {
                apps = apps.filter(a => !!(a['Class Roll No']));
            } else {
                apps = apps.filter(a => (a['Status'] || '') === statusFilter && !a.rejectionReason);
            }
        }
        const order = opts?.order || (state.adminData?.settings?.print_sort_by || 'submitted_desc');
        if (order === 'submitted_desc') {
            apps.sort((a, b) => new Date(b.Timestamp || 0) - new Date(a.Timestamp || 0));
        } else if (order === 'submitted_asc') {
            apps.sort((a, b) => new Date(a.Timestamp || 0) - new Date(b.Timestamp || 0));
        } else if (order === 'form_asc') {
            apps.sort((a, b) => String(a['Form Number'] || '').localeCompare(String(b['Form Number'] || '')));
        } else if (order === 'class_form') {
            apps.sort((a, b) => String(a['Admission sought for class'] || '').localeCompare(String(b['Admission sought for class'] || '')) || String(a['Form Number'] || '').localeCompare(String(b['Form Number'] || '')));
        } else if (order === 'class_roll') {
            apps.sort((a, b) => {
                const classA = String(a['Admission sought for class'] || '');
                const classB = String(b['Admission sought for class'] || '');
                if (classA !== classB) {
                    return classA.localeCompare(classB);
                }
                // Sort by roll number within same class
                const rollA = String(a['Class Roll No'] || '999999');
                const rollB = String(b['Class Roll No'] || '999999');
                const rollNumA = parseInt(rollA) || 999999;
                const rollNumB = parseInt(rollB) || 999999;
                return rollNumA - rollNumB;
            });
        } else if (order === 'roll_class') {
            apps.sort((a, b) => {
                // Sort by roll number first
                const rollA = String(a['Class Roll No'] || '999999');
                const rollB = String(b['Class Roll No'] || '999999');
                const rollNumA = parseInt(rollA) || 999999;
                const rollNumB = parseInt(rollB) || 999999;
                if (rollNumA !== rollNumB) {
                    return rollNumA - rollNumB;
                }
                // Then by class
                return String(a['Admission sought for class'] || '').localeCompare(String(b['Admission sought for class'] || ''));
            });
        }
        const labels = {
            sno: 'S.No.',
            form: 'Form No.',
            name: 'Name',
            parentage: 'Parentage',
            email: 'Email',
            profile_mobile: 'Profile M',
            account_mobile: 'Account Mobile',
            mobile: 'Mobile',
            parent_mobile: 'Parent Mobile',
            residence: 'Residence',
            class: 'Class',
            adm_type: 'Adm Type',
            class_roll_no: 'Class Roll No',
            status: 'Form Status',
            submitted: 'Submitted On',
            actions: 'Actions'
        };
        let printWin = null;
        try { printWin = window.open('', '_blank'); } catch (e) { }
        const style = `
        body { font-family: Arial, sans-serif; color: #111827; padding: 16px; }
        h3 { margin: 0 0 6px 0; }
        .meta { color: #6b7280; margin-bottom: 12px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #e5e7eb; padding: 6px 8px; font-size: 12px; }
        th { background: #f3f4f6; text-align: left; }
        .no-wrap { white-space: nowrap; }
        @media print { body { padding: 0; } }
      `;
        let thead = '<tr>' + cols.map(k => `<th>${labels[k] || k}</th>`).join('') + '</tr>';
        let rows = apps.map((app, i) => {
            const emailLower = String(app['Email Address'] || '').toLowerCase();
            const profile = (state.adminData.userProfiles || {})[emailLower] || {};
            const accountMobile = app['Account Mobile'] || profile.accountMobile || '';
            const profileMobile = profile.accountMobile || '';
            const mobile = app['Mobile No. (with working WhatsApp)'] || '';
            const parentMobile = app["Parent's Mobile No. (must be working)"] || '';
            const residence = toProperCase(app['Residence'] || app['Name of your village'] || profile.residence || '');
            const nameDisplay = toProperCase(app["Student's Name (as per school records)"] || app['Account Name'] || profile.name || '');
            const parentage = toProperCase(app["Father's/Guardian's Name (as per school records)"] || '');
            const status = app['Status'] || 'Draft';
            const statusText = status === 'Submitted' ? 'Submitted' : (app.rejectionReason ? 'Rejected' : status);
            const submitted = formatCompactDate(app['Timestamp']);
            const classVal = app['Admission sought for class'] || '';
            let admType = '';
            if (classVal === '11th') admType = app['Admission Type (Class 11th)'] || '';
            else if (classVal === '12th') admType = app['Admission Type (Class 12th)'] || '';
            admType = String(admType || '').trim();
            const admTypeDisplay = admType === 'Provisional' ? 'Provisional' : (admType ? 'Full' : '');
            const mapVal = (k) => {
                if (k === 'sno') return String(i + 1);
                if (k === 'form') return String(app['Form Number'] || '');
                if (k === 'name') return String(nameDisplay || '');
                if (k === 'parentage') return String(parentage || '');
                if (k === 'email') return String(app['Email Address'] || '');
                if (k === 'profile_mobile') return String(profileMobile || '');
                if (k === 'account_mobile') return String(accountMobile || '');
                if (k === 'mobile') return String(mobile || '');
                if (k === 'parent_mobile') return String(parentMobile || '');
                if (k === 'residence') return String(residence || '');
                if (k === 'class') return String(app['Admission sought for class'] || '');
                if (k === 'adm_type') return String(admTypeDisplay || '');
                if (k === 'class_roll_no') return String(app['Class Roll No'] || '');
                if (k === 'status') return String(statusText || '');
                if (k === 'submitted') return String(submitted || '');
                if (k === 'actions') return '';
                return '';
            };
            return '<tr>' + cols.map(k => `<td>${mapVal(k)}</td>`).join('') + '</tr>';
        }).join('');
        if (!rows) rows = '<tr><td colspan="' + cols.length + '" style="text-align:center; padding:8px;">No records</td></tr>';
        const header = `<h3>Admissions Report</h3><div class="meta">Session: ${session || 'All'} ? Class: ${cls || 'All'} ? Generated: ${new Date().toLocaleString('en-IN')}</div>`;
        const html = `
        <html>
          <head>
            <title>Admissions Report</title>
            <meta charset="utf-8">
            <style>${style}</style>
          </head>
          <body>
            ${header}
            <table><thead>${thead}</thead><tbody>${rows}</tbody></table>
          </body>
        </html>
      `;
        // Using array join to avoid issues with 'data:' string literal/identifier parsing
        const dataPrefix = ['data', ':', 'text/html;charset=utf-8,'].join('');
        const fallbackUrl = dataPrefix + encodeURIComponent(html);
        try {
            if (!printWin) { window.open(fallbackUrl, '_blank'); return; }
            printWin.document.open();
            printWin.document.write(html);
            printWin.document.close();
            setTimeout(() => { try { printWin.focus(); printWin.print(); } catch (e) { } }, 300);
        } catch (e) {
            try { printWin.location = fallbackUrl; } catch (_) { window.open(fallbackUrl, '_blank'); }
        }
    }
    async function handleAdminReject(e) {
        const formNumber = e.target.closest('tr').dataset.formNumber;
        const appData = state.adminData.applications.find(app => String(app['Form Number']) === formNumber);
        const name = appData ? (appData["Student's Name (as per school records)"] || 'Unknown') : 'Unknown';
        const cls = appData ? (appData['Admission sought for class'] || 'N/A') : 'N/A';
        try { await showConfirm(`Reject Application #${formNumber}<br><small>${name} -- ${cls}</small>`); } catch (err) { return; }
        const presets = [
            'Please upload a clear, Passport-size photo in school uniform.',
            'Review all entered details carefully and correct any mistakes.',
            'Ensure contact numbers are working and email is accurate.',
            'Recheck subject selection and stream per guidelines before resubmitting.',
            'Fill all required fields and then submit the form again.'
        ];
        const reason = await showInputModal(
            `Reject Application #${formNumber} -- ${name} (${cls})`,
            'Enter rejection reason:',
            'Reason',
            'Please upload a clear, Passport-size photo in school uniform and review all details, then resubmit.',
            'textarea',
            presets
        );
        setLoadingMessage('Rejecting application...');
        setLoading(true);
        runServerFunction('rejectApplication', formNumber, reason, state.currentUser)
            .then(async (response) => {
                if (response?.success) {
                    showAlert('admin-alert', response.message, 'success');
                    const fresh = await runServerFunction('getInitialDataForUser', state.currentUser);
                    state.adminData.applications = fresh.applications || [];
                    state.adminData.filteredApplications = [...(fresh.applications || [])];
                    renderAdminDashboard();
                } else throw new Error(response?.message || 'Reject failed');
            })
            .catch(handleError)
            .finally(() => setLoading(false));
    }
    // [NEW] Test Submission Handlers
    async function handleTestSubmission(scenario) {
        try {
            const msgMap = {
                'all': 'Generate demo applications for Class 9th, 10th, 11th (Full/Provisional), and 12th (Full/Provisional)?',
                '9th': 'Generate a demo application for Class 9th?',
                '10th': 'Generate a demo application for Class 10th?',
                '11th-full': 'Generate a demo application for Class 11th -- Full Admission?',
                '11th-provisional': 'Generate a demo application for Class 11th -- Provisional?',
                '12th-full': 'Generate a demo application for Class 12th -- Full Admission?',
                '12th-provisional': 'Generate a demo application for Class 12th -- Provisional?'
            };
            await showConfirm(msgMap[scenario] || 'Generate demo applications for the selected scenario?');
        } catch (err) { return; }

        setLoadingMessage('Creating demo applications...');
        setLoading(true);
        const resultsDisplay = document.getElementById('testResultsDisplay');
        const resultsContent = document.getElementById('testResultsContent');

        runServerFunction('createDemoTestApplications', scenario, state.currentUser)
            .then(results => {
                // Display results
                let html = `<div style="color: var(--success); margin-bottom: 0.5rem;"><strong>[OK] ${results.success.length} applications created</strong></div>`;

                if (results.success.length > 0) {
                    html += '<div style="margin-bottom: 0.75rem; padding: 0.5rem; background: var(--success-light); border-radius: 4px;"><strong>Successful:</strong><ul style="margin: 0.5rem 0 0 0; padding-left: 1.25rem;">';
                    results.success.forEach(app => {
                        html += `<li style="font-size: 0.8rem; margin: 0.25rem 0;">#${app.formNumber} - ${app['class']} (${app.admissionType}${app.stream ? ', ' + app.stream : ''})</li>`;
                    });
                    html += '</ul></div>';
                }

                if (results.failed.length > 0) {
                    html += '<div style="padding: 0.5rem; background: var(--danger-light); border-radius: 4px;"><strong style="color: var(--danger);">Failed:</strong><ul style="margin: 0.5rem 0 0 0; padding-left: 1.25rem;">';
                    results.failed.forEach(fail => {
                        html += `<li style="font-size: 0.8rem; color: var(--danger); margin: 0.25rem 0;">${fail['class'] || 'Unknown'}: ${fail.error || fail.message}</li>`;
                    });
                    html += '</ul></div>';
                }

                resultsContent.innerHTML = html;
                resultsDisplay.style.display = 'block';

                showAlert('admin-alert', `Test submission completed: ${results.success.length} created`, results.failed.length === 0 ? 'success' : 'warning');
            })
            .catch(err => {
                resultsContent.innerHTML = `<div style="color: var(--danger);">Error: ${err.message}</div>`;
                resultsDisplay.style.display = 'block';
                handleError(err);
            })
            .finally(() => setLoading(false));
    }
    async function handleClearDemoData() {
        try {
            await showConfirm('Clear all demo test log entries? This cannot be undone.');
        } catch (err) { return; }

        setLoadingMessage('Clearing demo data...');
        setLoading(true);
        runServerFunction('clearDemoTestApplications')
            .then(result => {
                showAlert('admin-alert', result.message, result.success ? 'success' : 'danger');
                document.getElementById('testResultsDisplay').style.display = 'none';
            })
            .catch(handleError)
            .finally(() => setLoading(false));
    }
    // Utility
    function toDirectDownloadUrl(url) {
        try {
            const u = String(url || '').trim();
            if (!u) return u;
            if (!/drive\.google\.com/i.test(u)) return u;

            let fileId = '';
            const m1 = u.match(/\/d\/([a-zA-Z0-9_-]+)/);
            if (m1 && m1[1]) fileId = m1[1];

            if (!fileId) {
                const m2 = u.match(/[?&]id=([a-zA-Z0-9_-]+)/);
                if (m2 && m2[1]) fileId = m2[1];
            }

            if (!fileId) return u;
            // confirm=t bypasses the Google Drive virus-scan interstitial page
            return `https://drive.google.com/uc?export=download&confirm=t&id=${fileId}`;
        } catch (e) {
            return url;
        }
    }

    function downloadFile(url, filename) {
        if (!url) return;

        const directUrl = toDirectDownloadUrl(url);

        // Detect context
        const inIframe = (window.self !== window.top);
        const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (window.innerWidth && window.innerWidth <= 720);
        const isDriveUrl = /drive\.google\.com/i.test(directUrl) || /docs\.google\.com/i.test(directUrl);

        if (isDriveUrl) {
            // Strategy 1: Navigate the top-level window directly to the download URL.
            // Inside GAS iframes, anchor clicks with target=_top are unreliable;
            // window.top.location.href is the most reliable approach.
            if (inIframe) {
                try {
                    window.top.location.href = directUrl;
                    return;
                } catch (e) {
                    // Cross-origin restriction - fall through
                    console.warn('top.location blocked (cross-origin), trying window.open', e);
                }
            }

            // Strategy 2: Open in a new tab/window (works on mobile and when top.location is blocked)
            try {
                const w = window.open(directUrl, '_blank');
                if (w) {
                    // Success - show a small note
                    showPopup('<strong>Download Started</strong><br>Your file is opening in a new tab.', { autoClose: 4000 });
                    return;
                }
            } catch (e) {
                console.warn('window.open failed', e);
            }

            // Strategy 3: Hidden iframe download (desktop fallback)
            if (!isMobile) {
                let iframe = document.getElementById('_hidden_download_frame');
                if (!iframe) {
                    iframe = document.createElement('iframe');
                    iframe.id = '_hidden_download_frame';
                    iframe.style.cssText = 'display:none; width:0; height:0; border:0; position:absolute; left:-9999px;';
                    document.body.appendChild(iframe);
                }
                iframe.src = directUrl;
            }

            // Always show a manual fallback button
            showPopup('<strong>Download</strong><br>If the download did not start automatically, tap the button below.', {
                autoClose: false,
                buttons: [{ text: 'Open / Download File', onClick: function () { window.open(directUrl, '_blank'); } }]
            });
            return;
        }

        // For non-Drive URLs, use the standard <a download> trick
        try {
            const a = document.createElement('a');
            a.href = directUrl;
            if (filename) a.download = filename;
            a.rel = 'noopener';
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            a.remove();
        } catch (e) {
            try { window.open(directUrl, '_blank'); } catch (err) { console.error('Download failed', err); }
        }
    }
    // [ENHANCED] Save application - Uses form_structure required for highlight
    function handleSaveApplication(status) {
        if (status === 'Draft') {
            // Check if in unlocked edit mode and draft count limit reached
            const currentApp = state.applications.find(a => state.isEditing && a['Form Number'] === state.editingFormData?.['Form Number']);
            if (currentApp && currentApp.isUnlockedEditMode) {
                const draftCount = currentApp.draftCount || 0;
                if (draftCount >= 15) {
                    showPopup('<strong>Draft Limit Reached!</strong><br>You have reached the maximum of 15 draft saves for this unlock window.<br>Please lock the form or wait for admin to extend the unlock period.', { autoClose: false });
                    return;
                }
            }
            // Draft saves never validate - just save whatever is filled
            performSave(status);
            return;
        }

        // For Final Submission, validate everything
        // Reset subject error before running validations
        state.subjectError = false;
        // Re-run all subject validations
        let hadSubjectSections = false;
        document.querySelectorAll('.subjects-section').forEach(section => {
            const firstCheckbox = section.querySelector('input[type="checkbox"]');
            if (firstCheckbox) {
                hadSubjectSections = true;
                validateSubjects(firstCheckbox);
            }
        });
        if (!hadSubjectSections) {
            // No subjects present for this class -> do not block on subject errors
            state.subjectError = false;
        }
        // Do not early-return on subject errors; include them with required fields

        // Validate all required fields using form_structure
        const validationResult = validateFormSubmission();
        const missingFields = validationResult.missing;
        const autoClearedFields = validationResult.autoCleared;

        if (missingFields.length > 0) {
            highlightMissingFields(missingFields);
            const subjectNote = state.subjectError ? '<br><br>Also correct the invalid subject selection (marked in red).' : '';
            // [NEW] Mention auto-cleared fields if any
            const clearedNote = autoClearedFields.length > 0 ? '<br><br><strong>Note:</strong> Some optional fields had incorrect formats and were cleared: ' + autoClearedFields.join(', ') : '';

            showPopup('<strong>Cannot submit yet!</strong><br>Please fill all required fields:<br><br>' + missingFields.map(function (f) { return '* ' + escapeHtmlStr(f); }).join('<br>') + subjectNote + clearedNote, { autoClose: false });

            // Scroll to the first error
            const firstErrorName = missingFields[0].replace(/ \(.*?\)/, '');
            const firstError = document.querySelector('[name="' + firstErrorName + '"]') || document.querySelector('[data-field-name="' + firstErrorName + '"]');
            if (firstError) {
                const closestFieldset = firstError.closest('fieldset');
                if (closestFieldset) closestFieldset.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
            return;
        }

        // All validation passed - confirm submission
        let confirmMessage = '[OK] All required fields are filled! Submit now? A PDF will be generated and emailed to you. The form will be locked after submission.';

        // [NEW] Inform about auto-cleared fields in the confirmation dialog
        if (autoClearedFields.length > 0) {
            confirmMessage = '<div style="color:var(--info); background:var(--info-light); padding:10px; border-radius:8px; margin-bottom:12px; border-left:4px solid var(--info);">' +
                '<strong>Note:</strong> Optional fields (<b>' + autoClearedFields.join(', ') + '</b>) were cleared because they contained incorrect data.</div>' +
                confirmMessage;
        }

        showConfirm(confirmMessage)
            .then(function () {
                showPopup('Please, wait... we are processing your application!', { autoClose: false });
                performSave(status);
            })
            .catch(function () { console.log('Submission cancelled'); });
    }
    // [MODIFIED] Validation for submission - Uses config.required
    function validateFormSubmission() {
        const missing = [];
        const autoCleared = [];
        const currentClass = document.querySelector('[name="Admission sought for class"]').value;
        if (!currentClass) {
            missing.push('Admission sought for class');
            return missing;
        }
        // Required/optional overrides based on your latest rules
        const optionalFields = [
            'House No.',
            'Block',
            'Remarks/Feedback (if any)'
        ];
        const alwaysRequiredFields = [
            "Student's Name (as per school records)",
            'DoB (as per school records)',
            'Gender',
            "Father's/Guardian's Name (as per school records)",
            "Mother's Name (as per school records)",
            "Father's/Guardian's Occupation",
            'Mobile No. (with working WhatsApp)',
            "Parent's Mobile No. (must be working)",
            'Aadhar No.',
            'Name of your village',
            'Tehsil',
            'District',
            'State/UT',
            'PIN code',
            'E-mail ID',
            'Height (cm)',
            'Weight (kg)',
            'Blood Group',
            'Your Mother Tongue',
            'Religion',
            'Social category',
            'Socio-economic category',
            'Whether Any Disability',
            'Bank Account No.',
            'Name of Bank',
            'IFSC code',
            'Student Photo'
        ];
        state.formStructure.forEach(config => {
            // Check if field is relevant for this class
            const allowedClasses = config.classes.split(',').map(c => c.trim());
            if (allowedClasses.length > 0 && !allowedClasses.includes(currentClass)) {
                return; // Skip fields not in this class
            }
            let isRequired = config.required; // Use form_structure Is Required?
            // Enforce overrides
            if (alwaysRequiredFields.includes(config.fieldName)) {
                isRequired = true;
            }
            if (optionalFields.includes(config.fieldName)) {
                isRequired = false;
            }
            // Check for dynamic required status
            if (config.fieldName === 'Type of Disability') {
                isRequired = document.querySelector('[name="Whether Any Disability"]')?.value === 'Yes';
            } else if (config.fieldName === 'Type of scholarship received' || config.fieldName === 'Amount received (INR)') {
                isRequired = document.querySelector('[name="Whether scholarship received in previous academic year"]')?.value === 'Yes';
            } else if (config.fieldName === 'Percentage Obtained in Vocational Subject') {
                isRequired = document.querySelector('[name="Vocational subject in previous class"]')?.value === 'Yes';
            }
            // [MODIFIED] Check provisional/reappear logic
            if (config.fieldName === 'Reason for Provisional (Class 11th)') {
                isRequired = document.querySelector('[name="Admission Type (Class 11th)"]')?.value === 'Provisional';
            } else if (config.fieldName === 'Reason for Provisional (Class 12th)') {
                isRequired = document.querySelector('[name="Admission Type (Class 12th)"]')?.value === 'Provisional';
            } else if (config.fieldName === 'Subjects to Reappear (Class 10th)') {
                isRequired = document.querySelector('[name="Admission Type (Class 11th)"]')?.value === 'Provisional' && document.querySelector('[name="Reason for Provisional (Class 11th)"]')?.value === 'Reappear Candidate';
            } else if (config.fieldName === 'Subjects to Reappear (Class 11th)') {
                isRequired = document.querySelector('[name="Admission Type (Class 12th)"]')?.value === 'Provisional' && document.querySelector('[name="Reason for Provisional (Class 12th)"]')?.value === 'Reappear Candidate';
            } else if (config.fieldName.includes('Year of Passing')) {
                isRequired = (document.querySelector('[name="Admission Type (Class 11th)"]')?.value === 'Full' || document.querySelector('[name="Admission Type (Class 12th)"]')?.value === 'Full');
            } else if (config.fieldName.includes('Year of Appearing')) {
                isRequired = (document.querySelector('[name="Admission Type (Class 11th)"]')?.value === 'Provisional' || document.querySelector('[name="Admission Type (Class 12th)"]')?.value === 'Provisional');
            } else if (config.fieldName.includes('Total Marks Obtained') || config.fieldName.includes('Total Max. Marks')) {
                const name = config.fieldName;
                const is11or12Marks = (name.includes('Class 10th') || name.includes('Class 11th'));
                if (is11or12Marks) {
                    isRequired = (document.querySelector('[name="Admission Type (Class 11th)"]')?.value === 'Full' || document.querySelector('[name="Admission Type (Class 12th)"]')?.value === 'Full');
                } else {
                    // For Class 9th marks used in Class 10th admissions, keep required
                    isRequired = config.required;
                }
            }

            if (isRequired) {
                if (config.fieldType === 'checkbox_dynamic') {
                    const section = document.querySelector(`[data-field-name="${config.fieldName}"]`);
                    if (section) {
                        // Trigger validation before checking status
                        const firstCheck = section.querySelector('input[type="checkbox"]');
                        if (firstCheck) validateSubjects(firstCheck);

                        const validationEl = section.querySelector('.validation-msg');
                        if (validationEl && validationEl.classList.contains('error')) {
                            missing.push(config.fieldName + ' (Selection Incomplete)');
                        } else if (section.querySelectorAll('input:checked').length === 0) {
                            missing.push(config.fieldName);
                        }
                    }
                } else if (config.fieldType === 'image') {
                    if (!state.photoFileData && !state.oldPhotoUrl) {
                        missing.push('Student Photo');
                    }
                } else if (config.fieldName === 'Games to participate' || config.fieldName === 'Previous participation in sports (if any)') {
                    // Ensure at least one selection if required
                    const group = document.querySelector(`.games-section[data-field-name="${config.fieldName}"]`);
                    if (group) {
                        const checked = group.querySelectorAll('input[type="checkbox"]:checked').length;
                        if (checked === 0) missing.push(config.fieldName);
                    }
                } else if (config.fieldType === 'checkbox_declaration') {
                    const el = document.querySelector(`[name="${config.fieldName}"]`);
                    if (el && !el.checked) {
                        missing.push(config.fieldName);
                    }
                } else {
                    const el = document.querySelector(`[name="${config.fieldName}"]`);
                    if (!el || el.disabled) return; // Skip disabled fields
                    const grp = el.closest('.form-group');
                    const in5a = grp && grp.closest('#section-academic9th') && grp.style.display !== 'none' && currentClass === '9th';
                    const in5b = grp && grp.closest('#section-academic10th') && grp.style.display !== 'none' && currentClass === '10th';
                    const in5c = grp && grp.closest('#section-academic11th') && grp.style.display !== 'none' && currentClass === '11th';
                    const in5d = grp && grp.closest('#section-academic12th') && grp.style.display !== 'none' && currentClass === '12th';
                    const effectiveRequired = isRequired || in5a || in5b || in5c || in5d;
                    const val = (el.value || '').trim();
                    // [Modified] Check for real-time validation errors first
                    if (el.classList.contains('is-invalid')) {
                        const grp = el.closest('.form-group');
                        const hint = grp ? grp.querySelector('.field-hint.error') : null;
                        const errorMsg = hint ? hint.textContent : 'Invalid format';
                        // Avoid duplicates
                        if (!missing.some(m => m.startsWith(config.fieldName))) {
                            missing.push(`${config.fieldName} (${errorMsg.replace('[!] ', '')})`);
                        }
                    } else if (effectiveRequired && val === '') {
                        missing.push(config.fieldName);
                    } else {
                        // Additional per-field format checks (robust to case)
                        if (config.fieldName === 'IFSC code') {
                            const ifsc = val.toUpperCase();
                            const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/;
                            if (!IFSC_REGEX.test(ifsc)) {
                                missing.push('IFSC code');
                            }
                        } else if (config.fieldName === 'PEN number (given by UDISE portal)') {
                            const pen = val.replace(/\s+/g, '');
                            if (pen !== '' && !/^\d{11}$/.test(pen)) {
                                if (effectiveRequired) {
                                    missing.push('PEN number (must be 11 digits)');
                                } else {
                                    autoCleared.push('PEN number (given by UDISE portal)');
                                    if (el) el.value = '';
                                }
                            }
                        } else if (config.fieldName === 'APAAR ID') {
                            const a = val.replace(/\s+/g, '');
                            if (a !== '' && !/^\d{12}$/.test(a)) {
                                if (effectiveRequired) {
                                    missing.push('APAAR ID (must be 12 digits)');
                                } else {
                                    autoCleared.push('APAAR ID');
                                    if (el) el.value = '';
                                }
                            }
                        } else if ((config.fieldName === 'Board Registration No. (Class 10th)' || config.fieldName === 'Board Registration No. (Class 11th)')) {
                            const reg = val.replace(/\s+/g, '');
                            const REG_REGEX = /^(?:[A-Za-z]\d{11}|\d{16})$/;
                            if (!REG_REGEX.test(reg)) missing.push(config.fieldName);
                        } else if ((config.fieldName === 'Exam Roll Number of Class 10th' || config.fieldName === 'Exam Roll Number of Class 11th')) {
                            const roll = val.replace(/\s+/g, '');
                            if (!/^\d{9}$/.test(roll)) missing.push(config.fieldName);
                        }
                        if ((config.fieldType === 'number' || config.fieldType === 'number_range') && config.options && val !== '') {
                            const parts = config.options.split('-');
                            if (parts.length === 2) {
                                const min = parseFloat(parts[0]);
                                let max = parseFloat(parts[1]);
                                // [NEW] Dynamic Max Year: If it's a year field, set max to current year dynamically
                                const currentYear = new Date().getFullYear();
                                if (config.fieldName.toLowerCase().includes('year') && max < currentYear) {
                                    max = currentYear;
                                }
                                const num = parseFloat(val);
                                if (!isNaN(num) && (num < min || num > max)) missing.push(config.fieldName);
                            }
                        }
                    }
                }

                // Open most recent ID Card folder when clicking the Open Folder button
                (function attachOpenIdCardFolderBtn(){
                    try {
                        const btn = document.getElementById('openIdCardFolderBtn');
                        if (!btn) return;
                        btn.addEventListener('click', async (e) => {
                            // Ensure list is loaded
                            await loadIdCardFolders();
                            const list = document.getElementById('idCardFoldersList');
                            const firstOpen = list ? list.querySelector('.btn-open-folder') : null;
                            if (firstOpen) {
                                firstOpen.click();
                            } else {
                                showToast('No ID Card folder available to open', 'info');
                            }
                        });
                    } catch (e) { console.warn('attachOpenIdCardFolderBtn failed', e); }
                })();
            }
        });
        // Cross-field marks sanity checks: obtained <= max for classes 8?12
        const markPairs = [
            ['Total Marks Obtained in Class 8th', 'Total Max. Marks in Class 8th'],
            ['Total Marks Obtained in Class 9th', 'Total Max. Marks in Class 9th'],
            ['Total Marks Obtained in Class 10th', 'Total Max. Marks in Class 10th'],
            ['Total Marks Obtained in Class 11th', 'Total Max. Marks in Class 11th'],
            ['Total Marks Obtained in Class 12th', 'Total Max. Marks in Class 12th']
        ];
        markPairs.forEach(([obtName, maxName]) => {
            const obtEl = document.querySelector(`[name="${obtName}"]`);
            const maxEl = document.querySelector(`[name="${maxName}"]`);
            if (!obtEl || !maxEl) return;
            const obtVal = parseFloat((obtEl.value || '').trim());
            const maxVal = parseFloat((maxEl.value || '').trim());
            if (!isNaN(obtVal) && !Number.isInteger(obtVal)) {
                missing.push(`${obtName} (must be a whole number)`);
                const hintElObt = document.getElementById(`hint-${obtEl.id}`);
                if (hintElObt) { hintElObt.textContent = 'Marks must be a whole number.'; hintElObt.className = 'field-hint error'; }
                obtEl.classList.add('is-invalid');
            }
            if (!isNaN(maxVal) && !Number.isInteger(maxVal)) {
                missing.push(`${maxName} (must be a whole number)`);
                const hintElMax = document.getElementById(`hint-${maxEl.id}`);
                if (hintElMax) { hintElMax.textContent = 'Max marks must be a whole number.'; hintElMax.className = 'field-hint error'; }
                maxEl.classList.add('is-invalid');
            }
            if (!isNaN(obtVal) && !isNaN(maxVal) && obtVal > maxVal) {
                missing.push(`${obtName} (cannot exceed ${maxName})`);
                const hintElObt = document.getElementById(`hint-${obtEl.id}`);
                const hintElMax = document.getElementById(`hint-${maxEl.id}`);
                if (hintElObt) { hintElObt.textContent = 'Marks obtained cannot be greater than max marks.'; hintElObt.className = 'field-hint error'; }
                if (hintElMax) { hintElMax.textContent = 'Max marks cannot be less than marks obtained.'; hintElMax.className = 'field-hint error'; }
                obtEl.classList.add('is-invalid');
                maxEl.classList.add('is-invalid');
            }
        });
        // Additional format and cross-field checks
        const mobileEl = document.querySelector('[name="Mobile No. (with working WhatsApp)"]');
        const parentMobileEl = document.querySelector('[name="Parent\'s Mobile No. (must be working)"]');
        const aadhaarEl = document.querySelector('[name="Aadhar No."]');
        const emailEl = document.querySelector('[name="E-mail ID"]');
        const pinEl = document.querySelector('[name="PIN code"]');
        const isIndianMobile = (val) => /^[6-9]\d{9}$/.test(val || '');
        if (mobileEl && mobileEl.value) {
            if (!isIndianMobile(mobileEl.value)) missing.push('Mobile No. (with working WhatsApp)');
        }
        if (parentMobileEl && parentMobileEl.value) {
            if (!isIndianMobile(parentMobileEl.value)) missing.push("Parent's Mobile No. (must be working)");
        }
        if (mobileEl && parentMobileEl && mobileEl.value && parentMobileEl.value && mobileEl.value === parentMobileEl.value) {
            // Push both to highlight
            missing.push('Mobile No. (with working WhatsApp)');
            missing.push("Parent's Mobile No. (must be working)");
        }
        if (aadhaarEl && aadhaarEl.value && !/^\d{12}$/.test(aadhaarEl.value)) {
            missing.push('Aadhar No.');
        }
        if (emailEl && emailEl.value && typeof validateEmail === 'function' && !validateEmail(emailEl.value)) {
            missing.push('E-mail ID');
        }
        if (pinEl && pinEl.value && !/^\d{6}$/.test(pinEl.value)) {
            missing.push('PIN code');
        }
        // Always enforce Declaration and Photo presence at final submission
        try {
            const declCheckbox = document.querySelector('[name="Declaration"]');
            if (declCheckbox && !declCheckbox.checked) missing.push('Declaration');
        } catch (e) { /* ignore */ }
        try {
            const photoInputEl = document.querySelector('[name="Student Photo"]');
            const hasFile = !!(photoInputEl && photoInputEl.files && photoInputEl.files.length > 0);
            if (!hasFile && !state.photoFileData && !state.oldPhotoUrl) missing.push('Student Photo');
        } catch (e) { /* ignore */ }

        return {
            missing: [...new Set(missing)],
            autoCleared: [...new Set(autoCleared)]
        };
    }
    function highlightMissingFields(fields) {
        fields.forEach(field => {
            // [Modified] Extract real field name from "Name (Error Message)" format
            let fieldName = field;
            let errorSuffix = '';
            if (field.includes('(')) {
                // Careful not to split field names that inherently have parens like "(as per ...)"
                // Use our known error suffixes or just take the name part if it matches a known field
                const knownFields = state.formStructure.map(f => f.fieldName);
                const possibleName = knownFields.find(k => field.startsWith(k));
                if (possibleName) {
                    fieldName = possibleName;
                    errorSuffix = field.substring(fieldName.length).trim().replace(/^\(|\)$/g, '');
                } else {
                    // Fallback for custom fields or exact matches
                    fieldName = field.split(' (')[0];
                }
            }

            const el = document.querySelector(`[name="${fieldName}"]`) || document.querySelector(`[data-field-name="${fieldName}"]`);
            if (el) {
                el.classList.add('is-invalid');
                if (el.value === 'Other' && el.id) {
                    const otherEl = document.getElementById(`${el.id}-other`);
                    if (otherEl) otherEl.classList.add('is-invalid');
                }
                const group = el.closest('.form-group');
                if (group) {
                    const hintEl = group.querySelector('.field-hint[id^="hint-"]');
                    if (hintEl) {
                        hintEl.classList.add('error');
                        if (errorSuffix) {
                            hintEl.textContent = errorSuffix;
                        } else if (fieldName === 'IFSC code') {
                            hintEl.textContent = 'Enter a valid IFSC (e.g., JAKA0SANGUS).';
                        } else if (fieldName === 'Declaration') {
                            hintEl.textContent = 'You must agree to this declaration to submit the form';
                        } else {
                            hintEl.textContent = 'This field is required.';
                        }
                    }
                }
                // Special case for subjects
                if (el.classList.contains('subjects-section')) {
                    const validationEl = el.querySelector('.validation-msg');
                    if (validationEl && !validationEl.classList.contains('error')) {
                        validationEl.className = 'validation-msg error';
                        validationEl.innerHTML = 'Subject selection is incomplete or invalid.';
                    }
                }
            }
        });
    }
    // Collect form data helper
    function collectFormData() {
        const formData = {};
        const allFields = state.formStructure.map(f => f.fieldName);
        const currentClassEl = document.querySelector('[name="Admission sought for class"]');
        const currentClass = currentClassEl ? currentClassEl.value : '';
        allFields.forEach(field => {
            const fieldConfig = state.formStructure.find(f => f.fieldName === field);
            if (!fieldConfig) return;
            // For students, do not collect values for fields not belonging to the selected class
            if (state.currentUser?.role !== 'Admin') {
                const allowedClasses = (fieldConfig.classes || '').split(',').map(c => c.trim()).filter(Boolean);
                if (allowedClasses.length > 0 && currentClass && !allowedClasses.includes(currentClass)) {
                    formData[field] = '';
                    return;
                }
                // Also skip hidden groups
                const group = document.querySelector(`[name="${field}"]`)?.closest('.form-group')
                    || document.querySelector(`[data-field-name="${field}"]`);
                if (group && group.closest('fieldset') && group.closest('fieldset').style.display === 'none') {
                    formData[field] = '';
                    return;
                }
            }
            if (fieldConfig.fieldType === 'checkbox_dynamic') {
                const section = document.querySelector(`[data-field-name="${field}"]`);
                if (section) {
                    const checkedBoxes = section.querySelectorAll('input[type="checkbox"]:checked');
                    formData[field] = Array.from(checkedBoxes).map(cb => cb.value).join(', ');
                } else {
                    formData[field] = '';
                }
                return;
            }
            if (fieldConfig.fieldType === 'checkbox_declaration') {
                const el = document.querySelector(`[name="${field}"]`);
                formData[field] = el ? el.checked : 'FALSE';
                return;
            }
            // Composite DoB collection
            if (field === 'DoB (as per school records)') {
                const hidden = document.querySelector(`[name="${field}"]`);
                formData[field] = hidden ? hidden.value : '';
                return;
            }
            const element = document.querySelector(`[name="${field}"]:not([type="file"])`);
            if (!element) return;
            if (fieldConfig.fieldType === 'list') {
                const sel = element;
                if (sel.value === 'Other') {
                    const otherEl = document.getElementById(`${sel.id}-other`);
                    formData[field] = (otherEl && otherEl.value.trim()) ? otherEl.value.trim() : 'Other';
                } else {
                    formData[field] = sel.value;
                }
            } else {
                formData[field] = element.value;
            }
        });
        return formData;
    }
    // [NEW] Back-button confirmation on phones
    function setupBackButtonConfirm() {
        try {
            history.pushState({ page: 'admission' }, '', document.location.href);
            window.addEventListener('popstate', function onPop(e) {
                showConfirm('Do you want to go back? Unsaved changes may be lost.')
                    .then(() => {
                        window.removeEventListener('popstate', onPop);
                        history.back();
                    })
                    .catch(() => {
                        history.pushState({ page: 'admission' }, '', document.location.href);
                    });
            });
        } catch (err) { /* no-op */ }
    }
    function performSave(status) {
        if (state.isProcessingSave) {
            console.warn('Blocked concurrent save attempt');
            return;
        }
        const btn = status === 'Draft' ? dom.saveDraftBtn : dom.finalSubmitBtn;
        setBtnLoading(btn, true, status === 'Draft' ? 'Saving...' : 'Submitting...');
        state.isProcessingSave = true;

        const formData = collectFormData();
        // Ensure form number and other sensitive meta-fields are included if editing
        if (state.isEditing && state.editingFormData?.['Form Number']) {
            formData['Form Number'] = state.editingFormData['Form Number'];
            // Explicitly preserve Class Roll No if it already existed
            if (state.editingFormData['Class Roll No']) {
                formData['Class Roll No'] = state.editingFormData['Class Roll No'];
            }
        }
        // Ensure Status is correct (for edit mode)
        if (state.applications.find(a => a['Form Number'] === formData['Form Number'])?.isUnlockedEditMode && status === 'Draft') {
            formData['Status'] = 'Submitted'; // It's a draft *of* a submitted app
        }
        const payload = {
            formData,
            fileData: state.photoFileData,
            oldPhotoUrl: state.oldPhotoUrl,
            deletePhoto: state.deletePhoto,
            user: state.currentUser,
            status: status,
            isUpgradeFlow: !!state.editingFormData?.isUpgradeFlow
        };
        runServerFunction('saveApplicationData', payload)
            .then(response => {
                if (response?.success) {
                    // Clear localStorage auto-save after successful save
                    clearLocalStorageAutosave();
                    closePopups();

                    // [MODIFIED] Refresh all data to get the updated array
                    return runServerFunction('getInitialDataForUser', state.currentUser)
                        .then(data => {
                            handleInitialData(data); // This will re-render the dashboard
                            state.currentView = isAnyAdmin() ? 'adminDashboard' : 'studentDashboard';
                            state.isEditing = false;
                            state.editingFormData = null;
                            state.oldPhotoUrl = null;
                            state.photoFileData = null;
                            state.selectedClassForNewApp = null;

                            const alertType = response.message.includes('failed') ? 'warning' : 'success';
                            let message = response.message;
                            state.isProcessingSave = false;
                            if (status === 'Draft') {
                                const appData = state.applications.find(a => a['Form Number'] === formData['Form Number']);
                                if (appData && appData.isUnlockedEditMode) {
                                    const draftNum = appData.draftCount || 0;
                                    const remaining = Math.max(0, 15 - draftNum);
                                    message = `[OK] Draft saved! ${remaining} draft${remaining === 1 ? '' : 's'} remaining in this unlock window.`;
                                } else {
                                    message = '[OK] Draft saved successfully! You can continue editing anytime.';
                                }
                            } else if (status === 'Submitted') {
                                message = '[OK] Application submitted successfully! A PDF has been generated and will be emailed to you shortly. Your form is now locked.';
                            }

                            showAlert(state.currentView === 'adminDashboard' ? 'admin-alert' : 'student-dashboard-alert', message, alertType);
                        });
                }
                throw new Error(response?.message || 'Save failed');
            })
            .catch(err => {
                handleError(err);
                showAlert('form-alert', err.message, 'danger');
                closePopups();
            })
            .finally(() => {
                setBtnLoading(dom.saveDraftBtn, false, 'Save Draft');
                setBtnLoading(dom.finalSubmitBtn, false, 'Final Submit');
                state.isProcessingSave = false;
            });
    }
    document.addEventListener('DOMContentLoaded', init);
    // [NEW] Global MAX_DRAFTS_IN_EDIT_MODE
    const MAX_DRAFTS_IN_EDIT_MODE = 15;

    // [NEW] Helper to check if upgrade is allowed
    function canUpgradeToFull(app) {
        if (!app) return false;
        const admType11 = app['Admission Type (Class 11th)'];
        const admType12 = app['Admission Type (Class 12th)'];
        const reason11 = app['Reason for Provisional (Class 11th)'];
        const reason12 = app['Reason for Provisional (Class 12th)'];
        const admType = admType11 || admType12;
        const reason = reason11 || reason12;
        const allowedReason = reason === 'Awaiting Result' || reason === 'Reappear Candidate';
        if (app['Status'] !== 'Submitted' || admType !== 'Provisional' || !allowedReason) return false;
        const normalizeSession = (s) => String(s || '').replace(/[?-]/g, '-').trim();
        const appSession = app['Session'] || (state.adminData?.settings?.session) || '2025-26';
        const emailLower = String(app['Email Address'] || '').toLowerCase();
        const hasFullInSession = (state.applications || []).some(a => {
            const sameEmail = String(a['Email Address'] || '').toLowerCase() === emailLower;
            const sameSession = normalizeSession(a['Session']) === normalizeSession(appSession);
            const adm = a['Admission Type (Class 11th)'] || a['Admission Type (Class 12th)'];
            return sameEmail && sameSession && a['Status'] === 'Submitted' && adm === 'Full';
        });
        return !hasFullInSession;
    }

    async function ensureAdminActivityLoaded() {
        if (Array.isArray(state.adminActivity) && state.adminActivity.length) return;
        try {
            const data = await runServerFunction('getAdminActivityLog', state.currentUser);
            state.adminActivity = data?.logs || [];
        } catch (e) { }
    }
    function buildEventEntryHtml(type, text, timeIso) {
        const color = type === 'rejected' ? '#b91c1c' : type === 'unlocked' ? '#b45309' : type === 'resubmitted' ? '#059669' : type === 'edited' ? '#0ea5e9' : '#374151';
        const time = timeIso ? formatCompactDate(timeIso) : '';
        return `<p style="margin:0.25rem 0; color:${color}"><strong>${text}</strong>${time ? ` -- <span style="color:#6b7280">${time}</span>` : ''}</p>`;
    }
    async function openEventDetailsPopup(formNumber) {
        await ensureAdminActivityLoaded();
        const app = (state.adminData.applications || []).find(a => String(a['Form Number']) === String(formNumber)) || {};
        const items = [];
        const addItem = (type, text, timeIso, meta) => {
            const d = new Date(timeIso);
            const normTime = isNaN(d.getTime()) ? String(timeIso) : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
            const normText = String(text)
                .replace(/\(\s*email\s*sent\s*\)/ig, '')
                .replace(/\s+/g, ' ')
                .replace(/[\.;]+$/, '')
                .trim()
                .toLowerCase();
            const key = `${type}|${normText}|${normTime}`;
            const existing = items.find(i => i.key === key);
            if (existing) { existing.emailSent = existing.emailSent || !!(meta && meta.emailSent); return; }
            items.push({ key, type, text: normText, rawText: String(text), timeIso, emailSent: !!(meta && meta.emailSent) });
        };
        if (app.rejectionReason && app.unlockStart) addItem('rejected', `Rejected: ${app.rejectionReason}`, app.unlockStart);
        if (app.isUnlockedEditMode && app.unlockExpiry) addItem('unlocked', `Unlocked until ${formatCompactDate(app.unlockExpiry)}`, app.unlockStart);
        if (app['Last Edited']) addItem('edited', 'Edited', app['Last Edited']);
        if (app.wasResubmitted) addItem('resubmitted', `Resubmitted${app.resubmittedReason ? `: ${app.resubmittedReason}` : ''}`, app['Timestamp']);
        try {
            const logs = (state.adminActivity || []).filter(r => String(r['FormNumber'] || '') === String(formNumber)).sort((a, b) => new Date(b['Timestamp']) - new Date(a['Timestamp']));
            logs.forEach(r => {
                const action = String(r['Action'] || '').toLowerCase();
                const ts = r['Timestamp'];
                const det = String(r['Details'] || '');
                if (action.includes('reject')) {
                    const reasonMatch = det.match(/-\s*(.*)/); // Fixed regex created by ASCII scrub
                    let reason = reasonMatch ? reasonMatch[1] : det;
                    reason = String(reason).replace(/\(\s*email\s*sent\s*\)/ig, '').trim();
                    addItem('rejected', `Rejected: ${reason}`, ts, { emailSent: !!r['EmailSent'] });
                } else if (action.includes('unlock')) {
                    const untilMatch = det.match(/until\s*(.*)$/i);
                    const untilText = untilMatch ? untilMatch[1] : '';
                    addItem('unlocked', `Unlocked ${untilText ? 'until ' + untilText : ''}`, ts);
                } else if (action.includes('lock')) {
                    addItem('edited', 'Locked', ts);
                } else if (action.includes('application submission')) {
                    addItem('edited', 'Submitted', ts, { emailSent: !!r['EmailSent'] });
                } else if (action.includes('application update')) {
                    addItem('edited', 'Updated', ts, { emailSent: !!r['EmailSent'] });
                } else if (action.includes('resubmission') || action.includes('resubmitted')) {
                    addItem('resubmitted', 'Resubmitted', ts);
                } else if (action.includes('draft saved')) {
                    addItem('edited', 'Draft saved', ts);
                } else if (action.includes('registration')) {
                    addItem('edited', 'Registered', ts);
                }
            });
        } catch (e) { }
        const content = items.length ? items.map(i => {
            let textOut = i.rawText || i.text;
            textOut = String(textOut).replace(/\(\s*email\s*sent\s*\)/ig, '').trim();
            if (i.emailSent && i.type === 'rejected' && !/\(\s*email\s*sent\s*\)/i.test(textOut)) {
                textOut += ' (Email Sent)';
            }
            return buildEventEntryHtml(i.type, textOut, i.timeIso);
        }).join('') : '<p style="margin:0; color:#6b7280">No recent events</p>';
        const html = `<div style="display:flex;flex-direction:column;gap:0.25rem;">${content}</div>`;
        showPopup(html, { autoClose: false, buttons: [{ text: 'Close', onClick: () => { } }] });
    }

    function loadAdminActivity(loadMore = false) {
        if (state.activityLoading) return;
        if (loadMore && !state.activityHasMore) return;

        if (!loadMore) {
            state.activityOffset = 0;
            state.activityHasMore = true;
            state.adminActivity = [];
            setLoading(true);
        }

        state.activityLoading = true;
        const options = {
            limit: state.activityLimit,
            offset: state.activityOffset
        };

        runServerFunction('getAdminActivityLog', state.currentUser, options)
            .then(data => {
                const logs = data?.logs || [];
                if (loadMore) {
                    state.adminActivity = [...state.adminActivity, ...logs];
                } else {
                    state.adminActivity = logs;
                }
                
                state.adminActivityFiltered = [...state.adminActivity];
                state.activityOffset += logs.length;
                
                if (logs.length < state.activityLimit) {
                    state.activityHasMore = false;
                }

                renderAdminActivity();
            })
            .catch(handleError)
            .finally(() => {
                state.activityLoading = false;
                if (!loadMore) setLoading(false);
                renderActivityLoadingStatus();
            });
    }

    function renderActivityLoadingStatus() {
        const container = document.querySelector('#adminActivity .table-container');
        if (!container) return;
        
        let status = document.getElementById('activityLoadingStatus');
        if (!status) {
            status = document.createElement('div');
            status.id = 'activityLoadingStatus';
            status.style.cssText = 'padding: 1.5rem; text-align: center; color: var(--text-secondary); font-size: 0.85rem; border-top: 1px solid var(--border); background: var(--bg-card);';
            container.appendChild(status);
        }

        if (state.activityLoading) {
            status.innerHTML = '<div style="display:flex; align-items:center; justify-content:center; gap:10px;"><span class="material-icons rotating" style="font-size:1.2rem; color:var(--primary);">sync</span><span>Fetching older activities...</span></div>';
            status.style.display = 'block';
        } else if (!state.activityHasMore) {
            status.innerHTML = '<div style="opacity:0.6; display:flex; align-items:center; justify-content:center; gap:8px;"><span class="material-icons" style="font-size:1.1rem;">check_circle</span><span>All activities loaded.</span></div>';
            status.style.display = state.adminActivity.length > 0 ? 'block' : 'none';
        } else {
            status.innerHTML = '<div style="opacity:0.5; font-style:italic;">Scroll down to load more history</div>';
            status.style.display = 'block';
        }
    }

    function initActivityScroll() {
        const container = document.querySelector('#adminActivity .table-container');
        if (!container || container.dataset.scrollBound) return;
        
        container.addEventListener('scroll', debounce(() => {
            if (state.activityLoading || !state.activityHasMore) return;
            
            const { scrollTop, scrollHeight, clientHeight } = container;
            if (scrollTop + clientHeight >= scrollHeight - 100) {
                loadAdminActivity(true);
            }
        }, 150));
        
        container.dataset.scrollBound = 'true';
    }

    function loadAdminOtps(silent = false) {
        if (!silent) setLoading(true);
        runServerFunction('getAdminOtpLogs', state.currentUser)
            .then(data => {
                state.adminOtps = data?.logs || [];
                renderAdminOtps();
            })
            .catch(handleError)
            .finally(() => { if (!silent) setLoading(false); });
    }

    function renderAdminOtps() {
        const rows = (state.adminOtps || []).slice().sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        if (dom.otpsTableBody) {
            dom.otpsTableBody.innerHTML = rows.map((r, idx) => `
                <tr>
                    <td>${idx + 1}</td>
                    <td class="no-wrap col-date">${formatCompactDate(r.timestamp)}</td>
                    <td>${r.email || '-'}</td>
                    <td>${r.mobile || '-'}</td>
                    <td>${r.name || '-'}</td>
                    <td style="font-weight:700; color:var(--primary); font-family:monospace; font-size:1.1rem;">${r.otp}</td>
                </tr>
            `).join('');
        }
    }
    function renderAdminActivity() {
        const rows = (state.adminActivityFiltered || []).slice().sort((a, b) => new Date(b['Timestamp']) - new Date(a['Timestamp']));
        if (dom.adminActivityBody) {
            dom.adminActivityBody.innerHTML = rows.map((r, idx) => `
          <tr>
            <td>${idx + 1}</td>
            <td class="no-wrap col-date" style="font-size:0.75rem;"><span class="material-icons" style="font-size:0.85rem; color:var(--text-secondary); margin-right:4px;">history</span>${formatCompactDate(r['Timestamp'])}</td>
            <td class="col-admin" title="${r['UserEmail'] || ''}">
                <div style="display:flex; align-items:center; gap:6px;">
                    <span class="material-icons" style="font-size:1rem; color:var(--primary);">account_circle</span>
                    <span style="max-width:140px; overflow:hidden; text-overflow:ellipsis; white-space:normal;">
                        ${r['UserEmail'] || ''}
                    </span>
                </div>
            </td>
            <td class="col-role">
                <span class="badge ${String(r['Role']).toLowerCase() === 'admin' ? 'badge-primary' : 'badge-secondary'}" style="font-size:0.65rem; padding:0.15rem 0.4rem;">
                    ${r['Role'] || '---'}
                </span>
            </td>
            <td class="col-action" style="font-weight:600; color:var(--text-primary);">
                <div style="display:flex; align-items:center; gap:4px;">
                    <span class="material-icons" style="font-size:0.9rem; color:var(--text-secondary);">touch_app</span>
                    ${r['Action'] || ''}
                </div>
            </td>
            <td class="col-form" style="font-family:monospace; color:var(--primary);">${r['FormNumber'] ? `<span class="material-icons" style="font-size:0.85rem; margin-right:2px;">tag</span>${r['FormNumber']}` : '<span style="opacity:0.3;">---</span>'}</td>
            <td class="col-name" style="font-weight:500;">${r['StudentName'] ? `<div style="display:flex; align-items:center; gap:4px;"><span class="material-icons" style="font-size:0.9rem; color:var(--text-secondary);">person</span>${r['StudentName']}</div>` : '<span style="opacity:0.3;">---</span>'}</td>
            <td class="col-class">${r['Class'] ? `<span class="material-icons" style="font-size:0.9rem; margin-right:2px; vertical-align:text-bottom;">school</span>${r['Class']}` : '<span style="opacity:0.3;">---</span>'}</td>
            <td class="col-studentm">${r['StudentMobile'] ? `<span class="material-icons" style="font-size:0.9rem; margin-right:2px; vertical-align:text-bottom;">phone</span>${r['StudentMobile']}` : '<span style="opacity:0.3;">---</span>'}</td>
            <td class="col-email">${r['StudentEmail'] ? `<span class="material-icons" style="font-size:0.9rem; margin-right:2px; vertical-align:text-bottom;">alternate_email</span>${r['StudentEmail']}` : '<span style="opacity:0.3;">---</span>'}</td>
            <td class="col-details" style="font-size:0.75rem; line-height:1.3;">${r['Details'] || ''}</td>
            <td class="col-sent" style="text-align:center;">
                ${r['EmailSent'] ? '<span class="material-icons" style="color:var(--success); font-size:1.2rem;">check_circle</span>' : '<span class="material-icons" style="color:var(--text-secondary); opacity:0.3; font-size:1.2rem;">cancel</span>'}
            </td>
          </tr>
        `).join('');
        }
        
        initActivityScroll();
        renderActivityLoadingStatus();

        try {
            dom.activitySearchInput?.addEventListener('input', debounce(() => {
                const q = (dom.activitySearchInput.value || '').toLowerCase();
                state.adminActivityFiltered = (state.adminActivity || []).filter(r =>
                    String(r['UserEmail'] || r['AdminEmail'] || '').toLowerCase().includes(q) ||
                    String(r['Role'] || '').toLowerCase().includes(q) ||
                    String(r['Action'] || '').toLowerCase().includes(q) ||
                    String(r['Details'] || '').toLowerCase().includes(q) ||
                    String(r['Timestamp'] || '').toLowerCase().includes(q) ||
                    String(r['FormNumber'] || '').toLowerCase().includes(q) ||
                    String(r['StudentName'] || '').toLowerCase().includes(q) ||
                    String(r['Class'] || '').toLowerCase().includes(q) ||
                    String(r['StudentMobile'] || '').toLowerCase().includes(q) ||
                    String(r['StudentEmail'] || '').toLowerCase().includes(q)
                );
                renderAdminActivity();
            }, 300));
        } catch (e) { }
    }
    function initWhitelistSearch() {
        const searchInput = document.getElementById('whitelistSearch');
        if (!searchInput || searchInput.dataset.bound) return;
        
        searchInput.addEventListener('input', debounce(() => {
            const q = (searchInput.value || '').toLowerCase();
            state.whitelistEntries = (state.adminData?.mobileWhitelist || []).filter(r => 
                String(r.email || '').toLowerCase().includes(q) ||
                String(r.mobile || '').toLowerCase().includes(q) ||
                String(r.reason || '').toLowerCase().includes(q)
            );
            renderMobileWhitelist();
        }, 200));
        
        searchInput.dataset.bound = 'true';
    }

    function loadMobileWhitelist() {
        setLoading(true);
        try {
            const entriesFromAdmin = state.adminData?.mobileWhitelist || [];
            state.whitelistEntries = entriesFromAdmin;
            renderMobileWhitelist();
        } catch (e) { handleError(e); }
        setLoading(false);
        try {
            if (!state.whitelistBound && dom.addWhitelistBtn) {
                dom.addWhitelistBtn.addEventListener('click', async () => {
                    const email = (dom.whitelistEmail.value || '').trim().toLowerCase();
                    const mobile = (dom.whitelistMobile.value || '').trim();
                    const reason = (dom.whitelistReason.value || '').trim();
                    if (!email || !mobile) { showAlert('admin-alert', 'Email and mobile are required', 'warning'); return; }
                    setLoading(true);
                    runServerFunction('addMobileWhitelist', email, mobile, reason, state.currentUser)
                        .then(res => {
                            if (!res?.success) throw new Error(res?.message || 'Add failed');
                            showAlert('admin-alert', res.message, 'success');
                            dom.whitelistEmail.value = '';
                            dom.whitelistMobile.value = '';
                            dom.whitelistReason.value = '';
                            return runServerFunction('getInitialDataForUser', state.currentUser);
                        })
                        .then(r => { state.adminData.mobileWhitelist = r.mobileWhitelist || []; state.whitelistEntries = state.adminData.mobileWhitelist; renderMobileWhitelist(); })
                        .catch(handleError)
                        .finally(() => setProgressBar(false));
                });
                state.whitelistBound = true;
            }
        } catch (e) { }
    }
    function renderMobileWhitelist() {
        const rows = state.whitelistEntries || [];
        const countEl = document.getElementById('whitelistCount');
        if (countEl) countEl.innerText = rows.length;

        if (dom.mobileWhitelistBody) {
            dom.mobileWhitelistBody.innerHTML = rows.map((r, idx) => `
        <tr>
          <td>${idx + 1}</td>
          <td style="font-weight:600; color:var(--text-primary);">${r.email}</td>
          <td style="font-family:monospace; color:var(--primary); font-weight:700;">${r.mobile}</td>
          <td style="font-size:0.85rem;">${r.reason || '<span style="opacity:0.3;">---</span>'}</td>
          <td style="font-size:0.75rem; color:var(--text-secondary);">${r.adminEmail || ''}</td>
          <td class="no-wrap col-date" style="font-size:0.75rem;">${formatCompactDate(r.dateAdded)}</td>
          <td style="text-align:right;">
            <button class="btn btn-secondary btn-small btn-remove-whitelist" data-email="${r.email}" data-mobile="${r.mobile}" style="padding:4px 8px; border-radius:6px; color:var(--danger);">
                <span class="material-icons" style="font-size:1.1rem;">delete</span>
            </button>
          </td>
        </tr>
      `).join('');
        }
        
        initWhitelistSearch();

        document.querySelectorAll('.btn-remove-whitelist').forEach(btn => {
            btn.addEventListener('click', async () => {
                const email = btn.dataset.email;
                const mobile = btn.dataset.mobile;
                try { await showConfirm(`Remove whitelist for ${email} (${mobile})?`); } catch (err) { return; }
                setLoading(true);
                runServerFunction('removeMobileWhitelist', email, mobile, state.currentUser)
                    .then(res => {
                        if (!res?.success) throw new Error(res?.message || 'Remove failed');
                        showAlert('admin-alert', res.message, 'success');
                        return runServerFunction('getInitialDataForUser', state.currentUser);
                    })
                    .then(r => { state.adminData.mobileWhitelist = r.mobileWhitelist || []; state.whitelistEntries = state.adminData.mobileWhitelist; renderMobileWhitelist(); })
                    .catch(handleError)
                    .finally(() => setLoading(false));
            });
        });
    }

    // ========== COLUMN RESIZE FEATURE ==========
    const COLUMN_WIDTHS_KEY = 'adminTableColumnWidths';
    let resizing = null;

    function initColumnResize() {
        const table = document.querySelector('.admin-table');
        if (!table) return;
        const headers = table.querySelectorAll('thead th');

        // Add resize handles to each header
        headers.forEach((th, idx) => {
            th.classList.add('resizable-th');
            th.style.position = th.style.position || 'relative';

            // Check if handle already exists
            if (th.querySelector('.resize-handle')) return;

            const handle = document.createElement('div');
            handle.className = 'resize-handle';
            handle.style.position = 'absolute';
            handle.style.top = '0';
            handle.style.right = '-2px';
            handle.style.width = '8px';
            handle.style.height = '100%';
            handle.style.cursor = 'col-resize';
            handle.style.userSelect = 'none';
            handle.style.touchAction = 'none';
            handle.style.zIndex = '20';
            handle.addEventListener('mousedown', (e) => startResize(e, th, idx, table));
            handle.addEventListener('touchstart', (e) => startResize(e.touches[0], th, idx, table), { passive: false });
            th.appendChild(handle);
        });

        // Apply saved widths
        loadColumnWidths(table, headers);
    }

    function startResize(e, th, colIdx, table) {
        e.preventDefault();
        e.stopPropagation();

        const startX = e.clientX || e.pageX;
        const startWidth = th.offsetWidth;

        resizing = { th, colIdx, startX, startWidth, table };
        th.querySelector('.resize-handle')?.classList.add('resizing');
        table.classList.add('resizing');

        document.addEventListener('mousemove', doResize);
        document.addEventListener('mouseup', stopResize);
        document.addEventListener('touchmove', doResizeTouch, { passive: false });
        document.addEventListener('touchend', stopResize);
    }

    function doResize(e) {
        if (!resizing) return;
        const diff = (e.clientX || e.pageX) - resizing.startX;
        const newWidth = Math.max(40, resizing.startWidth + diff);
        resizing.th.style.width = newWidth + 'px';
        resizing.th.style.minWidth = '40px';
    }

    function doResizeTouch(e) {
        if (!resizing || !e.touches[0]) return;
        e.preventDefault();
        doResize(e.touches[0]);
    }

    function stopResize() {
        if (!resizing) return;

        resizing.th.querySelector('.resize-handle')?.classList.remove('resizing');
        resizing.table.classList.remove('resizing');

        // Save to localStorage
        saveColumnWidthsLocal(resizing.table);

        resizing = null;
        document.removeEventListener('mousemove', doResize);
        document.removeEventListener('mouseup', stopResize);
        document.removeEventListener('touchmove', doResizeTouch);
        document.removeEventListener('touchend', stopResize);

        // Auto-save widths to config on stop - DISABLED
        // setTimeout(() => saveColumnWidthsToConfig(), 2000);
    }


    function saveColumnWidthsLocal(table) {
        const headers = table.querySelectorAll('thead th');
        const widths = {};
        headers.forEach((th, idx) => {
            if (th.style.width) {
                const key = th.dataset.colKey || th.className.split(' ').find(c => c.startsWith('col-')) || idx;
                widths[key] = th.style.width;
            }
        });
        try {
            localStorage.setItem(COLUMN_WIDTHS_KEY, JSON.stringify(widths));
        } catch (e) {
            console.warn('Failed to save column widths to localStorage:', e);
        }
    }

    function loadColumnWidths(table, headers) {
        // Try localStorage first
        let widths = null;
        try {
            const stored = localStorage.getItem(COLUMN_WIDTHS_KEY);
            if (stored) widths = JSON.parse(stored);
        } catch (e) { }

        // Fallback to Config defaults if available
        if (!widths && state.adminData?.settings?.columnWidths) {
            widths = state.adminData.settings.columnWidths;
        }

        if (widths) {
            headers.forEach((th, idx) => {
                const key = th.dataset.colKey || th.className.split(' ').find(c => c.startsWith('col-')) || idx;
                if (widths[key]) {
                    th.style.width = widths[key];
                    th.style.minWidth = '40px';
                }
            });
        }
    }

    function saveColumnWidthsToConfig() {
        const table = document.querySelector('.admin-table');
        if (!table) return;

        const headers = table.querySelectorAll('thead th');
        const widths = {};
        headers.forEach((th, idx) => {
            if (th.style.width) {
                const key = th.dataset.colKey || th.className.split(' ').find(c => c.startsWith('col-')) || idx;
                widths[key] = th.style.width;
            }
        });

        setLoading(true);
        setLoadingMessage('Saving column widths as default...');

        runServerFunction('saveColumnWidths', widths, state.currentUser)
            .then(response => {
                if (response?.success) {
                    if (!state.adminData.settings) state.adminData.settings = {};
                    state.adminData.settings.columnWidths = widths;
                    showAlert('admin-alert', 'Column widths saved as default for all admins', 'success');
                } else {
                    throw new Error(response?.message || 'Failed to save');
                }
            })
            .catch(handleError)
            .finally(() => setLoading(false));
    }

    function resetColumnWidths() {
        const table = document.querySelector('.admin-table');
        if (!table) return;

        // 1. Clear localStorage override
        try { localStorage.removeItem(COLUMN_WIDTHS_KEY); } catch (e) { }

        // 2. Clear from state
        if (state.adminData && state.adminData.settings) {
            state.adminData.settings.columnWidths = null;
        }

        // 3. Clear all inline widths from header cells
        const headers = table.querySelectorAll('thead th');
        headers.forEach(th => {
            th.style.width = '';
            th.style.minWidth = '';
        });

        // 4. Send empty config to server so it truly resets for everyone
        runServerFunction('saveColumnWidths', {}, state.currentUser).catch(() => { });

        showAlert('admin-alert', 'All column widths have been completely reset to original defaults', 'success');
    }

    // Initialize column resize after table is rendered
    const origRenderAdminDashboard = typeof renderAdminDashboard !== 'undefined' ? renderAdminDashboard : null;
    if (origRenderAdminDashboard) {
        // We'll call initColumnResize after DOM updates
    }

    // Use MutationObserver to initialize when table body changes
    const tableBodyObserver = new MutationObserver(() => {
        setTimeout(initColumnResize, 50);
    });
    function renderHistory(data, links) {
        const historyBody = document.getElementById('historyBody');
        if (!historyBody) return;
        if (!data || data.length === 0) return;
    }
    const adminTableBody = document.getElementById('adminTableBody');
    if (adminTableBody) {
        tableBodyObserver.observe(adminTableBody, { childList: true });
    }

    // Also initialize on page load
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(initColumnResize, 200);
        initActivityTooltips();
        if (typeof initLoginTabs === 'function') initLoginTabs();

        // [NEW] Mobile Dashboard UI Toggles (Restructured)
        const mobileTabToggle = document.getElementById('mobileTabToggle');
        const adminSidebar = document.getElementById('adminSidebar');
        const sidebarOverlay = document.getElementById('sidebarOverlay');
        const mobileFilterBtn = document.getElementById('mobileFilterToggle');

        const toggleMenu = (show) => {
            if (!adminSidebar || !sidebarOverlay) return;
            if (typeof show === 'undefined') {
                show = !adminSidebar.classList.contains('active');
            }
            if (show) {
                adminSidebar.classList.add('active');
                sidebarOverlay.classList.add('active');
            } else {
                adminSidebar.classList.remove('active');
                sidebarOverlay.classList.remove('active');
            }
        };

        if (mobileTabToggle) {
            mobileTabToggle.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleMenu();
            });
        }

        if (sidebarOverlay) {
            sidebarOverlay.addEventListener('click', () => toggleMenu(false));
        }

        // Close sidebar when clicking menu items
        const sidebarItems = document.querySelectorAll('.sidebar-nav-item');
        sidebarItems.forEach(item => {
            // [FIX] Clone to remove old listeners
            const newItem = item.cloneNode(true);
            item.parentNode.replaceChild(newItem, item);

            newItem.addEventListener('click', (e) => {
                const tab = newItem.dataset.tab;

                // [NEW] Handle External Portal Links with Token Handover
                if (!tab && newItem.tagName === 'A') {
                    const token = localStorage.getItem('hss_persist_token');
                    if (token && state.currentUser && isAnyAdmin()) {
                        try {
                            const url = new URL(newItem.href);
                            url.searchParams.set('hss_token', token);
                            newItem.href = url.toString();
                        } catch (err) { console.warn('Failed to append token:', err); }
                    }
                    toggleMenu(false);
                    return; // Let browser handle the link
                }

                if (tab) {
                    window.switchAdminTab(tab);
                }
                toggleMenu(false);
            });
        });

        // Bind Mobile Action Buttons
        const logoutMobile = document.getElementById('adminLogoutBtnMobile');
        const refreshMobile = document.getElementById('refreshBtnMobile');
        const themeMobile = document.getElementById('themeToggleBtnMobile');

        if (logoutMobile) {
            logoutMobile.onclick = () => document.getElementById('adminLogoutBtn')?.click();
        }
        if (refreshMobile) {
            refreshMobile.onclick = () => document.getElementById('refreshBtn')?.click();
        }
        if (themeMobile) {
            themeMobile.onclick = () => document.getElementById('themeToggleBtn')?.click();
        }

        if (mobileFilterBtn) {
            mobileFilterBtn.onclick = (e) => {
                e.stopPropagation();
                const toolbar = document.querySelector('#adminDashboardView .admin-toolbar');
                if (toolbar) toolbar.classList.toggle('mobile-hide');
                mobileFilterBtn.classList.toggle('btn-primary');
            };
        }
    });

    // Admin Activity Tooltip functionality
    function initActivityTooltips() {
        // Remove any existing tooltips
        document.querySelectorAll('.activity-tooltip').forEach(tooltip => tooltip.remove());

        // Add tooltip functionality to admin activity icons (both old and unified)
        document.addEventListener('mouseover', (e) => {
            // Ensure e.target is an element and has the closest method
            if (!e.target || typeof e.target.closest !== 'function') return;

            const activityIcons = e.target.closest('.admin-activity-icons') || e.target.closest('.unified-activity') || e.target.closest('.unified-history');
            if (activityIcons && activityIcons.dataset.tooltip) {
                showActivityTooltip(activityIcons, activityIcons.dataset.tooltip);
            }
        }, true);

        document.addEventListener('mouseout', (e) => {
            // Ensure e.target is an element and has the closest method
            if (!e.target || typeof e.target.closest !== 'function') return;

            const activityIcons = e.target.closest('.admin-activity-icons') || e.target.closest('.unified-activity') || e.target.closest('.unified-history') || e.target.closest('.activity-tooltip');
            if (activityIcons) {
                // If moving into the tooltip, don't hide it yet
                if (e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest('.activity-tooltip')) return;
                hideActivityTooltip();
            }
        }, true);

        // Also close tooltip on click elsewhere
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.activity-tooltip') && !e.target.closest('.admin-activity-icons') && !e.target.closest('.unified-activity') && !e.target.closest('.unified-history')) {
                hideActivityTooltip();
            }
        }, true);
    }

    function showActivityTooltip(element, text) {
        // Remove ALL existing tooltips immediately
        document.querySelectorAll('.activity-tooltip').forEach(tooltip => {
            tooltip.remove();
        });

        // Create tooltip element
        const tooltip = document.createElement('div');
        tooltip.className = 'activity-tooltip';

        // Format text with proper line breaks for activity history
        if (text.includes('\n')) {
            // It's activity history - format each line properly
            const lines = text.split('\n');
            tooltip.innerHTML = lines.map(line => {
                // Add proper spacing and formatting for each activity
                if (line.trim()) {
                    return `<div style="margin: 2px 0; font-size: 0.8rem; line-height: 1.3;">${line}</div>`;
                }
                return '';
            }).join('');
        } else {
            tooltip.textContent = text;
        }

        tooltip.style.zIndex = '9999'; // Ensure it's on top

        // Position tooltip
        const rect = element.getBoundingClientRect();
        tooltip.style.left = rect.left + 'px';
        tooltip.style.top = (rect.bottom + 8) + 'px';

        // Add to DOM and show with animation
        document.body.appendChild(tooltip);
        setTimeout(() => tooltip.classList.add('visible'), 10);

        // Adjust position if tooltip goes off screen
        setTimeout(() => {
            const tooltipRect = tooltip.getBoundingClientRect();
            if (tooltipRect.right > window.innerWidth) {
                tooltip.style.left = (rect.right - tooltipRect.width) + 'px';
            }
            if (tooltipRect.bottom > window.innerHeight) {
                tooltip.style.top = (rect.top - tooltipRect.height - 8) + 'px';
            }
        }, 10);
    }

    function hideActivityTooltip() {
        const existingTooltip = document.querySelector('.activity-tooltip');
        if (existingTooltip) {
            existingTooltip.remove();
        }
    }


    // Expose functions globally for button clicks
    window.saveColumnWidthsToConfig = saveColumnWidthsToConfig;
    window.resetColumnWidths = resetColumnWidths;

    function downloadFolderAsZip(folderId, fileName) {
        // [Inbuilt Feature] Uses Google Drive's native folder export engine
        // Handles large folders effortlessly by redirecting to Google's specialized downloader
        const exportUrl = 'https://drive.google.com/u/0/export?id=' + folderId + '&exportFormat=zip';
        window.open(exportUrl, '_blank');
        showAlert('admin-alert', 'Google Drive is preparing your ZIP download...', 'info');
    }

    /**
     * Helper to download base64 content in browser.
     */
    function downloadBase64File(base64, fileName, mimeType) {
        const link = document.createElement('a');
        // Using array join to avoid issues with 'data:' string literal/identifier parsing
        link.href = ['data', ':', mimeType, ';base64,', base64].join('');
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    // Global exposure if needed
    window.downloadFolderAsZip = downloadFolderAsZip;
    window.downloadBase64File = downloadBase64File;

    // Small helpers: add close button and click-away/ESC support for modal overlays
    (function modalCloseHelpers() {
        function safeHideOverlay(overlay) {
            const cancelBtn = overlay.querySelector('.modal-btn.cancel');
            if (cancelBtn) {
                try { cancelBtn.click(); } catch (e) { overlay.classList.add('hidden'); }
            } else {
                overlay.classList.add('hidden');
            }
        }

        document.querySelectorAll('.modal-overlay').forEach(overlay => {
            // click-away
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) safeHideOverlay(overlay);
            });

            // inject close button if not present
            try {
                const content = overlay.querySelector('.modal-content');
                if (content && !content.querySelector('.modal-close')) {
                    const btn = document.createElement('button');
                    btn.type = 'button';
                    btn.className = 'modal-close';
                    btn.title = 'Close';
                    btn.innerHTML = '<span class="material-icons" aria-hidden="true">close</span>';
                    btn.addEventListener('click', () => safeHideOverlay(overlay));
                    content.insertBefore(btn, content.firstChild);
                }
            } catch (e) {/* ignore */ }
        });

        // ESC key closes topmost popup/modal
        document.addEventListener('keydown', (ev) => {
            if (ev.key === 'Escape') {
                const overlays = Array.from(document.querySelectorAll('.popup-overlay, .modal-overlay')).filter(o => o.offsetParent !== null);
                if (overlays.length) {
                    const top = overlays[overlays.length - 1];
                    const cancelBtn = top.querySelector('.modal-btn.cancel, .popup-close');
                    if (cancelBtn) cancelBtn.click(); else top.classList.add('hidden');
                }
            }
        });
    })();

    /**
     * [NEW] Multi-Role Switching logic
     */
    window.renderRoleSwitcher = function () {
        const studentSwitcher = document.getElementById('studentRoleSwitcher');
        const teacherGateway = document.getElementById('studentPortalGateway');
        if (!studentSwitcher) return;

        const roles = state.currentUser?.availableRoles || [];
        const currentRole = state.currentUser?.role || 'Student';

        // [NEW] Handle prominent student link on teacher dashboard
        const teacherStudentLink = document.getElementById('teacherDashboardStudentLink');
        if (teacherStudentLink) {
            if (currentRole === 'Teacher' && roles.includes('Student')) {
                teacherStudentLink.classList.remove('hidden');
            } else {
                teacherStudentLink.classList.add('hidden');
            }
        }

        // Select the appropriate switcher container based on current view
        const switcher = currentRole === 'Teacher' ? document.getElementById('teacherRoleSwitcher') : studentSwitcher;

        if (!switcher || roles.length <= 1) {
            if (studentSwitcher) studentSwitcher.classList.add('hidden');
            if (document.getElementById('teacherRoleSwitcher')) document.getElementById('teacherRoleSwitcher').classList.add('hidden');
            if (teacherGateway) teacherGateway.classList.add('hidden');
            return;
        }

        const otherRoles = roles.filter(r => r !== currentRole);

        // If current role is Student and they have Teacher/Admin role, show the gateway bar at bottom too
        if (currentRole === 'Student' && otherRoles.some(r => ['Teacher', 'Admin', 'SuperAdmin'].includes(r))) {
            if (teacherGateway) teacherGateway.classList.remove('hidden');
        } else {
            if (teacherGateway) teacherGateway.classList.add('hidden');
        }

        switcher.innerHTML = `
            <div style="background: rgba(var(--primary-rgb, 99, 102, 241), 0.05); border: 1px dashed var(--primary); padding: 0.75rem; border-radius: 12px; display: flex; align-items: center; justify-content: space-between; gap: 1rem;">
                <div style="display:flex; align-items:center; gap:0.5rem; color: var(--primary); font-size: 0.85rem;">
                    <span class="material-icons" style="font-size:1.25rem">account_circle</span>
                    <span>Multi-role account detected. Currently viewed as <strong>${currentRole}</strong>.</span>
                </div>
                <div style="display:flex; gap:0.5rem;">
                    ${otherRoles.map(role => `
                        <button onclick="handleRoleSwitch('${role}')" class="btn btn-secondary btn-small" style="font-size: 0.75rem; height: 32px; padding: 0 12px;">
                            Switch to ${role}
                        </button>
                    `).join('')}
                </div>
            </div>
        `;
        switcher.classList.remove('hidden');
    }

    window.handleRoleSwitch = async function (newRole) {
        setLoading(true, true);
        setLoadingMessage(`Switching to ${newRole} Profile...`);
        console.log(`[AUTH] Requested role switch to: ${newRole}`);

        try {
            const res = await runServerFunction('switchUserRole', state.currentUser.email, newRole);
            
            if (res.success) {
                // Update cache and state
                sessionStorage.setItem('hss_user', JSON.stringify(res.data.profile));
                state.currentUser = res.data.profile;
                handleInitialData(res.data, true); // Force redirect to new role view
                showAlert('student-dashboard-alert', `Switched to ${newRole} mode successfully.`, 'success');
            } else {
                throw new Error(res.message);
            }
        } catch (err) {
            handleError(err);
            showAlert('student-dashboard-alert', 'Role switch failed: ' + err.message, 'danger');
        } finally {
            setLoading(false);
        }
    }



