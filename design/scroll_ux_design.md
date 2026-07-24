# Design: Smooth Page Transitions & Scroll Fix

This document outlines the solution for the "jarring scroll" experience when generating content and navigating between pages.

## Problem
1.  **Layout Collapse**: When generation starts on the Home Page, the large input form is replaced by a smaller loading indicator. This reduces the total page height instantly, causing the browser to "jump" the scroll position.
2.  **Stale Scroll Position**: Upon navigating to a new Story or Lesson, the browser often preserves the scroll offset from the previous page, landing the user in the middle of the story instead of at the top.

## Proposed Solutions

### 1. Height Stabilization (The "Anchor" Fix)
We will ensure that the generation area maintains a consistent minimum height whether it's showing the form or the loading state.

- **Implementation**: Wrap the Tabs content in a container with `min-h-[600px]`. 
- **Benefit**: Prevents the footer from jumping up, keeping the viewport stable while the AI works.

### 2. Global Scroll Reset (The "Fresh Start" Fix)
Ensure that every navigation to a new page starts at the very top of the window.

- **Implementation**: Add a `useEffect` in `RootLayout.tsx` that triggers `window.scrollTo(0, 0)` whenever the URL path changes.
- **Benefit**: Guarantees that users always land at the title of their new story.

### 4. Auto-Scroll to Generator (The "Focus" Fix)
When generation starts, the page should automatically scroll to the loading animation to ensure the user sees the progress immediately.

- **Implementation**: Use a `ref` on the generator container in `HomePage.tsx` and call `element.scrollIntoView({ behavior: 'smooth', block: 'start' })` when `isGenerating` is set to true.
- **Benefit**: Keeps the user focused on the active process, especially on mobile or smaller screens.

### 3. Smooth Transitions (The "Magic" Fix)
Use subtle animations to transition between states rather than instant DOM swaps.

- **Implementation**: 
    - Use `motion.div` to fade the form out and the loading state in.
    - Add a "Generating..." progress bar or skeleton to provide visual continuity.

## Implementation Steps
1.  Update `HomePage.tsx` with a stabilized container height and `framer-motion` transitions.
2.  Update `RootLayout.tsx` to include the scroll-to-top logic.
3.  Verify the fix by generating a story while scrolled halfway down the Home Page.
