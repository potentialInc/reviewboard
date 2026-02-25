# FastAPI Project Initialization

## Steps

1. **Create project structure**:
```bash
mkdir -p src/{types,config,repo,service,runtime,ui}
touch src/__init__.py
for dir in src/*/; do touch "$dir/__init__.py"; done
```

2. **Set up virtual environment**:
```bash
python -m venv .venv
source .venv/bin/activate
pip install fastapi uvicorn sqlalchemy pydantic
pip install pytest ruff httpx
```

3. **Layer mapping for FastAPI**:
| Harness Layer | FastAPI Equivalent |
|---|---|
| types/ | `src/types/` — Pydantic models, schemas |
| config/ | `src/config/` — Settings, env vars |
| repo/ | `src/repo/` — SQLAlchemy models, queries |
| service/ | `src/service/` — business logic |
| runtime/ | `src/runtime/` — FastAPI app, routers, middleware |
| ui/ | Not applicable (or separate frontend) |

4. **Entry point** (`src/runtime/main.py`):
```python
from fastapi import FastAPI
app = FastAPI()

# Import routers here
```

5. **Copy harness files**:
```bash
# Set HARNESS_ROOT to your claude-harness location, or use harness-install.sh
cp -r "${HARNESS_ROOT:?Set HARNESS_ROOT to your claude-harness path}"/{CLAUDE.md,architecture,hooks,agents,memory,docs} .
```

6. **Update CLAUDE.md** with FastAPI-specific commands:
```markdown
## Commands
- Dev: `uvicorn src.runtime.main:app --reload`
- Test: `pytest`
- Lint: `ruff check src/`
```
