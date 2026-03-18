/** Platform-shell moderation/privacy guard. */
import type { ChatMessage } from './chatTypes';

export type ReportReason = 'HARASSMENT' | 'SPAM' | 'INAPPROPRIATE' | 'CHEATING' | 'OTHER';
export type PrivacyActorType = 'BOT' | 'NPC' | 'PLAYER';

export interface ContentAssessment {
  safe: boolean;
  flags: string[];
}

class ChatPrivacyGuard {
  private muted = new Map<string, { senderName: string; type: PrivacyActorType }>();
  private blocked = new Set<string>();
  private reports: Array<{ senderId: string; senderName: string; reason: ReportReason; at: string; messageId?: string }> = [];

  assessContent(body: string): ContentAssessment {
    const lower = body.toLowerCase();
    const severe = /(kill myself|suicide|self harm|hurt myself)/.test(lower);
    const spam = /(buy now|free crypto|telegram me|whatsapp)/.test(lower);
    const flags = [severe ? 'SEVERE_CONTENT' : '', spam ? 'SPAM' : ''].filter(Boolean);
    return { safe: !severe, flags };
  }

  mute(senderId: string, senderName: string, type: PrivacyActorType) { this.muted.set(senderId, { senderName, type }); }
  unmute(senderId: string) { this.muted.delete(senderId); }
  block(senderId: string) { this.blocked.add(senderId); }
  unblock(senderId: string) { this.blocked.delete(senderId); }
  getMutedList() { return Array.from(this.muted.entries()).map(([senderId, info]) => ({ senderId, ...info })); }

  shouldShowMessage(message: ChatMessage): boolean {
    if (this.blocked.has(message.senderId)) return false;
    if (this.muted.has(message.senderId) && message.senderId !== 'SYSTEM') return false;
    return true;
  }

  enforceDMPrivacy(message: ChatMessage): boolean {
    if (message.channel !== 'DIRECT') return true;
    return Boolean(message.recipientId || message.senderId);
  }

  report(senderId: string, senderName: string, reason: ReportReason, message?: ChatMessage) {
    this.reports.push({ senderId, senderName, reason, at: new Date().toISOString(), messageId: message?.id });
  }
}

export const privacyGuard = new ChatPrivacyGuard();
