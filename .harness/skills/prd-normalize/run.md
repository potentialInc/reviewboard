# PRD Normalize — Execution Guide

Triggered by: `prd: <any-prd-file>` or intent matching (normalize prd, fill prd, standardize prd)

## Quick Start

```bash
# Normalize any PRD file
./skills/prd-normalize/normalize.sh prd/my-rough-prd.md

# With explicit output path
./skills/prd-normalize/normalize.sh docs/feature-spec.md --output prd/prd-auth.md
```

## What It Does

1. **Reads** the input PRD (any format, any language, any completeness)
2. **Maps** content to the 13-section standard template
3. **Flags** missing sections with `{MISSING — needs input}`
4. **Writes** `prd/prd-{name}.md` with `status: draft`
5. **Reports** what was extracted, what's partial, what's missing
6. **Asks** consolidated questions at the end

## No-Hallucination Rule

- Only extracts what's explicitly stated in the source
- Never invents endpoints, schemas, colors, or user flows
- Missing = `{MISSING — needs input}`, not a guess
- Status stays `draft` until the human reviews and sets `active`

## After Normalization

1. Review the output in `prd/`
2. Answer the questions in the gap report
3. Fill in `{MISSING — needs input}` sections
4. Set `status: active` in the YAML header
5. Run `fullstack:` or `pipeline:` to start building

## When openclaw executes `prd:` keyword

openclaw should:
1. Call `./skills/prd-normalize/normalize.sh <prd-path>`
2. Present the gap report to the user
3. Wait for user to answer the questions
4. Help fill in the remaining sections if user provides answers
5. NOT set `status: active` automatically — that's the user's decision
