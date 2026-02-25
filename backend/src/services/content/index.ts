/**
 * Content service for Point Zero One Digital
 */

import { Request, Response } from 'express';
import { REDIS_CLIENT } from '../config';
import { Card, Deck, Scenario, Ruleset, GameContent } from './interfaces';

interface ContentService {
  getCard(id: string): Promise<Card | null>;
  getDeck(id: string): Promise<Deck | null>;
  getScenario(id: string): Promise<Scenario | null>;
  getRuleset(): Promise<Ruleset | null>;
  listActiveScenarios(): Promise<Scenario[]>;
  publishCardVersion(cardId: string, version: number): Promise<void>;
  retireCard(cardId: string): Promise<void>;
}

const contentService: ContentService = {
  async getCard(id) {
    const cachedContent = await REDIS_CLIENT.get(`content:card:${id}`);
    if (cachedContent) return JSON.parse(cachedContent);

    // Fetch from database and cache the result
    const content = await fetchCardFromDB(id);
    await REDIS_CLIENT.set(`content:card:${id}`, JSON.stringify(content), 'EX', 60 * 60 * 24); // Cache for 1 day
    return content;
  },

  async getDeck(id) {
    const cachedContent = await REDIS_CLIENT.get(`content:deck:${id}`);
    if (cachedContent) return JSON.parse(cachedContent);

    // Fetch from database and cache the result
    const content = await fetchDeckFromDB(id);
    await REDIS_CLIENT.set(`content:deck:${id}`, JSON.stringify(content), 'EX', 60 * 60 * 24); // Cache for 1 day
    return content;
  },

  async getScenario(id) {
    const cachedContent = await REDIS_CLIENT.get(`content:scenario:${id}`);
    if (cachedContent) return JSON.parse(cachedContent);

    // Fetch from database and cache the result
    const content = await fetchScenarioFromDB(id);
    await REDIS_CLIENT.set(`content:scenario:${id}`, JSON.stringify(content), 'EX', 60 * 60 * 24); // Cache for 1 day
    return content;
  },

  async getRuleset() {
    const cachedContent = await REDIS_CLIENT.get(`content:ruleset`);
    if (cachedContent) return JSON.parse(cachedContent);

    // Fetch from database and cache the result
    const content = await fetchRulesetFromDB();
    await REDIS_CLIENT.set(`content:ruleset`, JSON.stringify(content), 'EX', 60 * 60 * 24); // Cache for 1 day
    return content;
  },

  async listActiveScenarios() {
    const activeScenarios = await fetchActiveScenariosFromDB();
    return activeScenarios;
  },

  async publishCardVersion(cardId, version) {
    await updateCardVersionInDB(cardId, version);
  },

  async retireCard(cardId) {
    await retireCardFromDB(cardId);
  },
};

export default contentService;

// Database schema (SQL)
