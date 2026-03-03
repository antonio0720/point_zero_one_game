// pzo-web/src/main.tsx (or main entry point if different)
import React, { useState } from 'react';
import './styles/pressure-engine.css'; // Import pressure CSS once in the UI tree path that renders run HUD
import RunScreen from './features/run/screens/RunScreen'; // Assuming this component is responsible for rendering the run HUD and uses PressureReader internally.
