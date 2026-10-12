import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

// Paths are relative to the upstream repository, one level above the skill.
// Only absent upstream material permits a skip; access and parse errors fail.
export function upstreamSkip(...relativePaths) {
  const missing = relativePaths.filter(relative => {
    try {
      fs.statSync(fileURLToPath(new URL(`../../${relative}`, import.meta.url)));
      return false;
    } catch (error) {
      if (error.code === 'ENOENT') return true;
      throw error;
    }
  });
  return missing.length
    ? `upstream material not vendored: ${missing.join(', ')}`
    : false;
}
