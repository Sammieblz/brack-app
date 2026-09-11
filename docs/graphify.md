# Graphify

[Graphify](https://github.com/Graphify-Labs/graphify) is optional developer tooling for exploring code relationships. It is not an application dependency and does not affect Brack's build or deployment.

## Installation

The official Python package is **graphifyy** (two trailing `y`s); its command is `graphify`. This setup uses version **0.9.58** in an isolated uv tool environment.

```powershell
python -m pip install --user uv
python -m uv tool install "graphifyy[sql]==0.9.58"
python -m uv tool update-shell
graphify install --project --platform codex
```

Open a new terminal after updating PATH. On this Windows machine the executable is `C:\Users\Samuel\.local\bin\graphify.exe`; that absolute path also works from an already-open terminal.

The project skill and its upstream references are in `.codex/skills/graphify/`. The installer also registers project guidance in `AGENTS.md` and an intentionally no-op Codex `PreToolUse` entry in `.codex/hooks.json`. No Git hooks, watchers, MCP server, or API provider were enabled. Reinstalling may refresh the generated instructions; retain the local-only and existing-index safeguards in `AGENTS.md`.

## Use

In a new Codex turn, invoke `$graphify` and specify what to index or query. Its large-corpus check may ask you to narrow the scan.

For explicit, local code-only indexing from the repository root:

```powershell
graphify extract . --code-only
```

This is a separate operation from installation. It skips semantic processing of documentation and media. The SQL extra includes local migration files; it does not connect to a database. Unsupported formats and parser warnings are reported during extraction. For a smaller first pass, use `graphify extract apps/client/src/components/library --code-only --out .` and remember that the resulting graph covers only that subtree.

## Obsidian vault and browser graph

The repository-wide code graph is exported to `graphify-out/obsidian/`. In Obsidian, choose **Open folder as vault** and select that folder. No Obsidian community plugin is required. The browser visualization is `graphify-out/graph.html`; the audit report is `graphify-out/GRAPH_REPORT.md`.

After extracting or updating the graph, regenerate the exports:

```powershell
graphify cluster-only . --no-label --no-viz
graphify export obsidian
graphify export html
```

`--no-label` prevents automatic model-backed labeling; existing curated labels are retained where valid. New communities may need descriptive labels. Large HTML graphs use an aggregated community view; Obsidian contains individual node notes and their relationships. The vault is a generated reference, so keep personal notes in a separate vault or folder rather than editing generated notes that a later export can overwrite.

Once a graph exists:

```powershell
graphify query "Library book card interactions"
graphify explain "LibraryBookCard"
graphify path "LibraryBookCard" "LibraryBookActions"
```

Use `graphify update .` for subsequent updates to a repository-wide code graph. Keep the original scan scope for a subtree graph. Inspect the cited source before treating inferred relationships as facts.

Generated `graphify-out/` directories are ignored by Git. Do not commit indexes that may contain source excerpts or machine-specific paths. Documentation/media extraction can use an assistant or a configured model provider; obtain explicit approval before sending content to an external backend. Never use live database introspection merely to map the repository.
