// ============================================================================
// VM100 Dashboard - Auto-Refresh & Tab Management
// ============================================================================

const APP_CONFIG = {
  REFRESH_INTERVAL: 10000, // 10 seconds
  MAX_RETRIES: 3,
  RETRY_DELAY: 2000,
};

// Detect if we're on the detail page vs homepage
const isDetailPage = window.location.pathname.startsWith('/agent/');
const agentName = isDetailPage ? extractAgentName() : null;

function extractAgentName() {
  const match = window.location.pathname.match(/\/agent\/(.+)/);
  return match ? match[1] : null;
}

// ============================================================================
// Homepage - Update timestamp
// ============================================================================

if (!isDetailPage) {
  setInterval(() => {
    const lastUpdate = document.getElementById('last-update');
    if (lastUpdate) {
      const now = new Date();
      lastUpdate.textContent = formatTime(now);
    }
  }, 30000); // Update every 30 seconds
}

// ============================================================================
// Detail Page - Tab Management
// ============================================================================

if (isDetailPage) {
  document.addEventListener('DOMContentLoaded', () => {
    initializeTabs();
    initializeRefreshButtons();
    initializeAutoRefresh();
  });

  function initializeTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabPanels = document.querySelectorAll('.tab-panel');

    tabButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const tabName = btn.getAttribute('data-tab');

        // Deactivate all tabs
        tabButtons.forEach((b) => b.classList.remove('active'));
        tabPanels.forEach((p) => p.classList.remove('active'));

        // Activate selected tab
        btn.classList.add('active');
        const activePanel = document.querySelector(
          `.tab-panel[data-tab="${tabName}"]`
        );
        if (activePanel) {
          activePanel.classList.add('active');

          // Load data for the new tab
          if (tabName === 'tmux') {
            loadTmuxOutput();
          } else if (tabName === 'files') {
            loadFilesList();
          } else if (tabName === 'logs') {
            loadLogs();
          }
        }
      });
    });

    // Load initial content (tmux tab is active by default)
    loadTmuxOutput();
  }

  function initializeRefreshButtons() {
    const refreshTmuxBtn = document.getElementById('refresh-tmux');
    const refreshFilesBtn = document.getElementById('refresh-files');
    const refreshLogsBtn = document.getElementById('refresh-logs');
    const fullscreenBtn = document.getElementById('fullscreen-tmux');

    if (refreshTmuxBtn) {
      refreshTmuxBtn.addEventListener('click', () => loadTmuxOutput());
    }
    if (refreshFilesBtn) {
      refreshFilesBtn.addEventListener('click', () => loadFilesList());
    }
    if (refreshLogsBtn) {
      refreshLogsBtn.addEventListener('click', () => loadLogs());
    }
    if (fullscreenBtn) {
      fullscreenBtn.addEventListener('click', () => toggleFullscreen());
    }
  }

  function initializeAutoRefresh() {
    const autoRefreshCheckbox = document.getElementById('auto-refresh');
    if (!autoRefreshCheckbox) return;

    // Load saved preference
    const savedPreference = localStorage.getItem('auto-refresh-enabled');
    if (savedPreference !== null) {
      autoRefreshCheckbox.checked = JSON.parse(savedPreference);
    }

    autoRefreshCheckbox.addEventListener('change', (e) => {
      localStorage.setItem('auto-refresh-enabled', e.target.checked);
      if (e.target.checked) {
        startAutoRefresh();
      } else {
        stopAutoRefresh();
      }
    });

    // Start auto-refresh if enabled
    if (autoRefreshCheckbox.checked) {
      startAutoRefresh();
    }
  }

  let refreshIntervalId = null;

  function startAutoRefresh() {
    if (refreshIntervalId) return; // Already running

    refreshIntervalId = setInterval(() => {
      const activeTab = document.querySelector('.tab-btn.active');
      if (activeTab) {
        const tabName = activeTab.getAttribute('data-tab');
        if (tabName === 'tmux') {
          loadTmuxOutput();
        }
      }
    }, APP_CONFIG.REFRESH_INTERVAL);
  }

  function stopAutoRefresh() {
    if (refreshIntervalId) {
      clearInterval(refreshIntervalId);
      refreshIntervalId = null;
    }
  }

  function loadTmuxOutput() {
    const tmuxOutput = document.getElementById('tmux-output');
    const loading = document.getElementById('tmux-loading');

    if (!tmuxOutput || !agentName) return;

    showLoading(loading);

    fetch(`/api/tmux/${agentName}`)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        return response.json();
      })
      .then((data) => {
        if (data.output) {
          tmuxOutput.textContent = data.output;
          tmuxOutput.classList.remove('empty');
        } else {
          tmuxOutput.textContent = '(No output)';
          tmuxOutput.classList.add('empty');
        }
        updateTimestamp();
      })
      .catch((error) => {
        console.error('Error fetching tmux output:', error);
        tmuxOutput.textContent = `Connection lost: ${error.message}`;
        tmuxOutput.classList.add('empty');
      })
      .finally(() => {
        hideLoading(loading);
      });
  }

  function loadFilesList() {
    const filesList = document.getElementById('files-list');
    const loading = document.getElementById('files-loading');

    if (!filesList || !agentName) return;

    showLoading(loading);

    fetch(`/api/files/${agentName}`)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        return response.json();
      })
      .then((data) => {
        if (!data.files || data.files.length === 0) {
          filesList.innerHTML =
            '<p style="grid-column: 1/-1; text-align: center; color: var(--text-secondary);">No files found</p>';
          return;
        }

        filesList.innerHTML = data.files
          .map((file) => {
            const icon =
              file.type === 'dir' ? '�' : getFileIcon(file.name);
            const sizeStr =
              file.type === 'dir' ? '—' : formatFileSize(file.size);
            return `
          <div class="file-item">
            <div class="file-icon">${icon}</div>
            <div class="file-name">${escapeHtml(file.name)}</div>
            <div class="file-type">${file.type}</div>
            <div class="file-meta">
              <span>${sizeStr}</span>
              <span>${formatDate(file.mtime)}</span>
            </div>
          </div>
        `;
          })
          .join('');

        updateTimestamp();
      })
      .catch((error) => {
        console.error('Error fetching files:', error);
        filesList.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: #ff6b6b;">Error: ${error.message}</p>`;
      })
      .finally(() => {
        hideLoading(loading);
      });
  }

  function loadLogs() {
    const logsOutput = document.getElementById('logs-output');
    const loading = document.getElementById('logs-loading');

    if (!logsOutput || !agentName) return;

    showLoading(loading);

    fetch(`/api/logs/${agentName}`)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        return response.json();
      })
      .then((data) => {
        if (!data.logs || data.logs.length === 0) {
          logsOutput.innerHTML =
            '<p style="text-align: center; color: var(--text-secondary);">No activity logs found</p>';
          return;
        }

        logsOutput.innerHTML = data.logs
          .map((log) => `<div class="log-entry">${escapeHtml(log)}</div>`)
          .join('');

        updateTimestamp();
      })
      .catch((error) => {
        console.error('Error fetching logs:', error);
        logsOutput.innerHTML = `<p style="text-align: center; color: #ff6b6b;">Error: ${error.message}</p>`;
      })
      .finally(() => {
        hideLoading(loading);
      });
  }

  function toggleFullscreen() {
    const tmuxOutput = document.getElementById('tmux-output');
    if (tmuxOutput) {
      tmuxOutput.classList.toggle('fullscreen');
    }
  }

  // ============================================================================
  // Utility Functions
  // ============================================================================

  function showLoading(element) {
    if (element) {
      element.classList.remove('hidden');
    }
  }

  function hideLoading(element) {
    if (element) {
      element.classList.add('hidden');
    }
  }

  function updateTimestamp() {
    const lastUpdate = document.getElementById('last-update');
    if (lastUpdate) {
      lastUpdate.textContent = `Last updated: ${formatTime(new Date())}`;
    }
  }

  function formatTime(date) {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  }

  function formatDate(isoString) {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString();
  }

  function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return (bytes / Math.pow(k, i)).toFixed(1) + ' ' + sizes[i];
  }

  function getFileIcon(filename) {
    if (filename.endsWith('.md')) return '📝';
    if (filename.endsWith('.py')) return '🐍';
    if (filename.endsWith('.js')) return '📜';
    if (filename.endsWith('.json')) return '📋';
    if (filename.endsWith('.log')) return '📋';
    if (filename.endsWith('.txt')) return '📄';
    return '📄';
  }

  function escapeHtml(text) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
  }
}
