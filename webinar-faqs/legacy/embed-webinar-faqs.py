import os
import psycopg2
from openai import OpenAI
from tqdm import tqdm

# --- Config ---
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
SUPABASE_DB_URL = os.getenv("SUPABASE_DB_URL")  # postgres://user:pass@host:port/db
EMBED_MODEL = "text-embedding-3-small"  # or "text-embedding-3-large"

# --- Data (replace this with file read later) ---
faqs = [
    {
        "question": "When was Deutsches Edelsteinhaus founded?",
        "answer": "It was founded in 2018 in Germany as a GmbH."
    },
    {
        "question": "Can I resell the gemstones later?",
        "answer": "Yes, resale is possible via DEH, auctions, or private sales."
    }
]

# --- OpenAI client ---
client = OpenAI(api_key=OPENAI_API_KEY)

# --- Supabase connection ---
conn = psycopg2.connect(SUPABASE_DB_URL)
cur = conn.cursor()

# Ensure table exists
cur.execute("""
CREATE TABLE IF NOT EXISTS faqs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    question text,
    answer text,
    embedding vector(1536)
);
""")
conn.commit()

# --- Insert embeddings ---
for faq in tqdm(faqs, desc="Embedding FAQs"):
    q = faq["question"]
    a = faq["answer"]

    embedding = client.embeddings.create(
        model=EMBED_MODEL,
        input=q
    ).data[0].embedding

    cur.execute(
        "INSERT INTO faqs (question, answer, embedding) VALUES (%s, %s, %s)",
        (q, a, embedding)
    )

conn.commit()
cur.close()
conn.close()
print("Insert complete")

