#!/usr/bin/env node

/**
 * Wrapper script for shadcn add that automatically fixes imports after adding components
 * Usage: node scripts/shadcn-add.js <component-name>
 * or: npm run shadcn:add <component-name>
 */

const { execSync } = require("child_process");
const path = require("path");
const { fixAllImports } = require("./fix-imports");

// Get component name from command line arguments
const componentName = process.argv[2];

if (!componentName) {
  console.error("❌ Error: Component name is required");
  console.log("\nUsage: npm run shadcn:add <component-name>");
  console.log("Example: npm run shadcn:add card");
  process.exit(1);
}

console.log(`🚀 Adding shadcn component: ${componentName}\n`);

try {
  // Run shadcn add command
  execSync(`npx shadcn@latest add ${componentName} --yes`, {
    stdio: "inherit",
    cwd: path.join(__dirname, ".."),
  });

  console.log("\n🔧 Fixing imports...\n");

  // Fix imports after component is added
  fixAllImports();

  console.log(`\n✅ Component "${componentName}" added and imports fixed!`);
} catch (error) {
  console.error("\n❌ Error adding component:", error.message);
  process.exit(1);
}
