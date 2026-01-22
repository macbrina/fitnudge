#!/usr/bin/env node

/**
 * HTML Cleaner Script
 * Removes class, style, data-* attributes and cleans up HTML for database storage
 *
 * Usage: node clean-html.js <input-file> [output-file]
 * Example: node clean-html.js tos.html tos-clean.html
 */

const fs = require("fs");
const path = require("path");

// Get command line arguments
const args = process.argv.slice(2);

if (args.length === 0) {
  console.log("Usage: node clean-html.js <input-file> [output-file]");
  console.log("Example: node clean-html.js tos.html tos-clean.html");
  process.exit(1);
}

const inputFile = args[0];
const outputFile = args[1] || inputFile.replace(".html", "-clean.html");

// Read input file
const inputPath = path.resolve(__dirname, inputFile);
const outputPath = path.resolve(__dirname, outputFile);

if (!fs.existsSync(inputPath)) {
  console.error(`Error: File not found: ${inputPath}`);
  process.exit(1);
}

console.log(`Reading: ${inputPath}`);
let html = fs.readFileSync(inputPath, "utf8");

const originalSize = html.length;

// Cleaning functions
function cleanHtml(html) {
  // Remove ALL bdt tags and fragments aggressively (do this first)
  // These are template tags from document generators
  html = html.replace(/<\/?bdt[^>]*>/gi, "");
  html = html.replace(/<\/bdt>/gi, "");
  html = html.replace(/<bdt>/gi, "");

  // Remove any remaining bdt fragments (multiple passes)
  for (let i = 0; i < 10; i++) {
    html = html.replace(/<\/?bdt[^>]*>/gi, "");
    html = html.replace(/<\/bdt>/gi, "");
  }

  // Remove data-custom-class attributes
  html = html.replace(/\s*data-custom-class="[^"]*"/gi, "");

  // Remove data-id attributes
  html = html.replace(/\s*data-id="[^"]*"/gi, "");

  // Remove all data-* attributes
  html = html.replace(/\s*data-[a-z-]+="[^"]*"/gi, "");

  // Remove class attributes
  html = html.replace(/\s*class="[^"]*"/gi, "");

  // Remove style attributes (including multiline)
  html = html.replace(/\s*style="[^"]*"/gis, "");

  // NOTE: We keep id attributes as they are needed for internal anchor links
  // (e.g., <a href="#services"> links need <div id="services"> targets)

  // Remove align attributes
  html = html.replace(/\s*align="[^"]*"/gi, "");

  // Remove name attributes on anchor tags (legacy)
  html = html.replace(/<a\s+name="[^"]*"\s*><\/a>/gi, "");

  // Remove empty spans (multiple passes)
  for (let i = 0; i < 3; i++) {
    html = html.replace(/<span\s*>\s*<\/span>/gi, "");
    html = html.replace(/<span>\s*<\/span>/gi, "");
  }

  // Remove empty divs (multiple passes)
  for (let i = 0; i < 3; i++) {
    html = html.replace(/<div\s*>\s*<\/div>/gi, "");
    html = html.replace(/<div>\s*<\/div>/gi, "");
  }

  // Remove empty strong tags
  html = html.replace(/<strong\s*>\s*<\/strong>/gi, "");

  // Clean up orphaned closing tags that might remain (aggressive)
  html = html.replace(/<\/bdt>/g, "");
  html = html.replace(/<bdt>/g, "");
  html = html.replace(/<bdt[^>]*>/g, "");

  // Remove any text that looks like </bdt> fragments
  html = html.replace(/\s*<\/bdt>\s*/g, "");
  html = html.replace(/\s*<bdt[^>]*>\s*/g, "");

  // Clean up multiple spaces
  html = html.replace(/  +/g, " ");

  // Clean up space before closing tags
  html = html.replace(/\s+>/g, ">");

  // Clean up spaces around tags
  html = html.replace(/>\s+</g, ">\n<");

  // Remove empty lines
  html = html.replace(/^\s*[\r\n]/gm, "");

  // Clean up multiple newlines
  html = html.replace(/\n\n\n+/g, "\n\n");

  // Clean up br tags with extra spaces
  html = html.replace(/<br\s*\/?>/gi, "<br>");

  // Remove embedded <style> blocks (they can leak and affect page layout)
  html = html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");

  // Trim
  html = html.trim();

  return html;
}

// Clean the HTML
html = cleanHtml(html);

// Write output
fs.writeFileSync(outputPath, html, "utf8");

const newSize = html.length;
const reduction = (((originalSize - newSize) / originalSize) * 100).toFixed(1);

console.log(`Output: ${outputPath}`);
console.log(`Original size: ${(originalSize / 1024).toFixed(1)} KB`);
console.log(`New size: ${(newSize / 1024).toFixed(1)} KB`);
console.log(`Reduced by: ${reduction}%`);
console.log("Done!");
