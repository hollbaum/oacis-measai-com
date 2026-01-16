from __future__ import annotations

import json
import os
import subprocess
from datetime import datetime
from typing import Any, Dict, List

from flask import Flask, jsonify, render_template


DEFAULT_AGENTS = ["Claude", "Gemini", "Codex", "Copilot"]

APP_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.environ.get(
    "REPO_ROOT", os.path.abspath(os.path.join(APP_DIR, "..", ".."))
)
AI_AGENTS_DIR = os.path.join(REPO_ROOT, "AI_Agents")
OPER_STATE_PATH = os.path.join(
    AI_AGENTS_DIR, "shared", "memory", "operational_state.json"
)

app = Flask(__name__)


def _normalize_agent(name: str, agents: List[str]) -> str | None:
    for agent in agents:
        if agent.lower() == name.lower():
            return agent
    return None


def _agent_entries() -> List[Dict[str, Any]]:
    config = _load_agents_config()
    agent_entries = config.get("agents", []) if isinstance(config, dict) else []
    entries: List[Dict[str, Any]] = []

    for entry in agent_entries:
        name = entry.get("name")
        if not name:
            continue
        entries.append(
            {
                "name": name,
                "session": entry.get("session", f"{name.lower()}_session"),
                "host": entry.get("host", "vm100"),
                "type": entry.get("type", "lxc"),
            }
        )

    if not entries:
        for name in DEFAULT_AGENTS:
            entries.append(
                {
                    "name": name,
                    "session": f"{name.lower()}_session",
                    "host": "vm100",
                    "type": "lxc",
                }
            )

    return entries


def _find_agent_entry(name: str) -> Dict[str, Any] | None:
    entries = _agent_entries()
    names = [entry["name"] for entry in entries]
    normalized = _normalize_agent(name, names)
    if not normalized:
        return None
    return next((entry for entry in entries if entry["name"] == normalized), None)


def _tmux_sessions() -> List[str]:
    try:
        result = subprocess.run(
            ["tmux", "list-sessions", "-F", "#{session_name}"],
            check=True,
            capture_output=True,
            text=True,
        )
    except (subprocess.CalledProcessError, FileNotFoundError):
        return []
    return [line.strip() for line in result.stdout.splitlines() if line.strip()]


def _tmux_capture(session: str, lines: int = 50) -> str:
    result = subprocess.run(
        ["tmux", "capture-pane", "-t", session, "-p", "-S", f"-{lines}"],
        check=True,
        capture_output=True,
        text=True,
    )
    return result.stdout


def _load_operational_state() -> Dict[str, Any]:
    try:
        with open(OPER_STATE_PATH, "r", encoding="utf-8") as handle:
            return json.load(handle)
    except (FileNotFoundError, json.JSONDecodeError):
        return {}


def _load_agents_config() -> Dict[str, Any]:
    path = os.path.join(APP_DIR, "config", "agents.json")
    try:
        with open(path, "r", encoding="utf-8") as handle:
            return json.load(handle)
    except (FileNotFoundError, json.JSONDecodeError):
        return {"agents": [{"name": name} for name in DEFAULT_AGENTS]}


def _agent_status() -> List[Dict[str, Any]]:
    sessions = set(_tmux_sessions())
    state = _load_operational_state()
    agents_info = []

    agent_entries = _agent_entries()
    for entry in agent_entries:
        agent = entry["name"]
        session_name = entry["session"]
        running = session_name in sessions
        meta = state.get(agent, {}) if isinstance(state, dict) else {}
        agents_info.append(
            {
                "name": agent,
                "session": session_name,
                "running": running,
                "status": meta.get("status"),
                "current_task": meta.get("current_task"),
                "focus_file": meta.get("focus_file"),
                "last_heartbeat": meta.get("last_heartbeat"),
                "host": entry.get("host"),
                "type": entry.get("type"),
            }
        )

    return agents_info


def _agent_dir(agent: str) -> str:
    return os.path.join(AI_AGENTS_DIR, agent)


def _list_agent_files(agent: str) -> List[Dict[str, Any]]:
    base = _agent_dir(agent)
    entries = []
    for name in sorted(os.listdir(base)):
        if name.startswith("."):
            continue
        path = os.path.join(base, name)
        try:
            stat = os.stat(path)
        except FileNotFoundError:
            continue
        entries.append(
            {
                "name": name,
                "path": os.path.relpath(path, REPO_ROOT),
                "type": "dir" if os.path.isdir(path) else "file",
                "size": stat.st_size,
                "mtime": datetime.utcfromtimestamp(stat.st_mtime).isoformat() + "Z",
            }
        )
    return entries


def _tail_file(path: str, max_lines: int = 200) -> List[str]:
    try:
        with open(path, "r", encoding="utf-8", errors="replace") as handle:
            lines = handle.readlines()
    except FileNotFoundError:
        return []
    return [line.rstrip("\n") for line in lines[-max_lines:]]


@app.route("/")
def index() -> str:
    agents = _agent_status()
    return render_template("index.html", agents=agents)


@app.route("/agent/<name>")
def agent_detail(name: str) -> str:
    entry = _find_agent_entry(name)
    if not entry:
        return render_template("agent.html", name=name, error="Unknown agent"), 404
    return render_template("agent.html", name=entry["name"])


@app.route("/api/tmux/<name>")
def tmux_output(name: str):
    entry = _find_agent_entry(name)
    if not entry:
        return jsonify({"error": "unknown_agent"}), 404
    try:
        output = _tmux_capture(entry["session"])
    except subprocess.CalledProcessError as exc:
        return jsonify({"error": "tmux_capture_failed", "details": str(exc)}), 500
    return jsonify({"output": output})


@app.route("/api/files/<name>")
def list_files(name: str):
    entry = _find_agent_entry(name)
    if not entry:
        return jsonify({"error": "unknown_agent"}), 404
    base = _agent_dir(entry["name"])
    if not os.path.isdir(base):
        return jsonify({"error": "agent_dir_missing"}), 404
    return jsonify({"files": _list_agent_files(entry["name"])})


@app.route("/api/logs/<name>")
def get_logs(name: str):
    entry = _find_agent_entry(name)
    if not entry:
        return jsonify({"error": "unknown_agent"}), 404
    log_path = os.path.join(_agent_dir(entry["name"]), "daily-activity.log")
    return jsonify({"logs": _tail_file(log_path)})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False)
