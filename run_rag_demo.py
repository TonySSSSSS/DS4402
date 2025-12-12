"""
run_rag_demo.py
----------------
This script demonstrates the full RAG (Retrieval-Augmented Generation)
pipeline using:

1. Qwen3-Embedding-0.6B for vector embeddings
2. Gemini 2.5 Flash for final grounded answering
3. A small demo insurance_chunks.json dataset
4. Precomputed insurance_embeddings.npy vectors

Author: DS440 Project
"""

import json
from pathlib import Path

import google.generativeai as genai
import numpy as np
from sentence_transformers import SentenceTransformer

# ================================================================
# 1. Gemini API configuration
# ================================================================
# NOTE: you decided to hard-code the key here during development.
GEMINI_API_KEY = "AIzaSyDTZEnFikYRNBOTAThekSi91_myBI4S8kU"
genai.configure(api_key=GEMINI_API_KEY)

GEMINI_MODEL = "gemini-2.5-flash"

# ================================================================
# 2. Load Qwen embedding model
# ================================================================
print("🔹 Loading Qwen3 Embedding model...")
EMBED_MODEL_NAME = "Qwen/Qwen3-Embedding-0.6B"
embed_model = SentenceTransformer(EMBED_MODEL_NAME)

# ================================================================
# 3. Load chunks + embeddings
# ================================================================
BASE_DIR = Path(__file__).resolve().parent
CHUNK_FILE = BASE_DIR / "insurance_chunks.json"
EMB_FILE = BASE_DIR / "insurance_embeddings.npy"

print("🔹 Loading chunks JSON...")
with open(CHUNK_FILE, "r", encoding="utf-8") as f:
    chunks = json.load(f)

print("🔹 Loading precomputed embeddings (.npy)...")
embeddings = np.load(str(EMB_FILE))

print(f"✔ Loaded {len(chunks)} chunks. Embedding shape: {embeddings.shape}")


# ================================================================
# 4. Retrieval functions (semantic search)
# ================================================================
def _encode_query(query: str) -> np.ndarray:
    """Embed the query using Qwen and return a normalized vector."""
    query_emb = embed_model.encode([query], normalize_embeddings=True)
    # (1, d) -> (d,)
    return query_emb.squeeze()


def retrieve_semantic(query: str, top_k: int = 3):
    """
    Generic semantic search over ALL insurance chunks.
    This is used for general questions not tied to any specific PDF.
    """
    query_vec = _encode_query(query)  # (d,)
    scores = np.dot(embeddings, query_vec)  # (N,)
    idx = scores.argsort()[-top_k:][::-1]

    results = []
    for i in idx:
        results.append(
            {
                "chunk": chunks[int(i)]["chunk"],
                "score": float(scores[int(i)]),
                "page": chunks[int(i)].get("page", None),
                "pdf": chunks[int(i)].get("pdf", None),
            }
        )
    return results


def retrieve_semantic_for_pdf(query: str, pdf_name: str, top_k: int = 3):
    """
    Semantic search restricted to chunks that belong to a specific PDF.

    We use the 'pdf' field in insurance_chunks.json.
    Matching rule:
      - case-insensitive substring match: pdf_name.lower() in chunk["pdf"].lower()

    If no chunks match the given pdf_name, we gracefully fall back to
    the global retrieve_semantic().
    """
    if not pdf_name:
        # If no file name is provided, just do global retrieval.
        return retrieve_semantic(query, top_k=top_k)

    pdf_name_lower = pdf_name.lower()

    # Collect indices of chunks whose 'pdf' field matches this file name.
    matched_indices = []
    for i, c in enumerate(chunks):
        pdf_field = str(c.get("pdf", "")).lower()
        if pdf_name_lower in pdf_field:
            matched_indices.append(i)

    if not matched_indices:
        # No match: fall back to global retrieval so that the system
        # still returns a reasonable answer.
        return retrieve_semantic(query, top_k=top_k)

    # Build a subset embedding matrix for these indices.
    subset_emb = embeddings[matched_indices]  # shape (M, d)
    query_vec = _encode_query(query)  # (d,)
    scores_subset = np.dot(subset_emb, query_vec)  # (M,)

    local_idx_sorted = scores_subset.argsort()[-top_k:][::-1]

    results = []
    for local_idx in local_idx_sorted:
        global_i = matched_indices[int(local_idx)]
        results.append(
            {
                "chunk": chunks[global_i]["chunk"],
                "score": float(scores_subset[int(local_idx)]),
                "page": chunks[global_i].get("page", None),
                "pdf": chunks[global_i].get("pdf", None),
            }
        )
    return results


# ================================================================
# 5. Ask Gemini with retrieved chunks
# ================================================================
def ask_gemini(query: str, retrieved_chunks):
    """Send the grounded context to Gemini for explanation."""
    context_text = "\n\n".join(
        [f"[Chunk {i+1}] {c['chunk']}" for i, c in enumerate(retrieved_chunks)]
    )

    prompt = f"""
You are a helpful and knowledgeable U.S. health-insurance assistant.  
Your job is to answer the user’s question using ONLY the retrieved context below.

When responding, please follow this style:

1. **Start with a clear and direct answer.**  
   (One or two sentences that directly respond to the user.)

2. **Then give a helpful explanation in natural language.**  
   Explain the insurance rule in simple terms, like you are talking to a normal person—not a lawyer.

3. **Cite supporting evidence from the retrieved context.**  
   Use phrases like “According to the document…” or “One section states that…”.

4. **If relevant, add a small clarification or reminder.**  
   Example: “Specific plans may vary, so your exact coverage could be different.”

5. **If the context does NOT contain the required information, say that politely.**  
   Do NOT guess or hallucinate.

User question:
{query}

Retrieved context:
{context_text}

Now give a complete, friendly, and well-explained answer.
""".strip()

    model = genai.GenerativeModel(GEMINI_MODEL)
    response = model.generate_content(prompt)
    return response.text.strip()


# ================================================================
# 6. Full RAG pipelines
# ================================================================
def rag_answer(query: str, top_k: int = 3):
    """
    Generic RAG: retrieve from all insurance chunks.
    """
    retrieved = retrieve_semantic(query, top_k=top_k)
    answer = ask_gemini(query, retrieved)
    return answer, retrieved


def rag_answer_for_pdf(query: str, pdf_name: str, top_k: int = 5):
    """
    PDF-specific RAG: restrict retrieval to chunks whose 'pdf' field
    matches the provided pdf_name (case-insensitive substring match).
    """
    retrieved = retrieve_semantic_for_pdf(query, pdf_name, top_k=top_k)
    answer = ask_gemini(query, retrieved)
    return answer, retrieved


# ================================================================
# 7. Standalone demo
# ================================================================
if __name__ == "__main__":
    print("\n🔷 RAG Demo is ready!\n")
    user_query = "Do emergency services bypass the deductible?"
    print(f"💬 User Query: {user_query}\n")

    answer, retrieved = rag_answer(user_query, top_k=3)

    print("===== Retrieved Chunks =====")
    for c in retrieved:
        print(
            f"- Score {c['score']:.3f} | Page {c['page']} | {c['pdf']} | {c['chunk'][:120]}..."
        )

    print("\n===== Gemini RAG Answer =====")
    print(answer)
