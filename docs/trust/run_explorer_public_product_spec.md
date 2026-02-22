# Public Run Explorer Product Spec

## Overview

The Public Run Explorer is a web application designed to provide users with an interactive and informative experience of Point Zero One Digital's financial roguelike game, Sovereign. This product offers URL shapes, layouts, Quality of Life (QoL) requirements, privacy rules, conversion surfaces, and anti-abuse posture that cater to a wide range of users.

## Non-Negotiables

1. **URL Shapes**: The URL structure should be clean, intuitive, and SEO-friendly. Each page should have a unique and descriptive slug.
2. **Layouts**: The layout must be responsive, ensuring optimal viewing and interaction experience across various devices and screen sizes.
3. **QoL Requirements**: The application must prioritize user experience by providing clear instructions, easy navigation, and quick load times.
4. **Privacy Rules**: User data privacy is paramount. All collected data should be anonymized, encrypted, and handled in compliance with relevant privacy laws and regulations.
5. **Conversion Surfaces**: The application should include clear calls-to-action (CTAs) to encourage user engagement, such as signing up for updates or purchasing the game.
6. **Anti-Abuse Posture**: Measures must be implemented to prevent abuse, such as rate limiting, CAPTCHA, and IP blocking.

## Implementation Spec

1. **URL Shapes**
   - Home: `/`
   - Game Overview: `/game`
   - Gameplay Guide: `/guide`
   - Privacy Policy: `/privacy-policy`
   - Terms of Service: `/terms-of-service`
   - Contact Us: `/contact`

2. **Layout**
   - Use TypeScript with strict mode and avoid using 'any'.
   - Adopt a modern, mobile-first design approach.
   - Ensure fast load times through efficient code optimization and content delivery network (CDN) usage.

3. **QoL Requirements**
   - Provide clear instructions for gameplay and navigation.
   - Implement search functionality to help users find specific content.
   - Offer a user-friendly interface with easy-to-understand icons and labels.

4. **Privacy Rules**
   - Collect only necessary user data, such as email addresses for newsletters.
   - Anonymize all collected data before storing it securely.
   - Implement HTTPS encryption to protect data in transit.

5. **Conversion Surfaces**
   - Place CTAs strategically throughout the application to encourage users to sign up for updates or purchase the game.
   - Offer incentives, such as discounts or exclusive content, to increase conversion rates.

6. **Anti-Abuse Posture**
   - Implement rate limiting to prevent automated abuse.
   - Use CAPTCHA to verify human users and prevent bot activity.
   - Block IP addresses that exhibit abusive behavior.

## Edge Cases

1. **IP Address Blocking**: Implement a system for temporary unblocking of IP addresses if legitimate users are mistakenly blocked due to abuse.
2. **Data Anonymization**: Ensure that anonymized data can still be used for analytics and improving the user experience without compromising privacy.
