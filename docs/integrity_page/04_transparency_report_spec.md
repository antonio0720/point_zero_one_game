Title: Monthly Integrity Transparency Report Specification

Overview
---------

This document outlines the specifications for the Monthly Integrity Transparency Report (MITR) in Point Zero One Digital's 12-minute financial roguelike game. The MITR aims to provide a clear, concise, and deterministic record of the game's integrity, ensuring transparency and trust among players.

Non-negotiables
----------------

1. **Fields**: The report must include the following fields: Timestamp, Game Version, Player Count, Cheat Detection Count, Ban Count, and Integrity Score.
2. **Aggregation Windows**: Data should be aggregated on a monthly basis to ensure accurate reporting.
3. **Safe Categories**: All categories in the report are considered sensitive and must not be disclosed to potential attackers or unauthorized parties.
4. **No Attacker Help**: The report should not provide any assistance or insights that could potentially aid attackers in exploiting vulnerabilities within the game.

Implementation Spec
--------------------

1. **Timestamp**: The date and time when the report is generated.
2. **Game Version**: The current version of the game at the time of the report generation.
3. **Player Count**: The total number of unique players during the reporting period.
4. **Cheat Detection Count**: The number of instances where cheating was detected and flagged by the system.
5. **Ban Count**: The number of players who were banned due to confirmed cheating activities.
6. **Integrity Score**: A score representing the overall integrity of the game during the reporting period, calculated based on the above metrics.

Edge Cases
----------

1. **Missing Data**: In cases where data is unavailable or incomplete, a note should be included in the report to explain the situation and any potential impact on the reported figures.
2. **Cheat Detection Algorithm Updates**: If there are updates to the cheat detection algorithm during the reporting period, this should be noted in the report, along with any potential impact on the reported figures.
3. **Player Count Discrepancies**: In rare cases where player count discrepancies occur due to technical issues or data corruption, a detailed explanation should be provided in the report.
