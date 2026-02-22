while True:
data = iforest.decision_scores_
drift = np.mean(data) - drift_threshold
if drift > 3:
websocket.send_text(f"DRIFT DETECTED: {drift}")

@app.websocket("/ws/drift")
async def websocket_endpoint(websocket):
await websocket.accept()
try:
await broadcast_drift(websocket)
finally:
await websocket.close()

if __name__ == "__main__":
import uvicorn
uvicorn.run(app, host="0.0.0.0", port=8000)
```

This script initializes an Isolation Forest model with a fixed random state and some synthetic data. When streaming new data, it calculates the drift score based on the decision scores of the Isolation Forest, if the drift is above a threshold (3 in this case), it sends a "DRIFT DETECTED" message to the connected websocket clients. The server runs using Uvicorn on port 8000.

You can extend and adapt this code based on your specific requirements for a production-ready implementation, such as handling incoming data securely, error handling, logging, monitoring, scaling, etc.
