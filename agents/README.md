# Vunked Email Agent (CLI)

AI-powered email generation from blog content using OpenAI.

## Setup

1. Install dependencies:
```bash
cd agents
npm install
```

2. Configure API key (choose one option):

**Option A: Use global variable (recommended if already set)**
```bash
# If OPEN_API_KEY_CURSOR is already in your shell environment, you're done!
# Just run the CLI and it will pick it up automatically
```

**Option B: Create .env file**
```bash
cp .env.example .env
# Edit .env and add:
OPENAI_API_KEY=sk-...
```

## Usage

### Generate from Blog URL
```bash
node index.js --url "https://example.com/blog-post"
```

### Generate from Text
```bash
node index.js --text "Your blog content here..."
```

### Generate from Prompt
```bash
node index.js --prompt "make a black friday email"
```

## Options

- `--url <url>` - Fetch content from URL
- `--text <text>` - Use provided text content
- `--prompt <prompt>` - Generate from prompt
- `--sections <path>` - Path to sections directory (default: `sections`)
- `--out <path>` - Output directory (default: `output`)
- `--modelPlan <model>` - Model for planning step (default: `gpt-5`)
- `--modelWrite <model>` - Model for writing step (default: `gpt-4.1-nano`)

## How It Works

### 1. RETRIEVE
- Fetches blog content from URL or accepts text/prompt input
- Uses Mozilla Readability to extract clean article content
- Strips navigation, ads, and other non-content elements

### 2. PLAN
- Uses the OpenAI **Responses** API with the `gpt-5` model (required – do not switch back to Chat Completions)
- Creates structured JSON plan based on:
  - Blog content
  - Brand guidelines (`brand-guidelines.md`)
  - Available email sections
- Outputs: subject, preview, section sequence, content slots

### 3. WRITE + ASSEMBLE
- Uses OpenAI Responses API–friendly models (default `gpt-4.1-nano`) for any dynamic copy generation
- Processes dynamic sections (hero, simple-body)
- Leaves static sections unchanged (contact, signature, footer, book-a-call)
- Assembles complete HTML email
- Generates plain-text version

## Output

Generated files are saved to the `output/` directory:
- `{slug}-{timestamp}.html` - HTML email
- `{slug}-{timestamp}.txt` - Plain-text version

## Section Templates

The tool uses HTML section templates from `../sections/`:
- `hero.html` - Hero section with title/subtitle (dynamic)
- `simple-body.html` - Body content (dynamic)
- `book-a-call.html` - Call booking CTA (static)
- `contact.html` - Contact information (static)
- `signature.html` - Email signature (static)
- `footer.html` - Footer with branding (static)

Dynamic sections are modified with AI-generated content while preserving HTML structure and styling. Static sections are used as-is.

## Environment Variables

```bash
# API Key (use one of these)
OPEN_API_KEY_CURSOR=your_api_key_here  # Preferred, matches your global variable
OPENAI_API_KEY=your_api_key_here       # Alternative

# Model Configuration (Optional)
MODEL_PLAN=gpt-5                       # Default model for planning (Responses API only)
MODEL_WRITE=gpt-4.1-nano               # Default model for writing

# Debugging (Optional)
DEBUG=1                                # Show full error stack traces
```

**Note:** The tool checks for `OPEN_API_KEY_CURSOR` first, then falls back to `OPENAI_API_KEY`.

## Error Handling

- If specified models are unavailable, automatically falls back to `gpt-4o-mini`
- Invalid sections in plan are filtered out with warnings
- Failed URL fetches provide clear error messages
- JSON schema validation ensures proper plan structure

## Examples

```bash
# Generate from Vunked blog post
node index.js --url "https://vunked.com/blog/battery-sizing-guide"

# Generate Black Friday campaign
node index.js --prompt "Create a Black Friday email promoting 20% off all campervan electrical kits"

# Custom output directory
node index.js --url "https://..." --out ../campaigns/2024

# Use specific models
node index.js --prompt "..." --modelPlan gpt-4o --modelWrite gpt-4o-mini
```

