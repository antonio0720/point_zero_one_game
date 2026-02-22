/**
 * Integrity Page Events Contract
 */

export interface IntegrityPageViewEvent {
    timestamp: number;
    playerId: string;
    gameVersion: string;
}

export interface IntegrityCtaVerifyClickEvent {
    timestamp: number;
    playerId: string;
    gameVersion: string;
    ctaId: string;
}

export interface IntegrityAppendixOpenEvent {
    timestamp: number;
    playerId: string;
    gameVersion: string;
    appendixId: string;
}

export interface AppealSubmittedEvent {
    timestamp: number;
    playerId: string;
    gameVersion: string;
    appealMessage: string;
}

export interface VerificationStatusViewedEvent {
    timestamp: number;
    playerId: string;
    gameVersion: string;
    verificationStatus: string;
}
