# Design: Google Analytics 4 Integration

This document outlines the strategy for implementing Google Analytics 4 (GA4) to track user engagement and feature performance.

## Objective
Track core user journeys (Story/Lesson generation) and engagement with social/offline features (Printing, Sharing) to understand product usage and improve the AI models.

## Tracking Strategy

### 1. Page Views
- **Home**: Track visits to the main generator.
- **Library**: Track exploration of saved content.
- **Story/Lesson Pages**: Track consumption of specific generated items.

### 2. Custom Events
We will track specific interactive milestones:

| Event Name | Parameters | Trigger |
|------------|------------|---------|
| `generate_story` | `gender`, `age`, `purpose`, `language` | Successful story generation |
| `generate_lesson` | `level`, `tone`, `language` | Successful lesson generation |
| `share_content` | `type` (story/lesson), `platform` | Clicking the Share button |
| `print_content` | `type` (story/lesson) | Clicking the Print button |
| `add_to_favorites` | `type`, `id` | Favoriting an item |
| `rate_content` | `type`, `rating` | Submitting a rating |

## Implementation Details

### Library
We will use [react-ga4](https://www.npmjs.com/package/react-ga4) for seamless integration with React and React Router.

### Configuration
- **Measurement ID**: Store in `.env` as `VITE_GA_MEASUREMENT_ID`.
- **Initialization**: Initialize in `App.tsx` or `main.tsx`.

### Analytics Hook
A custom hook `useAnalytics` will be created to wrap GA4 calls, ensuring they only fire in production.

```typescript
// Example usage:
const { trackEvent } = useAnalytics();
trackEvent('generate_story', { purpose: 'adventure' });
```

## Privacy & Ethics
- **No PII**: No names (child/parent), emails, or specific "Additional Info" content will be sent to Google Analytics.
- **Anonymization**: IP anonymization will be enabled by default.
