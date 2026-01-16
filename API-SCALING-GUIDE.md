# OACIS Dashboard API - Scaling & Integration Guide

**Created:** 2026-01-15 12:35 UTC  
**Audience:** Developers planning Phase 2B expansion  
**Purpose:** Document current API patterns for scaling to 100+ agents

---

## Current Architecture (MVP)

### Agent Discovery

**Current (Hardcoded):**
```python
AGENTS = ["Claude", "Gemini", "Codex", "Copilot"]
```

**For 100+ agents (Future):**
```python
# Option A: Config file
agents = load_json("config/agents.json")

# Option B: Database
agents = query_agents_table()

# Option C: Hybrid
agents = merge(hardcoded_legacy, external_sources)
```

### Session Resolution

**Current:**
```python
session_name = f"{agent.lower()}_session"  # claude_session, gemini_session, etc.
result = subprocess.run(["tmux", "capture-pane", "-t", session_name, "-p"])
```

**For 100+ agents:**
- Each agent can have different session naming scheme
- Move to config-driven lookup instead of hardcoded pattern
- Support agents on different VMs/hosts via SSH

---

## API Endpoints & Usage Patterns

### 1. **GET /api/tmux/<name>** - Terminal Output Streaming

**Current Implementation:**
```python
@app.route("/api/tmux/<name>")
def tmux_output(name: str):
    agent = _normalize_agent(name)
    output = _tmux_capture(agent, lines=50)
    return jsonify({"output": output})
```

**Performance Considerations:**
- **Per-call overhead:** ~100ms (tmux subprocess)
- **Scaling issue:** At 100 agents with 10s polling, that's 10 requests/second
- **Solution:** Add caching (Redis/memcached) with 2-5s TTL

**Proposed Caching Layer:**
```python
from functools import lru_cache
import time

@lru_cache(maxsize=128)
def _tmux_capture_cached(agent: str, max_age: int = 3):
    # Check cache age
    if cached_result and (time.time() - cache_time) < max_age:
        return cached_result
    
    # Fetch fresh
    output = _tmux_capture(agent)
    return output
```

**Usage in Frontend:**
```javascript
// Current: Refresh every 10 seconds
// Future: Add intelligent backoff (reduce frequency if no changes)
let lastOutput = null;
setInterval(async () => {
  const resp = await fetch(`/api/tmux/${agent}`);
  const data = await resp.json();
  
  // Only update if content changed
  if (data.output !== lastOutput) {
    updateUI(data.output);
    lastOutput = data.output;
  }
}, 10000);
```

---

### 2. **GET /api/files/<name>** - Directory Listing

**Current Implementation:**
```python
@app.route("/api/files/<name>")
def list_files(name: str):
    base = _agent_dir(agent)
    entries = []
    for name in sorted(os.listdir(base)):
        stat = os.stat(path)
        entries.append({
            "name": name,
            "path": relative_path,
            "type": "dir" or "file",
            "size": stat.st_size,
            "mtime": iso_timestamp
        })
    return jsonify({"files": entries})
```

**Scaling Issues:**
- **Directory size:** Agent folders can have 1000+ files
- **Deep recursion:** Need pagination or lazy loading
- **Performance:** os.stat on 1000 files = slow

**Optimization Strategies:**

**Strategy A: Pagination**
```python
@app.route("/api/files/<name>?page=1&per_page=50")
def list_files(name: str, page: int = 1, per_page: int = 50):
    entries = [...]  # Get all
    total = len(entries)
    start = (page - 1) * per_page
    return jsonify({
        "files": entries[start:start+per_page],
        "page": page,
        "per_page": per_page,
        "total": total,
        "pages": ceil(total / per_page)
    })
```

**Strategy B: Filtering**
```python
@app.route("/api/files/<name>?filter=.md")
def list_files(name: str, filter: str = None):
    # Only return matching files
    entries = [e for e in entries if filter in e["name"]]
    return jsonify({"files": entries})
```

**Strategy C: Caching (Similar to tmux)**
```python
# Cache directory listing with 10-30 second TTL
# Only refresh if modification time changes
```

**Frontend Usage Pattern:**

```javascript
// Current: Load all files
async function loadFilesList() {
  const resp = await fetch(`/api/files/${agent}`);
  const data = await resp.json();
  renderFiles(data.files);  // All files at once
}

// Future: Paginated loading
async function loadFilesList(page = 1) {
  const resp = await fetch(`/api/files/${agent}?page=${page}&per_page=50`);
  const data = await resp.json();
  
  renderFiles(data.files);
  renderPagination(data.page, data.pages);
}
```

---

### 3. **GET /api/logs/<name>** - Activity Log Streaming

**Current Implementation:**
```python
@app.route("/api/logs/<name>")
def get_logs(name: str):
    log_path = os.path.join(_agent_dir(agent), "daily-activity.log")
    lines = _tail_file(log_path, max_lines=200)
    return jsonify({"logs": lines})
```

**Scaling Pattern:**
- **Log rotation:** Implement log rotation (daily files) to keep tail() fast
- **Search:** Add timestamp-range filtering for large log archives
- **Streaming:** For real-time logs, consider WebSocket instead of polling

**Proposed Enhancement:**

```python
# Support log range queries
@app.route("/api/logs/<name>?since=2026-01-15T12:00:00Z&limit=100")
def get_logs(name: str, since: str = None, limit: int = 200):
    log_path = _log_path(agent)
    
    if since:
        # Filter logs after timestamp
        since_dt = datetime.fromisoformat(since)
        lines = [l for l in read_log(log_path) if parse_timestamp(l) > since_dt]
    else:
        lines = tail_file(log_path, max_lines=limit)
    
    return jsonify({"logs": lines, "total": len(lines)})
```

---

## Multi-VM & Multi-Provider Scaling

### Current State (Single VM, SSH-based)

```python
# All agents on localhost via tmux
session_name = f"{agent.lower()}_session"
subprocess.run(["tmux", "capture-pane", "-t", session_name])
```

### Future State (Multi-VM Support)

**Option 1: SSH to Remote Hosts**
```python
def _tmux_capture_remote(agent: str, host: str):
    session = f"{agent.lower()}_session"
    cmd = f"ssh {host} tmux capture-pane -t {session} -p"
    result = subprocess.run(cmd.split(), capture_output=True)
    return result.stdout.decode()
```

**Option 2: Agent Registry with Host Mapping**
```json
{
  "agents": [
    {
      "name": "Claude",
      "type": "vm",
      "host": "vm100.measai.com",
      "session": "claude_session",
      "provider": "hetzner"
    },
    {
      "name": "EdgeAgent-01",
      "type": "device",
      "host": "192.168.1.100",
      "port": 8000,
      "provider": "m-bud-pc"
    }
  ]
}
```

**Option 3: Agent API Endpoints (Decentralized)**
```python
# Instead of querying local tmux, query agent's own API
def _get_agent_status(agent_config: dict):
    resp = requests.get(f"http://{agent_config['host']}/api/status")
    return resp.json()
```

---

## Performance Targets & Monitoring

### Current Baseline (4 agents)

```
Homepage load time:     ~500ms
Agent detail page:      ~800ms
Tmux API response:      ~100ms (with 10s polling = 10req/s total)
Files API response:     ~150ms (with manual load)
Logs API response:      ~50ms
```

### Projected Scaling (100 agents)

**Without optimization:**
- Tmux polling: 10 agents × 1req/10s = 1 req/s ✓ (still OK)
- Files listing: 100 agents × 1000 files each = slow

**With optimization:**
- Add caching layer (Redis): <10ms response time
- Implement pagination: Load 50 files at a time
- Use lazy loading: Only fetch visible agent cards

### Monitoring Strategy

```python
# Add timing decorators
import time

def timed_endpoint(func):
    def wrapper(*args, **kwargs):
        start = time.time()
        result = func(*args, **kwargs)
        elapsed = time.time() - start
        print(f"{func.__name__}: {elapsed:.3f}s")
        return result
    return wrapper

@app.route("/api/tmux/<name>")
@timed_endpoint
def tmux_output(name):
    ...
```

---

## Testing Strategy for Scaling

### Load Testing (Using Locust)

```python
# locustfile.py
from locust import HttpUser, task, between

class OACIS_User(HttpUser):
    wait_time = between(5, 10)
    
    @task(3)
    def load_homepage(self):
        self.client.get("/")
    
    @task(1)
    def load_agent_detail(self):
        agents = ["Claude", "Gemini", "Codex", "Copilot"]
        agent = random.choice(agents)
        self.client.get(f"/agent/{agent}")
    
    @task(2)
    def poll_tmux(self):
        agents = ["Claude", "Gemini", "Codex", "Copilot"]
        agent = random.choice(agents)
        self.client.get(f"/api/tmux/{agent}")
```

**Run:** `locust -f locustfile.py -u 100 -r 10`

---

## Database Integration (Future)

### Current: Filesystem + Tmux

### Future: Optional Database Layer

```python
# For operational data (task assignments, completion status)
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

engine = create_engine("sqlite:///oacis.db")

class AgentStatus(Base):
    id = Column(Integer, primary_key=True)
    agent_name = Column(String)
    status = Column(String)  # active, idle, failed
    last_heartbeat = Column(DateTime)
    context_usage = Column(Integer)

# Keep filesystem for logs, GISTs, etc.
# Use DB for aggregated status only
```

---

## API Stability & Versioning

### Current: v0 (MVP, no versioning)

### Recommended (v1+):

```python
@app.route("/api/v1/agents")
def list_agents_v1():
    """List all agents with metadata"""
    return jsonify({
        "version": "1.0.0",
        "agents": [...]
    })

# Backwards compatibility
@app.route("/api/tmux/<name>")
def tmux_output_legacy(name):
    """Deprecated: Use /api/v1/agents/{name}/tmux"""
    return redirect(f"/api/v1/agents/{name}/tmux")
```

---

## Documentation for Future Team

**When scaling to 100+ agents, prioritize:**

1. **Add caching layer** - Reduces load by 80%
2. **Implement pagination** - Prevents large file listings
3. **Multi-host support** - Enable remote VM queries
4. **Performance monitoring** - Track endpoint latency
5. **Load testing** - Validate scaling assumptions

**Files to update when scaling:**
- `app.py` - Add caching, pagination, multi-host
- `README.md` - Document new endpoints
- `.env.example` - Add cache config, SSH hosts
- `tests/integration_test.py` - Add load test scenarios

---

**Prepared by:** Copilot (Autonomous Work Check 12:35 UTC)  
**For:** Phase 2B scaling planning  
**Status:** Ready for team review
