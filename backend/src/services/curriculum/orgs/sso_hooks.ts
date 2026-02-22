/**
 * SSO Hooks Service for handling OIDC/SAML integration points for institutions. Not required for consumers.
 */

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SsoHookDocument } from './sso-hook.model';

/**
 * SSO Hook Interface
 */
export interface ISsoHook {
  id: string;
  institutionId: string;
  ssoProvider: string;
  ssoClientId: string;
  ssoCallbackUrl: string;
}

/**
 * SSO Hook Model
 */
export class SsoHook implements ISsoHook {
  id: string;
  institutionId: string;
  ssoProvider: string;
  ssoClientId: string;
  ssoCallbackUrl: string;
}

/**
 * SSO Hook Model Schema
 */
const SsoHookSchema = new mongoose.Schema<SsoHook>({
  institutionId: { type: String, required: true },
  ssoProvider: { type: String, required: true },
  ssoClientId: { type: String, required: true },
  ssoCallbackUrl: { type: String, required: true },
});

/**
 * SSO Hooks Service
 */
@Injectable()
export class SsoHooksService {
  constructor(@InjectModel(SsoHook.name) private readonly model: Model<SsoHookDocument>) {}

  /**
   * Find an SSO hook by institution ID and provider.
   * @param institutionId The institution ID.
   * @param ssoProvider The SSO provider (OIDC/SAML).
   */
  async findOneByInstitutionAndProvider(institutionId: string, ssoProvider: string): Promise<ISsoHook | null> {
    return this.model.findOne({ institutionId, ssoProvider }).exec();
  }

  /**
   * Create an SSO hook for the given institution and provider.
   * @param institutionId The institution ID.
   * @param ssoProvider The SSO provider (OIDC/SAML).
   * @param ssoClientId The SSO client ID.
   * @param ssoCallbackUrl The SSO callback URL.
   */
  async create(institutionId: string, ssoProvider: string, ssoClientId: string, ssoCallbackUrl: string): Promise<ISsoHook> {
    const ssoHook = new this.model({ institutionId, ssoProvider, ssoClientId, ssoCallbackUrl });
    return ssoHook.save();
  }
}
