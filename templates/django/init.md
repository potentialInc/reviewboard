# Django Project Initialization

## Steps

1. **Create virtual environment and activate it**:
```bash
python -m venv .venv
source .venv/bin/activate
```

2. **Install Django and create project**:
```bash
pip install django
django-admin startproject {PROJECT_NAME} .
```

3. **Install additional dependencies**:
```bash
pip install djangorestframework pytest-django ruff
pip freeze > requirements.txt
```

Create a starter app:
```bash
python manage.py startapp core
```

4. **Layer mapping for Django**:
| Harness Layer | Django Equivalent |
|---|---|
| types/ | `{app}/models.py`, `{app}/serializers.py` — data models and serializers |
| config/ | `{project}/settings.py`, `.env` — Django settings, environment variables |
| repo/ | `{app}/managers.py`, `{app}/querysets.py` — custom QuerySets, data access |
| service/ | `{app}/services.py` — business logic, separated from views |
| runtime/ | `{project}/urls.py`, `{app}/views.py` — URL routing, views and viewsets |
| ui/ | `{app}/templates/`, `static/` — Django templates, static assets |

Create the service layer file (Django does not generate this by default):
```bash
touch core/services.py core/managers.py core/querysets.py core/serializers.py
mkdir -p core/templates/core static
```

5. **Copy harness files**:
```bash
# Set HARNESS_ROOT to your claude-harness location, or use harness-install.sh
cp -r "${HARNESS_ROOT:?Set HARNESS_ROOT to your claude-harness path}"/{CLAUDE.md,architecture,hooks,agents,memory,docs} .
```

6. **Update CLAUDE.md** with Django-specific commands:
```markdown
## Commands
- Dev: `python manage.py runserver`
- Migrations: `python manage.py makemigrations && python manage.py migrate`
- Test: `pytest`
- Lint: `ruff check .`
- Format: `ruff format .`
- Shell: `python manage.py shell`
- Create superuser: `python manage.py createsuperuser`
```
