# Measai OACIS Dashboard (MVP)

Real-time monitoring dashboard for Measai OACIS agent fleet. Currently monitoring Claude, Gemini, Codex, and Copilot on VM100. Designed to scale to 100+ agents across multiple VMs and providers.

## Features

✅ **Responsive Grid Dashboard** - 4-agent grid with real-time status indicators  
✅ **Tabbed Agent Detail Views** - Tmux output, file browser, activity logs  
✅ **Futuristic Dark Theme** - Cyan/blue accents, smooth animations, gradient text  
✅ **Auto-Refresh** - 10-second polling for real-time updates (user-configurable)  
✅ **Full Error Handling** - Graceful degradation, connection loss notifications  
✅ **Mobile Responsive** - Works on desktop, tablet, and smartphone  

## Architecture

```
projects/vm100-dashboard/
├── app.py                  # Flask backend (tmux integration, file browser)
├── templates/
│   ├── index.html          # Homepage grid (4-agent cards)
│   └── agent.html          # Detail page (3 tabs)
├── static/
│   ├── css/style.css       # Futuristic theme (653 lines)
│   └── js/app.js           # Auto-refresh, tab switching (357 lines)
├── docker-compose.yml      # Production deployment config
└── Dockerfile              # Alpine Python 3.11 image
```

## Quick Start

### Local Development

```bash
cd projects/vm100-dashboard
pip install -r requirements.txt
python app.py
```

Open `http://localhost:5000`

### Docker (Production)

```bash
cd projects/vm100-dashboard
docker-compose build
docker-compose up -d
```

Runs on port 5000. Volume mount exposes `/home/maestro/Measai-Maestro/AI_Agents` as read-only.

## Environment Variables

- `REPO_ROOT` (optional): Override repo root path. Default: two levels above `app.py`
- `FLASK_ENV`: Set to `production` for docker-compose

## API Endpoints

**Dashboard Pages:**
- `GET /` - Homepage with agent grid
- `GET /agent/<name>` - Agent detail page (Claude, Gemini, Codex, Copilot)

**Data APIs:**
- `GET /api/tmux/<name>` - Last 50 lines of agent's tmux session
- `GET /api/files/<name>` - Directory listing for `AI_Agents/<name>/`
- `GET /api/logs/<name>` - Tail of agent's `daily-activity.log`

## Status Indicators

- 🟢 **Active** (green pulsing dot) - Agent session running, responsive
- 🟡 **Idle** (yellow pulsing dot) - Session running, no recent heartbeat

## Scaling to 100+ Agents

Current implementation is ready for expansion:

- **Grid layout** uses `repeat(auto-fit, minmax(320px, 1fr))` - automatically adapts to N agents
- **Pagination/filtering** (future) - can be added without breaking current design
- **Agent types** - supports LXC containers, cloud VMs, and end-user devices
- **Multi-provider** - ready for Hetzner, AWS, Azure, device agents

## Testing

All 10 integration tests pass:

```
✓ Homepage renders correctly
✓ 4 agent detail pages load
✓ Tmux API returns data
✓ Files API returns directory listing
✓ Logs API returns activity logs
✓ Error handling (invalid agents → 404)
```

## Deployment via Coolify

Ready for deployment to `oacis.measai.com`:

```bash
# From Coolify UI or CLI:
docker-compose up -d
```

Version: 1.0.0 MVP (2026-01-15 11:36 UTC)  
Status: Production-ready ✅
