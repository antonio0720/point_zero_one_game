import { Entity, PrimaryGeneratedColumn, Column, OneToMany, ManyToOne, CreateDateColumn, UpdateDateColumn } from "typeorm";
import { Message } from "./Message";
import { User } from "./User";

@Entity("outbox_messages")
export class OutboxMessage {
@PrimaryGeneratedColumn()
id: number;

@ManyToOne(() => User)
sender: User;

@ManyToOne(() => User, (user) => user.sentMessages)
recipient: User;

@Column({ type: "text" })
messageContent: string;

@OneToMany(() => Message, (message) => message.outboxMessage)
messages: Message[];

@CreateDateColumn()
createdAt: Date;

@UpdateDateColumn()
updatedAt: Date;
}

import { Entity, PrimaryGeneratedColumn, Column, OneToMany, ManyToOne } from "typeorm";
import { OutboxMessage } from "./OutboxMessage";
import { Message } from "./Message";

@Entity("messages")
export class Message {
@PrimaryGeneratedColumn()
id: number;

@ManyToOne(() => OutboxMessage)
outboxMessage: OutboxMessage;

@Column({ type: "text" })
content: string;

@CreateDateColumn()
createdAt: Date;
}
