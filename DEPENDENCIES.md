# DEPENDENCIES

This file documents the dependencies used in the SATQUERY AI (DRISHTIWATCH) project.

## 1. Runtime requirements
- **Node.js**: v18+ (Recommended)
- **npm**: v9+ (Included with Node.js)

## 2. Frontend dependencies
| Package | Version | Purpose |
| --- | --- | --- |
| `react` | ^19.2.8 | Core UI library |
| `react-dom` | ^19.2.8 | DOM rendering for React |
| `react-router-dom` | ^7.18.4 | Client-side routing |
| `framer-motion` | ^13.4.4 | Animation library |
| `lucide-react` | ^1.48.0 | SVG icons |
| `maplibre-gl` | ^6.11.2 | Map rendering engine |

## 3. Backend dependencies
| Package | Version | Purpose |
| --- | --- | --- |
| `express` | ^5.2.1 | Local backend server |
| `cors` | ^2.8.6 | CORS middleware |
| `body-parser` | ^2.3.0 | JSON payload parsing |
| `sqlite3` | ^5.1.7 | SQLite local database driver |
| `google-auth-library` | ^11.1.0 | Server-side authentication |

## 4. Mapping
- **Engine**: MapLibre GL JS (`maplibre-gl`)
- **Tiles**: Currently uses basic satellite sources. Ready for advanced tiles.

## 5. Geospatial
- Built-in MapLibre logic for coordinates and simple geometric interactions.

## 6. AI
- To be integrated via secure backend endpoints to chosen LLM provider.

## 7. Satellite / Earth Engine
- Earth Engine scripts ready on backend; authenticated securely without exposing credentials to the client.

## 8. Database
- **SQLite3**: Used by the local Express server for offline persistence (Reports, Evidence, Settings, Watches).

## 9. Visualization
- Custom CSS layouts/grid metrics. Chart libraries can be added as needed.

## 10. Animation
- **Framer Motion**: Smooth entry/exit and micro-animations for UI elements.

## 11. Icons
- **Lucide**: Clean, customizable SVG icons.

## 12. Dev dependencies
| Package | Version | Purpose |
| --- | --- | --- |
| `vite` | ^8.3.0 | Build tool & dev server |
| `@vitejs/plugin-react` | ^6.1.1 | Vite plugin for React |
| `concurrently` | ^10.0.5 | Run multiple npm scripts |
| `oxlint` | ^1.81.0 | Fast linter |

## 13. Environment variables
See `.env.example` for details. Variables used:
- `VITE_API_URL` (Client) - Points to the local API server (default: `http://localhost:3001`).
- `PORT` (Server) - Port for the backend.
- `EE_PRIVATE_KEY` (Server) - Earth Engine / Google Cloud credentials (Do NOT commit).

## 14. External services
- **Google Earth Engine**: Optional. Required for advanced satellite analysis.
- **AI Provider**: Optional. Required for conversational UI and autonomous planning.
