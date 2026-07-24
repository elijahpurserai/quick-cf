# Web-Server Interaction Design

This document outlines the architectural design for the **Quick** platform's backend infrastructure, specifically focusing on the interaction between the website (client), the Node.js server, and the database.

## Architecture Overview

The application will follow a classic **Layered Architecture** (Presentation, Business Logic, Data Access) to ensure modularity, scalability, and maintainability.

**Flow:**
1.  **Client (Website):** Next.js or Vite (Frontend) sends HTTP requests to the Node.js server.
2.  **Server (Node.js):** Handles requests, performs business logic (AI generation, validation), and interacts with the database.
3.  **Database:** Stores user data, generated content (stories/lessons), and metadata.

---

## Core Technologies & Modules

The server will be built using **Node.js**. Below is the recommended stack of modules and libraries, explaining **how** they will be used and **why** they were chosen.

### 1. Web Framework: `express`
*   **How:** Acts as the backbone of the server, defining routes (endpoints) for the frontend to consume (e.g., `POST /api/stories/generate`, `GET /api/users/profile`).
*   **Why:**
    *   **Maturity:** The industry standard for Node.js servers with a massive ecosystem of plugins (middleware).
    *   **Flexibility:** Unopinionated, allowing us to structure the sophisticated AI workflows exactly as needed.
    *   **Performance:** Sufficiently fast for I/O-heavy operations like streaming AI responses.

### 2. Database ORM: `prisma`
*   **How:** Manages the connection to the database (PostgreSQL recommended) and allows us to interact with data using type-safe JavaScript/TypeScript instead of raw SQL.
*   **Why:**
    *   **Type Safety:** Auto-generates TypeScript types based on our schema, preventing runtime errors.
    *   **Developer Experience:** Intuitive API for complex relations (e.g., connecting a `User` to their generated `Stories`).
    *   **Migrations:** Built-in schema migration tool makes evolving the database (e.g., adding "Illustrations" later) safe and easy.

### 3. Database: `postgresql` (via `pg` driver)
*   **How:** The underlying relational database system where all structured data lives.
*   **Why:**
    *   **Reliability:** ACID compliance ensures user data and payment records are never lost.
    *   **JSON Support:** Excellent `JSONB` support allows us to store unstructured AI generation metadata alongside structured user records, perfect for the "User-Seeded AI Content" model.
    *   **Vector Search (Extension):** Can easily support vector embeddings (`pgvector`) in the future for semantic search of stories/lessons.

### 4. Validation: `zod`
*   **How:** Validates incoming request data (e.g., ensuring a prompt is not empty, age is a number) before it hits the database or AI service.
*   **Why:**
    *   **Runtime Safety:** Catches bad data at the API boundary, protecting the core logic.
    *   **TypeScript Integration:** Infers static types from the validation schema, reducing code duplication (single source of truth for types).

### 5. Authentication: `lucia` or `simple-jwt`
*   **How:** Manages user sessions and secures protected routes (e.g., "My Saved Stories").
*   **Why:**
    *   **Ownership:** AI content is valuable; good auth ensures users own what they generate.
    *   **Flexibility:** `Lucia` is modern and pairs well with Prisma, offering better security practices than bare JWTs.

### 6. AI Integration: `openai` (Official SDK)
*   **How:** The core engine. The server will act as a secure proxy to the AI provider, injecting system prompts (e.g., "You are a children's story writer") and managing API keys.
*   **Why:**
    *   **Security:** Keeps sensitive API keys on the server, never exposing them to the client.
    *   **Control:** Allows us to rate-limit users and track usage for monetization.
    *   **Streaming:** The SDK supports streaming responses, allowing us to show the story appearing in real-time on the website.

### 7. Security Middleware: `helmet` & `cors`
*   **How:** `helmet` sets HTTP headers to secure the app; `cors` manages cross-origin requests from the frontend domain.
*   **Why:**
    *   **Best Practices:** Essential for protecting the server from common web vulnerabilities (XSS, Clickjacking) and enabling the frontend to communicate with the backend securely.

---

## Data Flow Example: Generating a Story

1.  **Request:** Client sends `POST /api/stories` with `{ prompt: "Princess Rey", age: 3 }`.
2.  **Validation:** `zod` checks if `age` is a valid number and `prompt` is safe.
3.  **AI Processing:** Server uses `openai` module to generate the story text based on the "Adventure" system prompt.
4.  **Persistence:** Server uses `prisma` to save the new story to `PostgreSQL`, helping satisfy the "Saved for future reference" requirement.
5.  **Response:** The generated story content is sent back to the client for display.
