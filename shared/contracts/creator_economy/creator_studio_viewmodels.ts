/**
 * Creator Studio View Models
 */

export interface BuilderViewModel {
    id: number;
    creatorId: number;
    name: string;
    description?: string;
    previewImageUrl?: string;
    isPublished: boolean;
}

export interface PreviewViewModel {
    id: number;
    builderId: number;
    imageUrl: string;
}

export interface MetersViewModel {
    id: number;
    builderId: number;
    difficulty: number;
    length: number;
    complexity: number;
}

export interface TrackerViewModel {
    id: number;
    builderId: number;
    playCount: number;
    winCount: number;
    lossCount: number;
    averagePlayTime: number;
}

export interface FixlistViewModel {
    id: number;
    builderId: number;
    title: string;
    description?: string;
    isFixed: boolean;
}

export interface ReceiptsTimelineViewModel {
    id: number;
    creatorStudioId: number;
    receiptId: number;
    timestamp: Date;
    amount: number;
}
