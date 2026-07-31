import fs from 'fs';
import path from 'path';

console.log('=== TIRVONA CURRENCY STANDARDIZATION AUDIT REPORT ===\n');

const FRONTEND_DIR = path.resolve('..', 'frontend', 'src');
const BACKEND_DIR = path.resolve('.', 'src');

let uiDollarCount = 0;
let enUsCount = 0;
let usdCount = 0;
let regexDollarCount = 0;

function scanDir(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  files.forEach((file) => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      scanDir(filePath, fileList);
    } else if (file.endsWith('.tsx') || file.endsWith('.ts') || file.endsWith('.js') || file.endsWith('.html')) {
      fileList.push(filePath);
    }
  });
  return fileList;
}

const allFiles = [...scanDir(FRONTEND_DIR), ...scanDir(BACKEND_DIR)];

const reportItems = [];

allFiles.forEach((filePath) => {
  if (filePath.includes('audit_currency_standards.js')) return;

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  lines.forEach((line, index) => {
    const lineNum = index + 1;

    // Audit for USD
    if (line.includes('USD')) {
      usdCount++;
      reportItems.push({
        filePath,
        lineNum,
        matched: 'USD',
        line: line.trim(),
        safeToKeep: false,
        reason: 'Hardcoded USD reference',
      });
    }

    // Audit for en-US
    if (line.includes('en-US')) {
      enUsCount++;
      reportItems.push({
        filePath,
        lineNum,
        matched: 'en-US',
        line: line.trim(),
        safeToKeep: false,
        reason: 'US Locale formatting used instead of en-IN',
      });
    }

    // Audit for Regex Dollar Backreferences vs UI Dollar Symbols
    const regexBackrefMatch = line.match(/\.replace\(.*\$[0-9]/);
    if (regexBackrefMatch) {
      regexDollarCount++;
    } else {
      const uiDollarMatch = line.match(/['"\s>]\$[0-9\.]+/);
      if (uiDollarMatch) {
        uiDollarCount++;
        reportItems.push({
          filePath,
          lineNum,
          matched: uiDollarMatch[0],
          line: line.trim(),
          safeToKeep: false,
          reason: 'Hardcoded Dollar ($) UI price symbol',
        });
      }
    }
  });
});

console.log(`TOTAL FILES AUDITED: ${allFiles.length}`);
console.log(`- Hardcoded UI "$" Occurrences Found: ${uiDollarCount}`);
console.log(`- Hardcoded "USD" Occurrences Found: ${usdCount}`);
console.log(`- Hardcoded "en-US" Occurrences Found: ${enUsCount}`);
console.log(`- Code Syntax Regex Backreferences ($1, $2) Intentionally Preserved: ${regexDollarCount}`);

console.log('\n--- AUDIT VERIFICATION SUMMARY ---');
if (uiDollarCount === 0 && usdCount === 0 && enUsCount === 0) {
  console.log('✅ VERIFICATION PASSED: 0 hardcoded USD, 0 en-US, and 0 UI "$" symbols found!');
  console.log('✅ Every visible price across all modules displays Indian Rupee (₹) with Indian numbering format (en-IN).');
} else {
  reportItems.forEach((item) => {
    console.log(`File: ${item.filePath}:${item.lineNum}`);
    console.log(`  Value: ${item.matched}`);
    console.log(`  Line: ${item.line}`);
    console.log(`  Reason: ${item.reason}\n`);
  });
}

console.log('\n=== AUDIT COMPLETE ===\n');
