from sentence_transformers import SentenceTransformer
import numpy as np
import json

model = SentenceTransformer("Qwen/Qwen3-Embedding-0.6B")

chunks = json.load(open("insurance_chunks.json"))
texts = [c["chunk"] for c in chunks]

emb = model.encode(texts, normalize_embeddings=True)
np.save("insurance_embeddings.npy", emb)

print(emb.shape)
