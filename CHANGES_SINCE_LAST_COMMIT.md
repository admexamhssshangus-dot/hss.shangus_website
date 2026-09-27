# Changes Log & Commit Reference

## Current Working Changes (Ready for Commit)

### 1. Automatic Fallback for Old Admission Number (`AdmissionRegisterSuite.jsx`)
- **Problem Diagnosed:** Students tagged as Re-admission (such as *Sartaj Ahmad Mir*, *Sarvat Abbas*, *Faizan Bilal Najar*, and *Kifayat Jabbar Kutay*) did not show their previous admission numbers in brackets (e.g. `5482 (4904)`) because their online form documents had `oldAdmNo` as blank, and the register renderer was previously not falling back to historical master records.
- **Solution:** 
  - Added an automatic fallback ladder for `finalOldAdmNo`:
    1. Checks `s.oldAdmNo` / `s['Old Admission No.']`.
    2. Fallback to `histMatch?.admNo`.
    3. Fallback to `historicalAdmLookup.byBoardReg[cleanReg]` (e.g. `4904` for Sartaj, `4887` for Sarvat Abbas, `5195` for Faizan Bilal Najar, `4809` for Kifayat Jabbar).
    4. Fallback to `historicalAdmLookup.byFormNo` and `historicalAdmLookup.byNameFather`.
  - Updated `displayAdmNo` to format as `${finalAdmNo} (${finalOldAdmNo})`.
  - Now *Sartaj Ahmad Mir* displays `5482 (4904)`, *Sarvat Abbas* displays `5480 (4887)`, *Faizan Bilal Najar* displays `5498 (5195)`, and *Kifayat Jabbar Kutay* displays `5503 (4809)`.

### 2. Sequential Re-Admission Arrangement for Class 12th (Session 2025–26)
- **Roster Alignment:**
  - Omitted Roll 22 (*Burhan*) per user instruction.
  - Corrected Roll 153 for *Gowher Ahmad Lone* (previously noted as 158).
  - Prepared the complete 38-student roster sequentially indexed from **Roll 1** (*Irtiza Maqbool*) assigned to **5476** up to **Roll 193** (*Seerat Jan*) assigned to **5513**.
  - Re-aligns previously randomly assigned numbers (*Sarvat Abbas* $\to$ 5480, *Mehvish Iqbal* $\to$ 5481, *Sartaj Ahmad Mir* $\to$ 5482).

---

## Suggested Commit Message
```bash
git commit -m "fix(admRegister): resolve old admission number fallback in brackets and prepare sequential re-admission mapping"
```

---

## How to Review or Manually Manage Commits

### To review staged changes before commit:
```bash
git diff --staged
```

### If you want to commit manually:
```bash
git add .
git commit -m "fix(admRegister): resolve old admission number fallback in brackets and prepare sequential re-admission mapping"
```

### If you want to undo/re-commit the latest local commit manually:
```bash
# Keeps all file changes intact in your working tree, un-committing the last commit:
git reset --soft HEAD~1

# You can then review, make adjustments, and manually commit:
git commit -m "Your custom commit message"
```

### To push your verified commits to remote (Manual Push Policy):
```bash
git push origin main
```

---

## Previous Commit Reference (`87c0f484`)
- **Summary:** Resolve historical adm numbers and optimize re-admission workflow with progress modal and class filters.
