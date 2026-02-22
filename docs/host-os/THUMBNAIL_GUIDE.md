# Thumbnail Guide for Point Zero One Digital Assets

## Overview

This guide provides instructions on how to use `thumbnail_text.csv` for creating thumbnails that adhere to our design principles and ensure consistency across all assets.

## Non-negotiables

1. **Font Recommendations**: Use the primary font, `Roboto`, for all thumbnail text. In case of headings, use `Roboto Bold`. For secondary text, use `Roboto Regular`.

2. **Contrast Rules**: Ensure high contrast between the thumbnail background and text color to maintain readability. The recommended color combination is a dark thumbnail with light text.

3. **3-Line Max Rule**: Each thumbnail should contain no more than three lines of text. If additional information is required, consider using abbreviations or bullet points.

4. **Deterministic Effects**: All visual effects applied to the thumbnails must be deterministic to ensure consistency across different platforms and devices.

## Implementation Spec

1. Open `thumbnail_text.csv` in a text editor that supports CSV files (e.g., Microsoft Excel, Google Sheets, or LibreOffice Calc).

2. Each row represents a thumbnail with the following columns:
   - `family`: The moment family the thumbnail belongs to, as described in the game's text.
   - `heading`: The main heading for the thumbnail (up to 30 characters).
   - `subheading`: A secondary heading or additional information (up to 30 characters).
   - `text`: The primary text content for the thumbnail (up to 60 characters per line, with a maximum of three lines).

3. Save the file in UTF-8 format and name it `thumbnail_text.md`.

4. Convert the CSV file into Markdown using a tool like [csv2markdown](https://github.com/jim-nielsen/csv2markdown).

5. Review the generated Markdown file to ensure all formatting is correct and adjust as necessary.

## Edge Cases

In case of longer headings or text, consider breaking them into multiple lines while maintaining readability and adhering to the 3-line max rule. If additional information is required, consult with the design team for guidance on how to present it effectively within the thumbnail.
