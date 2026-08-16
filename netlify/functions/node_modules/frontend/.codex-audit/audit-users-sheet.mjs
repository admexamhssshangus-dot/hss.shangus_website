import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const workbookPath = process.argv[2];
if (!workbookPath) throw new Error("Workbook path is required");

const input = await FileBlob.load(workbookPath);
const workbook = await SpreadsheetFile.importXlsx(input);
const sheetInfo = JSON.parse((await workbook.inspect({ kind: "sheet", include: "id,name", maxChars: 10000 })).ndjson)
  .filter((item) => item?.type === "sheet" || item?.kind === "sheet");

const usersSheet = workbook.worksheets.getItem("Users");
const used = usersSheet.getUsedRange(true);
const values = used?.values ?? [];
const headers = (values[0] ?? []).map((value) => String(value ?? "").trim());
const normalizedHeaders = headers.map((header) => header.toLowerCase().replace(/[^a-z0-9]/g, ""));

const findColumn = (...names) => {
  const candidates = names.map((name) => name.toLowerCase().replace(/[^a-z0-9]/g, ""));
  return normalizedHeaders.findIndex((header) => candidates.includes(header));
};

const emailIndex = findColumn("email", "email address", "user email", "username");
const passwordIndex = findColumn("password", "pass", "user password", "login password");
const roleIndex = findColumn("role", "user role", "account type");
const nameIndex = findColumn("name", "full name", "display name", "student name", "teacher name");

const classifyPassword = (raw) => {
  if (raw === null || raw === undefined || String(raw).length === 0) return "missing";
  const value = String(raw);
  if (/^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(value)) return "bcrypt_hash";
  if (/^\$argon2(?:id|i|d)\$/.test(value)) return "argon2_hash";
  if (/^[a-f0-9]{32}$/i.test(value)) return "md5_like_hash";
  if (/^[a-f0-9]{40}$/i.test(value)) return "sha1_like_hash";
  if (/^[a-f0-9]{64}$/i.test(value)) return "sha256_like_hash";
  if (/^[a-f0-9]{128}$/i.test(value)) return "sha512_like_hash";
  return "plaintext_or_temporary";
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const rows = [];
const emailRows = new Map();
const passwordFormats = {};
const roles = {};

for (let i = 1; i < values.length; i += 1) {
  const row = values[i] ?? [];
  const isBlank = row.every((value) => value === null || value === undefined || String(value).trim() === "");
  if (isBlank) continue;
  const email = emailIndex >= 0 ? String(row[emailIndex] ?? "").trim().toLowerCase() : "";
  const passwordFormat = passwordIndex >= 0 ? classifyPassword(row[passwordIndex]) : "column_missing";
  const role = roleIndex >= 0 ? String(row[roleIndex] ?? "").trim() : "";
  const displayName = nameIndex >= 0 ? String(row[nameIndex] ?? "").trim() : "";
  passwordFormats[passwordFormat] = (passwordFormats[passwordFormat] ?? 0) + 1;
  roles[role || "(missing)"] = (roles[role || "(missing)"] ?? 0) + 1;
  const item = {
    excelRow: i + 1,
    email,
    emailValid: emailPattern.test(email),
    passwordFormat,
    passwordLength: passwordIndex >= 0 ? String(row[passwordIndex] ?? "").length : 0,
    role: role || null,
    hasDisplayName: Boolean(displayName),
  };
  rows.push(item);
  if (email) {
    if (!emailRows.has(email)) emailRows.set(email, []);
    emailRows.get(email).push(i + 1);
  }
}

const duplicates = [...emailRows.entries()]
  .filter(([, excelRows]) => excelRows.length > 1)
  .map(([email, excelRows]) => ({ email, excelRows }));

console.log(JSON.stringify({
  sheetNames: sheetInfo.map((item) => item.name).filter(Boolean),
  users: {
    usedRowCount: values.length,
    usedColumnCount: headers.length,
    headers,
    detectedColumns: { emailIndex, passwordIndex, roleIndex, nameIndex },
    dataRowCount: rows.length,
    passwordFormats,
    roles,
    duplicates,
    invalidEmailRows: rows.filter((row) => !row.emailValid).map(({ excelRow, email }) => ({ excelRow, email })),
    missingPasswordRows: rows.filter((row) => row.passwordFormat === "missing").map(({ excelRow, email }) => ({ excelRow, email })),
    rows,
  },
}, null, 2));
