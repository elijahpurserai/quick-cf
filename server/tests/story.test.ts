import request from "supertest";
import app from "../index";
import OpenAI from "openai";

jest.mock("openai", () => {
    return jest.fn().mockImplementation(() => ({
        chat: {
            completions: {
                create: jest.fn().mockResolvedValue({
                    choices: [
                        {
                            message: {
                                content: JSON.stringify({
                                    title: "Rey and the Dragon Quest",
                                    englishTitle: "Rey and the Dragon Quest",
                                    description: "An adventure with dragons",
                                    content: "Once upon a time...",
                                    tags: ["dragons", "adventure"]
                                })
                            }
                        }
                    ]
                })
            }
        }
    }));
});

describe("Story Generation test", () => {
    it("should generate a story with valid adventure parameters", async () => {
        const payload = {
            purpose: "adventure",
            childName: "Rey",
            gender: "male",
            age: 4,
            additionalInfo: "Red head that loves dragons",
            siblingNames: [{ name: "Rom", gender: "male" }],
            parentNames: [{ name: "Guy", gender: "male" }, { name: "Eliran", gender: "male" }],
            duration: 5,
            language: "en"
        };

        const response = await request(app)
            .post("/api/generate-story")
            .send(payload);

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty("id");
        expect(response.body).toHaveProperty("slug");
        expect(response.body.slug).toMatch(/^rey-and-the-dragon-quest-[a-f0-9]{6}$/);
        expect(response.body).toHaveProperty("title", "Rey and the Dragon Quest");
        expect(response.body.age).toBe(4);
        expect(response.body.gender).toBe("male");
        expect(response.body.chapters).toEqual([]);
    }, 10000);

    it("should generate a story with the second reported payload", async () => {
        const payload = {
            purpose: "adventure",
            childName: "Rey",
            gender: "female",
            age: 4,
            additionalInfo: "Rey loves dinosaurus",
            siblingNames: [{ name: "rom", gender: "male" }],
            parentNames: [],
            duration: 5,
            language: "en"
        };

        const response = await request(app)
            .post("/api/generate-story")
            .send(payload);

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty("id");
        expect(response.body.age).toBe(4);
        expect(response.body.gender).toBe("female");
        expect(response.body.chapters).toEqual([]);
    }, 10000);
});
