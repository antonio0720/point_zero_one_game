#!/usr/bin/env python3
"""
pzo_notifier.py — PZO Sovereign SMS Notifier via iMessage
Uses macOS built-in Messages app — zero installs, zero accounts, zero cost.

USAGE:
  python3 pzo_notifier.py           # run watcher in tmux pane
  python3 pzo_notifier.py --test    # send test text and exit
"""

import json, os, sys, time, signal, argparse, subprocess
from pathlib import Path
from datetime import datetime

TO_NUMBER  = "+18604360540"
STATE_FILE = os.path.expanduser("~/.pzo_unified_state.json")
POLL_SEC   = 8
MILESTONES = {25, 50, 75, 90, 100}

def sms(message: str) -> bool:
    ts = datetime.now().strftime("%H:%M:%S")
    print(f"[{ts}] 📱 {message[:80]}")
    safe = message.replace("\\", "\\\\").replace('"', '\\"')
    for svc_type in ["iMessage", "SMS"]:
        script = f'''
tell application "Messages"
    set targetService to first service whose service type = {svc_type}
    set targetBuddy to buddy "{TO_NUMBER}" of targetService
    send "{safe}" to targetBuddy
end tell
'''
        try:
            r = subprocess.run(["osascript", "-e", script],
                               capture_output=True, text=True, timeout=15)
            if r.returncode == 0:
                label = "iMessage" if svc_type == "iMessage" else "SMS relay"
                print(f"  ✅ Sent via {label}")
                return True
        except Exception:
            continue
    print(f"  ❌ Both iMessage and SMS relay failed")
    return False


class NotifierState:
    def __init__(self):
        self.last_done       = 0
        self.last_failed     = 0
        self.seen_phases     = set()
        self.notified_pcts   = set()
        self.run_done        = False
        self._stall_count    = 0
        self._ollama_alerted = False

    def load(self):
        try:
            return json.loads(Path(STATE_FILE).read_text())
        except Exception:
            return None


def check(s: dict, ns: NotifierState):
    total     = s.get("total_backend", 155) + s.get("total_frontend", 253)
    done      = s.get("done", 0)
    failed    = s.get("failed", 0)
    pct       = int(done * 100 / max(total, 1))
    phases    = s.get("phases", {})
    cur_task  = s.get("current_task", "")
    cur_title = s.get("current_title", "")
    done_be   = s.get("done_backend", 0)
    done_fe   = s.get("done_frontend", 0)

    # Failures
    new_fails = failed - ns.last_failed
    if new_fails > 0:
        sms(f"⚠️ PZO FAILURE\nTask: {cur_task}\n{cur_title[:45]}\nFailed: {failed} | Done: {done}/{total}")
    ns.last_failed = failed

    # Phase completions
    for ph_id, ph_data in phases.items():
        ph_done  = ph_data.get("done", 0)
        ph_total = ph_data.get("total", 0)
        domain   = ph_data.get("domain", "backend")
        icon     = "🔧" if domain == "backend" else "⚛️"
        if ph_total > 0 and ph_done == ph_total and ph_id not in ns.seen_phases:
            ns.seen_phases.add(ph_id)
            label = ph_id.replace("_", " ").title()[:35]
            sms(f"{icon} PHASE DONE\n{label}\n{ph_done} tasks | Overall: {pct}% ({done}/{total})")

    # Milestone %
    for milestone in MILESTONES:
        if pct >= milestone and milestone not in ns.notified_pcts:
            ns.notified_pcts.add(milestone)
            times   = s.get("task_times", [])
            eta_str = ""
            if times and milestone < 100:
                avg    = sum(times[-20:]) / len(times[-20:])
                secs   = int(avg * (total - done))
                h, r   = divmod(secs, 3600)
                m      = r // 60
                eta_str = f"\nETA: {h}h {m}m left"
            if milestone == 100:
                sms(f"🏆 PZO COMPLETE — 100%\n✅ {done} done  ❌ {failed} failed\nBE: {done_be}/155  FE: {done_fe}/253\nSovereign execution complete.")
            else:
                sms(f"🚀 PZO {milestone}% MILESTONE\n✅ {done}/{total} tasks\nBE: {done_be}  FE: {done_fe}{eta_str}")

    # Ollama hit rate low
    hits      = s.get("ollama_hits", 0)
    fallbacks = s.get("ollama_fallbacks", 0)
    total_gen = hits + fallbacks
    if total_gen >= 20 and not ns._ollama_alerted:
        hit_pct = int(hits * 100 / total_gen)
        if hit_pct < 30:
            ns._ollama_alerted = True
            sms(f"📋 PZO — Ollama hit rate low\n{hit_pct}% AI generation\nFalling back to templates.")

    # Stall detector — 20 min no progress
    if done == ns.last_done and done > 0:
        ns._stall_count += 1
        if ns._stall_count >= int(1200 / POLL_SEC):
            sms(f"⏰ PZO — Possible stall\nNo progress ~20 min\nStuck on: {cur_task}\nDone: {done}/{total}")
            ns._stall_count = 0
    else:
        ns._stall_count = 0

    ns.last_done = done


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--test", action="store_true")
    args = parser.parse_args()

    if args.test:
        ok = sms("✅ PZO Notifier TEST\niMessage alerts working.\nPhases, failures & milestones incoming.")
        sys.exit(0 if ok else 1)

    ns = NotifierState()
    print(f"📱 PZO iMessage Notifier")
    print(f"   Watching: {STATE_FILE}")
    print(f"   Sending to: {TO_NUMBER}\n")

    sms("⚡ PZO Notifier online\nAlerts active — watching executor run.")

    def _quit(*_):
        print("\n📵 Stopped.")
        sys.exit(0)
    signal.signal(signal.SIGINT,  _quit)
    signal.signal(signal.SIGTERM, _quit)

    while True:
        state = ns.load()
        if state:
            try:
                check(state, ns)
            except Exception as e:
                print(f"  ⚠️  {e}")
        else:
            print(f"  [{datetime.now().strftime('%H:%M:%S')}] waiting for state file…")
        time.sleep(POLL_SEC)


if __name__ == "__main__":
    main()
