import React, { createContext, useContext, useState, useRef, ReactNode, useCallback } from "react";
import { Story, User, Lesson, HeroProfile } from "../types";
import { toast } from "sonner";
import { api } from "../services/api";
import { useLanguage } from "./LanguageContext";

const HERO_PROFILES_STORAGE_KEY = "hero-profiles";

/** Load hero profiles from localStorage, applying the legacy single-profile migration if needed. */
function loadLocalHeroProfiles(): HeroProfile[] {
  try {
    // One-time migration from old "story-child-profile" (single object) to "hero-profiles" (array)
    const legacy = localStorage.getItem("story-child-profile");
    if (legacy && !localStorage.getItem(HERO_PROFILES_STORAGE_KEY)) {
      const parsed = JSON.parse(legacy);
      const migrated: HeroProfile[] = [{
        id: crypto.randomUUID(),
        childName: parsed.childName ?? "",
        gender: (parsed.gender ?? "unspecified") as HeroProfile["gender"],
        age: parsed.age ? parseInt(parsed.age) : null,
        siblingNames: parsed.siblingNames ?? [],
        pets: parsed.pets ?? [],
        parentNames: parsed.parentNames ?? [],
        language: parsed.language ?? "en",
      }];
      localStorage.setItem(HERO_PROFILES_STORAGE_KEY, JSON.stringify(migrated));
      localStorage.removeItem("story-child-profile");
      localStorage.removeItem("story-child-profile-history");
      return migrated;
    }
    const saved = localStorage.getItem(HERO_PROFILES_STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

interface AppContextType {
  user: User | null;
  login: (credential: string) => Promise<void>;
  logout: () => Promise<void>;
  stories: Story[];
  addStory: (story: Story) => void;
  updateStory: (storyId: string, updates: Partial<Story>) => void;
  userLibrary: string[]; // story IDs
  addToLibrary: (storyId: string) => void;
  removeFromLibrary: (storyId: string) => void;
  favorites: string[]; // story IDs
  toggleFavorite: (storyId: string) => void;
  rateStory: (storyId: string, rating: number) => void;
  lessons: Lesson[];
  addLesson: (lesson: Lesson) => void;
  updateLesson: (lessonId: string, updates: Partial<Lesson>) => void;
  rateLesson: (lessonId: string, rating: number) => void;
  updateStoryImage: (storyId: string, imageUrl: string) => void;
  heroProfiles: HeroProfile[];
  saveHeroProfiles: (profiles: HeroProfile[]) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const { t } = useLanguage();
  const [user, setUser] = useState<User | null>(null);
  const userRef = useRef<User | null>(null);
  const [stories, setStories] = useState<Story[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [userLibrary, setUserLibrary] = useState<string[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [heroProfiles, setHeroProfiles] = useState<HeroProfile[]>(() => loadLocalHeroProfiles());

  // Keep userRef in sync so saveHeroProfiles doesn't go stale
  React.useEffect(() => { userRef.current = user; }, [user]);

  const fetchHeroProfiles = useCallback(async () => {
    try {
      const serverProfiles = await api.heroProfiles.get();
      setHeroProfiles(serverProfiles);
      try {
        localStorage.setItem(HERO_PROFILES_STORAGE_KEY, JSON.stringify(serverProfiles));
      } catch {}
    } catch (err) {
      console.error("Failed to fetch hero profiles:", err);
    }
  }, []);

  const saveHeroProfiles = useCallback((profiles: HeroProfile[]) => {
    setHeroProfiles(profiles);
    try {
      localStorage.setItem(HERO_PROFILES_STORAGE_KEY, JSON.stringify(profiles));
    } catch {}
    // Fire-and-forget sync to server if authenticated
    if (userRef.current) {
      api.heroProfiles.save(profiles).catch((err) =>
        console.error("Failed to sync hero profiles to server:", err)
      );
    }
  }, []);

  const fetchUserData = useCallback(async () => {
    try {
      const [library, favs] = await Promise.all([
        api.me.getLibrary(),
        api.me.getFavorites()
      ]);

      // Update global stories/lessons lists with these if they are not there
      setStories(prev => {
        const existingIds = new Set(prev.map(s => s.id));
        const combined = [...library, ...favs];
        const newStories = combined.filter(item => item.type === 'story' && !existingIds.has(item.id));
        return [...prev, ...newStories];
      });

      setLessons(prev => {
        const existingIds = new Set(prev.map(l => l.id));
        const combined = [...library, ...favs];
        const newLessons = combined.filter(item => item.type === 'lesson' && !existingIds.has(item.id));
        return [...prev, ...newLessons];
      });

      setUserLibrary(library.map(item => item.id));
      setFavorites(favs.map(item => item.id));
    } catch (error) {
      console.error("Failed to fetch user data:", error);
    }
  }, []);

  // Check session on mount
  React.useEffect(() => {
    const checkSession = async () => {
      try {
        const data = await api.auth.me();
        if (data && data.user) {
          setUser(data.user);
          fetchUserData();
          fetchHeroProfiles();
        }
      } catch (error) {
        console.error("Session check failed:", error);
      } finally {
        setIsLoading(false);
      }
    };
    checkSession();
  }, [fetchUserData, fetchHeroProfiles]);

  const login = async (credential: string) => {
    try {
      const data = await api.post("/auth/google", { credential });
      if (data.user) {
        setUser(data.user);
        toast.success(t("toast.welcomeBack", { name: data.user.name }));
        fetchUserData();
        fetchHeroProfiles();
      }
    } catch (error) {
      console.error("Login error:", error);
      toast.error(t("toast.loginFailed"));
    }
  };

  const logout = async () => {
    try {
      await api.post("/auth/logout", {});
      setUser(null);
      setUserLibrary([]);
      setFavorites([]);
      toast.success(t("toast.loggedOut"));
    } catch (error) {
      console.error("Logout error:", error);
      toast.error(t("toast.logoutFailed"));
    }
  };

  const addStory = (story: Story) => {
    setStories((prev) => [story, ...prev]);
    if (user && (story.ownerId === user.id || !story.ownerId)) {
      setUserLibrary((prev) => [story.id, ...prev]);
    }
  };

  const updateStory = (storyId: string, updates: Partial<Story>) => {
    setStories((prev) =>
      prev.map((story) =>
        story.id === storyId ? { ...story, ...updates } : story
      )
    );
  };

  const addToLibrary = (storyId: string) => {
    if (!userLibrary.includes(storyId)) {
      setUserLibrary((prev) => [...prev, storyId]);
    }
    // Note: We might want a server endpoint for adding to library if it's not just automatic on creation
  };

  const removeFromLibrary = (storyId: string) => {
    setUserLibrary((prev) => prev.filter((id) => id !== storyId));
    // Note: We might want a server endpoint for removing from library
  };

  const toggleFavorite = async (storyId: string) => {
    try {
      const result = await api.me.toggleFavorite(storyId);
      if (result.favorited) {
        setFavorites((prev) => [...prev, storyId]);
      } else {
        setFavorites((prev) => prev.filter((id) => id !== storyId));
      }
    } catch (error) {
      toast.error(t("toast.favoriteUpdateFailed"));
    }
  };

  const rateStory = (storyId: string, rating: number) => {
    // Optimistic local update
    setStories((prev) =>
      prev.map((story) => {
        if (story.id === storyId) {
          const newRatingsCount = story.ratingsCount + 1;
          const newRating =
            (story.rating * story.ratingsCount + rating) / newRatingsCount;
          return {
            ...story,
            rating: newRating,
            ratingsCount: newRatingsCount,
          };
        }
        return story;
      })
    );
    // Persist to database (fire-and-forget)
    api.creations.rate(storyId, rating).catch((err) =>
      console.error("Failed to persist story rating:", err)
    );
  };

  const updateStoryImage = (storyId: string, imageUrl: string) => {
    setStories((prev) =>
      prev.map((story) =>
        story.id === storyId ? { ...story, imageUrl } : story
      )
    );
  };

  const addLesson = (lesson: Lesson) => {
    setLessons((prev) => [lesson, ...prev]);
    if (user && (lesson.ownerId === user.id || !lesson.ownerId)) {
      setUserLibrary((prev) => [lesson.id, ...prev]);
    }
  };

  const updateLesson = (lessonId: string, updates: Partial<Lesson>) => {
    setLessons((prev) =>
      prev.map((lesson) =>
        lesson.id === lessonId ? { ...lesson, ...updates } : lesson
      )
    );
  };

  const rateLesson = (lessonId: string, rating: number) => {
    // Optimistic local update
    setLessons((prev) =>
      prev.map((lesson) => {
        if (lesson.id === lessonId) {
          const newRatingsCount = lesson.ratingsCount + 1;
          const newRating =
            (lesson.rating * lesson.ratingsCount + rating) / newRatingsCount;
          return {
            ...lesson,
            rating: newRating,
            ratingsCount: newRatingsCount,
          };
        }
        return lesson;
      })
    );
    // Persist to database (fire-and-forget)
    api.creations.rate(lessonId, rating).catch((err) =>
      console.error("Failed to persist lesson rating:", err)
    );
  };

  return (
    <AppContext.Provider
      value={{
        user,
        login,
        logout,
        stories,
        addStory,
        updateStory,
        userLibrary,
        addToLibrary,
        removeFromLibrary,
        favorites,
        toggleFavorite,
        rateStory,
        lessons,
        addLesson,
        updateLesson,
        rateLesson,
        updateStoryImage,
        heroProfiles,
        saveHeroProfiles,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp must be used within AppProvider");
  }
  return context;
}