import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';

/**
 * Fetch and parse content from a URL
 */
async function fetchFromUrl(url) {
  try {
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const html = await response.text();
    const dom = new JSDOM(html, { url });
    
    // Use Readability to extract clean article content
    const reader = new Readability(dom.window.document);
    const article = reader.parse();
    
    if (!article) {
      throw new Error('Could not extract article content from URL');
    }
    
    return {
      blog_title: article.title || extractTitleFromDom(dom),
      blog_text: article.textContent || article.content
    };
  } catch (error) {
    throw new Error(`Failed to fetch content from URL: ${error.message}`);
  }
}

/**
 * Extract title from DOM if Readability doesn't find it
 */
function extractTitleFromDom(dom) {
  const doc = dom.window.document;
  
  // Try various selectors
  const h1 = doc.querySelector('h1');
  if (h1) return h1.textContent.trim();
  
  const title = doc.querySelector('title');
  if (title) return title.textContent.trim();
  
  return 'Untitled';
}

/**
 * Process text or prompt input
 */
function processTextInput(text) {
  // Try to extract a title from the first line or first sentence
  const lines = text.trim().split('\n').filter(l => l.trim());
  
  let blog_title = 'Email Content';
  let blog_text = text;
  
  if (lines.length > 0) {
    const firstLine = lines[0].trim();
    
    // If first line is short (likely a title), use it
    if (firstLine.length < 100 && lines.length > 1) {
      blog_title = firstLine.replace(/^#+\s*/, ''); // Remove markdown heading markers
      blog_text = lines.slice(1).join('\n').trim();
    } else {
      // Extract first sentence as title
      const firstSentence = firstLine.match(/^[^.!?]+[.!?]/);
      if (firstSentence) {
        blog_title = firstSentence[0].trim();
      }
    }
  }
  
  return { blog_title, blog_text };
}

/**
 * Main retrieve function
 * @param {Object} input - Input configuration
 * @param {string} input.url - URL to fetch content from
 * @param {string} input.text - Direct text content
 * @param {string} input.prompt - Prompt for generating email
 * @returns {Promise<{blog_title: string, blog_text: string, source_url?: string}>}
 */
export async function retrieveContent(input) {
  if (input.url) {
    console.log(`Fetching content from: ${input.url}`);
    const result = await fetchFromUrl(input.url);
    result.source_url = input.url; // Store the original URL for CTA
    return result;
  }
  
  if (input.text) {
    console.log('Processing provided text content');
    return processTextInput(input.text);
  }
  
  if (input.prompt) {
    console.log('Processing prompt input');
    return {
      blog_title: 'Custom Email',
      blog_text: input.prompt
    };
  }
  
  throw new Error('No input provided. Please specify --url, --text, or --prompt');
}

