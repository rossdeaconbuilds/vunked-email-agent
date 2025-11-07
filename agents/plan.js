import OpenAI from 'openai';
import { validatePlan } from './utils.js';

/**
 * Create email plan using OpenAI Responses API
 * @param {Object} blogData - Blog content with title and text
 * @param {string} brandGuidelines - Brand guidelines markdown content
 * @param {string[]} availableSections - List of available section names
 * @param {string} model - Model to use (default: o3-mini)
 * @param {string} sourceUrl - Original blog URL if available
 * @returns {Promise<Object>} Plan object with subject, preview, sequence, and slots
 */
export async function createPlan(blogData, brandGuidelines, availableSections, model = 'o3-mini-2025-01-31', sourceUrl = null) {
  const apiKey = process.env.OPEN_API_KEY_CURSOR || process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    throw new Error('OPEN_API_KEY_CURSOR or OPENAI_API_KEY environment variable is not set');
  }
  
  const openai = new OpenAI({ apiKey });
  
  // Build the prompt
  const prompt = buildPlanPrompt(blogData, brandGuidelines, availableSections, sourceUrl);
  
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
      sequence: {
        type: "array",
        items: { type: "string" },
        description: "Ordered list of section names to include in email"
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
    required: ["subject", "preview", "sequence", "slots"],
    additionalProperties: false
  };
  
  try {
    console.log(`Calling OpenAI Responses API with model: ${model}`);
    
    // Call OpenAI API with response format
    const completion = await openai.chat.completions.create({
      model: model,
      messages: [
        {
          role: "system",
          content: "You are an expert email marketing strategist. Generate structured email plans in JSON format based on blog content and brand guidelines."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "email_plan",
          strict: true,
          schema: schema
        }
      },
      temperature: 0.7
    });
    
    const responseText = completion.choices[0].message.content;
    const plan = JSON.parse(responseText);

    // Normalize slot keys to match section filenames
    const slotKeyMap = {
      hero: 'hero',
      simple_body: 'simple-body',
      book_a_call: 'book-a-call',
      footer: 'footer',
      contact: 'contact',
      signature: 'signature',
      six_summary_cards: 'six-summary-cards'
    };

    if (plan.sequence) {
      plan.sequence = plan.sequence.map(section => slotKeyMap[section] || section);
    }

    if (plan.slots) {
      const normalizedSlots = {};
      for (const [key, value] of Object.entries(plan.slots)) {
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

      plan.slots = normalizedSlots;
    } else {
      plan.slots = {
        hero: { title: '', subtitle: '', cta_text: '', cta_url: '' },
        'simple-body': [],
        'six-summary-cards': [],
        'book-a-call': {},
        footer: {},
        contact: {},
        signature: {}
      };
    }
    
    // Validate the plan
    const validation = validatePlan(plan);
    if (!validation.valid) {
      throw new Error(`Invalid plan structure: ${validation.errors.join(', ')}`);
    }
    
    // Ensure sequence only uses available sections
    const invalidSections = plan.sequence.filter(s => !availableSections.includes(s));
    if (invalidSections.length > 0) {
      console.warn(`Warning: Plan includes unavailable sections: ${invalidSections.join(', ')}`);
      plan.sequence = plan.sequence.filter(s => availableSections.includes(s));
    }
    
    // Ensure six-summary-cards placement based on content
    const cards = plan.slots['six-summary-cards'];
    const hasCards = Array.isArray(cards) && cards.length > 0;
    const simpleBodyIndex = plan.sequence.indexOf('simple-body');
    const cardsIndex = plan.sequence.indexOf('six-summary-cards');

    if (hasCards) {
      if (cardsIndex === -1 && simpleBodyIndex !== -1) {
        // Insert cards immediately after simple-body
        plan.sequence.splice(simpleBodyIndex + 1, 0, 'six-summary-cards');
        console.log('✓ Inserted six-summary-cards after simple-body');
      } else if (cardsIndex !== -1 && simpleBodyIndex !== -1 && cardsIndex !== simpleBodyIndex + 1) {
        // Move to correct position
        plan.sequence.splice(cardsIndex, 1);
        plan.sequence.splice(simpleBodyIndex + 1, 0, 'six-summary-cards');
        console.log('✓ Moved six-summary-cards after simple-body');
      }
    } else if (cardsIndex !== -1) {
      // Remove section if no cards provided
      plan.sequence.splice(cardsIndex, 1);
      plan.slots['six-summary-cards'] = [];
      console.log('✓ Removed six-summary-cards from sequence (no cards provided)');
    }

    // Ensure signature is always included before footer
    const hasSignature = plan.sequence.includes('signature');
    const hasFooter = plan.sequence.includes('footer');
    const footerIndex = plan.sequence.indexOf('footer');
    
    if (!hasSignature && hasFooter) {
      // Add signature before footer if missing
      plan.sequence.splice(footerIndex, 0, 'signature');
      if (!plan.slots.signature) {
        plan.slots.signature = {};
      }
      console.log('✓ Added signature section before footer');
    } else if (hasSignature && hasFooter) {
      // Ensure signature comes before footer
      const signatureIndex = plan.sequence.indexOf('signature');
      if (signatureIndex > footerIndex) {
        // Move signature before footer
        plan.sequence.splice(signatureIndex, 1);
        plan.sequence.splice(footerIndex, 0, 'signature');
        console.log('✓ Moved signature section before footer');
      }
    }
    
    console.log('✓ Email plan generated successfully');
    console.log(`  Subject: ${plan.subject}`);
    console.log(`  Sections: ${plan.sequence.join(' → ')}`);
    
    return plan;
    
  } catch (error) {
    if (error.message.includes('model') || error.message.includes('does not exist')) {
      console.warn(`Model ${model} not available, falling back to gpt-4o-mini`);
      return createPlan(blogData, brandGuidelines, availableSections, 'gpt-4o-mini', sourceUrl);
    }
    throw new Error(`Failed to create plan: ${error.message}`);
  }
}

/**
 * Build the prompt for plan generation
 */
function buildPlanPrompt(blogData, brandGuidelines, availableSections, sourceUrl = null) {
  const urlContext = sourceUrl ? `\n**Source URL:** ${sourceUrl}` : '';
  const ctaGuidance = sourceUrl 
    ? `- Use source URL (${sourceUrl}) for the hero CTA if promoting the blog post`
    : `- Use https://builder.vunked.com for product/system emails, or https://vunked.com/ for general promotional emails`;
  
  return `
# Task: Generate Email Plan

You are creating a structured plan for an HTML email based on the provided blog content.

## Blog Content
**Title:** ${blogData.blog_title}${urlContext}

**Content:**
${blogData.blog_text.substring(0, 3000)}${blogData.blog_text.length > 3000 ? '...' : ''}

## Brand Guidelines
${brandGuidelines.substring(0, 2000)}

## Available Email Sections
${availableSections.map(s => `- ${s}`).join('\n')}

### Section Types:
- **hero**: Dynamic hero section with title, subtitle, and CTA button
- **simple-body**: Dynamic body content (H3 headings + paragraphs)
- **six-summary-cards**: Optional visual grid showcasing 6 key points/topics (USE ONLY for educational/blog content)
- **book-a-call**, **contact**, **signature**, **footer**: Static sections (use as-is)

### Slots Object Schema
Use the following property names inside the slots object (note the underscores):
- hero → content for the hero section with title, subtitle, cta_text, and cta_url
- simple_body → array of body blocks (maps to simple-body)
- book_a_call → static CTA section (leave {} if unused)
- footer → static footer info (leave {} if unused)
- contact → static contact block (leave {} if unused)
- signature → static signature (leave {} if unused)
- six_summary_cards → optional visual grid with 6 key topics/cards from blog content (array of 6 objects with title and description)

The sequence array should list actual section filenames (e.g., hero, simple-body, book-a-call, footer, etc.).

**Decision Guide for six-summary-cards:**
- Blog post about campervan electrics? → INCLUDE six-summary-cards
- Educational guide or tutorial? → INCLUDE six-summary-cards  
- Black Friday sale or discount? → SKIP six-summary-cards (set six_summary_cards to [])
- Product announcement? → SKIP six-summary-cards (set six_summary_cards to [])

### CTA Button Guidelines
${ctaGuidance}
- CTA text should be action-oriented and 3-5 words (e.g., "Read Full Guide", "Build Your System", "Shop Now")

## Instructions:
1. Create a compelling email subject line (40-60 chars)
2. Write preview text (90-140 chars)
3. Choose sections from the available list in logical order
4. For dynamic sections (hero, simple-body, six-summary-cards):
   - **hero**: Write a catchy title (will be H1, 36px), engaging subtitle (14px body text), CTA button text (3-5 words), and appropriate CTA URL
   - **simple-body**: Create 2-4 HTML blocks with H3 headings (21px) and body paragraphs (14px). Use this format for each block:
     <h3 style="line-height: 120%; margin: 0 0 12px 0; font-size: 21px;"><span style="font-weight: bold; font-family: Montserrat, Tahoma, Verdana, Segoe, sans-serif;">Your Heading</span></h3>
     <p style="line-height: 120%; margin: 0 0 14px 0;"><span style="font-family: Montserrat, Tahoma, Verdana, Segoe, sans-serif; font-size: 14px;">Your paragraph text here.</span></p>
   - **six-summary-cards**: Extract 6 key topics/takeaways from the blog. Each card needs:
     * title: Short catchy title (3-6 words)
     * description: Brief description (15-25 words)
     * emoji: Relevant emoji icon (⚡, 🔋, 🔧, ☀️, ⚙️, ❄️, etc.)
5. **six-summary-cards usage decision**:
   - INCLUDE if: Email is promoting educational content, blog posts, guides, tutorials, or detailed technical information
   - SKIP if: Email is promotional (sales, discounts), transactional, or simple announcements
   - Position: ALWAYS after simple-body, before book-a-call
   - Content: Extract 6 key topics/takeaways from the blog content to populate the cards
6. Static sections (book-a-call, contact, signature, footer) should return empty objects {} unless specific copy is provided. If six-summary-cards is NOT used, return an empty array [].
7. **IMPORTANT**: Always include 'signature' in the sequence, positioned BEFORE 'footer'
8. Match Vunked's brand voice: friendly, knowledgeable, empowering
9. Use brand colors in your planning: Burnt Orange (#E76F51), Navy Blue (#264653)

Generate the email plan as valid JSON matching the schema.
`.trim();
}

