"use client";

import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import PDFHighlighter from "./PDFHighlighter";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type RAGResponse = {
  answer: string;
  chunks: any[];
};

const BACKEND_URL =
  (typeof process !== "undefined" &&
    process.env.NEXT_PUBLIC_BACKEND_URL) ||
  "https://fictional-guacamole-wr974jjpwp66h9wqw-8000.app.github.dev";

console.log("BACKEND_URL =", BACKEND_URL);

async function callRAG(path: string, body: any): Promise<RAGResponse> {
  const url = `${BACKEND_URL}${path}`;
  console.log("Calling RAG backend:", url, "\nbody:", body);

  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    console.error("RAG HTTP error:", resp.status, await resp.text());
    throw new Error(`RAG request failed: ${resp.status}`);
  }

  return (await resp.json()) as RAGResponse;
}

export default function HomePage() {
  // === overview (top right) ===
  const [overviewText, setOverviewText] = useState("");
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const [currentFileName, setCurrentFileName] = useState<string | null>(null);

  // === highlight Q&A (bottom right) ===
  const [selectedText, setSelectedText] = useState<string | null>(null);
  const [highlightMessages, setHighlightMessages] = useState<ChatMessage[]>([]);
  const [highlightInput, setHighlightInput] = useState("");

  // -----------------------------
  // Document overview – after upload
  // -----------------------------
  const fetchOverviewForFile = async (fileName: string) => {
    setOverviewLoading(true);
    setOverviewError(null);
    setOverviewText("");

    const question = `
The user has uploaded a U.S. health-insurance related PDF named "${fileName}".

Based on the retrieved chunks from this PDF and any closely related
insurance information in the knowledge base, write a concise summary.

In 5–7 short sentences:
1. Explain what kind of document this is and who typically provides it (for example, an employer, insurance company, or government agency).
2. Describe the main purpose of this document for the person reading it.
3. Highlight 3–4 key things the reader should pay attention to (such as who is covered, premium costs, deductibles/copays, important deadlines, and what to do if something looks wrong).

Use simple language. Bold important terms with **this style**.
`.trim();

    try {
      const res = await callRAG("/api/rag/overview", {
        question,
        file_name: fileName,
      });
      setOverviewText(res.answer);
    } catch (err) {
      console.error(err);
      setOverviewError(
        "Sorry, I could not load the document overview from the server."
      );
    } finally {
      setOverviewLoading(false);
    }
  };

  // PDF uploaded (from PDFInner via PDFHighlighter)
  const handleFileLoaded = (fileName: string) => {
    setCurrentFileName(fileName);
    setSelectedText(null);
    setHighlightMessages([]);
    setHighlightInput("");
    fetchOverviewForFile(fileName);
  };

  // -----------------------------
  // Highlight Q&A
  // -----------------------------
  const handleSelection = async (text: string) => {
    setSelectedText(text);
    setHighlightMessages([]);
    setHighlightInput("");

    const question = `
You are explaining one short sentence from a U.S. health insurance form
to a normal person with no insurance background.

Highlighted text:
"${text}"

In **no more than 3 short sentences**, explain:
- What this part is saying in simple words,
- What it means for the person reading or filling out the form,
- If needed, mention **one** thing they should be careful about (such as deadlines or coverage limits).

Use clear language and bold important terms with **this style**.
`.trim();

    try {
      const res = await callRAG("/api/rag/highlight", {
        question,
      });
      setHighlightMessages([
        {
          role: "assistant",
          content: res.answer,
        },
      ]);
    } catch (err) {
      console.error(err);
      setHighlightMessages([
        {
          role: "assistant",
          content:
            "Sorry, I could not get an explanation from the server. Please try again later.",
        },
      ]);
    }
  };

  const handleClearSelection = () => {
    setSelectedText(null);
    setHighlightMessages([]);
    setHighlightInput("");
  };

  const handleHighlightSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = highlightInput.trim();
    if (!trimmed || !selectedText) return;

    const userMsg: ChatMessage = { role: "user", content: trimmed };
    setHighlightMessages((prev) => [...prev, userMsg]);
    setHighlightInput("");

    const question = `
We are discussing this highlighted text from a U.S. health insurance form:
"${selectedText}"

The user now asks:
"${trimmed}"

Answer in **no more than 3 short sentences**, focusing only on what the user really needs to know.
Use simple language and bold important terms with **this style**.
`.trim();

    try {
      const res = await callRAG("/api/rag/highlight", {
        question,
      });

      const botMsg: ChatMessage = {
        role: "assistant",
        content: res.answer,
      };

      setHighlightMessages((prev) => [...prev, botMsg]);
    } catch (err) {
      console.error(err);
      setHighlightMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "Sorry, I could not get a follow-up answer from the server.",
        },
      ]);
    }
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        backgroundColor: "#f3f4f6",
        padding: "24px",
        boxSizing: "border-box",
      }}
    >
      {/* Title */}
      <h1
        style={{
          textAlign: "center",
          fontSize: "32px",
          fontWeight: 700,
          color: "#2563eb",
          marginBottom: "16px",
        }}
      >
        Healthcare Insurance Chatbot
      </h1>

      {/* Main layout */}
      <div
        style={{
          display: "flex",
          gap: "24px",
          alignItems: "stretch",
          height: "calc(100vh - 104px)",
        }}
      >
        {/* LEFT: PDF */}
        <div
          style={{
            flex: 3,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              flex: 1,
              backgroundColor: "#ffffff",
              borderRadius: "12px",
              boxShadow: "0 10px 30px rgba(15, 23, 42, 0.12)",
              padding: "12px",
              boxSizing: "border-box",
              overflow: "hidden",
            }}
          >
            <PDFHighlighter
              onSelection={handleSelection}
              onClearSelection={handleClearSelection}
              onFileLoaded={handleFileLoaded}
            />
          </div>
        </div>

        {/* RIGHT: overview (top 1/2) + highlight Q&A (bottom 1/2) */}
        <div
          style={{
            flex: 2,
            display: "flex",
            flexDirection: "column",
            gap: "16px",
          }}
        >
          {/* Top: Document Overview */}
          <div
            style={{
              backgroundColor: "#ffffff",
              borderRadius: "12px",
              boxShadow: "0 10px 30px rgba(15, 23, 42, 0.12)",
              padding: "16px",
              boxSizing: "border-box",
              flex: 1,
              display: "flex",
              flexDirection: "column",
              minHeight: 0,
            }}
          >
            <div
              style={{
                fontWeight: 700,
                fontSize: "16px",
                marginBottom: "8px",
              }}
            >
              Document Overview (RAG)
            </div>
            <div
              style={{
                flex: 1,
                borderRadius: "8px",
                backgroundColor: "#f9fafb",
                padding: "10px",
                overflowY: "auto",
                fontSize: "13px",
              }}
            >
              {!currentFileName && (
                <span style={{ color: "#9ca3af" }}>
                  Upload an insurance PDF on the left to see a document-specific
                  overview here.
                </span>
              )}

              {currentFileName && overviewLoading && (
                <span style={{ color: "#9ca3af" }}>
                  Generating a short overview for "{currentFileName}"…
                </span>
              )}

              {currentFileName && !overviewLoading && overviewError && (
                <span style={{ color: "#b91c1c" }}>{overviewError}</span>
              )}

              {currentFileName &&
                !overviewLoading &&
                !overviewError &&
                overviewText && (
                  <div
                    style={{
                      display: "inline-block",
                      padding: "8px 10px",
                      borderRadius: "8px",
                      backgroundColor: "#e5e7eb",
                      color: "#111827",
                    }}
                  >
                    <ReactMarkdown>{overviewText}</ReactMarkdown>
                  </div>
                )}
            </div>
          </div>

          {/* Bottom: Highlight Q&A */}
          <div
            style={{
              backgroundColor: "#ffffff",
              borderRadius: "12px",
              boxShadow: "0 10px 30px rgba(15, 23, 42, 0.12)",
              padding: "16px",
              boxSizing: "border-box",
              flex: 1,
              display: "flex",
              flexDirection: "column",
              minHeight: 0,
            }}
          >
            <div
              style={{
                fontWeight: 700,
                fontSize: "16px",
                marginBottom: "8px",
              }}
            >
              Highlight Q&A
            </div>

            {!selectedText && (
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#9ca3af",
                  fontSize: "13px",
                }}
              >
                Highlight a sentence on the left to see a short explanation
                here.
              </div>
            )}

            {selectedText && (
              <>
                <div
                  style={{
                    flex: 1,
                    borderRadius: "8px",
                    backgroundColor: "#f9fafb",
                    padding: "10px",
                    marginBottom: "8px",
                    overflowY: "auto",
                    fontSize: "13px",
                    minHeight: 0,
                  }}
                >
                  {/* selected text */}
                  <div
                    style={{
                      fontSize: "12px",
                      fontWeight: 600,
                      color: "#4b5563",
                      marginBottom: "4px",
                    }}
                  >
                    Selected text:
                  </div>
                  <div
                    style={{
                      marginBottom: "10px",
                      padding: "8px 10px",
                      borderRadius: "6px",
                      backgroundColor: "rgba(255, 255, 170, 0.9)",
                      color: "#111827",
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {selectedText}
                  </div>

                  {/* conversation */}
                  {highlightMessages.map((msg, idx) => (
                    <div
                      key={idx}
                      style={{
                        marginBottom: "6px",
                        textAlign: msg.role === "user" ? "right" : "left",
                      }}
                    >
                      <span
                        style={{
                          display: "inline-block",
                          padding: "8px 12px",
                          borderRadius: "16px",
                          backgroundColor:
                            msg.role === "user" ? "#2563eb" : "#e5e7eb",
                          color: msg.role === "user" ? "#f9fafb" : "#111827",
                          whiteSpace: "pre-wrap",
                          maxWidth: "100%",
                          textAlign: "left",
                        }}
                      >
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </span>
                    </div>
                  ))}
                </div>

                {/* input */}
                <form
                  onSubmit={handleHighlightSubmit}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <input
                    type="text"
                    placeholder="Ask more about this highlighted text..."
                    value={highlightInput}
                    onChange={(e) => setHighlightInput(e.target.value)}
                    style={{
                      flex: 1,
                      borderRadius: "9999px",
                      border: "1px solid #d1d5db",
                      padding: "8px 12px",
                      fontSize: "13px",
                      outline: "none",
                    }}
                  />
                  <button
                    type="submit"
                    style={{
                      borderRadius: "9999px",
                      backgroundColor: "#2563eb",
                      color: "#f9fafb",
                      border: "none",
                      padding: "8px 16px",
                      fontSize: "13px",
                      fontWeight: 500,
                      cursor: "pointer",
                    }}
                  >
                    Send
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
