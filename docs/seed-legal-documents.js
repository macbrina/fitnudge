#!/usr/bin/env node

/**
 * Seed Legal Documents Script
 * Inserts Terms of Service and Privacy Policy into the database
 *
 * Usage: node seed-legal-documents.js
 *
 * Requirements:
 * - SUPABASE_URL environment variable
 * - SUPABASE_SERVICE_ROLE_KEY environment variable
 * - tos-clean.html file in the same directory
 * - privacy-clean.html file in the same directory (optional)
 */

const fs = require("fs");
const path = require("path");

// Check for environment variables
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Error: Missing environment variables");
  console.error("Required: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
  console.error("");
  console.error("Usage:");
  console.error(
    "  SUPABASE_URL=https://xxx.supabase.co SUPABASE_SERVICE_ROLE_KEY=xxx node seed-legal-documents.js"
  );
  process.exit(1);
}

// Documents to seed
const documents = [
  {
    type: "terms_of_service",
    version: "1.0",
    title: "Terms of Service",
    file: "tos-clean.html",
    required: true,
  },
  {
    type: "privacy_policy",
    version: "1.0",
    title: "Privacy Policy",
    file: "privacy-clean.html",
    required: false,
  },
];

async function seedDocuments() {
  console.log("Seeding legal documents...\n");

  for (const doc of documents) {
    const filePath = path.resolve(__dirname, doc.file);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      if (doc.required) {
        console.error(`Error: Required file not found: ${doc.file}`);
        process.exit(1);
      } else {
        console.log(`Skipping ${doc.type}: ${doc.file} not found`);
        continue;
      }
    }

    // Read file content
    const content = fs.readFileSync(filePath, "utf8");
    console.log(`Read ${doc.type}: ${(content.length / 1024).toFixed(1)} KB`);

    // First, check if document exists
    const checkResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/legal_documents?type=eq.${doc.type}&version=eq.${doc.version}`,
      {
        method: "GET",
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
      }
    );

    const existing = await checkResponse.json();
    const exists = Array.isArray(existing) && existing.length > 0;

    if (exists) {
      // Update existing document
      const updateResponse = await fetch(
        `${SUPABASE_URL}/rest/v1/legal_documents?type=eq.${doc.type}&version=eq.${doc.version}`,
        {
          method: "PATCH",
          headers: {
            apikey: SUPABASE_SERVICE_ROLE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            "Content-Type": "application/json",
            Prefer: "return=minimal",
          },
          body: JSON.stringify({
            title: doc.title,
            content: content,
            effective_date: new Date().toISOString(),
            is_current: true,
            updated_at: new Date().toISOString(),
          }),
        }
      );

      if (!updateResponse.ok) {
        const error = await updateResponse.text();
        console.error(`Error updating ${doc.type}: ${error}`);
        continue;
      }

      console.log(`✓ Updated ${doc.type} v${doc.version}`);
    } else {
      // Insert new document
      const insertResponse = await fetch(
        `${SUPABASE_URL}/rest/v1/legal_documents`,
        {
          method: "POST",
          headers: {
            apikey: SUPABASE_SERVICE_ROLE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            "Content-Type": "application/json",
            Prefer: "return=minimal",
          },
          body: JSON.stringify({
            type: doc.type,
            version: doc.version,
            title: doc.title,
            content: content,
            effective_date: new Date().toISOString(),
            is_current: true,
          }),
        }
      );

      if (!insertResponse.ok) {
        const error = await insertResponse.text();
        console.error(`Error inserting ${doc.type}: ${error}`);
        continue;
      }

      console.log(`✓ Inserted ${doc.type} v${doc.version}`);
    }
  }

  console.log("\nDone!");
}

seedDocuments().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
