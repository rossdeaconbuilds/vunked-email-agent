import OpenAI from 'openai';

const SECTION_LIBRARY = {
  hero: {
    category: 'General',
    summary: 'Hero banner with headline, supporting copy, and CTA. Always the first section.'
  },
  'simple-body': {
    category: 'Educational',
    summary: 'Flexible content blocks for storytelling, guides, and updates. Use 2-4 per email.'
  },
  'six-summary-cards': {
    category: 'Educational',
    summary: 'Six-card grid for summarising key takeaways. Use when content is an educational guide or insights list.'
  },
  'selling-points-what-you-get': {
    category: 'Product',
    summary: 'Three benefit cards that spotlight what customers receive. Ideal for product launches, offers, or kit promotions.'
  },
  'social-media-van-conversions': {
    category: 'Social Proof',
    summary: 'Community spotlight cards featuring social posts. Use to build trust or highlight real installations.'
  },
  'book-a-call': {
    category: 'General CTA',
    summary: 'Consultation CTA for readers ready to speak with Vunked. Place near the end for sales-oriented emails.'
  },
  contact: {
    category: 'General',
    summary: 'Standard contact information block. Include when closing with next steps or support.'
  },
  signature: {
    category: 'General',
    summary: 'Friendly sign-off from the Vunked team. Always place before the footer.'
  },
  footer: {
    category: 'General',
    summary: 'Legal footer with company info and unsubscribe links. Always the final section.'
  }
};

/**
 * Create email structure (section selection and ordering)
 * @param {Object} blogData - Blog content with title and text
 * @param {string} brandGuidelines - Brand guidelines markdown content
 * @param {string[]} availableSections - List of available section names
 * @param {string} model - Model to use (default: gpt-4o-mini)
 * @param {string} sourceUrl - Original blog URL if available
 * @returns {Promise<Object>} Structure object with sequence and metadata
 */
export async function createStructure(blogData, brandGuidelines, availableSections, model = 'gpt-4o-mini', sourceUrl = null) {
  const apiKey = process.env.OPEN_API_KEY_CURSOR || process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    throw new Error('OPEN_API_KEY_CURSOR or OPENAI_API_KEY environment variable is not set');
  }
  
  const openai = new OpenAI({
    apiKey,
    timeout: 60_000,
    maxRetries: 1
  });
  
  // Build the prompt
  const prompt = buildStructurePrompt(blogData, brandGuidelines, availableSections, sourceUrl);
  
  // Define the JSON schema for the response
  const schema = {
    type: "object",
    properties: {
      sequence: {
        type: "array",
        items: { type: "string" },
        description: "Ordered list of section names to include in email"
      },
      email_goal: {
        type: "string",
        description: "Primary goal of this email (educational, promotional, mixed, etc.)"
      },
      use_summary_cards: {
        type: "boolean",
        description: "Whether to include six-summary-cards section"
      },
      reasoning: {
        type: "string",
        description: "Brief explanation of section choices"
      }
    },
    required: ["sequence", "email_goal", "use_summary_cards", "reasoning"],
    additionalProperties: false
  };
  
  const systemPrompt = "You are an expert email strategist. Analyze blog content and decide which email sections to use and in what order.";

  console.log(`Calling OpenAI API for structure with model: ${model}`);
  console.log(`  Prompt length: ${prompt.length} characters`);

  const timerLabel = `structure:openai_request (${model})`;
  console.time(timerLabel);
  
  try {
    const completion = await openai.chat.completions.create({
      model: model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt }
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "email_structure",
          schema: schema,
          strict: true
        }
      },
      temperature: 0.7,
      max_tokens: 1000
    });
    
    console.timeEnd(timerLabel);
    
    const responseText = completion.choices[0].message.content;
    const structure = JSON.parse(responseText);
    
    // Post-process the sequence
    structure.sequence = postProcessSequence(structure.sequence, structure.use_summary_cards, availableSections);
    
    console.log('✓ Email structure generated successfully');
    console.log(`  Goal: ${structure.email_goal}`);
    console.log(`  Sections: ${structure.sequence.join(' → ')}`);
    console.log(`  Reasoning: ${structure.reasoning}`);
    
    return structure;
  } catch (error) {
    console.timeEnd(timerLabel);
    console.error('Full error details:', error);
    throw new Error(`Failed to create structure: ${error.message}`);
  }
}

/**
 * Build the prompt for structure generation
 */
function buildStructurePrompt(blogData, brandGuidelines, availableSections, sourceUrl = null) {
  const urlContext = sourceUrl ? `\n**Source URL:** ${sourceUrl}` : '';
  const sectionDetails = availableSections.map(sectionName => {
    const meta = SECTION_LIBRARY[sectionName];
    if (!meta) {
      return `- ${sectionName}`;
    }
    return `- ${sectionName} [${meta.category}]: ${meta.summary}`;
  });
  
  return `
# Task: Determine Email Structure

You are deciding which sections to include in an email and in what order, based on blog content.

## Blog Content
**Title:** ${blogData.blog_title}${urlContext}

**Content Preview:**
${blogData.blog_text.substring(0, 1500)}${blogData.blog_text.length > 1500 ? '...' : ''}

## Brand Context
${brandGuidelines.substring(0, 1000)}

## Available Email Sections
${sectionDetails.join('\n')}

### Section Categories
- **Educational:** Share guides, how-tos, technical explainers, or multi-step stories.
- **Product:** Highlight offers, benefits, kits, or reasons to buy Vunked products.
- **Social Proof:** Feature customer success, community builds, testimonials, or social content.
- **General / Always-On:** Infrastructure pieces (hero, signature, footer, contact) that frame the narrative.

## Your Task
Analyze the blog content and decide:
1. What is the primary goal of this email? (educational, promotional, mixed, announcement, etc.)
2. Which sections should be included?
3. In what order should they appear?
4. Should six-summary-cards be included? (Use for educational/tutorial content, skip for promotional/sales)

## Rules
- ALWAYS start with 'hero'
- ALWAYS end with 'signature' followed by 'footer'
- Include 'contact' for support-focused or resource-heavy emails
- Use 'six-summary-cards' ONLY for educational/blog content, NOT for sales/promotions
- Use 'selling-points-what-you-get' for product launches, offers, or kit promotions
- Use 'social-media-van-conversions' to showcase community builds or customer success
- Use 'book-a-call' for sales-oriented emails or consultation pushes
- 'simple-body' should always be included for main content

Return your decision as JSON.
`.trim();
}

/**
 * Post-process sequence to ensure rules are followed
 */
function postProcessSequence(sequence, useSummaryCards, availableSections) {
  let processed = [...sequence];
  
  // Filter to only available sections
  processed = processed.filter(s => availableSections.includes(s));
  
  // Ensure hero is first
  if (!processed.includes('hero')) {
    processed.unshift('hero');
  } else if (processed[0] !== 'hero') {
    processed = processed.filter(s => s !== 'hero');
    processed.unshift('hero');
  }
  
  // Ensure footer is last
  if (!processed.includes('footer')) {
    processed.push('footer');
  } else if (processed[processed.length - 1] !== 'footer') {
    processed = processed.filter(s => s !== 'footer');
    processed.push('footer');
  }
  
  // Ensure signature comes before footer
  const footerIndex = processed.indexOf('footer');
  const signatureIndex = processed.indexOf('signature');
  
  if (signatureIndex === -1) {
    // Add signature before footer
    processed.splice(footerIndex, 0, 'signature');
  } else if (signatureIndex > footerIndex) {
    // Move signature before footer
    processed.splice(signatureIndex, 1);
    const newFooterIndex = processed.indexOf('footer');
    processed.splice(newFooterIndex, 0, 'signature');
  }
  
  // Handle six-summary-cards based on flag
  const cardsIndex = processed.indexOf('six-summary-cards');
  const simpleBodyIndex = processed.indexOf('simple-body');
  
  if (useSummaryCards) {
    if (cardsIndex === -1 && simpleBodyIndex !== -1) {
      // Insert after simple-body
      processed.splice(simpleBodyIndex + 1, 0, 'six-summary-cards');
      console.log('✓ Inserted six-summary-cards after simple-body');
    } else if (cardsIndex !== -1 && simpleBodyIndex !== -1 && cardsIndex !== simpleBodyIndex + 1) {
      // Move to correct position
      processed.splice(cardsIndex, 1);
      const newSimpleBodyIndex = processed.indexOf('simple-body');
      processed.splice(newSimpleBodyIndex + 1, 0, 'six-summary-cards');
      console.log('✓ Moved six-summary-cards after simple-body');
    }
  } else if (cardsIndex !== -1) {
    // Remove if present but not wanted
    processed.splice(cardsIndex, 1);
    console.log('✓ Removed six-summary-cards from sequence');
  }
  
  return processed;
}

