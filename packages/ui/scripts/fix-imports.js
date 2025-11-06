#!/usr/bin/env node

/**
 * Script to fix imports in shadcn components
 * Converts @/lib/utils to relative imports (../../lib/utils)
 */

const fs = require("fs");
const path = require("path");

// Find the package root (where this script is located)
const PACKAGE_ROOT = path.join(__dirname, "..");
const COMPONENTS_DIR = path.join(PACKAGE_ROOT, "src/components/ui");
const LIB_UTILS_PATH = path.join(PACKAGE_ROOT, "src/lib/utils.ts");

function findFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);

  files.forEach((file) => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      findFiles(filePath, fileList);
    } else if (/\.(ts|tsx)$/.test(file)) {
      fileList.push(filePath);
    }
  });

  return fileList;
}

function fixImportsInFile(filePath) {
  let content = fs.readFileSync(filePath, "utf8");
  let modified = false;

  // Calculate relative path from file to lib/utils
  const fileDir = path.dirname(filePath);
  const relativePath = path
    .relative(fileDir, LIB_UTILS_PATH)
    .replace(/\.ts$/, "");

  // Normalize path separators (Windows compatibility)
  const normalizedPath = relativePath.replace(/\\/g, "/");

  // Replace @/lib/utils with relative path
  // Match: from "@/lib/utils" or from '@/lib/utils'
  const importPattern = /from\s+["']@\/lib\/utils["']/g;

  if (content.match(importPattern)) {
    content = content.replace(importPattern, `from "${normalizedPath}"`);
    modified = true;
  }

  if (modified) {
    fs.writeFileSync(filePath, content, "utf8");
    const relativeFilePath = path.relative(process.cwd(), filePath);
    console.log(`✓ Fixed imports in ${relativeFilePath}`);
    return true;
  }

  return false;
}

function fixAllImports() {
  console.log("🔧 Fixing imports in shadcn components...\n");

  // Check if components directory exists
  if (!fs.existsSync(COMPONENTS_DIR)) {
    console.log("Components directory not found. Skipping.");
    return;
  }

  // Find all .tsx and .ts files in components/ui directory
  const files = findFiles(COMPONENTS_DIR);

  if (files.length === 0) {
    console.log("No component files found.");
    return;
  }

  let fixedCount = 0;
  files.forEach((file) => {
    if (fixImportsInFile(file)) {
      fixedCount++;
    }
  });

  if (fixedCount > 0) {
    console.log(`\n✨ Fixed imports in ${fixedCount} file(s).`);
  } else {
    console.log("\n✓ No imports to fix.");
  }
}

// Run if called directly
if (require.main === module) {
  fixAllImports();
}

module.exports = { fixImportsInFile, fixAllImports };
