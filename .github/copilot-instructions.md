# Copilot Instructions for zmuda.pro Blog

## Project Overview
This is a **Docusaurus 3.9.2 blog** deployed via containerized CI/CD. The site serves personal DevOps/infrastructure content at `https://zmuda.pro` with the blog as the root route and a separate `/aboutme` docs section. The entire site is containerized (Node.js builder → Nginx runtime) and published to DockerHub on date-based git tags (format: `YYYY.M.D` with no leading zeros, e.g., `2026.1.23`).

**Key Tech Stack:**
- Docusaurus 3.9.2 (React 19.2.3, MDX)
- Node 18+ with `npm ci` for reproducibility
- Docker multi-stage build (Node→Nginx)
- Markdown blog posts with YAML frontmatter

## Directory Structure & Purpose

```
zmuda-pro/                    # Main Docusaurus app
  ├── blog/                   # Blog posts (served as /)
  │   ├── [DATE]-[SLUG]/      # Directory-based posts (e.g., 2025-03-02-cloudflare-crowdsec-nginx/)
  │   │   └── index.md        # Post content with YAML frontmatter
  │   ├── authors.yml         # Author metadata (name, title, social links, page=true for author pages)
  │   ├── tags.yml            # Tag definitions with custom permalinks
  │   └── [DATE]-[SLUG].md    # Single-file posts (legacy format)
  ├── content/                # "About me" docs (served as /aboutme via routeBasePath)
  ├── src/                    # React components & CSS
  │   ├── components/HomepageFeatures/
  │   └── css/custom.css      # Custom theme overrides
  ├── static/                 # Static assets (img/, pdf/)
  ├── docusaurus.config.js    # Site config (title, navbar, footer, plugins)
  └── sidebars.js             # Docs sidebar (currently empty, autodiscovery disabled)

Root config files:
  - Dockerfile               # Multi-stage: builds site, copies to Nginx
  - default.conf            # Nginx server configuration
  - .pre-commit-config.yaml # Local dev hooks (markdownlint, yamllint, hadolint, shellcheck, etc.)
  - .github/workflows/zmuda-pro.yaml # Docker build & push on tags
```

## Critical Developer Workflows

### Local Development
```bash
cd zmuda-pro
npm ci              # Install deps (reproducible)
npm start           # Dev server on http://localhost:3000, hot-reload enabled
npm run build       # Compile to /build directory
npm run serve       # Serve built site locally
```

### Adding Blog Posts
**Author writes posts; AI reviews for style, formatting, and grammar.**

Post structure:
1. Directory: `zmuda-pro/blog/YYYY-MM-DD-slug/index.md`
2. Frontmatter template:
   ```markdown
   ---
   slug: your-slug-here
   title: Your Title Here
   authors: adzik
   tags: [tag1, tag2]
   toc_min_heading_level: 2
   toc_max_heading_level: 3
   ---

   First paragraph (appears in blog listing)

   <!-- truncate -->

   Rest of content...
   ```
3. Requirements:
   - `slug`: URL path identifier (must be unique, hyphen-separated)
   - `authors` must exist in `zmuda-pro/blog/authors.yml` (currently: `adzik`)
   - `tags` must be defined in `zmuda-pro/blog/tags.yml` with `label` and `permalink`
   - Include `<!-- truncate -->` comment to mark where preview cuts off in listing
4. Images: Store in `static/img/` as `.webp` format, reference as `/img/filename.webp`

### Deployment & Versioning
- **Trigger:** Push a git tag matching date format `YYYY.M.D` (no leading zeros, e.g., `2026.1.23`)
- **Pipeline:**
  1. Docker login (uses `DOCKERHUB_USERNAME` var + `DOCKERHUB_TOKEN` secret)
  2. Build Docusaurus site with npm
  3. Build and push Docker image with pre-built artifacts
  4. Push to DockerHub as `{USERNAME}/zmuda-pro-blog:{TAG}` and `:latest`
  5. Generate SBOM and provenance attestation for supply chain security
- **PR builds:** Run quality checks (build verification, security audit, pre-commit hooks, Docker test)

### Pre-Commit Hooks
Repo enforces via `.pre-commit-config.yaml`:
- **JSON:** Auto-format (except `package*.json`)
- **Markdown:** Lint with markdownlint
- **YAML:** Lint with yamllint (excludes specific ansible/argocd files)
- **Python:** isort + black (from other parts of repo)
- **Docker:** hadolint
- **Shell:** shellcheck
- **Secrets:** detect-secrets with baseline at `.sec.baseline`

Run locally: `pre-commit run --all-files`

## Architecture & Data Flows

### URL Routing
- `/` → blog posts from `zmuda-pro/blog/` (rendered newest first)
- `/aboutme` → docs from `zmuda-pro/content/` (via `routeBasePath: '/aboutme'`)
- `/kubernetes`, `/security`, etc. → tag archive pages (permalinks defined in `tags.yml`)
- Author pages auto-generated when `page: true` in `authors.yml`

### Build Output
- `npm run build` → `zmuda-pro/build/` directory (static HTML)
- Dockerfile copies `build/` → Docker image → Nginx serves on port 8080 (unprivileged)
- Nginx config: `default.conf` (custom routing if needed)

### Plugin & Theme Extensions
- **docusaurus-plugin-image-zoom**: Enables click-to-zoom for images
- **prism-react-renderer**: Syntax highlighting (GitHub light / Dracula dark)
- Custom CSS: `src/css/custom.css` (colors, fonts, etc.)

## Project-Specific Patterns & Conventions

### Frontmatter Conventions
- `slug`: URL identifier (blog post filename prefix is ignored, slug is canonical)
- `toc_min_heading_level: 2 / toc_max_heading_level: 3` standard for consistent ToC depth
- `authors: adzik` (single string, not array) for author assignment
- `tags: [tag1, tag2]` must exist in `tags.yml`
- `<!-- truncate -->` comment marks content visibility cutoff in listings (required for clarity)

### Image Assets
- Format: `.webp` (modern, smaller files)
- Location: `static/img/`
- Reference: `/img/filename.webp` (absolute path from root)

### "About Me" Docs Structure
- Currently minimal (`content/index.mdx` exists)
- Add subdirectories or files as needed; Docusaurus auto-discovers
- Not currently in use much; follow Docusaurus docs best practices if expanding

### Broken Links & Build Strictness
- `onBrokenLinks: 'throw'` → **build fails on broken internal links**
- Markdown links: `[text](path)` must resolve or build will error
- External links are safe; internal links checked strictly

## Integration Points & External Dependencies

### External Services
- **DockerHub:** Push target (authenticated via GitHub Actions secrets)
- **GitHub:** Source control + Actions for CI/CD
- **Cloudflare Tunnels:** Article topic (not infra dependency, blog content only)

### Git Tagging Strategy
- Date-based tags (`YYYY.M.D` format, e.g., `2026.1.23`) trigger Docker build+push
- Format uses year.month.day with **no leading zeros** (e.g., `2026.1.5` not `2026.01.05`)
- Non-tagged pushes do not trigger the release workflow; use workflow_dispatch for manual runs
- PRs trigger quality checks workflow (build verification, security audit, linting)

### Environment Constraints
- Node 18+ required (`engines.node` in `package.json`)
- npm ci required for reproducible installs
- Docker multi-stage for production (no dev deps in runtime image)

## Modification Checklist
When making changes:
- [ ] Blog post? Add to `zmuda-pro/blog/`, update `authors.yml` or `tags.yml` if needed
- [ ] Static assets? Place in `static/img/` (webp preferred), reference as `/img/...`
- [ ] Config changes? Edit `docusaurus.config.js` (title, navbar, footer, plugins)
- [ ] Styling? Update `src/css/custom.css` (Docusaurus CSS var system)
- [ ] Docs page? Add to `content/`, follow Markdown best practices
- [ ] Build failures? Check `onBrokenLinks: 'throw'` — all internal links must resolve
- [ ] Release? Create date-based git tag (format: `YYYY.M.D`, e.g., `2026.1.23`); GitHub Actions builds and pushes to DockerHub
