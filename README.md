# Causal Trainer

Causal Trainer is a web application for generating, reviewing, and exporting causal reasoning questions. It supports an admin workflow to:
- Use GPT-based generation to create questions across Pearl causal levels (L1–L3) and multiple domains
- Review and curate questions with rich annotations (trap types, difficulty, causal structure, etc.)
- Export a cleaned, verified question set in JSON format for use in downstream training or evaluation tools

## Setup

1. **Install prerequisites**  
   Make sure you have the following installed:
   - **Node.js** (LTS version recommended)
   - **npm** (comes with Node.js)

2. **Configure environment variables**  
   Copy the example environment file and edit it:

   ```bash
   cp .env.example .env
   ```

   Then open `.env` and set:
   - `OPENAI_API_KEY` to your own OpenAI API key
   - `DATABASE_URL` to a valid Prisma connection string, e.g. for local SQLite:

     ```env
     DATABASE_URL="file:./dev.db"
     ```

3. **Initialize the database**  
   Run Prisma migrations to create the schema:

   ```bash
   npx prisma migrate dev --name init
   ```

4. **Install dependencies and start the dev server**  
   From the project root, run:

   ```bash
   npm install
   npm run dev
   ```

   The app will start on `http://localhost:3000` by default.
