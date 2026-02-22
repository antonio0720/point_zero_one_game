# Session 7: ML Layer Phase 5a

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Commands](#commands)
3. [Done Criteria](#done-criteria)
4. [Smoke Tests](#smoke-tests)

## Prerequisites
- Ensure you have completed Session 6: ML Layer Phase 5.
- Verify that all previous sessions' tasks are successfully completed.

## Commands

### Step 1: Update Dependencies
```bash
pip install --upgrade tensorflow==2.4.0
```

### Step 2: Compile Model
```bash
python compile_model.py
```

### Step 3: Train Model
```bash
python train_model.py
```

### Step 4: Deploy Model
```bash
python deploy_model.py
```

## Done Criteria

- The `compile_model.py` script completes without errors.
- The `train_model.py` script completes without errors and achieves an accuracy of at least 95%.
- The model is successfully deployed to the production environment.

## Smoke Tests

### Step 1: Model Performance Check
```bash
python check_model_performance.py
```

### Step 2: API Endpoints Check
```bash
curl -X GET http://localhost:5000/predict
```

### Step 3: UI Integration Check
- Navigate to `http://localhost:5000` in your web browser.
- Verify that the model predictions are displayed correctly.

## Next Steps

- Proceed to Session 8: ML Layer Phase 5b for further enhancements and fine-tuning of the model.
