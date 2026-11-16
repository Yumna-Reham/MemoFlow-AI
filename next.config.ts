import type { NextConfig } from "next";
import fs from "fs";
import path from "path";

// Standardize process.cwd() to resolve Windows junction paths cleanly
try {
  const realPath = fs.realpathSync.native ? fs.realpathSync.native(process.cwd()) : fs.realpathSync(process.cwd());
  if (realPath && realPath !== process.cwd()) {
    process.chdir(realPath);
  }
} catch (err) {}

const nextConfig: NextConfig = {
  outputFileTracingRoot: process.cwd(),
};

export default nextConfig;
