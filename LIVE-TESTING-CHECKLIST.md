# OACIS Dashboard - Live Testing Checklist & API Documentation

**Created:** 2026-01-15 12:35 UTC  
**Purpose:** Deployment verification checklist + API usage guide  
**Status:** Ready for live testing on oacis.measai.com

---

## 🧪 Live Testing Checklist

### Homepage (/)

- [ ] **Page Loads** - No 404 or 5xx errors
- [ ] **Visual Layout** - 4 agent cards display in responsive grid
- [ ] **Status Indicators** - All agents show status dot (green/yellow pulsing)
- [ ] **Agent Names** - Claude, Gemini, Codex, Copilot visible
- [ ] **Navigation** - "View Details" buttons clickable

### Agent Detail Pages (/agent/<name>)

For each agent (Claude, Gemini, Codex, Copilot):

- [ ] **Page Loads** - No errors
- [ ] **Back Link** - "← Back to Dashboard" works
- [ ] **Tab Switching** - Click each tab (Tmux, Files, Logs)
- [ ] **Content Loads** - Each tab shows data (or "no data" gracefully)
- [ ] **Controls Work** - Refresh buttons functional
- [ ] **Auto-Refresh Checkbox** - Toggle on/off works
- [ ] **Responsive** - Test on mobile viewport (if possible)

### Tmux Tab

- [ ] **Output Displays** - Last 50 lines of agent tmux session visible
- [ ] **Monospace Font** - Terminal text renders in monospace
- [ ] **Scrollable** - Long output scrolls vertically
- [ ] **Fullscreen Button** - Toggles fullscreen mode
- [ ] **Auto-Refresh** - Updates every 10s when enabled
- [ ] **Cyan Color Scheme** - Terminal text in cyan/dark theme

### Files Tab

- [ ] **File List Renders** - Agent directory files/folders display
- [ ] **File Icons** - Appropriate icons (📁 📝 🐍 📊 etc.)
- [ ] **File Metadata** - Size and modification date visible
- [ ] **Grid Layout** - Responsive grid adapts to screen size
- [ ] **Hover Effects** - Card highlights on hover

### Logs Tab

- [ ] **Activity Log Displays** - Recent log entries visible
- [ ] **Timestamps** - Log entries show dates/times
- [ ] **Scrollable** - Long logs scroll without page scroll
- [ ] **Readable Format** - Log entries properly formatted

### Error Handling

- [ ] **Invalid Agent** - `/agent/InvalidAgent` returns 404
- [ ] **API Error** - If tmux fails, shows "Connection lost" gracefully
- [ ] **Loading States** - Spinners show during data fetch

### Styling & UX

- [ ] **Dark Theme** - Background is dark (#0a0e1a)
- [ ] **Cyan Accents** - Accent colors are cyan/blue
- [ ] **Smooth Animations** - Transitions are smooth (not jarring)
- [ ] **Font Rendering** - Text is readable, proper anti-aliasing
- [ ] **Mobile Responsive** - Works on various screen sizes

### Performance

- [ ] **Page Load Time** - Homepage loads in < 2 seconds
- [ ] **No Console Errors** - Browser dev tools show no JS errors
- [ ] **API Response Time** - `/api/tmux/<agent>` responds in < 1 second
- [ ] **Memory Usage** - Auto-refresh doesn't cause memory leak

---

## 📚 API Documentation - Quick Reference

### Base URL

```
http://oacis.measai.com  (production)
http://localhost:5000    (local development)
```

### Endpoints

#### **GET /**

**Homepage with agent grid**

```bash
curl http://localhost:5000/
```

**Response:** HTML page with 4 agent cards

---

#### **GET /agent/<name>**

**Agent detail page**

```bash
curl http://localhost:5000/agent/Claude
```

**Parameters:**
- `name` - Agent name (Claude, Gemini, Codex, Copilot)

**Response:** HTML page with 3 tabs (Tmux, Files, Logs)

---

#### **GET /api/tmux/<name>**

**Get last 50 lines of agent's tmux session**

```bash
curl http://localhost:5000/api/tmux/Claude
```

**Response:**
```json
{
  "output": "line1\nline2\nline3...\n(last 50 lines of tmux output)"
}
```

**Use Cases:**
- Dashboard tmux tab auto-refresh
- Debugging agent execution
- Monitoring real-time terminal output

---

#### **GET /api/files/<name>**

**Get directory listing for agent's AI_Agents folder**

```bash
curl http://localhost:5000/api/files/Claude
```

**Response:**
```json
{
  "files": [
    {
      "name": "context-archives",
      "path": "AI_Agents/Claude/context-archives",
      "type": "dir",
      "size": 2048,
      "mtime": "2026-01-15T12:00:00Z"
    },
    {
      "name": "AGENT-IDENTITY.md",
      "path": "AI_Agents/Claude/AGENT-IDENTITY.md",
      "type": "file",
      "size": 1024,
      "mtime": "2026-01-15T11:00:00Z"
    }
  ]
}
```

**Use Cases:**
- Browse agent's files via dashboard
- Verify file existence (GISTs, logs, etc.)
- Check file metadata (size, modification date)

---

#### **GET /api/logs/<name>**

**Get tail of agent's activity log**

```bash
curl http://localhost:5000/api/logs/Claude
```

**Response:**
```json
{
  "logs": [
    "2026-01-15T12:30:00Z - Task: Phase 2A execution started",
    "2026-01-15T12:29:45Z - Status: ACTIVE (context: 2,341 lines)",
    "2026-01-15T12:29:30Z - Completed: Dashboard frontend handoff"
  ]
}
```

**Use Cases:**
- View recent agent activity
- Track status changes
- Monitor task completion

---

## 🔄 Auto-Refresh Behavior

### Tmux Auto-Refresh

**Default:** Enabled (10-second interval)

```javascript
// User can toggle via checkbox
// localStorage persists preference across sessions
setInterval(() => {
  fetch(`/api/tmux/${agentName}`)
    .then(resp => resp.json())
    .then(data => updateTerminal(data.output))
}, 10000); // 10 seconds
```

**Behavior:**
- Only refreshes active tab (Tmux)
- Skips refresh if user disabled auto-refresh
- Gracefully handles API errors

### Manual Refresh

Users can click "⟲ Refresh" button on each tab to force immediate update.

---

## 🎨 Styling Guide

### Color Scheme

```css
--bg-primary: #0a0e1a      /* Dark navy background */
--accent-cyan: #00d4ff      /* Bright cyan accent */
--accent-blue: #0066ff      /* Deep blue accent */
--status-active: #10b981    /* Green for active agents */
--status-idle: #f59e0b      /* Amber for idle agents */
```

### Typography

- **Headers:** Large gradient text (cyan → blue)
- **Body:** Clean sans-serif (Segoe UI, Roboto)
- **Code/Logs:** Monospace (Courier New, Monaco)

### Animations

- **Hover Effects:** 300ms smooth transitions
- **Status Dots:** 2-second pulse animation
- **Card Sweep:** Light shimmer on hover
- **Tab Switch:** Fade in/out (300ms)

---

## 🚀 Scaling for 100+ Agents

Current implementation is **production-ready** for expansion:

### What Works Now

- Grid layout automatically adapts to any number of cards
- API endpoints are stateless (scale with load)
- Database-agnostic (uses filesystem + tmux)

### Future Enhancements (Not MVP)

- **Pagination:** Split large agent lists across pages
- **Filtering:** Filter by status, team, VM, provider
- **Search:** Find agents by name, location, type
- **Agent Types:** Support LXC, cloud, device agents
- **Multi-provider:** Hetzner, AWS, Azure, etc.

---

## 📋 Issue Tracking Template

If issues found during live testing:

```markdown
### Issue: [Title]

**Expected Behavior:**
[What should happen]

**Actual Behavior:**
[What actually happens]

**Steps to Reproduce:**
1. Go to [URL]
2. Click [element]
3. Observe [issue]

**Environment:**
- Browser: [Chrome/Firefox/Safari]
- URL: [oacis.measai.com or localhost:5000]
- Agent: [Claude/Gemini/Codex/Copilot]

**Screenshot/Log:**
[Attach if available]
```

---

## ✅ Sign-Off Checklist

When live testing complete:

- [ ] All 20+ visual tests passed
- [ ] All 5 API endpoints working
- [ ] No console errors
- [ ] Performance acceptable
- [ ] Mobile responsive verified
- [ ] Documentation complete

**Test Report Due:** After live testing on oacis.measai.com

---

**Prepared by:** Copilot (Autonomous Work Check 12:35 UTC)  
**Status:** Ready for QA team
