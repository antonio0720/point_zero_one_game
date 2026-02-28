import { EventBus } from "./event_bus"; // Adjust the import path as necessary
import * as moment from 'moment';

export function registerPressureTelemetry(eventBus: EventBus): void {
    eventBus.on("PRESSURE_SCORE_UPDATED", (score, tickNumber) => {
        const timestamp = moment().unix(); // Or use a more precise time-tracking library if needed
        eventBus.emit({
            ticketNumber: tickNumber, 
            score: normalizeScore(score),
            tier: getPressureTierFromScore(score),
            type: "PRESSURE_SCORE_UPDATED",
            timestamp: timestamp
        });
    });
    
    eventBus.on("PRESSURE_TIER_CHANGED", (tier) => {
        const timestamp = moment().unix(); // Or use a more precise time-tracking library if needed
        eventBus.emit({
            ticketNumber: -1, 
            score: normalizeScore(0),
            tier: getPressureTierFromScore(0),
            type: "PRESSURE_TIER_CHANGED",
            timestamp: timestamp
        });
    });
    
    eventBus.on("PRESSURE_CRITICAL_ENTERED", () => {
        const timestamp = moment().unix(); // Or use a more precise time-tracking library if needed
        eventBus.emit({
            ticketNumber: -1, 
            score: normalizeScore(0),
            tier: getPressureTierFromScore(-Infinity),
            type: "PRESSURE_CRITICAL_ENTERED",
            timestamp: timestamp
        });
    });
}

function normalizeScore(score: number): number {
    // Implement score normalization logic here, e.g., scaling or capping the value if necessary
    return Math.min(Math.max(score, 0), Infinity);
}

function getPressureTierFromScore(score: number): string {
    // Define tiers based on score ranges and implement logic here to determine tier from a given score
    const thresholds = [1000, 5000, 10000]; // Example threshold values for different pressure levels/tiers
    let tier: string;
    
    if (score <= thresholds[0]) {
        tier = 'Low';
    } else if (score <= thresholds[1]) {
        tier = 'Medium';
    } else if (score <= thresholds[2]) {
        tier = 'High';
    } else {
        tier = 'Critical'; // Assuming scores above the highest threshold are critical pressure levels
    }
    
    return tier;
}
