/**
 * Event Consumer Framework
 * Per-topic consumers with exactly-once processing, dead-letter-queue handling, schema validation on consume, emit CONSUMER_LAG metric.
 */

import { Consumer as KafkaConsumer } from 'kafkajs';
import { Joi, ValidationError } from 'joi';
import { Metrics } from '@pointzeroonedigital/metrics';
import { DeadLetterQueue } from './dead_letter_queue';

type TopicConfig = {
  topic: string;
  schemaValidator: Joi.Schema;
};

interface EventConsumerOptions {
  topics: TopicConfig[];
  consumerGroupId: string;
  deadLetterQueue: DeadLetterQueue;
}

class EventConsumer {
  private consumer: KafkaConsumer;
  private metrics: Metrics;
  private deadLetterQueue: DeadLetterQueue;

  constructor(options: EventConsumerOptions) {
    this.metrics = new Metrics();
    this.deadLetterQueue = options.deadLetterQueue;

    const consumerConfig = {
      groupId: options.consumerGroupId,
      autoCommit: false,
    };

    this.consumer = new KafkaConsumer({
      brokers: ['kafka-broker'],
      clientId: 'event-consumer',
      ...consumerConfig,
    });

    this.consumer.on('groupMetadataUpdate', (metadata) => {
      metadata.topics().forEach((topic) => {
        this.metrics.gauge('CONSUMER_LAG', topic, this.getConsumerLag(topic));
      });
    });
  }

  private async getConsumerLag(topic: string): Promise<number> {
    const currentOffset = await this.consumer.getOffset(topic);
    const latestOffset = await this.consumer.getCommitOffset(topic);
    return currentOffset - latestOffset;
  }

  private async consume(message: KafkaConsumer.Message) {
    try {
      const validatedEvent = this.validateEventSchema(message.value);
      // Process the event here (game engine or replay logic)
      await processEvent(validatedEvent);
      await this.consumer.commit(message);
    } catch (error) {
      console.error(`Error processing message from ${message.topic}:`, error);
      await this.deadLetterQueue.enqueue(message);
    }
  }

  private validateEventSchema(event: any): any {
    const schema = this.getTopicSchema(event.topic);
    const { error, value } = schema.validate(event);

    if (error) {
      throw new ValidationError({ message: 'Invalid event schema', details: error });
    }

    return value;
  }

  private getTopicSchema(topic: string): Joi.Schema {
    const topicConfig = this.findTopicConfig(topic);
    if (!topicConfig) {
      throw new Error(`No schema found for topic ${topic}`);
    }
    return topicConfig.schemaValidator;
  }

  private findTopicConfig(topic: string): TopicConfig | undefined {
    return this.consumer.config().topics.find(({ topic: configTopic }) => topic === configTopic);
  }

  public async start() {
    await this.consumer.connect();
    await this.consumer.subscribe({ topic: this.consumer.config().topics });
    await this.consumer.run({
      eachMessage: (message) => this.consume(message),
    });
  }
}

export { EventConsumer };
