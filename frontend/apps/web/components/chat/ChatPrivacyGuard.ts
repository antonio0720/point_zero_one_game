/**
 * ChatPrivacyGuard.ts — PZO Sovereign Chat · Privacy Controls
 * ─────────────────────────────────────────────────────────────────────────────
 * Enforces privacy guarantees:
 *   - DMs are fully private: no bot injection, no game commentary
 *   - Players can mute any bot, NPC, or other player
 *   - Block list persists across sessions
 *   - Report system for harassment
 *   - Content filtering for inappropriate content
 *
 * FILE LOCATION: frontend/apps/web/components/chat/ChatPrivacyGuard.ts
 * Density6 LLC · Point Zero One · Confidential
 */

import type { ChatMessage, ChatChannel, BotId } from './chatTypes';

// ─── Storage Keys ─────────────────────────────────────────────────────────────

const MUTED_KEY   = 'pzo_chat_muted';
const BLOCKED_KEY = 'pzo_chat_blocked';
const REPORTS_KEY = 'pzo_chat_reports';

// ─── Mute Entry ───────────────────────────────────────────────────────────────

interface MuteEntry {
  id:        string;
  name:      string;
  type:      'BOT' | 'NPC' | 'PLAYER';
  mutedAt:   number;
  expiresAt: number | null;  // null = permanent, timestamp = temporary
}

// ─── Report Entry ─────────────────────────────────────────────────────────────

export interface ReportEntry {
  reportId:    string;
  reportedId:  string;
  reportedName: string;
  reason:      'HARASSMENT' | 'SPAM' | 'INAPPROPRIATE' | 'CHEATING' | 'OTHER';
  messageId:   string;
  messageBody: string;
  reportedAt:  number;
  status:      'PENDING' | 'REVIEWED' | 'ACTIONED';
}

// ─── Privacy Guard ────────────────────────────────────────────────────────────

export class ChatPrivacyGuard {
  private mutedIds:   Map<string, MuteEntry> = new Map();
  private blockedIds: Set<string> = new Set();
  private reports:    ReportEntry[] = [];

  constructor() {
    this.loadFromStorage();
  }

  // ─── Mute System ────────────────────────────────────────────────────────

  mute(id: string, name: string, type: MuteEntry['type'], durationMs?: number): void {
    const entry: MuteEntry = {
      id, name, type,
      mutedAt: Date.now(),
      expiresAt: durationMs ? Date.now() + durationMs : null,
    };
    this.mutedIds.set(id, entry);
    this.saveToStorage();
  }

  unmute(id: string): void {
    this.mutedIds.delete(id);
    this.saveToStorage();
  }

  isMuted(id: string): boolean {
    const entry = this.mutedIds.get(id);
    if (!entry) return false;
    // Check expiration
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.mutedIds.delete(id);
      this.saveToStorage();
      return false;
    }
    return true;
  }

  getMutedList(): MuteEntry[] {
    // Clean expired entries
    const now = Date.now();
    for (const [id, entry] of this.mutedIds) {
      if (entry.expiresAt && now > entry.expiresAt) {
        this.mutedIds.delete(id);
      }
    }
    this.saveToStorage();
    return Array.from(this.mutedIds.values());
  }

  muteAllBots(): void {
    const bots: Array<{ id: string; name: string }> = [
      { id: 'BOT_01_LIQUIDATOR', name: 'THE LIQUIDATOR' },
      { id: 'BOT_02_BUREAUCRAT', name: 'THE BUREAUCRAT' },
      { id: 'BOT_03_MANIPULATOR', name: 'THE MANIPULATOR' },
      { id: 'BOT_04_CRASH_PROPHET', name: 'THE CRASH PROPHET' },
      { id: 'BOT_05_LEGACY_HEIR', name: 'THE LEGACY HEIR' },
    ];
    for (const bot of bots) {
      this.mute(bot.id, bot.name, 'BOT');
    }
  }

  unmuteAllBots(): void {
    const botIds = ['BOT_01_LIQUIDATOR', 'BOT_02_BUREAUCRAT', 'BOT_03_MANIPULATOR', 'BOT_04_CRASH_PROPHET', 'BOT_05_LEGACY_HEIR'];
    for (const id of botIds) {
      this.unmute(id);
    }
  }

  // ─── Block System ───────────────────────────────────────────────────────

  block(id: string): void {
    this.blockedIds.add(id);
    this.saveToStorage();
  }

  unblock(id: string): void {
    this.blockedIds.delete(id);
    this.saveToStorage();
  }

  isBlocked(id: string): boolean {
    return this.blockedIds.has(id);
  }

  getBlockedList(): string[] {
    return Array.from(this.blockedIds);
  }

  // ─── Report System ──────────────────────────────────────────────────────

  report(
    reportedId: string,
    reportedName: string,
    reason: ReportEntry['reason'],
    message: ChatMessage,
  ): ReportEntry {
    const entry: ReportEntry = {
      reportId:     `report_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      reportedId,
      reportedName,
      reason,
      messageId:    message.id,
      messageBody:  message.body.slice(0, 200),
      reportedAt:   Date.now(),
      status:       'PENDING',
    };
    this.reports.push(entry);
    this.saveToStorage();
    return entry;
  }

  getReports(): ReportEntry[] {
    return [...this.reports];
  }

  // ─── Message Filtering ──────────────────────────────────────────────────

  /** Filter a message array, removing muted/blocked senders */
  filterMessages(messages: ChatMessage[]): ChatMessage[] {
    return messages.filter(msg => {
      if (this.isMuted(msg.senderId)) return false;
      if (this.isBlocked(msg.senderId)) return false;
      return true;
    });
  }

  /** Check if a message should be allowed through */
  shouldShowMessage(msg: ChatMessage): boolean {
    if (this.isMuted(msg.senderId)) return false;
    if (this.isBlocked(msg.senderId)) return false;
    return true;
  }

  /** Enforce DM privacy — strip any non-player content from DM channel */
  enforceDMPrivacy(msg: ChatMessage): boolean {
    if (msg.channel !== 'DM') return true;
    // Only PLAYER messages allowed in DMs
    return msg.kind === 'PLAYER' || msg.kind === 'PLAYER_RESPONSE';
  }

  // ─── Content Filter (basic, client-side) ────────────────────────────────

  /** Basic content moderation — flag but don't block (server handles enforcement) */
  assessContent(body: string): { safe: boolean; flags: string[] } {
    const flags: string[] = [];
    const lower = body.toLowerCase();

    // Severe content patterns
    const severePatterns = [
      /\b(k+i+l+l*\s*(your)?self)\b/i,
      /\b(sui?cide)\b/i,
    ];
    for (const p of severePatterns) {
      if (p.test(lower)) flags.push('SEVERE_CONTENT');
    }

    // Personal info patterns (protect privacy)
    const piiPatterns = [
      /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/,  // phone numbers
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z]{2,}\b/i,  // emails
      /\b\d{3}[-]?\d{2}[-]?\d{4}\b/,  // SSN pattern
    ];
    for (const p of piiPatterns) {
      if (p.test(body)) flags.push('POTENTIAL_PII');
    }

    return { safe: flags.length === 0, flags };
  }

  // ─── Persistence ────────────────────────────────────────────────────────

  private loadFromStorage(): void {
    if (typeof window === 'undefined') return;
    try {
      const muted = localStorage.getItem(MUTED_KEY);
      if (muted) {
        const entries: MuteEntry[] = JSON.parse(muted);
        for (const e of entries) this.mutedIds.set(e.id, e);
      }
      const blocked = localStorage.getItem(BLOCKED_KEY);
      if (blocked) {
        const ids: string[] = JSON.parse(blocked);
        for (const id of ids) this.blockedIds.add(id);
      }
      const reports = localStorage.getItem(REPORTS_KEY);
      if (reports) this.reports = JSON.parse(reports);
    } catch { /* ignore corrupt storage */ }
  }

  private saveToStorage(): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(MUTED_KEY, JSON.stringify(Array.from(this.mutedIds.values())));
      localStorage.setItem(BLOCKED_KEY, JSON.stringify(Array.from(this.blockedIds)));
      localStorage.setItem(REPORTS_KEY, JSON.stringify(this.reports.slice(-50)));
    } catch { /* storage full */ }
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export const privacyGuard = new ChatPrivacyGuard();
