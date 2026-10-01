# Changes Log & Commit Reference

## Latest Commit: Pre-Board Consolidated Awards Hidden

**Commit:** `fb0c71bb`
**Message:** `feat(practicals): hide consolidated award options for Pre-Board type with explanatory notice`

### What Changed
Pre-Board type in the Practicals portal no longer shows consolidated award export/print options, since pre-board consolidated awards are handled via the Competitive Exams & OMR system.

**Awards / Export dropdown behaviour by type:**

| Option | Internal | Pre-Board | External |
|---|---|---|---|
| 🖨 Print Consolidated Awards & Letter | ✅ | ❌ | ✅ |
| 📄 Print Individual Subject Award Rolls | ✅ | ✅ | ✅ |
| 📊 Export Consolidated Excel (.xlsx) | ✅ | ❌ | ✅ |
| 📝 Export Official Word Doc (.docx) | ✅ | ❌ | ✅ |
| ⬇ Export Blank Teacher Roster (.xlsx) | ✅ | ✅ | ✅ |

When **Pre-Board** is selected, an amber ⓘ notice appears:
> *"Pre-Board consolidated awards are managed via the Competitive Exams & OMR system — not this portal."*

---

## Files Modified
- `src/portal/admin/AdminPracticals.jsx` — Conditional guards on consolidated award items in the dropdown.
- `CHANGES_SINCE_LAST_COMMIT.md` — This file.

---

## Manual Push (Mandatory Policy)
```bash
git push origin main
```
