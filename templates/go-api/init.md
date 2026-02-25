# Go REST API Project Initialization

## Steps

1. **Initialize Go module**:
```bash
go mod init {MODULE_NAME}
```

2. **Create Go project structure**:
```bash
mkdir -p cmd/api
mkdir -p internal/{types,config,repo,service,handler}

touch cmd/api/main.go
for dir in internal/types internal/config internal/repo internal/service internal/handler; do
  touch "$dir/${dir##*/}.go"
done
```

Starter `cmd/api/main.go`:
```go
package main

import (
	"log"
	"net/http"
)

func main() {
	mux := http.NewServeMux()
	log.Println("Server starting on :8080")
	log.Fatal(http.ListenAndServe(":8080", mux))
}
```

3. **Install common dependencies**:
```bash
go get github.com/go-chi/chi/v5
go get github.com/go-chi/chi/v5/middleware
```

4. **Layer mapping for Go API**:
| Harness Layer | Go Equivalent |
|---|---|
| types/ | `internal/types/` — domain types, request/response structs |
| config/ | `internal/config/` — configuration loading, env parsing |
| repo/ | `internal/repo/` — database access, repository pattern |
| service/ | `internal/service/` — business logic, orchestration |
| runtime/ | `cmd/`, `internal/handler/` — entry point, HTTP handlers and middleware |
| ui/ | N/A — API only (or `web/` for embedded static files) |

5. **Copy harness files**:
```bash
# Set HARNESS_ROOT to your claude-harness location, or use harness-install.sh
cp -r "${HARNESS_ROOT:?Set HARNESS_ROOT to your claude-harness path}"/{CLAUDE.md,architecture,hooks,agents,memory,docs} .
```

6. **Update CLAUDE.md** with Go-specific commands:
```markdown
## Commands
- Run: `go run ./cmd/api`
- Build: `go build -o bin/api ./cmd/api`
- Test: `go test ./...`
- Test (verbose): `go test -v ./...`
- Lint: `golangci-lint run`
- Vet: `go vet ./...`
- Tidy: `go mod tidy`
```
