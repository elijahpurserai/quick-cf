# OpenAI Story & Lesson Generation Design

## 1. Objective
Leverage OpenAI's Large Language Models (LLMs) to generate high-quality, personalized bedtime stories and educational lessons based on user-provided parameters.

## 2. Model Selection
- **Default**: `gpt-4o-mini`
  - **Reasoning**: Extremely fast, highly cost-effective, and more than capable of handling the creative writing and educational simplification required for the project.
- **Enhanced**: `gpt-4o`
  - **Reasoning**: Reserved for premium generation or more complex educational requests where deeper reasoning is required.

## 3. Integration Architecture

### Client-Server Flow
1. **Frontend**: Collects user input via `StoryGeneratorForm` or `LessonGeneratorForm`.
2. **Frontend**: Sends a `POST` request to the Express backend.
3. **Backend**: Validates the request using `Zod`.
4. **Backend**: Constructs the system and user prompts.
5. **Backend**: Calls the OpenAI API.
6. **Backend**: Parses and moderates the AI response.
7. **Backend**: Saves the result to the database (Prisma/PostgreSQL).
8. **Backend**: Returns the generated `Story` or `Lesson` object to the frontend.

### Security
- **API Keys**: Never stored or used in the frontend. All AI logic resides on the server.
- **Prompt Injection**: Basic sanitization of user inputs to prevent prompt manipulation.

## 4. Prompt Engineering

### Story Generation
**System Prompt:**
> You are a world-class children's storyteller. You create magical, engaging, and age-appropriate stories. 
> Your mission is to weave a personalized tale that incorporates specific details about the child, their family, and their pets.
> The tone should be warm, imaginative, and positive.

**User Prompt Template:**
> Generate a bedtime story for:
> - Child: {childName}, Age {age}
> - Purpose: {purpose}
> - educational Category: {educationCategory}
> - Siblings: {siblingNames}
> - Pets: {petType} named {petName}
> - Parent(s): {parentNames}
> - Estimated Duration: {duration} minutes
> - Extra Details: {additionalInfo}
> - Language: {language}

### Lesson Generation
**System Prompt:**
> You are an expert educator who specializes in simplifying complex topics for all ages.
> You create structured, clear, and engaging lessons.
> Use Markdown for formatting (headers, bold text, lists).

**User Prompt Template:**
> Create a quick lesson about:
> - Topic: {topic}
> - Level: {level}
> - Tone: {tone}
> - Reading Duration: {duration} minutes
> - Extra Focus: {additionalInfo}
> - Language: {language}

## 5. Standardized Output (JSON Mode)
To ensure the backend can reliably parse the AI's response into our `Story` and `Lesson` TypeScript interfaces, we will use OpenAI's **JSON Mode** or **Structured Outputs**.

### Output Schema Example (Story)
```json
{
  "title": "...",
  "description": "...",
  "content": "...",
  "tags": ["...", "..."]
}
```

## 6. Content Moderation
- **Moderation API**: Automatically run all user inputs and AI outputs through OpenAI's Moderation endpoint.
- **Safety Filters**: Reject any requests that involve violence, adult content, or inappropriate topics for children.

## 7. Performance & Optimization
- **Caching**: Hash the form data. If an identical request was fulfilled recently, return the cached version from the database instead of calling OpenAI.
- **Streaming (Future Phase)**: Use Server-Sent Events (SSE) to stream the story/lesson to the UI as it is being generated, reducing perceived latency.
