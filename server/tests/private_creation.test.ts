import request from "supertest";
import app from "../index";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";

// ---------------------------------------------------------------------------
// OpenAI mock (same pattern as story.test.ts)
// ---------------------------------------------------------------------------
jest.mock("openai", () => {
    return jest.fn().mockImplementation(() => ({
        chat: {
            completions: {
                create: jest.fn().mockResolvedValue({
                    choices: [
                        {
                            message: {
                                content: JSON.stringify({
                                    title: "Private Test Story",
                                    englishTitle: "Private Test Story",
                                    description: "A secret adventure",
                                    content: "Once upon a time in secret...",
                                    tags: ["secret", "adventure"],
                                }),
                            },
                        },
                    ],
                }),
            },
        },
    }));
});

// ---------------------------------------------------------------------------
// Supabase mock — captures what was inserted into `creations`
// ---------------------------------------------------------------------------
let capturedCreationInsert: Record<string, any> | null = null;
let mockReturnedCreation: Record<string, any> | null = null;

jest.mock("../supabase", () => {
    const buildChain = (resolvedValue: any) => {
        const chain: any = {
            insert: jest.fn(() => resolvedValue),
            select: jest.fn(() => chain),
            eq: jest.fn(() => chain),
            single: jest.fn(() => Promise.resolve(resolvedValue)),
            upsert: jest.fn(() => chain),
        };
        return chain;
    };

    return {
        supabase: {
            from: jest.fn((table: string) => {
                if (table === "creations") {
                    return {
                        insert: jest.fn((data: any) => {
                            capturedCreationInsert = data;
                            return Promise.resolve({ error: null });
                        }),
                        select: jest.fn(() => ({
                            eq: jest.fn(() => ({
                                eq: jest.fn(() => ({
                                    limit: jest.fn(() => Promise.resolve({ data: [], error: null })),
                                })),
                                single: jest.fn(() =>
                                    Promise.resolve({
                                        data: mockReturnedCreation,
                                        error: mockReturnedCreation ? null : { message: "Not found" },
                                    })
                                ),
                                limit: jest.fn(() => Promise.resolve({ data: [], error: null })),
                            })),
                        })),
                    };
                }

                if (table === "stories") {
                    return {
                        insert: jest.fn(() => Promise.resolve({ error: null })),
                        select: jest.fn(() => ({
                            eq: jest.fn(() => ({
                                single: jest.fn(() =>
                                    Promise.resolve({
                                        data: {
                                            id: "story-id",
                                            content: "Once upon a time in secret...",
                                            child_name: "Rey",
                                            age: 5,
                                            gender: "male",
                                            purpose: "adventure",
                                            education_category: "General",
                                            duration_mins: 7,
                                            language: "en",
                                            metadata: {},
                                        },
                                        error: null,
                                    })
                                ),
                            })),
                        })),
                    };
                }

                if (table === "tags") {
                    return buildChain({ data: { id: "tag-id-1", name: "adventure", slug: "adventure" }, error: null });
                }

                if (table === "creation_tags") {
                    return {
                        insert: jest.fn(() => Promise.resolve({ error: null })),
                        select: jest.fn(() => ({
                            eq: jest.fn(() => Promise.resolve({ data: [], error: null })),
                        })),
                    };
                }

                // fallback
                return buildChain({ data: null, error: null });
            }),
        },
    };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const baseStoryPayload = {
    purpose: "adventure",
    childName: "Rey",
    gender: "male",
    age: 5,
    siblingNames: [],
    parentNames: [],
    pets: [],
    duration: 7,
    language: "en",
};

const makeAuthCookie = (userId = "owner-123") => {
    const token = jwt.sign({ id: userId, email: "test@example.com" }, JWT_SECRET);
    return `token=${token}`;
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Visibility — generation", () => {
    beforeEach(() => {
        capturedCreationInsert = null;
    });

    it("saves with visibility='private' when visibility is 'private'", async () => {
        const response = await request(app)
            .post("/api/generate-story")
            .set("Cookie", [makeAuthCookie()])
            .send({ ...baseStoryPayload, visibility: "private" });

        expect(response.status).toBe(200);
        expect(capturedCreationInsert).not.toBeNull();
        expect(capturedCreationInsert!.visibility).toBe("private");
    }, 10000);

    it("saves with visibility='public' when visibility is 'public'", async () => {
        const response = await request(app)
            .post("/api/generate-story")
            .set("Cookie", [makeAuthCookie()])
            .send({ ...baseStoryPayload, visibility: "public" });

        expect(response.status).toBe(200);
        expect(capturedCreationInsert).not.toBeNull();
        expect(capturedCreationInsert!.visibility).toBe("public");
    }, 10000);

    it("saves with visibility='unlisted' when visibility is 'unlisted'", async () => {
        const response = await request(app)
            .post("/api/generate-story")
            .set("Cookie", [makeAuthCookie()])
            .send({ ...baseStoryPayload, visibility: "unlisted" });

        expect(response.status).toBe(200);
        expect(capturedCreationInsert).not.toBeNull();
        expect(capturedCreationInsert!.visibility).toBe("unlisted");
    }, 10000);

    it("defaults to visibility='public' when visibility is omitted", async () => {
        const response = await request(app)
            .post("/api/generate-story")
            .set("Cookie", [makeAuthCookie()])
            .send(baseStoryPayload);

        expect(response.status).toBe(200);
        expect(capturedCreationInsert).not.toBeNull();
        expect(capturedCreationInsert!.visibility).toBe("public");
    }, 10000);

    it("sets owner_id to the authenticated user's id", async () => {
        await request(app)
            .post("/api/generate-story")
            .set("Cookie", [makeAuthCookie("user-abc")])
            .send({ ...baseStoryPayload, visibility: "private" });

        expect(capturedCreationInsert!.owner_id).toBe("user-abc");
    }, 10000);

    it("sets owner_id to null for anonymous users", async () => {
        await request(app)
            .post("/api/generate-story")
            .send(baseStoryPayload); // no auth cookie

        expect(capturedCreationInsert!.owner_id).toBeNull();
    }, 10000);
});

describe("Visibility — access control", () => {
    it("returns 403 when anonymous user requests a private story", async () => {
        mockReturnedCreation = {
            id: "story-id",
            slug: "private-story-abc123",
            visibility: "private",
            owner_id: "owner-123",
            type: "story",
            title: "Private Test Story",
        };

        const response = await request(app).get("/api/stories/s/private-story-abc123");

        expect(response.status).toBe(403);
        expect(response.body.error).toMatch(/Unauthorized/);
    });

    it("returns 403 when a different logged-in user requests a private story", async () => {
        mockReturnedCreation = {
            id: "story-id",
            slug: "private-story-abc123",
            visibility: "private",
            owner_id: "owner-123",
            type: "story",
            title: "Private Test Story",
        };

        const response = await request(app)
            .get("/api/stories/s/private-story-abc123")
            .set("Cookie", [makeAuthCookie("other-user-999")]);

        expect(response.status).toBe(403);
    });

    it("returns 200 when the owner accesses their own private story", async () => {
        mockReturnedCreation = {
            id: "story-id",
            slug: "private-story-abc123",
            visibility: "private",
            owner_id: "owner-123",
            type: "story",
            title: "Private Test Story",
            english_title: "Private Test Story",
            description: "A secret adventure",
            rating_avg: 0,
            rating_count: 0,
            created_at: new Date().toISOString(),
        };

        const response = await request(app)
            .get("/api/stories/s/private-story-abc123")
            .set("Cookie", [makeAuthCookie("owner-123")]);

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty("title", "Private Test Story");
    });

    it("returns 200 when any user accesses a public story", async () => {
        mockReturnedCreation = {
            id: "story-id",
            slug: "public-story-abc123",
            visibility: "public",
            owner_id: "owner-123",
            type: "story",
            title: "Public Test Story",
            english_title: "Public Test Story",
            description: "A public adventure",
            rating_avg: 0,
            rating_count: 0,
            created_at: new Date().toISOString(),
        };

        const response = await request(app).get("/api/stories/s/public-story-abc123");

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty("title", "Public Test Story");
    });

    it("returns 200 when anonymous user accesses an unlisted story", async () => {
        mockReturnedCreation = {
            id: "story-id",
            slug: "unlisted-story-abc123",
            visibility: "unlisted",
            owner_id: "owner-123",
            type: "story",
            title: "Unlisted Test Story",
            english_title: "Unlisted Test Story",
            description: "A hidden adventure",
            rating_avg: 0,
            rating_count: 0,
            created_at: new Date().toISOString(),
        };

        const response = await request(app).get("/api/stories/s/unlisted-story-abc123");

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty("title", "Unlisted Test Story");
    });

    it("returns 200 when a different user accesses an unlisted story", async () => {
        mockReturnedCreation = {
            id: "story-id",
            slug: "unlisted-story-abc123",
            visibility: "unlisted",
            owner_id: "owner-123",
            type: "story",
            title: "Unlisted Test Story",
            english_title: "Unlisted Test Story",
            description: "A hidden adventure",
            rating_avg: 0,
            rating_count: 0,
            created_at: new Date().toISOString(),
        };

        const response = await request(app)
            .get("/api/stories/s/unlisted-story-abc123")
            .set("Cookie", [makeAuthCookie("other-user-999")]);

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty("title", "Unlisted Test Story");
    });
});
