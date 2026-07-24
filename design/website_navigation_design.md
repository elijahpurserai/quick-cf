# Design Document: Website Navigation Refinement

## 1. Objective
Refine the website's navigation (top bar and bottom bar) to prioritize core user actions (story creation, library access) while keeping legal information available but less prominent.

## 2. Top Bar (Header)

### 2.1 Current State
The header currently includes:
- Brand Logo & Title (Link to Home)
- Navigation Links: "My Library", "Favorites"
- User Profile / Login Button
- **"Legal" Button with Scale Icon** (Main navigation)

### 2.2 Proposed Changes
- **Remove "Legal" from the primary header navigation.** 
  - *Rationale*: Legal information is rarely a primary destination for users focused on story creation. Its presence in the header adds clutter and distracts from key calls to action.
- **Maintain core links**: Keep Logo, My Library, Favorites, and User/Login as the primary focuses.
- **Ensure Responsive Consistency**: The mobile view (if applicable) should also hide legal links in the primary menu.

## 3. Bottom Bar (Footer)

### 2.1 Current State
The footer currently includes:
- Brand Section (Logo, Mission)
- "Explore" Column (Top Bedtime Stories, Educational Stories, Trending)
- **"Legal" Column** (Privacy & Legal, Sitemap)
- Bottom-most bar with Copyright and AI Moderation message.

### 2.2 Proposed Changes
- **De-emphasize Legal Links**:
  - Remove the dedicated "Legal" column to provide more breathing room for content discovery ("Explore" section).
  - Move "Privacy Policy", "Terms of Use", and "Sitemap" to the bottom-most bar (the copyright bar).
  - Use a subtle, small font for these links.
- **Layout Mockup (Footer Bottom)**:
  ```
  © 2026 QuickStory.AI. All rights reserved. • Privacy Policy • Terms of Use • Sitemap
  [Heart Icon] Content moderated by AI for age-appropriate storytelling.
  ```

## 4. Visual Implementation Notes
- **Color/Style**: Use `text-gray-500` or `text-gray-400` for legal links in the footer to ensure they are readable but "in the background".
- **Hover Effects**: Maintain subtle hover effects (e.g., `hover:text-purple-600`) for accessibility, but keep the base state muted.

## 5. Summary of Benefits
- **Streamlined Header**: Directs user attention to "Create" and "Library" actions.
- **Cleaner Footer**: Focuses on content discovery and brand identity while maintaining legal compliance in a standard, expected location (the bottom bar).
- **Improved UX**: Reduces cognitive load by hiding non-essential utility links from primary view.
