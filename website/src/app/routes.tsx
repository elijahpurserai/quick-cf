import { createBrowserRouter } from "react-router";
import { HomePage } from "./pages/HomePage";
import { StoryPage } from "./pages/StoryPage";
import { LessonPage } from "./pages/LessonPage";
import { TopStoriesPage } from "./pages/TopStoriesPage";
import { LegalPage } from "./pages/LegalPage";
import { LibraryPage } from "./pages/LibraryPage";
import { FavoritesPage } from "./pages/FavoritesPage";
import { SitemapPage } from "./pages/SitemapPage";
import { SitemapIndexPage } from "./pages/SitemapIndexPage";
import { AllStoriesPage } from "./pages/AllStoriesPage";
import { AllLessonsPage } from "./pages/AllLessonsPage";
import { CategoryPage } from "./pages/CategoryPage";
import { GeneratePage } from "./pages/GeneratePage";
import { DiscoverPage } from "./pages/DiscoverPage";
import { TestsPage } from "./pages/TestsPage";
import { AdminPage } from "./pages/AdminPage";
import { PromptsPage } from "./pages/PromptsPage";
import { ImageTestPage } from "./pages/ImageTestPage";
import { RootLayout } from "./components/RootLayout";

const childRoutes = [
  { index: true, Component: HomePage },
  { path: "story/:identifier", Component: StoryPage },
  { path: "lesson/:identifier", Component: LessonPage },
  { path: "cat/:tagSlug", Component: CategoryPage },
  { path: "tag/:tagSlug", Component: CategoryPage },
  { path: "generate", Component: GeneratePage },
  { path: "discover", Component: DiscoverPage },
  { path: "top-bedtime-stories", Component: TopStoriesPage },
  { path: "top-educational-stories", Component: TopStoriesPage },
  { path: "trending-this-week", Component: TopStoriesPage },
  { path: "most-loved-by-3-year-olds", Component: TopStoriesPage },
  { path: "age/:age", Component: TopStoriesPage },
  { path: "legal", Component: LegalPage },
  { path: "library", Component: LibraryPage },
  { path: "favorites", Component: FavoritesPage },
  { path: "sitemap", Component: SitemapPage },
  { path: "all-stories", Component: AllStoriesPage },
  { path: "all-lessons", Component: AllLessonsPage },
  { path: "sitemap/all-stories", Component: AllStoriesPage },
  { path: "sitemap/all-lessons", Component: AllLessonsPage },
  { path: "tests", Component: TestsPage },
  { path: "analytics", Component: AdminPage },
  { path: "prompts", Component: PromptsPage },
  { path: "image-test", Component: ImageTestPage },
];

export const router = createBrowserRouter([
  // Language-prefixed routes (e.g. /en/story/..., /he/cat/...)
  {
    path: "/:lang",
    Component: RootLayout,
    children: childRoutes,
  },
  // Non-prefixed routes (default language)
  {
    path: "/",
    Component: RootLayout,
    children: childRoutes,
  },
]);