# Point Zero One Game LiveOps Surfaces Specification

## Overview

This document outlines the specifications for the Point Zero One Game LiveOps surfaces, encompassing the Patch Note Cards feed, Community Pinned Posts, and 'What Changed?' tooltip logic. These features are designed to provide a seamless and informative experience for players.

## Non-Negotiables

1. **Markdown Compatibility**: All content must be compatible with Markdown syntax for easy editing and formatting.
2. **Deterministic Behavior**: The implementation of all features should maintain the deterministic nature of Point Zero One Digital's games, ensuring consistent results across different runs.
3. **Strict TypeScript**: All code adheres to strict TypeScript mode to ensure type safety and avoid runtime errors.
4. **No 'Any' Type**: The use of the 'any' type is strictly prohibited in TypeScript to maintain type safety and readability.
5. **Production-Grade**: All implementations are designed for production-grade deployment, ensuring robustness and scalability.

## Implementation Spec

### Patch Note Cards Feed

1. **Data Source**: The feed should be populated from a centralized database containing all game updates and patches.
2. **Display**: Each card should display the patch number, date, and a summary of changes in an easily digestible format.
3. **Sorting**: Cards should be sorted by descending order of patch number for easy navigation to the latest updates.
4. **Pagination**: Implement pagination to manage large amounts of data and improve load times.
5. **Search Functionality**: Include a search bar to allow users to quickly find specific patches based on keywords.

### Community Pinned Posts

1. **Data Source**: Pinned posts should be sourced from the community management team or moderators.
2. **Display**: Each post should display the username, title, and content of the post.
3. **Prominence**: Pinned posts should be displayed prominently on the game's main interface to ensure visibility.
4. **Moderation**: Implement a system for moderating pinned posts to remove inappropriate or outdated content.

### 'What Changed?' Tooltip Logic

1. **Trigger**: The tooltip should be triggered by hovering over a specific game element (e.g., an item, building, etc.) that has been updated.
2. **Content**: The tooltip should display the changes made to the selected game element, including any new abilities, stats, or visual updates.
3. **Persistence**: Tooltips should persist until the user clicks elsewhere or dismisses the tooltip manually.
4. **Efficiency**: Ensure the tooltip logic is optimized for performance and does not negatively impact game performance.

## Edge Cases

1. **Offline Mode**: Implement caching mechanisms to ensure that content remains accessible even when the user is offline.
2. **Game Updates**: Account for game updates that may require changes to the LiveOps surfaces, such as UI redesigns or new features.
3. **Language Support**: Ensure compatibility with multiple languages to cater to a global audience.
