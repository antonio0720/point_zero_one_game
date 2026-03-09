/**
 * Notification Service
 */

import { Injectable } from '@nestjs/common';
import * as apn from 'apn';
import * as fcm from 'fcm-node';
import * as nodemailer from 'nodemailer';
import * as twilio from 'twilio';

/**
 * APNs Config
 */
const apnsConfig = {
  production: true,
  key: 'path/to/your/apns-production-key.p8',
  teamId: 'your-team-id',
};

/**
 * FCM Config
 */
const fcmConfig = {
  serverKey: 'path/to/your/server-key.json',
};

/**
 * Sendgrid Config
 */
const sendgridConfig = new nodemailer.SendGrid({
  apiKey: 'your-sendgrid-api-key',
});

/**
 * Twilio Config
 */
const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

/**
 * Notification Service Interface
 */
interface NotificationService {
  sendEmail(to: string, subject: string, body: string): Promise<void>;
  sendApnsNotification(deviceToken: string, payload: apn.Payload): Promise<void>;
  sendFcmNotification(registrationToken: string, payload: fcm.Message): Promise<void>;
  sendSms(to: string, body: string): Promise<void>;
}

/**
 * Notification Service Implementation
 */
@Injectable()
export class NotificationService implements NotificationService {
  private readonly apns = new apn.Provider(apnsConfig);
  private readonly fcm = new fcm(fcmConfig);

  async sendEmail(to: string, subject: string, body: string): Promise<void> {
    const mailOptions = {
      from: 'your-email@example.com',
      to,
      subject,
      text: body,
    };

    await sendgridConfig.sendMail(mailOptions);
  }

  async sendApnsNotification(deviceToken: string, payload: apn.Payload): Promise<void> {
    const notification = new apn.Notification();
    notification.expiry = Math.floor(Date.now() / 1000) + 3600; // Notification expires in 1 hour
    notification.payload = payload;
    notification.deviceToken = Buffer.from(deviceToken, 'hex');

    await this.apns.sendNotification(notification);
  }

  async sendFcmNotification(registrationToken: string, payload: fcm.Message): Promise<void> {
    await this.fcm.send(payload, registrationToken);
  }

  async sendSms(to: string, body: string): Promise<void> {
    const message = await twilioClient.messages.create({
      from: 'your-twilio-number',
      to,
      body,
    });

    console.log(`Sent SMS with ID ${message.sid}`);
  }
}
