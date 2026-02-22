ML Rollback + Kill Switch - Instant Disable (Version 9)
======================================================

Overview
--------

This document outlines the Instant Disable feature for ML Rollback and Kill Switch Version 9. The feature allows for immediate shutdown of machine learning models during training or inference to mitigate potential risks associated with unstable or malicious models.

Prerequisites
-------------

1. A functioning ML deployment pipeline that includes model training, validation, and serving components.
2. Access to the configuration management system (e.g., Kubernetes) where the machine learning models are deployed.
3. Familiarity with YAML and Kubernetes objects.
4. The latest version of `kubectl` command-line tool for interacting with a Kubernetes cluster.

Installation
------------

To enable the Instant Disable feature, you will need to modify the relevant deployment configurations for your machine learning models using YAML manifests.

1. In your ML deployment configuration file (e.g., `deployment.yaml`), locate the section defining your machine learning model's pod specification.
2. Add the following annotations to the pod template:

```yaml
annotations:
ml-rollback.example.com/killswitch: "true"
```

3. Save and apply the updated configuration using `kubectl apply -f deployment.yaml`.

Usage
-----

Once the Instant Disable feature is enabled, you can use the `ml-rollback kill-switch` command to temporarily disable a specific machine learning model during training or inference.

1. Run the following command to list all enabled models with kill switches:

```bash
kubectl get pods --field-selector=annotations.ml-rollback\.example\.com/killswitch --output json | jq -r '.items[].metadata.name'
```

2. To disable a specific model (e.g., `my-ml-model`), run the following command:

```bash
kubectl exec -it my-ml-model -- /usr/bin/ml-rollback kill-switch on
```

3. To re-enable a previously disabled model, use the following command:

```bash
kubectl exec -it my-ml-model -- /usr/bin/ml-rollback kill-switch off
```

Best Practices
--------------

1. Test the Instant Disable feature thoroughly in a controlled environment before deploying to production.
2. Document the usage of Instant Disable within your team and organization.
3. Implement monitoring solutions that can detect abnormal behavior and automatically enable or disable models as needed.
4. Ensure that any disruptions caused by model disabling are handled gracefully in your application or system.
5. Regularly review the need for Instant Disable on each machine learning model, especially after model updates.
