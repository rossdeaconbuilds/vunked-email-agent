import OpenAI from 'openai';
import { JSDOM } from 'jsdom';
import { readSections, htmlToText } from './utils.js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Write and assemble final email HTML
 * @param {Object} plan - Email plan with sequence and slots
 * @param {string} brandGuidelines - Brand guidelines content
 * @param {string} sectionsDir - Directory containing section HTML files
 * @param {string} model - Model to use for content generation (default: gpt-5-mini)
 * @returns {Promise<{subject: string, preview: string, html: string, text_version: string}>}
 */
export async function writeAndAssemble(plan, brandGuidelines, sectionsDir = 'sections', model = 'gpt-5-mini') {
  const apiKey = process.env.OPEN_API_KEY_CURSOR || process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    throw new Error('OPEN_API_KEY_CURSOR or OPENAI_API_KEY environment variable is not set');
  }
  
  console.log('Reading section HTML files...');
  const sections = await readSections(plan.sequence, sectionsDir);
  
  console.log('Processing sections with AI assistance...');
  const openai = new OpenAI({ apiKey });
  
  // Process dynamic sections
  const processedSections = {};
  
  for (const sectionName of plan.sequence) {
    const sectionHtml = sections[sectionName];
    
    if (!sectionHtml) {
      console.warn(`Warning: Section ${sectionName} is empty, skipping`);
      continue;
    }
    
    // Check if this is a dynamic section that needs AI processing
    if (sectionName === 'hero' && plan.slots.hero) {
      processedSections[sectionName] = await processHeroSection(
        sectionHtml,
        plan.slots.hero,
        openai,
        model,
        brandGuidelines
      );
    } else if (sectionName === 'simple-body' && plan.slots['simple-body']) {
      processedSections[sectionName] = await processBodySection(
        sectionHtml,
        plan.slots['simple-body'],
        openai,
        model,
        brandGuidelines
      );
    } else if (sectionName === 'six-summary-cards' && plan.slots['six-summary-cards']) {
      processedSections[sectionName] = await processSixSummaryCards(
        sectionHtml,
        plan.slots['six-summary-cards'],
        openai,
        model,
        brandGuidelines
      );
    } else {
      // Static section - use as-is
      processedSections[sectionName] = sectionHtml;
    }
  }
  
  console.log('Assembling final HTML email...');
  const html = assembleEmail(processedSections, plan.sequence);
  
  console.log('Generating plain-text version...');
  const text_version = htmlToText(html);
  
  console.log('✓ Email HTML generated successfully');
  
  return {
    subject: plan.subject,
    preview: plan.preview,
    html,
    text_version
  };
}

/**
 * Process hero section by replacing title, subtitle, and CTA button
 */
async function processHeroSection(heroHtml, heroSlot, openai, model, brandGuidelines) {
  try {
    const dom = new JSDOM(heroHtml);
    const doc = dom.window.document;
    
    // Find and update the H1/H3 title
    const titleElement = doc.querySelector('h3') || doc.querySelector('h1') || doc.querySelector('h2');
    if (titleElement && heroSlot.title) {
      // Keep the styling, just replace the text content
      const boldSpan = titleElement.querySelector('span[style*="font-weight: bold"]');
      if (boldSpan) {
        boldSpan.textContent = heroSlot.title;
      } else {
        titleElement.textContent = heroSlot.title;
      }
    }
    
    // Find and update the subtitle
    const paragraphs = doc.querySelectorAll('div[style*="line-height"] span[style*="font-family: Montserrat"]');
    if (paragraphs.length > 1 && heroSlot.subtitle) {
      // Usually the second paragraph is the subtitle
      paragraphs[1].innerHTML = heroSlot.subtitle;
    }
    
    // Find and update the CTA button
    if (heroSlot.cta_text || heroSlot.cta_url) {
      const ctaLink = doc.querySelector('a[href*="Insert Link"]') || doc.querySelector('.kl-button a');
      if (ctaLink) {
        if (heroSlot.cta_text) {
          ctaLink.textContent = heroSlot.cta_text;
        }
        if (heroSlot.cta_url) {
          ctaLink.setAttribute('href', heroSlot.cta_url);
        }
      }
    }
    
    return dom.serialize();
  } catch (error) {
    console.warn(`Warning: Could not process hero section: ${error.message}`);
    return heroHtml; // Return original if processing fails
  }
}

/**
 * Process body section by replacing content with new HTML blocks
 */
async function processBodySection(bodyHtml, bodySlots, openai, model, brandGuidelines) {
  try {
    const dom = new JSDOM(bodyHtml);
    const doc = dom.window.document;
    
    // Find the text container
    const textContainer = doc.querySelector('td.kl-text div[style*="font-family"]');
    
    if (!textContainer) {
      console.warn('Could not find text container in simple-body section');
      return bodyHtml;
    }
    
    // Build new content from slots
    let newContent = '<div style="line-height: 120%;">';
    
    for (const block of bodySlots) {
      if (block.html) {
        newContent += block.html;
      }
    }
    
    newContent += '</div>';
    
    // Replace the content
    textContainer.innerHTML = newContent;
    
    return dom.serialize();
  } catch (error) {
    console.warn(`Warning: Could not process body section: ${error.message}`);
    return bodyHtml; // Return original if processing fails
  }
}

/**
 * Process six-summary-cards section by populating with blog topics
 */
async function processSixSummaryCards(cardsHtml, cardsData, openai, model, brandGuidelines) {
  try {
    const dom = new JSDOM(cardsHtml);
    const doc = dom.window.document;
    
    // Find all card containers (there should be 6)
    const cardContainers = doc.querySelectorAll('td[width="50%"][align="center"]');
    
    if (!cardContainers || cardContainers.length === 0) {
      console.warn('Could not find card containers in six-summary-cards section');
      return cardsHtml;
    }
    
    // Populate each card with data from cardsData
    cardsData.forEach((card, index) => {
      if (index >= cardContainers.length) return; // Safety check
      
      const container = cardContainers[index];
      
      // Find and update emoji
      const emojiSpan = container.querySelector('span[style*="font-size: 28px"]');
      if (emojiSpan && card.emoji) {
        emojiSpan.textContent = card.emoji;
      }
      
      // Find and update title (h3)
      const titleH3 = container.querySelector('h3');
      if (titleH3 && card.title) {
        titleH3.innerHTML = card.title.replace(/\n/g, '<br>');
      }
      
      // Find and update description (p)
      const descP = container.querySelector('p[style*="font-size: 14px"]');
      if (descP && card.description) {
        descP.textContent = card.description;
      }
    });
    
    return dom.serialize();
  } catch (error) {
    console.warn(`Warning: Could not process six-summary-cards section: ${error.message}`);
    return cardsHtml; // Return original if processing fails
  }
}

/**
 * Assemble all sections into complete email HTML
 */
function assembleEmail(sections, sequence) {
  // Read email wrapper sections
  const sectionsDir = join(__dirname, '..', 'sections');
  const emailStart = readFileSync(join(sectionsDir, 'email-wrapper-start.html'), 'utf-8');
  const emailEnd = readFileSync(join(sectionsDir, 'email-wrapper-end.html'), 'utf-8');

  // Concatenate all sections in sequence
  const sectionsHtml = sequence
    .map(sectionName => sections[sectionName] || '')
    .filter(html => html.trim().length > 0)
    .join('\n\n');
  
  return emailStart + sectionsHtml + emailEnd;
}

