/**
 * Sentiment Analyzer service for Point Zero One Digital
 */

import { EventEmitter } from 'events';

interface ISentimentClassifiedEvent {
  message: string;
  sentiment: 'frustration' | 'joy' | 'fear' | 'overconfidence' | 'neutral';
}

class SentimentAnalyzer extends EventEmitter {
  private model: any; // Load the lightweight sentiment analysis model here (< 50ms)

  constructor() {
    super();
    this.loadModel();
  }

  private loadModel(): void {
    // Implement loading of the lightweight sentiment analysis model here
  }

  public classify(message: string): void {
    const sentiment = this.model.classify(message);
    this.emit('SentimentClassified', { message, sentiment });
  }
}

export default SentimentAnalyzer;

Regarding the SQL schema, it's important to note that since no message content is stored beyond classification, there won't be a need for any tables in this case. However, if you require a table for logging events or other purposes, here's an example:

CREATE TABLE IF NOT EXISTS sentiment_events (
  id INT PRIMARY KEY AUTO_INCREMENT,
  message TEXT NOT NULL,
  sentiment ENUM('frustration', 'joy', 'fear', 'overconfidence', 'neutral') NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
