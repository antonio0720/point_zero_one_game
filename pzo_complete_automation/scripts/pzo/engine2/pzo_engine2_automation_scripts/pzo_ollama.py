#!/usr/bin/env python3
"""pzo_ollama.py — hardened Ollama caller implementing all 5 deadlock-prevention vectors.

THE CORE DEADLOCK:
  subprocess.run(capture_output=True) buffers all stdout into an OS pipe.
  Ollama streams NDJSON. If the buffer fills (~64KB), curl blocks waiting
  for a reader, Python blocks waiting for curl — neither timeout fires.
  Both hang forever. process.communicate() can ALSO deadlock if the hard-kill
  timer thread itself gets blocked.

THE 5-VECTOR FIX (all required, none optional):
  1. subprocess.Popen()            ← NOT subprocess.run — avoids pipe buffer fill
  2. curl --max-time               ← OS-level network timeout
  3. threading.Timer(timeout+15)   ← hard kill if communicate() itself hangs
  4. communicate(timeout=t+10)     ← Python-level process timeout
  5. heartbeat every 30s           ← visible "still alive" so monitor doesn't panic
  BONUS: tiered num_predict        ← prevents pipe overflow at source

VERSION: 2.0.0 (2026-02-27)
"""

from __future__ import annotations

import json
import subprocess
import threading
import time
from dataclasses import dataclass
from typing import Callable, Optional

from pzo_config import OLLAMA_GENERATE_ENDPOINT


@dataclass(frozen=True)
class OllamaResult:
    ok:          bool
    text:        str       # sanitized model output (empty on failure)
    stderr:      str       # curl/process stderr
    rc:          int       # process return code
    duration_s:  float
    model:       str
    timeout_s:   int
    num_predict: int
    failure_reason: str = ""


def call_ollama(
    prompt:      str,
    model:       str,
    timeout_s:   int,
    num_predict: int,
    temperature: float = 0.2,
    top_p:       float = 0.9,
    seed:        Optional[int] = None,
    log_fn:      Callable[[str], None] = lambda _: None,
) -> OllamaResult:
    """Call Ollama /api/generate with full deadlock prevention.

    Args:
        prompt:      Full prompt string (no truncation — caller controls length).
        model:       Ollama model name (e.g. 'phi3:mini', 'qwen3:8b').
        timeout_s:   Task-level timeout. Hard kill fires at timeout_s+15.
        num_predict: Max tokens. MUST be <= 2048 for phi3:mini (deadlock rule).
        temperature: Sampling temperature (default 0.2 for deterministic code gen).
        top_p:       Nucleus sampling (default 0.9).
        seed:        Optional seed for reproducibility.
        log_fn:      Callable receiving heartbeat/kill log messages.

    Returns:
        OllamaResult with ok=True and text set on success.
    """
    t0 = time.time()

    payload: dict = {
        "model":  model,
        "prompt": prompt,
        "stream": False,  # single JSON response — no partial-chunk parsing needed
        "options": {
            "num_predict": int(num_predict),
            "temperature": float(temperature),
            "top_p":       float(top_p),
        },
    }
    if seed is not None:
        payload["options"]["seed"] = int(seed)

    # Vector 2: curl --max-time enforces OS-level timeout
    # --connect-timeout 10 prevents infinite DNS/TCP hang
    # --data-binary @- reads payload from stdin (avoids shell quoting issues)
    cmd = [
        "curl", "-sS",
        "--connect-timeout", "10",
        "--max-time", str(max(30, timeout_s + 20)),
        "-H", "Content-Type: application/json",
        "-X", "POST",
        OLLAMA_GENERATE_ENDPOINT,
        "--data-binary", "@-",
    ]

    # Vector 1: Popen — avoids blocking pipe buffer accumulation
    proc = subprocess.Popen(
        cmd,
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        bufsize=0,  # unbuffered — critical for pipe safety
    )

    # Vector 3: hard-kill timer fires if communicate() itself hangs
    killed = threading.Event()
    def _hard_kill():
        try:
            log_fn(f"[KILL] hard_kill_timer fired at {timeout_s+15}s — terminating curl pid={proc.pid}")
            proc.kill()
        except Exception:
            pass
        killed.set()

    kill_timer = threading.Timer(timeout_s + 15, _hard_kill)
    kill_timer.daemon = True
    kill_timer.start()

    # Vector 5: heartbeat thread emits log every 30s so monitor sees activity
    hb_stop = threading.Event()
    def _heartbeat():
        count = 0
        while not hb_stop.is_set():
            hb_stop.wait(30)
            if not hb_stop.is_set():
                count += 1
                elapsed = int(time.time() - t0)
                log_fn(f"[HB] ollama call alive — {elapsed}s elapsed model={model} hb#{count}")
    hb_thread = threading.Thread(target=_heartbeat, daemon=True)
    hb_thread.start()

    try:
        # Vector 4: communicate() timeout — Python-level safety net
        stdout, stderr = proc.communicate(
            input=json.dumps(payload),
            timeout=timeout_s + 10,
        )
        rc = proc.returncode or 0

        if rc != 0:
            return OllamaResult(
                ok=False, text="", stderr=stderr.strip(), rc=rc,
                duration_s=time.time()-t0, model=model,
                timeout_s=timeout_s, num_predict=num_predict,
                failure_reason=f"curl rc={rc}",
            )

        # Parse Ollama JSON response
        try:
            data = json.loads(stdout)
        except json.JSONDecodeError as e:
            return OllamaResult(
                ok=False, text=stdout[:500], stderr=f"non-JSON from Ollama: {e}",
                rc=0, duration_s=time.time()-t0, model=model,
                timeout_s=timeout_s, num_predict=num_predict,
                failure_reason="json_decode_error",
            )

        text = (data.get("response") or "").strip()
        if not text:
            return OllamaResult(
                ok=False, text="", stderr="empty response field",
                rc=0, duration_s=time.time()-t0, model=model,
                timeout_s=timeout_s, num_predict=num_predict,
                failure_reason="empty_response",
            )

        return OllamaResult(
            ok=True, text=text, stderr=stderr.strip(), rc=0,
            duration_s=time.time()-t0, model=model,
            timeout_s=timeout_s, num_predict=num_predict,
        )

    except subprocess.TimeoutExpired:
        log_fn(f"[TIMEOUT] communicate() expired at {timeout_s+10}s — killing proc")
        try:
            proc.kill()
            proc.communicate(timeout=3)
        except Exception:
            pass
        return OllamaResult(
            ok=False, text="", stderr="TimeoutExpired",
            rc=124, duration_s=time.time()-t0, model=model,
            timeout_s=timeout_s, num_predict=num_predict,
            failure_reason="timeout_expired",
        )

    finally:
        # Always clean up — never leak timers or threads
        try:
            kill_timer.cancel()
        except Exception:
            pass
        hb_stop.set()
        try:
            if proc.poll() is None:
                proc.kill()
        except Exception:
            pass
