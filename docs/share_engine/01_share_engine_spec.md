# Auto-Clip Capture Spec for Share Engine

## Overview

This document outlines the specifications for the auto-clip capture feature in the Point Zero One Digital's Share Engine. The feature captures a 12-minute segment of gameplay, with a decision frame at the center, and records 5 seconds before and after the moment for analysis. The captured footage is vertically exported at a resolution of 1080x1920 pixels.

## Non-Negotiables

1. **Duration**: The feature must capture a 12-minute segment of gameplay, with 5 seconds before and after the decision frame for context and reaction analysis.
2. **Resolution**: The footage must be vertically exported at a resolution of 1080x1920 pixels to ensure clarity and detail.
3. **Decision Frame**: The decision frame is crucial, marking the moment of interest during gameplay.
4. **Moment Classification Triggers**: The system should automatically classify moments based on predefined triggers such as significant financial events or strategic decisions.
5. **Caption Overlay Format**: Captions must be overlaid on the footage in a clear and readable format, providing context and analysis of the captured moments.

## Implementation Spec

1. **Capture Segment**: The system should initiate capture 5 seconds before the decision frame, record the decision frame itself, and continue recording for another 5 seconds after the decision frame.
2. **Export Resolution**: The footage should be vertically exported at a resolution of 1080x1920 pixels to ensure clarity and detail.
3. **Moment Classification**: Moments should be automatically classified based on predefined triggers such as significant financial events or strategic decisions.
4. **Caption Overlay**: Captions must be overlaid on the footage in a clear and readable format, providing context and analysis of the captured moments.

## Edge Cases

1. **Long Decision Frames**: In cases where a decision frame extends beyond the 5-second buffer, the system should adjust the capture duration accordingly to ensure that the full decision frame is captured.
2. **Multiple Decision Frames**: If multiple decision frames occur within the 12-minute segment, the system should prioritize the most significant moments based on predefined criteria.
3. **Low Resolution or Pixelated Footage**: In cases where the gameplay footage is of low resolution or pixelated, the system should attempt to enhance the footage using available upscaling techniques to maintain clarity and detail.
