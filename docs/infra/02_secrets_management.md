# Secrets Management in Point Zero One Digital Infrastructure

## Overview

This document outlines the secrets management policy for Point Zero One Digital, focusing on secret rotation, Vault/AWS Secrets Manager usage, the never-in-env-vars rule, app-level secret references, and audit trails.

## Non-Negotiables

1. **Deterministic Secret Rotation**: All secrets must be rotated in a predictable manner to minimize security risks.
2. **Vault/AWS Secrets Manager Usage**: All sensitive data should be stored securely using either Vault or AWS Secrets Manager.
3. **Never-In-Env-Vars Rule**: Environment variables should never contain sensitive information.
4. **App-Level Secret References**: Apps should reference secrets at the application level, not at the infrastructure level.
5. **Audit Trail**: A comprehensive audit trail must be maintained for all secret operations.

## Implementation Spec

### Secret Rotation Policy

1. Secrets will be rotated on a regular schedule (e.g., monthly or quarterly).
2. Upon rotation, the old secret will be revoked and the new one will be issued.
3. The rotation process should be automated to minimize human error.

### Vault/AWS Secrets Manager Usage

1. Use Vault for secrets management when possible due to its open-source nature and robust features.
2. If Vault is not available, use AWS Secrets Manager as a reliable alternative.
3. Always encrypt secrets before storing them in either Vault or AWS Secrets Manager.

### Never-In-Env-Vars Rule

1. Sensitive information should never be hardcoded into environment variables.
2. Use Vault/AWS Secrets Manager to securely provide sensitive data to applications through environment variables.
3. If a secret is required at the infrastructure level, use an encrypted configuration file instead of environment variables.

### App-Level Secret References

1. Applications should reference secrets directly from Vault or AWS Secrets Manager.
2. Never hardcode secrets into application code or configuration files.
3. Use environment variables to pass secret references to the application, which can then retrieve the actual secret value at runtime.

### Audit Trail

1. Log all secret operations (creation, rotation, deletion) in a centralized location for easy auditing.
2. Include details such as the operation type, timestamp, user performing the operation, and affected secrets in the audit log.
3. Regularly review the audit logs to identify any potential security issues or policy violations.

## Edge Cases

1. **Emergency Rotation**: If a secret is compromised, it may need to be rotated immediately outside of the regular rotation schedule. In such cases, document the reason for emergency rotation in the audit log.
2. **Multi-Cloud Deployments**: When deploying applications across multiple cloud providers, consider using a consistent secrets management solution (e.g., Vault) to simplify management and maintain consistency.
3. **Legacy Applications**: For legacy applications that do not support secret management solutions, consider implementing a secure configuration management system to store and manage sensitive data.
