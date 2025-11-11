# Vunked Email Agent

The Vunked Email Agent is now a runnable AI-powered pipeline that assembles fully branded HTML emails end-to-end. Instead of relying on a conversational assistant to stitch content together, the repository houses a Node.js project that drives multiple specialised agents to read brand materials, plan an email, generate the copy, and output Klaviyo-ready HTML.

## High-Level Flow

```
retrieve content → decide structure → generate copy → assemble HTML → save output
```

Each step is handled by a dedicated agent and the entire process can be executed locally from the command line.

## Requirements

- Node.js 18+
- `npm install` (only required once; dependencies are stored in `package.json`)
- OpenAI-compatible API key exported as `OPEN_AI_KEY_CURSOR` or `OPENAI_API_KEY`

## Key Directories

```
vunked-email-agent/
├── agents/                    # Orchestration and specialised agents
│   ├── index.js               # CLI entry point (retrieve → structure → copy → assemble)
│   ├── retrieve.js            # Fetch blog content or accept raw text/prompt
│   ├── structure.js           # Chooses which sections to use and orders them
│   ├── copy.js                # Writes subject, preview, hero, body blocks, etc.
│   ├── write.js               # Injects copy into HTML sections and assembles final markup
│   └── utils.js               # Shared helpers (file IO, link directory, validation)
├── brand-guidelines.md        # Authoritative source of brand voice, colours, typography
├── sections/                  # Modular HTML snippets (hero, body, CTA, footer, etc.)
├── content/                   # Blog posts or prompts to convert into campaigns
├── output/                    # Generated HTML + plain text versions
└── saved_emails/              # Reference campaigns produced by the agent
```

> **Note:** Templates in `templates/` are legacy and not used by the current pipeline. The agent works exclusively with modular sections under `sections/`.

## Agents Overview

### 1. Retrieve (`agents/retrieve.js`)
- Normalises the input: URL, raw text, or prompt.
- Returns canonical `blogData` with `blog_title` and `blog_text`.

### 2. Structure (`agents/structure.js`)
- Calls the OpenAI Responses API (default `gpt-4o-mini`).
- Chooses the section sequence and documents the email goal.
- Decides on optional blocks such as `six-summary-cards`.

### 3. Copy (`agents/copy.js`)
- Calls OpenAI (default `gpt-4.1`) with the structure, blog data, brand guidelines, and a whitelist of approved URLs.
- Produces:
  - Subject line & preview text
  - Hero title/subtitle/CTA
  - HTML fragments for body sections
  - Optional summary cards
- Enforces link safety by replacing non-whitelisted URLs with appropriate defaults (`builder.vunked.com`, `cal.com/vunked/free-campervan-electrics-consultation-email`, `www.vunked.com`, `vunked.com/blog`).

### 4. Write & Assemble (`agents/write.js`)
- Loads the HTML snippets from `sections/`.
- Injects the generated copy into each section using `JSDOM`.
- Wraps everything with the global email wrapper start/end.
- Produces both HTML and plaintext versions ready for Klaviyo.

## Running the Agent

From the repository root:

```bash
cd agents
node index.js --url "https://example.com/blog-post"
```

Other options:

- `--text "Raw blog text..."` – supply content directly.
- `--prompt "Create a Black Friday teaser"` – let the retrieve agent expand the prompt.
- `--sections ./sections-custom` – point at an alternate sections directory.
- `--out ./output` – override the output directory.
- `--modelStructure`, `--modelCopy`, `--modelWrite` – override default models per stage.

Generated files land in `output/` as:

```
<slug>-<timestamp>.html   # Full HTML email
<slug>-<timestamp>.txt    # Plaintext companion
```

The slug is derived from the final subject line.

## Approved Link Directory

All CTAs and anchored links are restricted to the whitelist defined in `agents/utils.js`:

- Builder: `https://builder.vunked.com`
- Book a call: `https://cal.com/vunked/free-campervan-electrics-consultation-email`
- Homepage: `https://www.vunked.com`
- Blog hub: `https://vunked.com/blog`

The copy agent automatically enforces these values, falling back to the best fit if an upstream model suggests anything else.

## Recommended Workflow

1. **Prep Content** – drop blog posts or prompts into `content/`.
2. **Run the CLI** – choose URL/text/prompt input depending on your source.
3. **Review Output** – inspect the generated HTML and plain text versions in `output/`.
4. **Load into Klaviyo** – copy the HTML into Klaviyo or a similar ESP.
5. **Archive** – optionally move final campaigns into `saved_emails/` for reference.

## Debugging Tips

- Set `DEBUG=1` when running the CLI to see raw OpenAI responses.
- SSL issues on macOS can sometimes require `NODE_TLS_REJECT_UNAUTHORIZED=0` for quick local testing (not recommended for production).
- The agent logs timing info for each model call to help diagnose slow responses or timeouts.

## Roadmap Ideas

- Automated testing harness with fixture blog posts.
- Additional sections (testimonials, product grids, etc.).
- Telemetry on model behaviour to fine-tune prompts and token budgets.

---

The repository now reflects a fully automated email production pipeline: gather content, plan the structure, write the copy, and assemble the HTML—everything is scripted and repeatable. Welcome to the Vunked AI Email Agent. 

