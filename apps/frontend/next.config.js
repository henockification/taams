const path = require("path");

/** @type {import("next").NextConfig} */
const nextConfig = {
  output: "standalone",

  // Allows Next.js to trace shared monorepo dependencies
  // outside apps/frontend.
  outputFileTracingRoot: path.join(__dirname, "../../"),
};

module.exports = nextConfig;