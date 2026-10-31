import sys
import os
sys.path.insert(0, os.path.abspath("."))
sys.stdout.reconfigure(encoding='utf-8')

from app.ingestion.database import GovernmentDatabase
from app.ingestion.html_loader import GovernmentHTMLLoader
from app.ingestion.document_processor import GovernmentDocumentProcessor
from app.ingestion.embeddings import EmbeddingService
from app.retrieval.hnsw_index import FAISSHNSWIndex
from app.retrieval.bm25_retriever import GovernmentBM25Retriever
from langchain_core.documents import Document

def main():
    print("Starting multilingual reindexing...")
    db = GovernmentDatabase()
    raw_docs = db.fetch_all_documents()
    print(f"Fetched {len(raw_docs)} documents from SQLite.")

    loader = GovernmentHTMLLoader()
    docs = loader.load_from_records(raw_docs)
    print(f"Loaded {len(docs)} LangChain documents.")

    processor = GovernmentDocumentProcessor(chunk_size=500, chunk_overlap=100)
    chunks = processor.split_documents(docs)
    print(f"Split into {len(chunks)} chunks.")

    service = EmbeddingService.get_instance()
    print(f"Embedding model: {service.model_name}, dim: {service.dimension}")

    texts = [c.page_content for c in chunks]
    embeddings = service.embed_texts(texts)
    print(f"Generated embeddings array shape: {embeddings.shape}")

    hnsw = FAISSHNSWIndex(dimension=service.dimension)
    hnsw.rebuild(chunks, embeddings)
    print(f"FAISS HNSW index rebuilt with {hnsw.total_vectors} vectors.")

    bm25 = GovernmentBM25Retriever(documents=chunks)
    print(f"BM25 index rebuilt with {len(bm25.documents)} documents.")

    # Update hash cache
    for c in chunks:
        cid = c.metadata.get("chunk_id", "")
        if cid:
            h = service.compute_hash(c.page_content)
            service.update_hash_cache(cid, h)
    service._save_hash_cache()

    # Mark documents indexed in db
    for doc in raw_docs:
        doc_id = doc["document_id"]
        cnt = hnsw.get_document_chunk_count(doc_id)
        db.mark_document_indexed(doc_id, chunk_count=cnt, embedding_model=service.model_name)
    print("Database updated with indexing status.")
    print("Reindexing complete!")

if __name__ == "__main__":
    main()
