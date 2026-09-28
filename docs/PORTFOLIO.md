# Make Atlas your project

## Learn it in this order

1. Run the application and create two thoughts. Connect them and find a route.
2. Read `public/graph.js`. Draw a small graph on paper and trace breadth-first search.
3. Read `test/graph.test.js`. Add a test for two equally short routes.
4. Read `lib/store.mjs`. Explain the edge uniqueness constraint and note revision check.
5. Read `lib/http.mjs` and the HTTP integration test. Follow one request from input to database row.
6. Read `public/universe.js`. Understand world coordinates, screen coordinates, and pointer hit testing.
7. Add a feature and document your own decisions.

## Strong next features

- **Full-text search:** add SQLite FTS5, define ranking, and test updates/deletes in the index.
- **Undo history:** model reversible commands for notes and relationships, including conflict behavior.
- **Graph layout:** add a force-directed layout in a Web Worker, with cancellation and position persistence.
- **Accessibility:** add an adjacency-list navigation mode and test it with a screen reader.
- **Deployment:** design authentication, per-user ownership checks, migrations, and backup strategy before exposing a shared server.

## Interview discussion prompts

- Why does breadth-first search return a shortest path here? When would you use Dijkstra instead?
- What happens when two tabs update the same note?
- Why are both input validation and database constraints useful?
- What could happen if an import fails halfway through?
- How would you keep the map responsive with ten thousand nodes?
- What are the tradeoffs between a Canvas map and an SVG map?

## A resume bullet to adapt after you understand and extend the project

Developed and extended Atlas, a visual knowledge-graph application using JavaScript, Canvas, Node.js, and SQLite; implemented [your contribution], with graph traversal, transactional persistence, and automated integration tests.

Replace the bracketed section with work you actually did. Do not invent performance figures or user counts. Describe the AI-assisted starting point honestly when asked about the development process.
