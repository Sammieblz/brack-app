## graphify

Graphify is installed for this project. Generated knowledge graphs live in graphify-out/; installation alone does not create an index. See docs/graphify.md for setup and local-only indexing.

When the user types `/graphify`, use the installed graphify skill or instructions before doing anything else.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- Dirty graphify-out/ files are expected after hooks or incremental updates; dirty graph files are not a reason to skip graphify. Only skip graphify if the task is about stale or incorrect graph output, or the user explicitly says not to use it.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, update an existing graph with `graphify update .` (AST-only, no API cost). If no graph exists, do not imply that it does or launch a large indexing job just to finish an unrelated task.
- Keep indexing local unless the user requests semantic/cloud processing. Do not enable API-backed extraction, live database introspection, Git hooks, or background watchers implicitly.
