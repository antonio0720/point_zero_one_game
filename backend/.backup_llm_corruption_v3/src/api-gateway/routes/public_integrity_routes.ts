/**
 * Public Integrity Routes for Point Zero One Digital's Financial Roguelike Game API Gateway
 */

import express from 'express';
import { RateLimiterRedis } from 'rate-limiter-flexible';
import redisClient from '../redis/client';
import IntegrityService from './integrity.service';

const router = express.Router();
const rateLimiter = new RateLimiterRedis({ storeClient: redisClient, keyPrefix: 'exploit_reports' });

/**
 * Get all exploit reports with caching and rate limiting
 */
router.get('/exploit-reports', async (req, res) => {
  try {
    await rateLimiter.consume(req.ip);
    const integrityService = new IntegrityService();
    const reports = await integrityService.getAllReports();
    res.json(reports);
  } catch (error) {
    res.status(429).send('Too many requests');
  }
});

export { router };

-- Public Integrity Routes SQL Schema

CREATE TABLE IF NOT EXISTS exploit_reports (
  id SERIAL PRIMARY KEY,
  report_data JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_exploit_reports_report_data ON exploit_reports USING gin(report_data jsonb_path_ops);

#!/bin/bash
set -euo pipefail

echo "Creating exploit reports table"
psql -f sql/create_exploit_reports.sql your_database_name

echo "Migrating existing data to new table if any"
psql -c "\copy (SELECT * FROM old_exploit_reports) TO stdout WITH (FORMAT csv, HEADER true)" | psql your_database_name exploit_reports --column-inserts

api_gateway:
  version: '3'
  name: PointZeroOneDigitalApiGateway

resources:
  outputs:
    default:
      value: api_gateway.id

  api_gateways:
    api_gateway:
      type: aws_api_gateway
      properties:
        rest_apis:
          - name: point-zero-one-digital-api
            description: API Gateway for Point Zero One Digital's Financial Roguelike Game
            api_key_source_type: HEADER
            cors_configuration:
              allow_methods:
                - ANY
              allow_origins:
                - '*'
              allow_headers:
                - '*'
            stage_names:
              - prod
            binary_media_types:
              - application/json
            tags:
              - point-zero-one-digital
              - api-gateway

      root_resource_id: ${api_gateway.root_resource_id}

  stages:
    prod:
      type: aws_api_gateway_stage
      properties:
        stage_name: prod
        deployment_id: ${aws_api_gateway_deployment.id}
        rest_api_id: ${aws_api_gateway_rest_api.id}
