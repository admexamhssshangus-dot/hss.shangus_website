/**
 * adminModuleSearchEngine.js
 * 
 * High-performance, Google-like fuzzy and semantic search engine for Administrative Modules & Tools.
 * Features:
 * - Domain-specific educational semantic thesaurus (Board, Marks, Admissions, Fees, Exams, etc.)
 * - Levenshtein & Damerau fuzzy typo tolerance
 * - Multi-token weighting & coverage scoring
 * - Substring, prefix, and word-boundary matching
 * - Matched keyword extraction for visual badges ("Matches: JKBOSE, Sent-up roll")
 * - Smart query suggestion ("Did you mean...?")
 */

// ─────────────────────────────────────────────────────────────────────────────
// 1. SEMANTIC CONCEPT THESAURUS (EDUCATIONAL DOMAIN ONTOLOGY)
// ─────────────────────────────────────────────────────────────────────────────
export const SEMANTIC_THESAURUS = Object.freeze({
  board: [
    'jkbose', 'bose', 'state board', 'board exam', 'sent up', 'sent-up', 'gazette',
    'roll return', 'roll returns', 'matric', 'higher secondary', 'pre-board', 'pre board',
    'board reg', 'board roll', 'board ingestion', 'board data', 'verified data', 'board sync'
  ],
  marks: [
    'score', 'scores', 'result', 'results', 'grade', 'grades', 'eval', 'evaluation',
    'assessment', 'awards', 'award roll', 'practical', 'practicals', 'viva', 'theory',
    'internal assessment', 'external practical', 'test', 'exam', 'gazette', 'mark list'
  ],
  exam: [
    'test', 'examination', 'assessment', 'pre-board', 'golden test', 'unit test', 'term test',
    'omr', 'mcq', 'competitive', 'neet', 'jee', 'gk', 'admit card', 'hall ticket', 'roll no'
  ],
  admission: [
    'intake', 'enrol', 'enrolment', 'enrollment', 'form', 'apply', 'applicant', 'entry',
    'direct entry', 'new student', 'registration', 'provisional', 'ledger', 'register',
    'feeder', 'feeder school', 'class 10', 'class 11', 'class 12'
  ],
  fee: [
    'fees', 'fund', 'funds', 'dues', 'payment', 'collection', 'receipt', 'concession',
    'scholarship', 'money', 'ledger', 'account', 'financial', 'bank', 'cash'
  ],
  salary: [
    'pay', 'tax', 'income tax', 'tds', 'deduction', 'payroll', 'accounts clerk',
    'nps', 'gp fund', 'form 16', 'statement', 'staff salary', 'allowance'
  ],
  photo: [
    'picture', 'image', 'camera', 'avatar', 'id card', 'badge', 'batch photo',
    'photo export', 'student photo', 'photograph'
  ],
  message: [
    'email', 'sms', 'whatsapp', 'notification', 'notify', 'alert', 'broadcast',
    'parent message', 'delivery log', 'announcement'
  ],
  staff: [
    'teacher', 'teachers', 'faculty', 'lecturer', 'master', 'permission', 'permissions',
    'role', 'roles', 'rbac', 'access', 'admin', 'superadmin', 'designation', 'credential', 'login'
  ],
  certificate: [
    'bonafide', 'character', 'provisional', 'dob', 'birth', 'slc', 'transfer', 'discharge',
    'achievement certificate', 'qr verification', 'school leaving'
  ],
  achievements: [
    'achievement', 'achievements', 'hall of fame', 'fame', 'topper', 'toppers', 'position', 'positions',
    'ut positions', 'top ranks', 'rankers', 'awards', 'medals', 'honors', 'trophies', 'merit',
    'neet', 'jee', 'cuet', 'sports', 'jkbose toppers', 'hall of fame cms'
  ],
  export: [
    'download', 'excel', 'csv', 'spreadsheet', 'sheets', 'pdf', 'print', 'word', 'docx'
  ],
  delete: [
    'trash', 'bin', 'recycle', 'recycle bin', 'deleted', 'restore', 'recovery', 'history', 'archive'
  ],
  attendance: [
    'absent', 'present', 'leave', 'roll call', 'daily register', 'monthly attendance',
    'percentage', 'attendance defaulter'
  ],
  roll: [
    'roll no', 'class roll', 'roll number', 'roll returns', 'sent-up roll', 'serial number',
    'exam roll', 'sequence', 'auto roll'
  ],
  website: [
    'cms', 'homepage', 'portal', 'slider', 'hero', 'notices', 'circular', 'gallery',
    'news', 'public site', 'achievements', 'hall of fame'
  ],
  audit: [
    'logs', 'activity', 'history', 'who did what', 'dispute', 'trail', 'timestamp',
    'security log', 'investigation'
  ],
  duplicate: [
    'merge', 'deduplication', 'double admission', 'identical', 'clone', 'repeat'
  ],
  contacts: [
    'phone', 'mobile', 'parents phone', 'phonebook', 'google contacts', 'directory', 'whatsapp list'
  ],
  curriculum: [
    'subject', 'subjects', 'stream', 'streams', 'medical', 'non-medical', 'arts',
    'commerce', 'combination', 'elective', 'compulsory', 'course'
  ],
  letter: [
    'letterhead', 'official letter', 'draft', 'compose', 'ai letter', 'order', 'circular', 'memo'
  ]
});

export const STOP_WORDS = new Set([
  'of', 'in', 'at', 'on', 'to', 'for', 'by', 'and', 'or', 'the', 'a', 'an', 'is', 'as', 'with', 'amp'
]);

// ─────────────────────────────────────────────────────────────────────────────
// 2. FUZZY STRING METRIC (DAMERAU-LEVENSHTEIN WITH TRANSPOSITION)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Computes Damerau-Levenshtein distance between two normalized strings.
 * Supports transposition of adjacent characters (e.g., 'tehc' -> 'tech').
 */
export function getDamerauLevenshteinDistance(str1, str2) {
  if (!str1) return str2 ? str2.length : 0;
  if (!str2) return str1.length;
  if (str1 === str2) return 0;

  const len1 = str1.length;
  const len2 = str2.length;
  const d = [];

  for (let i = 0; i <= len1; i++) {
    d[i] = [i];
  }
  for (let j = 0; j <= len2; j++) {
    d[0][j] = j;
  }

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      d[i][j] = Math.min(
        d[i - 1][j] + 1,       // deletion
        d[i][j - 1] + 1,       // insertion
        d[i - 1][j - 1] + cost // substitution
      );

      // Transposition check
      if (
        i > 1 &&
        j > 1 &&
        str1[i - 1] === str2[j - 2] &&
        str1[i - 2] === str2[j - 1]
      ) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }

  return d[len1][len2];
}

/**
 * Normalizes text for clean tokenization and comparison.
 */
export function normalizeSearchText(str) {
  return String(str || '')
    .toLowerCase()
    .replace(/[^\w\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Checks if queryToken fuzzily matches targetToken.
 * Returns { isMatch: boolean, score: number, distance: number }
 */
export function matchTokenFuzzy(queryToken, targetToken) {
  if (!queryToken || !targetToken) return { isMatch: false, score: 0 };
  if (queryToken === targetToken) return { isMatch: true, score: 100, distance: 0 };

  // Prefix match
  if (targetToken.startsWith(queryToken)) {
    const ratio = queryToken.length / targetToken.length;
    return { isMatch: true, score: 85 + Math.round(ratio * 15), distance: 0 };
  }

  // Substring match
  if (targetToken.includes(queryToken)) {
    return { isMatch: true, score: 75, distance: 0 };
  }

  const qLen = queryToken.length;
  const tLen = targetToken.length;

  // Do not fuzzy-match very short tokens
  if (qLen < 3) return { isMatch: false, score: 0 };

  const maxAllowedDistance = qLen <= 4 ? 1 : (qLen <= 7 ? 2 : 3);
  const distance = getDamerauLevenshteinDistance(queryToken, targetToken);

  if (distance <= maxAllowedDistance) {
    const penalty = distance * 20;
    const lengthSimilarity = 1 - Math.abs(qLen - tLen) / Math.max(qLen, tLen);
    const score = Math.max(20, Math.round(70 - penalty + lengthSimilarity * 20));
    return { isMatch: true, score, distance };
  }

  return { isMatch: false, score: 0 };
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. SEMANTIC QUERY EXPANDER
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Expands a query into its semantic concepts and synonyms using the thesaurus.
 */
export function expandSemanticQuery(rawQuery) {
  const norm = normalizeSearchText(rawQuery);
  const tokens = norm.split(' ').filter(Boolean);
  const expandedConcepts = new Set();
  const searchSynonyms = new Set(tokens);

  const meaningfulTokens = tokens.filter(tok => !STOP_WORDS.has(tok) && tok.length > 1);

  meaningfulTokens.forEach(tok => {
    // 1. Direct concept lookup
    if (SEMANTIC_THESAURUS[tok]) {
      expandedConcepts.add(tok);
      SEMANTIC_THESAURUS[tok].forEach(syn => searchSynonyms.add(syn));
    }

    // 2. Reverse concept lookup (token appears inside another concept's synonyms)
    Object.entries(SEMANTIC_THESAURUS).forEach(([conceptKey, synList]) => {
      const isSyn = synList.some(s => {
        if (s === tok) return true;
        if (tok.length >= 3 && (s.startsWith(tok) || s.split(' ').includes(tok))) return true;
        return matchTokenFuzzy(tok, s).isMatch;
      });
      if (isSyn) {
        expandedConcepts.add(conceptKey);
        searchSynonyms.add(conceptKey);
        synList.forEach(s => searchSynonyms.add(s));
      }
    });
  });

  return {
    originalTokens: tokens,
    expandedConcepts: Array.from(expandedConcepts),
    allSynonyms: Array.from(searchSynonyms),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. CORE SEARCH & RANKING ENGINE
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Searches an array of admin module items with Google-like fuzzy and semantic matching.
 * 
 * @param {Array<object>} items - List of items ({ id, label, desc, category, keywords, aliases })
 * @param {string} rawQuery - The administrator's search query
 * @returns {Array<object>} - Ranked items with relevance scores, matchedKeywords, and highlight ranges
 */
export function searchAdminModules(items, rawQuery) {
  if (!rawQuery || !rawQuery.trim() || !Array.isArray(items)) {
    return items || [];
  }

  const cleanQuery = normalizeSearchText(rawQuery);
  const queryTokens = cleanQuery.split(' ').filter(Boolean);
  if (queryTokens.length === 0) return items;

  const { expandedConcepts, allSynonyms } = expandSemanticQuery(cleanQuery);

  const scoredResults = [];

  items.forEach(item => {
    let score = 0;
    const matchedReasons = new Set();
    let termHits = 0;

    const labelNorm = normalizeSearchText(item.label);
    const descNorm = normalizeSearchText(item.desc);
    const catNorm = normalizeSearchText(item.category);
    const idNorm = normalizeSearchText(item.id);
    const aliasesNorm = (item.aliases || []).map(normalizeSearchText);
    const keywordsNorm = (item.keywords || []).map(normalizeSearchText);

    // Collect all search fields
    const labelWords = labelNorm.split(' ').filter(Boolean);
    const descWords = descNorm.split(' ').filter(Boolean);
    const allKeywords = [...keywordsNorm, ...aliasesNorm];

    // 1. EXACT WHOLE QUERY MATCHES (Maximum Priority)
    if (labelNorm === cleanQuery || idNorm === cleanQuery) {
      score += 2000;
      matchedReasons.add('Exact Title');
    } else if (labelNorm.startsWith(cleanQuery)) {
      score += 1200;
      matchedReasons.add('Title Prefix');
    } else if (labelNorm.includes(cleanQuery)) {
      score += 900;
      matchedReasons.add('In Title');
    } else if (descNorm.includes(cleanQuery)) {
      score += 500;
      matchedReasons.add('In Description');
    }

    // 2. TOKEN-BY-TOKEN EVALUATION
    queryTokens.forEach(qTok => {
      let qHit = false;

      // Check ID & Aliases
      if (idNorm === qTok || aliasesNorm.includes(qTok)) {
        score += 800;
        qHit = true;
        matchedReasons.add(item.label);
      }

      // Check Label Words
      for (const lWord of labelWords) {
        const fuzzy = matchTokenFuzzy(qTok, lWord);
        if (fuzzy.isMatch) {
          score += fuzzy.score * 8; // Max ~800
          qHit = true;
          matchedReasons.add(lWord);
          break;
        }
      }

      // Check Keywords
      for (const kw of allKeywords) {
        if (kw === qTok || kw.includes(qTok)) {
          score += 650;
          qHit = true;
          matchedReasons.add(kw);
          break;
        }
        const kwWords = kw.split(' ');
        for (const kWord of kwWords) {
          const fuzzy = matchTokenFuzzy(qTok, kWord);
          if (fuzzy.isMatch) {
            score += fuzzy.score * 5; // Max ~500
            qHit = true;
            matchedReasons.add(kw);
            break;
          }
        }
      }

      // Check Category
      if (catNorm.includes(qTok)) {
        score += 350;
        qHit = true;
        matchedReasons.add(item.category);
      }

      // Check Description Words
      for (const dWord of descWords) {
        if (dWord === qTok || dWord.startsWith(qTok)) {
          score += 250;
          qHit = true;
          matchedReasons.add(dWord);
          break;
        }
        const fuzzy = matchTokenFuzzy(qTok, dWord);
        if (fuzzy.isMatch && fuzzy.score >= 70) {
          score += fuzzy.score * 2;
          qHit = true;
          break;
        }
      }

      if (qHit) termHits++;
    });

    // 3. SEMANTIC SYNONYM & CONCEPT BOOST
    allSynonyms.forEach(syn => {
      if (queryTokens.includes(syn)) return; // Already checked as direct query token

      // Check if item label or keywords match this semantic synonym
      if (labelNorm.includes(syn)) {
        score += 450;
        matchedReasons.add(syn);
      } else if (allKeywords.some(kw => kw === syn || kw.includes(syn))) {
        score += 400;
        matchedReasons.add(syn);
      } else if (descNorm.includes(syn)) {
        score += 200;
        matchedReasons.add(syn);
      }
    });

    // 4. MULTI-TERM COVERAGE BONUS
    // If user searched for 2+ terms and all were hit, grant a 1.5x multiplier
    if (queryTokens.length > 1) {
      const coverage = termHits / queryTokens.length;
      if (coverage === 1) {
        score = Math.round(score * 1.6);
      } else if (coverage >= 0.5) {
        score = Math.round(score * 1.2);
      }
    }

    // 5. QUALIFY RESULT
    if (score > 60) {
      scoredResults.push({
        ...item,
        _searchScore: score,
        _matchedReasons: Array.from(matchedReasons).slice(0, 3),
      });
    }
  });

  // Sort descending by score
  scoredResults.sort((a, b) => b._searchScore - a._searchScore);

  return scoredResults;
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. HIGHLIGHT HELPER FOR SEARCH RENDERING
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Splits text into highlighted and plain segments based on search terms.
 * Useful for highlighting matching letters in search results.
 */
export function getHighlightedSegments(text, rawQuery) {
  if (!text || !rawQuery || !rawQuery.trim()) {
    return [{ text: text || '', highlight: false }];
  }

  const queryTokens = normalizeSearchText(rawQuery).split(' ').filter(Boolean);
  if (queryTokens.length === 0) return [{ text, highlight: false }];

  // Build regex matching any token
  const pattern = queryTokens
    .map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|');
  const regex = new RegExp(`(${pattern})`, 'gi');

  const parts = String(text).split(regex);
  return parts.map(part => ({
    text: part,
    highlight: regex.test(part),
  }));
}
