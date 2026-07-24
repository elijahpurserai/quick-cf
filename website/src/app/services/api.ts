
import { Story, StoryFormData, Lesson, LessonFormData, HeroProfile, Visibility } from "../types";


const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001/api";

const handleResponse = async (response: Response, context: string) => {
    if (!response.ok) {
        let errorMessage = `Failed to generate ${context}`;
        try {
            const errorData = await response.json();
            if (errorData.error) {
                errorMessage = errorData.details
                    ? `${errorData.error}: ${errorData.details}`
                    : errorData.error;
            }
        } catch (e) {
            // If response is not JSON, use status text
            errorMessage = `${errorMessage} (${response.statusText})`;
        }
        throw new Error(errorMessage);
    }
    return response.json();
};

const parseCreation = (data: any) => {
    if (!data) return data;
    const rawDuration = data.duration;
    const parsed = {
        ...data,
        createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
        tags: data.tags || [],
        chapters: data.chapters || [],
        siblings: data.siblings || [],
        parentNames: data.parentNames || [],
        duration: (rawDuration && rawDuration <= 45) ? rawDuration : 7,
    };

    if (parsed.chapters && Array.isArray(parsed.chapters)) {
        parsed.chapters = parsed.chapters.map((chapter: any) => ({
            ...chapter,
            createdAt: chapter.createdAt ? new Date(chapter.createdAt) : new Date(),
        }));
    }

    return parsed;
};

export const api = {
    stories: {
        generate: async (
            formData: StoryFormData,
            userId?: string
        ): Promise<Story> => {
            try {
                const response = await fetch(`${API_URL}/generate-story`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(formData),
                    credentials: "include",
                });

                const story = await handleResponse(response, "story");
                return parseCreation({
                    ...story,
                    ownerId: userId,
                });
            } catch (error) {
                console.error("API Error (Story):", error);
                throw error;
            }
        },
        generateImage: async (
            title: string,
            description: string,
            creationId?: string,
            imagePrompt?: string
        ): Promise<string> => {
            try {
                const response = await fetch(`${API_URL}/generate-story-image`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ title, description, creationId, imagePrompt }),
                    credentials: "include",
                });

                const data = await handleResponse(response, "story illustration");
                return data.imageUrl;
            } catch (error) {
                console.error("API Error (Story Image):", error);
                throw error;
            }
        },
        generateAudio: async (
            text: string,
            voice: string = "shimmer"
        ): Promise<Blob> => {
            try {
                const response = await fetch(`${API_URL}/generate-story-audio`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ text, voice }),
                });

                if (!response.ok) throw new Error("Failed to generate audio");
                return await response.blob();
            } catch (error) {
                console.error("API Error (Story Audio):", error);
                throw error;
            }
        },
        getStoryBySlug: async (slug: string): Promise<Story> => {
            try {
                const response = await fetch(`${API_URL}/stories/s/${slug}`, {
                    method: "GET",
                    credentials: "include",
                });

                const story = await handleResponse(response, "story details");
                return parseCreation(story);
            } catch (error) {
                console.error("API Error (Get Story):", error);
                throw error;
            }
        },
    },
    lessons: {
        generate: async (
            formData: LessonFormData,
            userId?: string
        ): Promise<Lesson> => {
            try {
                const response = await fetch(`${API_URL}/generate-lesson`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(formData),
                    credentials: "include",
                });

                const lesson = await handleResponse(response, "lesson");
                return parseCreation({
                    ...lesson,
                    ownerId: userId,
                });
            } catch (error) {
                console.error("API Error (Lesson):", error);
                throw error;
            }
        },
        generateAudio: async (
            text: string,
            voice: string = "nova"
        ): Promise<Blob> => {
            try {
                const response = await fetch(`${API_URL}/generate-story-audio`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ text, voice }),
                });

                if (!response.ok) throw new Error("Failed to generate audio");
                return await response.blob();
            } catch (error) {
                console.error("API Error (Lesson Audio):", error);
                throw error;
            }
        },
        generateImage: async (
            topic: string,
            description: string,
            creationId?: string,
            imagePrompt?: string
        ): Promise<string> => {
            try {
                const response = await fetch(`${API_URL}/generate-story-image`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ title: topic, description, creationId, imagePrompt }),
                    credentials: "include",
                });

                const data = await handleResponse(response, "lesson illustration");
                return data.imageUrl;
            } catch (error) {
                console.error("API Error (Lesson Image):", error);
                throw error;
            }
        },
        getLessonBySlug: async (slug: string): Promise<Lesson> => {
            try {
                const response = await fetch(`${API_URL}/lessons/s/${slug}`, {
                    method: "GET",
                    credentials: "include",
                });

                const lesson = await handleResponse(response, "lesson details");
                return parseCreation(lesson);
            } catch (error) {
                console.error("API Error (Get Lesson):", error);
                throw error;
            }
        },
    },
    creations: {
        getPublic: async (params: { type?: string, sort?: string, limit?: number, offset?: number, q?: string, lang?: string, age?: number } = {}): Promise<any[]> => {
            try {
                const query = new URLSearchParams();
                if (params.type) query.append('type', params.type);
                if (params.sort) query.append('sort', params.sort);
                if (params.limit) query.append('limit', params.limit.toString());
                if (params.offset) query.append('offset', params.offset.toString());
                if (params.q) query.append('q', params.q);
                if (params.lang) query.append('lang', params.lang);
                if (params.age != null) query.append('age', params.age.toString());

                const response = await fetch(`${API_URL}/discovery/public?${query.toString()}`, {
                    method: "GET",
                    credentials: "include",
                });

                const data = await handleResponse(response, "public creations");
                return (data || []).map(parseCreation);
            } catch (error) {
                console.error("API Error (Get Public Creations):", error);
                throw error;
            }
        },
        updateVisibility: async (creationId: string, visibility: Visibility): Promise<{ visibility: Visibility }> => {
            try {
                const response = await fetch(`${API_URL}/creations/${creationId}/visibility`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ visibility }),
                    credentials: "include",
                });
                return await handleResponse(response, "update visibility");
            } catch (error) {
                console.error("API Error (Update Visibility):", error);
                throw error;
            }
        },
        rate: async (creationId: string, rating: number): Promise<{ rating: number, ratingsCount: number }> => {
            try {
                const response = await fetch(`${API_URL}/discovery/creations/${creationId}/rate`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ rating }),
                    credentials: "include",
                });
                return await handleResponse(response, "rate creation");
            } catch (error) {
                console.error("API Error (Rate Creation):", error);
                throw error;
            }
        },
    },
    tags: {
        getAll: async (lang?: string): Promise<{ name: string, slug: string, count: number }[]> => {
            try {
                const query = new URLSearchParams();
                if (lang) query.append('lang', lang);
                const qs = query.toString();
                const response = await fetch(`${API_URL}/discovery/tags${qs ? `?${qs}` : ''}`, {
                    method: "GET",
                    credentials: "include",
                });

                return await handleResponse(response, "all tags");
            } catch (error) {
                console.error("API Error (Get All Tags):", error);
                throw error;
            }
        },
        getBySlug: async (tagSlug: string, lang?: string): Promise<any[]> => {
            try {
                const query = new URLSearchParams();
                if (lang) query.append('lang', lang);
                const qs = query.toString();
                const response = await fetch(`${API_URL}/discovery/tags/s/${tagSlug}${qs ? `?${qs}` : ''}`, {
                    method: "GET",
                    credentials: "include",
                });

                const data = await handleResponse(response, `creations for tag ${tagSlug}`);
                return (data || []).map(parseCreation);
            } catch (error) {
                console.error("API Error (Get Creations by Tag):", error);
                throw error;
            }
        },
    },
    me: {
        getLibrary: async (): Promise<any[]> => {
            try {
                const response = await fetch(`${API_URL}/me/library`, {
                    method: "GET",
                    credentials: "include",
                });

                const data = await handleResponse(response, "user library");
                return (data || []).map(parseCreation);
            } catch (error) {
                console.error("API Error (Get Library):", error);
                throw error;
            }
        },
        getFavorites: async (): Promise<any[]> => {
            try {
                const response = await fetch(`${API_URL}/me/favorites`, {
                    method: "GET",
                    credentials: "include",
                });

                const data = await handleResponse(response, "user favorites");
                return (data || []).map(parseCreation);
            } catch (error) {
                console.error("API Error (Get Favorites):", error);
                throw error;
            }
        },
        toggleFavorite: async (creationId: string): Promise<{ favorited: boolean }> => {
            try {
                const response = await fetch(`${API_URL}/me/favorites/${creationId}`, {
                    method: "POST",
                    credentials: "include",
                });

                return await handleResponse(response, "toggle favorite");
            } catch (error) {
                console.error("API Error (Toggle Favorite):", error);
                throw error;
            }
        },
    },
    heroProfiles: {
        get: async (): Promise<HeroProfile[]> => {
            try {
                const response = await fetch(`${API_URL}/me/hero-profiles`, {
                    method: "GET",
                    credentials: "include",
                });
                const data = await handleResponse(response, "hero profiles");
                return data.heroProfiles ?? [];
            } catch (error) {
                console.error("API Error (Get Hero Profiles):", error);
                return [];
            }
        },
        save: async (profiles: HeroProfile[]): Promise<HeroProfile[]> => {
            try {
                const response = await fetch(`${API_URL}/me/hero-profiles`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ heroProfiles: profiles }),
                    credentials: "include",
                });
                const data = await handleResponse(response, "save hero profiles");
                return data.heroProfiles ?? profiles;
            } catch (error) {
                console.error("API Error (Save Hero Profiles):", error);
                throw error;
            }
        },
    },
    auth: {
        me: async (): Promise<{ user: any }> => {
            try {
                const response = await fetch(`${API_URL}/auth/me`, {
                    method: "GET",
                    credentials: "include",
                });
                return await handleResponse(response, "current user");
            } catch (error) {
                console.error("API Error (Auth Me):", error);
                throw error;
            }
        },
    },
    get: async (path: string): Promise<any> => {
        try {
            const response = await fetch(`${API_URL}${path}`, {
                method: "GET",
                credentials: "include",
            });
            return await handleResponse(response, path);
        } catch (error) {
            console.error(`API Error (GET ${path}):`, error);
            throw error;
        }
    },
    post: async (path: string, body: any): Promise<any> => {
        try {
            const response = await fetch(`${API_URL}${path}`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(body),
                credentials: "include",
            });
            return await handleResponse(response, path);
        } catch (error) {
            console.error(`API Error (POST ${path}):`, error);
            throw error;
        }
    },
};
