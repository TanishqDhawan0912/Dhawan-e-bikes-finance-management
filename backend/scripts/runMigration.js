#!/usr/bin/env node

console.log("Starting purchase date migration for existing models...");

// Run the update script
require("./updateExistingPurchaseDates.js");
