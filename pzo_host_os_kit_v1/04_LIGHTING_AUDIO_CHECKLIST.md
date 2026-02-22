# Pzo Host OS Kit v1 - 04_LIGHTING_AUDIO_CHECKLIST

## Overview

This checklist outlines the essential steps for setting up lighting and audio in Phone-only, Lite, and Pro configurations of Point Zero One Digital's financial roguelike game. The focus is on achieving high-quality audio while maintaining a 60-second preflight checklist.

## Non-negotiables

1. **Audio Quality Priority**: Ensure the audio setup prioritizes quality over video to deliver an immersive gaming experience.
2. **Deterministic Effects**: All audio effects must be deterministic to maintain consistency across different devices and configurations.
3. **Strict TypeScript**: Adhere to strict TypeScript mode for all code related to lighting and audio setup. Avoid using 'any'.

## Implementation Spec

### Phone-only Setup

1. Configure the audio engine with a stereo output for mono compatibility.
2. Set the sample rate to 44.1kHz for compatibility with most mobile devices.
3. Optimize audio assets for low file size and high quality.
4. Implement spatial audio if supported by the device.
5. Adjust volume levels to ensure a balanced mix.
6. Test on multiple devices to ensure compatibility.

### Lite Setup

1. Use compressed audio formats (e.g., MP3) for reduced file size.
2. Prioritize essential sound effects and music over ambient sounds.
3. Implement dynamic loading of audio assets based on device capabilities.
4. Optimize audio processing to minimize CPU usage.
5. Test on a variety of devices to ensure performance and compatibility.

### Pro Setup

1. Use lossless audio formats (e.g., WAV) for superior sound quality.
2. Include all sound effects, music, and ambient sounds.
3. Implement advanced spatial audio techniques like Dolby Atmos if supported by the device.
4. Optimize audio processing for high-end devices with powerful CPUs.
5. Test on a variety of high-end devices to ensure optimal performance.

## Edge Cases

1. **Device Compatibility**: Ensure compatibility with various devices by testing on multiple platforms and adjusting settings as needed.
2. **Audio Format Conversion**: Convert audio assets between formats (e.g., WAV to MP3) using lossless conversion methods to maintain quality.
3. **Dynamic Audio Loading**: Implement dynamic loading of audio assets based on device capabilities to ensure optimal performance across devices.
