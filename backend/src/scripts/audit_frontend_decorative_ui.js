import fs from 'fs';
import path from 'path';

const FRONTEND_SRC = path.resolve('../frontend/src');

const DECORATIVE_ICON_NAMES = [
  'Sparkles', 'Wand', 'Magic', 'Quote', 'Compass', 'Badge', 'Award', 'Crown',
  'Ribbon', 'Fire', 'Bolt', 'Diamond', 'Stars', 'Heart', 'ShieldCheck', 'Shield', 'Globe'
];

const DECORATIVE_LABEL_TERMS = [
  'Spiritual Experience', 'Sacred Journey', 'Editor\'s Pick', 'Best Choice', 'Exclusive'
];

const DECORATIVE_CSS_PATTERNS = [
  { name: 'Glow / Blur Effects', regex: /backdrop-blur|filter:\s*blur|blur-3xl|blur-2xl|blur-xl/g },
  { name: 'Gradient Blobs & Radial Overlays', regex: /radial-gradient|bg-gradient-to-[rltb]/g },
  { name: 'Floating & Infinite Animations', regex: /animate-bounce|animate-pulse|animate-spin|animate-float/g },
  { name: 'Colored Glow Shadows', regex: /shadow-[a-z]+-\d+|shadow-2xl|shadow-xl/g },
  { name: 'Excessive Padding / Spacing', regex: /py-24|py-32|space-y-12|space-y-16/g }
];

function walk(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  files.forEach((file) => {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      walk(filePath, fileList);
    } else if (/\.(tsx|jsx|css|ts)$/.test(file)) {
      fileList.push(filePath);
    }
  });
  return fileList;
}

function runAudit() {
  console.log('=== TIRVONA FRONTEND ENTERPRISE UI AUDIT ===\n');

  const allFiles = walk(FRONTEND_SRC);
  console.log(`Auditing ${allFiles.length} frontend source files...\n`);

  let totalDecorativeIcons = 0;
  let totalDecorativeLabels = 0;
  let totalDecorativeAnimations = 0;
  let totalGlowAndBlurEffects = 0;
  let totalGradients = 0;
  let totalShadows = 0;
  let totalOversizedSpacing = 0;

  const affectedFilesMap = new Map();

  allFiles.forEach((file) => {
    const content = fs.readFileSync(file, 'utf-8');
    const relativePath = path.relative(FRONTEND_SRC, file);
    let fileFindings = 0;

    // Check decorative icons before title text
    DECORATIVE_ICON_NAMES.forEach((icon) => {
      const regex = new RegExp(`<${icon}[^>]*\\/>`, 'g');
      const matches = content.match(regex);
      if (matches) {
        totalDecorativeIcons += matches.length;
        fileFindings += matches.length;
      }
    });

    // Check decorative labels
    DECORATIVE_LABEL_TERMS.forEach((term) => {
      const matches = content.match(new RegExp(term, 'gi'));
      if (matches) {
        totalDecorativeLabels += matches.length;
        fileFindings += matches.length;
      }
    });

    // Check CSS patterns
    DECORATIVE_CSS_PATTERNS.forEach((pattern) => {
      const matches = content.match(pattern.regex);
      if (matches) {
        if (pattern.name.includes('Animation')) totalDecorativeAnimations += matches.length;
        if (pattern.name.includes('Glow')) totalGlowAndBlurEffects += matches.length;
        if (pattern.name.includes('Gradient')) totalGradients += matches.length;
        if (pattern.name.includes('Shadow')) totalShadows += matches.length;
        if (pattern.name.includes('Spacing')) totalOversizedSpacing += matches.length;
        fileFindings += matches.length;
      }
    });

    if (fileFindings > 0) {
      affectedFilesMap.set(relativePath, fileFindings);
    }
  });

  console.log('=== AUDIT SUMMARY FINDINGS ===');
  console.log(`1. Total Decorative Icons Identified: ${totalDecorativeIcons}`);
  console.log(`2. Total Unbacked Decorative Labels: ${totalDecorativeLabels}`);
  console.log(`3. Total Floating/Pulse Animations: ${totalDecorativeAnimations}`);
  console.log(`4. Total Glow & Blur Overlays: ${totalGlowAndBlurEffects}`);
  console.log(`5. Total Background Gradients: ${totalGradients}`);
  console.log(`6. Total Heavy / Glow Shadows: ${totalShadows}`);
  console.log(`7. Total Oversized Section Spacings (py-24+): ${totalOversizedSpacing}`);
  console.log(`8. Total Affected Frontend Files: ${affectedFilesMap.size} of ${allFiles.length} files\n`);

  console.log('=== TOP AFFECTED FILES ===');
  const sortedFiles = Array.from(affectedFilesMap.entries()).sort((a, b) => b[1] - a[1]);
  sortedFiles.slice(0, 15).forEach(([f, count], idx) => {
    console.log(`${idx + 1}. ${f} — ${count} decorative items`);
  });
}

runAudit();
