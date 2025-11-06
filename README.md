# Vunked Email Agent

A simple file repository for storing brand guidelines, email templates, and blog content. The AI will access these files and generate HTML emails on demand through conversation.

## Project Structure

```
vunked-email-agent/
├── brand-guidelines.md          # Vunked brand guidelines
├── templates/
│   ├── simple.html              # Simple email template
│   └── newsletter.html          # Newsletter email template
├── content/
│   └── blog-text.txt            # Input blog/informational text (add your files here)
└── output/                      # Generated HTML emails (optional)
```

## Files

### Brand Guidelines (`brand-guidelines.md`)
Contains all Vunked brand information including:
- Colors: Burnt Orange (#E76F51), Navy Blue (#264653), White (#FFFFFF), Accent Blues (#366476, #468299)
- Typography: Montserrat font (Arial fallback), size hierarchy
- Brand voice and tone guidelines
- Mission, vision, and target audience information
- Contact information: hello@vunked.co.uk

### Email Templates (`templates/`)

#### `simple.html`
A clean, single-column email template with:
- Header with logo placeholder
- Title section
- Intro, body, and conclusion sections
- Optional CTA button
- Footer with contact information

#### `newsletter.html`
A newsletter-style template with:
- Gradient hero section
- Visual hierarchy with dividers
- Highlight box for conclusion
- Enhanced styling and spacing
- Footer with brand messaging

Both templates use placeholders:
- `{{title}}` - Email title/heading
- `{{intro}}` - Introduction section
- `{{body}}` - Main body content
- `{{conclusion}}` - Conclusion section
- `{{cta_text}}` - Call-to-action button text (optional)

### Content Directory (`content/`)
Place your blog text or informational text files here. Files can be named as needed (e.g., `blog-text.txt`, `blog-post-1.txt`).

## Usage Workflow

1. **Store Files**: Place brand guidelines, templates, and blog text in the repository
2. **Request Email**: Ask the AI to generate an email from specific blog text
3. **AI Processing**: The AI will:
   - Read brand guidelines from `brand-guidelines.md`
   - Read the specified blog text file from `content/`
   - Select an appropriate template (`simple.html` or `newsletter.html`)
   - Analyze content and parse into intro, body, conclusion sections
   - Apply Vunked brand voice and styling
   - Generate HTML email by populating the template
4. **Output**: The AI will provide the generated HTML email (can save to `output/` if requested)

## Example Usage

When you want to generate an email, simply ask:

"Generate an email from the blog text in `content/blog-post.txt` using the simple template"

Or:

"Create an email from `content/my-article.txt` - you choose the best template"

The AI will read the files, analyze the content, and generate a branded HTML email ready for Klaviyo.

## Notes

- This is a file repository, not a CLI application
- All email generation happens through conversation with the AI
- Templates use inline CSS for email client compatibility
- Templates are designed for Klaviyo compatibility
- Brand colors and typography are applied consistently across templates

