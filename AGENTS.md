# Vunked Email Agent - AI Agent Instructions

## Project Overview
This is a file repository for Vunked email generation. The AI agent reads brand guidelines, selects sections, and generates HTML emails from blog/informational text.

## Architecture
- **Modular Sections**: Emails are built from reusable HTML sections in `/sections/`
- **Agent Assembly**: The `agents/write.js` script assembles sections into complete emails
- **No Direct Template Editing**: Sections are combined dynamically - never edit individual sections unless updating globally

## Key Files
- `brand-guidelines.md` - **ALWAYS read this before generating emails**. Contains all brand colors, typography, voice, mission, and contact information.
- `sections/` - Modular HTML email components (hero, footer, body, etc.)
- `sections/email-wrapper-start.html` - Email DOCTYPE, head, styles, and opening body/container
- `sections/email-wrapper-end.html` - Closing tags for email HTML
- `agents/write.js` - Assembles sections into complete email HTML
- `content/` - Contains blog text files to be converted to emails

## Brand Guidelines (Critical)
ALWAYS consult `brand-guidelines.md` before generating any email. Key brand elements:

### Colors
- Primary: Burnt Orange (#E76F51), Navy Blue (#264653), White (#FFFFFF)
- Accent: Blue lighter (#366476), Blue lightest (#468299)
- **Background**: #F7F7F7 (set in `sections/email-wrapper-start.html`)

### Typography
- Font: Montserrat (Arial fallback)
- H1: 36px, H2: 28px, Body: 16px
- **IMPORTANT**: For Klaviyo compatibility, DO NOT use Google Fonts API (`<link>` or `@import`)
- Simply declare the font in CSS: `font-family: 'Montserrat', Arial, sans-serif;`
- Klaviyo and modern email clients recognize Montserrat without external imports
- Fallback to Arial works automatically in clients that don't support Montserrat

### Brand Voice
- Friendly, knowledgeable, and approachable
- Helpful and patient
- Focus on educating and empowering customers
- Tone: "We're here to make your campervan electrics stress-free. Let's build something amazing together!"

### Contact
- Email: hello@vunked.co.uk

## CRITICAL RULE: Sections vs Templates
**The agent system uses SECTIONS, not templates:**
- Individual HTML components live in `/sections/` directory
- These are assembled by `agents/write.js` into complete emails
- To change global email settings (background color, fonts, meta tags), edit `sections/email-wrapper-start.html`
- `/templates/` directory is separate (Klaviyo templates) - not used by agent system

## Email Generation Process
When generating an email:

1. **Read brand guidelines** - Always reference `brand-guidelines.md` first
2. **Read blog text** - Read the specified file from `content/` directory (if provided)
3. **Select sections** - Choose appropriate sections based on content (hero, body, footer, etc.)
4. **Parse content** - Split into intro, body, conclusion sections (if blog text provided)
5. **Extract title** - Create or extract appropriate heading
6. **Apply brand voice** - Ensure content matches Vunked's friendly, knowledgeable tone
7. **Generate CTA** - Suggest appropriate call-to-action if relevant
8. **Populate sections** - Replace placeholders in sections: `{{title}}`, `{{intro}}`, `{{body}}`, `{{conclusion}}`, `{{cta_text}}`
9. **Output HTML** - Agent assembles sections into complete HTML email ready for Klaviyo

## Section Placeholders
Sections may use these placeholders that must be replaced:
- `{{title}}` - Email heading/title
- `{{intro}}` - Introduction section (first 1-2 paragraphs)
- `{{body}}` - Main body content (middle sections)
- `{{conclusion}}` - Conclusion section (final paragraph)
- `{{cta_text}}` - Call-to-action button text (can be empty if not needed)

## Content Parsing Guidelines
- **Intro**: First 1-2 paragraphs or up to ~200 words
- **Body**: Middle sections with main content
- **Conclusion**: Final paragraph(s) or last ~150 words
- Handle edge cases (short content, single paragraph)

## Email HTML Best Practices
- Use inline CSS only (no external stylesheets)
- Table-based layouts for email client compatibility
- **Font Declaration**: Use `font-family: 'Montserrat', Arial, sans-serif;` directly in CSS
  - **DO NOT** use `<link>` tags to Google Fonts
  - **DO NOT** use `@import` for Google Fonts
  - Klaviyo and email clients handle font rendering without external imports
- Ensure Klaviyo-compatible HTML structure
- Maintain brand colors and typography throughout
- Keep friendly, empowering tone in all content

## Global Email Settings
To change global email appearance:
- **Background color**: Edit `sections/email-wrapper-start.html` (currently #F7F7F7)
- **Fonts & styles**: Edit `<style>` block in `sections/email-wrapper-start.html`
- **Meta tags**: Edit `<head>` section in `sections/email-wrapper-start.html`

## Mobile Responsiveness
Sections include media queries for mobile optimization:
- Use `.mobile-stack-*` classes for vertical stacking on mobile
- Use `.mobile-center-*` classes for centering content on mobile
- Target: `@media only screen and (max-width: 480px)`

## Output
Generated emails are saved to `output/` directory with descriptive filenames, or provided directly in the conversation for copy/paste into Klaviyo.

