import fs from 'fs/promises';
import path from 'path';
import { convert } from 'html-to-text';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Read a file from the project root
 */
export async function readFile(filePath) {
  try {
    const fullPath = path.resolve(__dirname, '..', filePath);
    return await fs.readFile(fullPath, 'utf-8');
  } catch (error) {
    throw new Error(`Failed to read file ${filePath}: ${error.message}`);
  }
}

/**
 * Write content to a file
 */
export async function writeFile(filePath, content) {
  try {
    const fullPath = path.resolve(__dirname, '..', filePath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, content, 'utf-8');
    return fullPath;
  } catch (error) {
    throw new Error(`Failed to write file ${filePath}: ${error.message}`);
  }
}

/**
 * List all files in a directory
 */
export async function listFiles(dirPath) {
  try {
    const fullPath = path.resolve(__dirname, '..', dirPath);
    const files = await fs.readdir(fullPath);
    return files.filter(f => f.endsWith('.html'));
  } catch (error) {
    throw new Error(`Failed to list files in ${dirPath}: ${error.message}`);
  }
}

/**
 * Read multiple section files based on sequence
 */
export async function readSections(sequence, sectionsDir = 'sections') {
  const sections = {};
  
  for (const sectionName of sequence) {
    const fileName = `${sectionName}.html`;
    try {
      const content = await readFile(path.join(sectionsDir, fileName));
      sections[sectionName] = content;
    } catch (error) {
      console.warn(`Warning: Could not read section ${sectionName}: ${error.message}`);
      sections[sectionName] = '';
    }
  }
  
  return sections;
}

/**
 * Convert HTML to plain text
 */
export function htmlToText(html) {
  return convert(html, {
    wordwrap: 80,
    selectors: [
      { selector: 'a', options: { ignoreHref: true } },
      { selector: 'img', format: 'skip' }
    ]
  });
}

/**
 * Validate plan JSON structure
 */
export function validatePlan(plan) {
  const errors = [];
  
  if (!plan.subject || typeof plan.subject !== 'string') {
    errors.push('Plan must have a subject string');
  }
  
  if (!plan.preview || typeof plan.preview !== 'string') {
    errors.push('Plan must have a preview string');
  }
  
  if (!Array.isArray(plan.sequence) || plan.sequence.length === 0) {
    errors.push('Plan must have a non-empty sequence array');
  }
  
  if (!plan.slots || typeof plan.slots !== 'object') {
    errors.push('Plan must have a slots object');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Get available sections from the sections directory
 */
export async function getAvailableSections(sectionsDir = 'sections') {
  const files = await listFiles(sectionsDir);
  return files.map(f => path.basename(f, '.html'));
}

/**
 * Create a slug from text
 */
export function createSlug(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 50);
}

/**
 * Get timestamp string for filenames
 */
export function getTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
}

