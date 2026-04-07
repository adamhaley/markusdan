Scripts and code vor MarkusDan projects

# FAQ Embeddings Loader

This script batch-embeds FAQ question/answer pairs using OpenAI’s Embeddings API and stores them in a **Supabase Postgres database** with the `pgvector` extension enabled.  
It is designed for use in **RAG (Retrieval Augmented Generation)** workflows, e.g., connecting n8n and Supabase to auto-reply to webinar/survey questions.

---

## Features

- Generate embeddings for FAQ questions (`text-embedding-3-small` or `text-embedding-3-large`).
- Store results in a `faqs` table with columns:
  - `id` (UUID)
  - `question` (text)
  - `answer` (text)
  - `embedding` (vector)
- Works with Supabase (Postgres + pgvector).

---

## Requirements

- Python 3.9+
- PostgreSQL with the `pgvector` extension (Supabase hosted or self-managed).
- OpenAI API key.

### Python dependencies

See [`requirements.txt`](./requirements.txt):


