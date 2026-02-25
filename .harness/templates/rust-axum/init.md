# Rust Axum Web Service Project Initialization

## Steps

1. **Create Rust project**:
```bash
cargo init {PROJECT_NAME}
cd {PROJECT_NAME}
```

2. **Add dependencies** to `Cargo.toml`:
```toml
[dependencies]
axum = "0.7"
tokio = { version = "1", features = ["full"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
tower-http = { version = "0.5", features = ["cors", "trace"] }
tracing = "0.1"
tracing-subscriber = { version = "0.3", features = ["env-filter"] }

# Optional: database
# sqlx = { version = "0.7", features = ["runtime-tokio-rustls", "postgres"] }

[dev-dependencies]
axum-test = "14"
```

Then fetch dependencies:
```bash
cargo build
```

3. **Create module structure**:
```bash
mkdir -p src/{types,config,repo,service,handler}
for dir in src/types src/config src/repo src/service src/handler; do
  touch "$dir/mod.rs"
done
```

Starter `src/main.rs`:
```rust
mod config;
mod handler;
mod repo;
mod service;
mod types;

use axum::Router;
use tokio::net::TcpListener;

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt::init();

    let app = Router::new();

    let listener = TcpListener::bind("0.0.0.0:3000").await.unwrap();
    tracing::info!("listening on {}", listener.local_addr().unwrap());
    axum::serve(listener, app).await.unwrap();
}
```

4. **Layer mapping for Rust Axum**:
| Harness Layer | Rust Axum Equivalent |
|---|---|
| types/ | `src/types/` — domain types, request/response structs |
| config/ | `src/config/` — configuration loading, env parsing |
| repo/ | `src/repo/` — database access, repository traits and impls |
| service/ | `src/service/` — business logic, orchestration layer |
| runtime/ | `src/main.rs`, `src/handler/` — app entry, HTTP handlers and routing |
| ui/ | N/A — API only (or `assets/` for embedded static files) |

5. **Copy harness files**:
```bash
# Set HARNESS_ROOT to your claude-harness location, or use harness-install.sh
cp -r "${HARNESS_ROOT:?Set HARNESS_ROOT to your claude-harness path}"/{CLAUDE.md,architecture,hooks,agents,memory,docs} .
```

6. **Update CLAUDE.md** with Rust-specific commands:
```markdown
## Commands
- Run: `cargo run`
- Build: `cargo build --release`
- Test: `cargo test`
- Lint: `cargo clippy -- -D warnings`
- Format: `cargo fmt`
- Check: `cargo check`
```
