import OpenAI from 'openai';
import { validatePlan, LINK_DIRECTORY, resolveLink } from './utils.js';

/**
 * Generate email copy (subject, preview, and all slot content)
 * @param {Object} structure - Structure object from structure agent
 * @param {Object} blogData - Blog content with title and text
 * @param {string} brandGuidelines - Brand guidelines markdown content
 * @param {string} model - Model to use (default: gpt-5)
 * @param {string} sourceUrl - Original blog URL if available
 * @returns {Promise<Object>} Complete plan with subject, preview, sequence, and slots
 */
export async function generateCopy(structure, blogData, brandGuidelines, model = 'gpt-4.1', sourceUrl = null) {
  const apiKey = process.env.OPEN_API_KEY_CURSOR || process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    throw new Error('OPEN_API_KEY_CURSOR or OPENAI_API_KEY environment variable is not set');
  }
  
  const openai = new OpenAI({
    apiKey,
    timeout: 180_000,
    maxRetries: 1
  });
  
  // Build the prompt
  const prompt = buildCopyPrompt(structure, blogData, brandGuidelines, sourceUrl);
  
  // Define the JSON schema for the response
  const schema = {
    type: "object",
    properties: {
      subject: {
        type: "string",
        description: "Email subject line"
      },
      preview: {
        type: "string",
        description: "Email preview text"
      },
      slots: {
        type: "object",
        description: "Content for each section",
        properties: {
          hero: {
            type: "object",
            properties: {
              title: { type: "string" },
              subtitle: { type: "string" },
              cta_text: { type: "string" },
              cta_url: { type: "string" }
            },
            required: ["title", "subtitle", "cta_text", "cta_url"],
            additionalProperties: false
          },
          simple_body: {
            type: "array",
            items: {
              type: "object",
              properties: {
                html: { type: "string" }
              },
              required: ["html"],
              additionalProperties: false
            }
          },
          book_a_call: { 
            type: "object",
            properties: {},
            required: [],
            additionalProperties: false
          },
          footer: { 
            type: "object",
            properties: {},
            required: [],
            additionalProperties: false
          },
          contact: { 
            type: "object",
            properties: {},
            required: [],
            additionalProperties: false
          },
          signature: { 
            type: "object",
            properties: {},
            required: [],
            additionalProperties: false
          },
          six_summary_cards: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                description: { type: "string" },
                emoji: { type: "string" }
              },
              required: ["title", "description", "emoji"],
              additionalProperties: false
            }
          }
        },
        required: ["hero", "simple_body", "book_a_call", "footer", "contact", "signature", "six_summary_cards"],
        additionalProperties: false
      }
    },
    required: ["subject", "preview", "slots"],
    additionalProperties: false
  };
  
  const systemPrompt = "You are an expert email copywriter. Generate compelling subject lines, preview text, and email content based on blog material and brand guidelines.";

  console.log(`Calling OpenAI Responses API for copy with model: ${model}`);
  console.log(`  Prompt length: ${prompt.length} characters`);

  const timerLabel = `copy:openai_request (${model})`;
  console.time(timerLabel);
  
  try {
    const completion = await openai.responses.create({
      model: model,
      input: `${systemPrompt}\n\n${prompt}`,
      text: {
        format: {
          name: "email_copy",
          type: "json_schema",
          schema: schema,
          strict: true
        }
      },
      max_output_tokens: 8000
    });
    
    console.timeEnd(timerLabel);
    
    // Check for truncation
    if (completion.usage && completion.usage.completion_tokens >= 7900) {
      console.warn('⚠️  Warning: Response may be truncated (near token limit)');
    }
    
    // Extract response text
    const responseText = extractResponseText(completion);
    if (!responseText) {
      console.log('Extraction failed. Full response:', JSON.stringify(completion, null, 2).substring(0, 1000));
      throw new Error('Empty response from copy model');
    }
    
    // Check if response looks truncated
    const trimmed = responseText.trim();
    if (!trimmed.endsWith('}')) {
      console.error('⚠️  Response appears truncated (does not end with }):');
      console.error('Last 200 chars:', trimmed.substring(trimmed.length - 200));
      throw new Error('Response was truncated - increase max_output_tokens or reduce content');
    }

    // Log raw response for debugging
    if (process.env.DEBUG) {
      console.log('Raw response text:', responseText.substring(0, 500));
    }

    let copyData;
    try {
      copyData = JSON.parse(responseText);
    } catch (parseError) {
      console.error('JSON Parse Error:', parseError.message);
      console.error('Response text around error position:');
      const errorPos = parseInt(parseError.message.match(/position (\d+)/)?.[1] || '0');
      console.error(responseText.substring(Math.max(0, errorPos - 100), Math.min(responseText.length, errorPos + 100)));
      throw new Error(`Failed to parse copy response: ${parseError.message}`);
    }

    // Build complete plan object
    const plan = {
      subject: copyData.subject,
      preview: copyData.preview,
      sequence: structure.sequence,
      slots: normalizeSlots(copyData.slots)
    };

    // Enforce approved links for hero CTA
    const allowedLinks = new Set(Object.values(LINK_DIRECTORY));
    const heroSlot = plan.slots.hero || {};
    if (!allowedLinks.has(heroSlot.cta_url)) {
      const fallbackLink = selectDefaultCtaLink(structure);
      console.warn(`⚠️  Hero CTA URL "${heroSlot.cta_url}" is not approved. Using fallback: ${fallbackLink}`);
      plan.slots.hero = {
        ...heroSlot,
        cta_url: fallbackLink
      };
    }
    
    // Validate the plan
    const validation = validatePlan(plan);
    if (!validation.valid) {
      throw new Error(`Invalid plan structure: ${validation.errors.join(', ')}`);
    }
    
    console.log('✓ Email copy generated successfully');
    console.log(`  Subject: ${plan.subject}`);
    console.log(`  Preview: ${plan.preview}`);
    console.log(`  Hero title: ${plan.slots.hero?.title || 'N/A'}`);
    console.log(`  Body blocks: ${plan.slots['simple-body']?.length || 0}`);
    console.log(`  Summary cards: ${plan.slots['six-summary-cards']?.length || 0}`);
    
    return plan;
  } catch (error) {
    try {
      console.timeEnd(timerLabel);
    } catch (_) {
      // ignore timer errors
    }
    throw new Error(`Failed to generate copy: ${error.message}`);
  }
}

/**
 * Build the prompt for copy generation
 */
function buildCopyPrompt(structure, blogData, brandGuidelines, sourceUrl = null) {
  const urlContext = sourceUrl ? `\n**Source URL:** ${sourceUrl}` : '';
  const approvedLinksList = Object.entries(LINK_DIRECTORY)
    .map(([key, url]) => `- ${key.replace(/_/g, ' ')} → ${url}`)
    .join('\n');
  const ctaGuidance = [
    `- For build/system CTAs use ${LINK_DIRECTORY.builder}`,
    `- For consultation CTAs use ${LINK_DIRECTORY.book_call}`,
    `- For general brand awareness use ${LINK_DIRECTORY.homepage}`,
    `- For educational/blog content use ${LINK_DIRECTORY.blog}`
  ].join('\n');
  
  const sectionsInEmail = structure.sequence.join(', ');
  const needsSummaryCards = structure.sequence.includes('six-summary-cards');
  
  return `
# Task: Write Email Copy

You are writing all the copy for an HTML email based on blog content. The structure has already been decided.

## Blog Content
**Title:** ${blogData.blog_title}${urlContext}

**Content:**
${blogData.blog_text.substring(0, 3500)}${blogData.blog_text.length > 3500 ? '...' : ''}

## Brand Guidelines
${brandGuidelines.substring(0, 2500)}

## Approved Links (use only these exact URLs)
${approvedLinksList}

## Email Structure (Already Decided)
**Goal:** ${structure.email_goal}
**Sections to include:** ${sectionsInEmail}
**Reasoning:** ${structure.reasoning}

## Your Task
Write compelling copy for this email:

1. **Subject line** (40-60 characters, attention-grabbing)
2. **Preview text** (90-140 characters, complements subject)
3. **Hero section:**
   - title: Catchy H1 heading (5-10 words, will be displayed at 36px)
   - subtitle: Engaging supporting text (20-35 words, 14px body text)
   - cta_text: Action button text (3-5 words, e.g. "Read Full Guide")
   - cta_url: Must be one of the approved links above (no other URLs). Guidance:
${ctaGuidance}

4. **Simple-body blocks** (2-3 HTML blocks recommended):
   - Each block should have an H3 heading and 1-2 short paragraphs
   - Use this exact format for each block:
   
   \`\`\`
   <h3 style="line-height: 120%; margin: 0 0 12px 0; font-size: 21px;"><span style="font-weight: bold; font-family: Montserrat, Tahoma, Verdana, Segoe, sans-serif;">Your Heading Here</span></h3>
   <p style="line-height: 120%; margin: 0 0 14px 0;"><span style="font-family: Montserrat, Tahoma, Verdana, Segoe, sans-serif; font-size: 14px;">Your paragraph text here. Keep it concise - 2-4 sentences max.</span></p>
   \`\`\`
   
   - Keep it CONCISE - emails should be scannable
   - Each paragraph: 2-4 sentences maximum
   - Use Vunked's friendly, knowledgeable tone
   - Focus on key takeaways, not exhaustive detail

${needsSummaryCards ? `
5. **Six-summary-cards** (6 cards required):
   - Extract 6 key topics/takeaways from the blog content
   - Each card needs:
     * title: Short catchy title (3-6 words)
     * description: Brief description (15-25 words)
     * emoji: Relevant emoji (⚡, 🔋, 🔧, ☀️, ⚙️, ❄️, 💡, 🚐, 🔌, ⚠️, etc.)
` : `
5. **Six-summary-cards**: Return empty array [] (not needed for this email)
`}

6. **Static sections** (book-a-call, contact, signature, footer): Return empty objects {}

7. **Links in body copy**: Only include anchor tags if absolutely needed, and only with the approved URLs above. Never introduce new URLs.

## Brand Voice Guidelines
- Friendly, knowledgeable, and approachable
- Helpful and patient
- Focus on educating and empowering customers
- Tone: "We're here to make your campervan electrics stress-free"

## Brand Colors (for reference)
- Primary: Burnt Orange (#E76F51), Navy Blue (#264653)
- Keep tone positive and supportive

Generate the email copy as valid JSON matching the schema.
`.trim();
}

/**
 * Normalize slot keys to match section filenames
 */
function normalizeSlots(slots) {
  const slotKeyMap = {
    hero: 'hero',
    simple_body: 'simple-body',
    book_a_call: 'book-a-call',
    footer: 'footer',
    contact: 'contact',
    signature: 'signature',
    six_summary_cards: 'six-summary-cards'
  };

  const normalizedSlots = {};
  for (const [key, value] of Object.entries(slots)) {
    const normalizedKey = slotKeyMap[key] || key;
    normalizedSlots[normalizedKey] = value;
  }

  // Ensure optional static slots exist with defaults
  const defaultSlots = {
    hero: { title: '', subtitle: '', cta_text: '', cta_url: '' },
    'simple-body': [],
    'six-summary-cards': [],
    'book-a-call': {},
    footer: {},
    contact: {},
    signature: {}
  };

  for (const [slotKey, defaultValue] of Object.entries(defaultSlots)) {
    if (!(slotKey in normalizedSlots)) {
      normalizedSlots[slotKey] = Array.isArray(defaultValue)
        ? []
        : { ...defaultValue };
    }
  }

  return normalizedSlots;
}

/**
 * Extract response text from various OpenAI response formats
 */
function extractResponseText(response) {
  if (!response) {
    return '';
  }

  // Check for direct output_text field
  if (typeof response.output_text === 'string' && response.output_text.trim().length > 0) {
    return response.output_text;
  }

  // Check for text field
  if (typeof response.text === 'string' && response.text.trim().length > 0) {
    return response.text;
  }

  // Check for output array with content blocks
  if (Array.isArray(response.output)) {
    const parts = [];
    for (const item of response.output) {
      if (typeof item.text === 'string') {
        parts.push(item.text);
        continue;
      }
      
      if (Array.isArray(item.content)) {
        for (const content of item.content) {
          if (typeof content.text === 'string') {
            parts.push(content.text);
          }
        }
      }
    }
    if (parts.length > 0) {
      return parts.join('');
    }
  }

  // Check for choices array (fallback for chat-style responses)
  if (Array.isArray(response.choices) && response.choices.length > 0) {
    const firstChoice = response.choices[0];
    if (firstChoice.message && typeof firstChoice.message.content === 'string') {
      return firstChoice.message.content;
    }
  }

  return '';
}

function selectDefaultCtaLink(structure) {
  const sequence = Array.isArray(structure?.sequence) ? structure.sequence : [];
  const goal = typeof structure?.email_goal === 'string' ? structure.email_goal.toLowerCase() : '';

  if (sequence.includes('book-a-call') || goal.includes('consult')) {
    return resolveLink('book_call');
  }

  if (
    sequence.includes('selling-points-what-you-get') ||
    goal.includes('product') ||
    goal.includes('promo') ||
    goal.includes('sale')
  ) {
    return resolveLink('builder');
  }

  if (goal.includes('educat') || goal.includes('guide') || goal.includes('blog')) {
    return resolveLink('blog');
  }

  return resolveLink('homepage');
}

