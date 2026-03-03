// tslint:disable:no-any strict-type-checking no-console

import { FeatureExtractor } from './feature_extractor';
import { ModelCall } from './model_call';
import { AuditLogger } from '../audit_logger';

export class InferenceGateway {
  private featureExtractor: FeatureExtractor;
  private modelCall: ModelCall;
  private auditLogger: AuditLogger;

  constructor(
    featureExtractor: FeatureExtractor,
    modelCall: ModelCall,
    auditLogger: AuditLogger
  ) {
    this.featureExtractor = featureExtractor;
    this.modelCall = modelCall;
    this.auditLogger = auditLogger;
  }

  async call(inputData: any): Promise<{ output: number[]; auditHash: string }> {
    if (!process.env.ML_ENABLED) {
      throw new Error('ML is disabled');
    }

    const features = await this.featureExtractor.extractFeatures(inputData);
    const output = await this.modelCall.call(features);

    // Ensure output is bounded between 0 and 1
    for (let i = 0; i < output.length; i++) {
      if (output[i] < 0 || output[i] > 1) {
        throw new Error(`Output value ${i} out of bounds: ${output[i]}`);
      }
    }

    const auditHash = this.auditLogger.log(inputData, features, output);

    return { output, auditHash };
  }
}
