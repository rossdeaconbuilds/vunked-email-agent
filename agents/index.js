#!/usr/bin/env node

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { retrieveContent } from './retrieve.js';
import { createStructure } from './structure.js';
import { generateCopy } from './copy.js';
import { writeAndAssemble } from './write.js';
import { readFile, writeFile, getAvailableSections, createSlug, getTimestamp } from './utils.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
dotenv.config({ path: path.join(path.dirname(fileURLToPath(import.meta.url)), '.env') });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Main email generation function
 */
async function generateEmail(input, options = {}) {
  const startTime = Date.now();
  
  console.log('='.repeat(60));
  console.log('🚀 Vunked Email Agent');
  console.log('='.repeat(60));
  console.log();
  
  try {
    // Step 1: RETRIEVE
    console.log('📥 STEP 1: RETRIEVE');
    console.log('-'.repeat(60));
    const blogData = await retrieveContent(input);
    console.log(`✓ Retrieved: "${blogData.blog_title}"`);
    console.log(`  Length: ${blogData.blog_text.length} characters`);
    console.log();
    
    // Read brand guidelines
    const brandGuidelines = await readFile('brand-guidelines.md');
    console.log('✓ Brand guidelines loaded');
    console.log();
    
    // Get available sections
    const sectionsDir = options.sections || 'sections';
    const availableSections = await getAvailableSections(sectionsDir);
    console.log(`✓ Found ${availableSections.length} section templates`);
    console.log();
    
    // Step 2: STRUCTURE
    console.log('🏗️  STEP 2: STRUCTURE');
    console.log('-'.repeat(60));
    const modelStructure = options.modelStructure || process.env.MODEL_STRUCTURE || 'gpt-4o-mini';
    const structure = await createStructure(blogData, brandGuidelines, availableSections, modelStructure, input.url);
    console.log();
    
    // Step 3: COPY
    console.log('✍️  STEP 3: COPY');
    console.log('-'.repeat(60));
    const modelCopy = options.modelCopy || process.env.MODEL_COPY || 'gpt-4.1';
    const plan = await generateCopy(structure, blogData, brandGuidelines, modelCopy, input.url);
    console.log();
    
    // Step 4: ASSEMBLE
    console.log('🔧 STEP 4: ASSEMBLE');
    console.log('-'.repeat(60));
    const modelWrite = options.modelWrite || process.env.MODEL_WRITE || 'gpt-5';
    const result = await writeAndAssemble(plan, brandGuidelines, sectionsDir, modelWrite);
    console.log();
    
    // Save output files
    console.log('💾 SAVING OUTPUT');
    console.log('-'.repeat(60));
    const outputDir = options.out || 'output';
    const slug = createSlug(plan.subject);
    const timestamp = getTimestamp();
    const basename = `${slug}-${timestamp}`;
    
    const htmlPath = await writeFile(
      path.join(outputDir, `${basename}.html`),
      result.html
    );
    console.log(`✓ HTML saved: ${path.basename(htmlPath)}`);
    
    const textPath = await writeFile(
      path.join(outputDir, `${basename}.txt`),
      result.text_version
    );
    console.log(`✓ Text saved: ${path.basename(textPath)}`);
    
    // Summary
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log();
    console.log('='.repeat(60));
    console.log('✅ EMAIL GENERATED SUCCESSFULLY');
    console.log('='.repeat(60));
    console.log(`Subject: ${result.subject}`);
    console.log(`Preview: ${result.preview}`);
    console.log(`HTML: ${htmlPath}`);
    console.log(`Text: ${textPath}`);
    console.log(`Duration: ${duration}s`);
    console.log('='.repeat(60));
    
    return result;
    
  } catch (error) {
    console.error();
    console.error('❌ ERROR:', error.message);
    console.error();
    
    if (error.stack && process.env.DEBUG) {
      console.error(error.stack);
    }
    
    process.exit(1);
  }
}

/**
 * CLI Interface
 */
async function main() {
  const argv = yargs(hideBin(process.argv))
    .usage('Usage: $0 [options]')
    .example('$0 --url "https://blog.example.com/post"', 'Generate email from blog URL')
    .example('$0 --text "Blog content here..."', 'Generate email from text')
    .example('$0 --prompt "make a black friday email"', 'Generate email from prompt')
    .option('url', {
      type: 'string',
      description: 'URL of blog post to convert'
    })
    .option('text', {
      type: 'string',
      description: 'Direct text content to convert'
    })
    .option('prompt', {
      type: 'string',
      description: 'Prompt for generating email (e.g., "black friday sale")'
    })
    .option('sections', {
      type: 'string',
      default: 'sections',
      description: 'Path to sections directory'
    })
    .option('out', {
      type: 'string',
      default: 'output',
      description: 'Output directory for generated files'
    })
    .option('modelStructure', {
      type: 'string',
      description: 'Model for structure step (default: gpt-4o-mini)'
    })
    .option('modelCopy', {
      type: 'string',
      description: 'Model for copy generation step (default: gpt-4.1)'
    })
    .option('modelWrite', {
      type: 'string',
      description: 'Model for assembly step (default: gpt-5)'
    })
    .check((argv) => {
      if (!argv.url && !argv.text && !argv.prompt) {
        throw new Error('Must specify one of: --url, --text, or --prompt');
      }
      return true;
    })
    .help()
    .alias('help', 'h')
    .version()
    .alias('version', 'v')
    .argv;
  
  const input = {
    url: argv.url,
    text: argv.text,
    prompt: argv.prompt
  };
  
  const options = {
    sections: argv.sections,
    out: argv.out,
    modelStructure: argv.modelStructure,
    modelCopy: argv.modelCopy,
    modelWrite: argv.modelWrite
  };
  
  await generateEmail(input, options);
}

// Run CLI if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

// Export for use as a module
export { generateEmail };

