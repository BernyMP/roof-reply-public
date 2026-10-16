import type { LanguageModel } from "ai";

type Model = Extract<LanguageModel, { specificationVersion: "v4" }>;
type Result = Awaited<ReturnType<Model["doGenerate"]>>;
type Stream = Awaited<ReturnType<Model["doStream"]>>;

// ChatGPT's subscription endpoint is streaming-only. Eve compaction still calls
// doGenerate, so collect that same authenticated stream without another provider.
export async function collectSubscriptionStream(source: Stream): Promise<Result> {
  const content: Result["content"] = [];
  const blocks = new Map<string, Extract<Result["content"][number], { type: "text" | "reasoning" }>>();
  let finish: Pick<Result, "usage" | "finishReason" | "providerMetadata"> | undefined;
  let warnings: Result["warnings"] = [];
  let response: Result["response"] = source.response;
  const reader = source.stream.getReader();
  try {
    while (true) {
      const { value: part, done } = await reader.read();
      if (done) break;
      switch (part.type) {
        case "error": throw part.error;
        case "stream-start": warnings = part.warnings; break;
        case "response-metadata": response = { ...response, id: part.id, timestamp: part.timestamp, modelId: part.modelId }; break;
        case "finish": finish = { usage: part.usage, finishReason: part.finishReason, providerMetadata: part.providerMetadata }; break;
        case "text-start":
        case "reasoning-start": {
          const block = { type: part.type === "text-start" ? "text" as const : "reasoning" as const, text: "", providerMetadata: part.providerMetadata };
          blocks.set(part.id, block);
          content.push(block);
          break;
        }
        case "text-delta":
        case "reasoning-delta": {
          const block = blocks.get(part.id);
          if (!block) throw new Error("Subscription stream contained an unstarted content block.");
          block.text += part.delta;
          if (part.providerMetadata) block.providerMetadata = { ...block.providerMetadata, ...part.providerMetadata };
          break;
        }
        case "text-end":
        case "reasoning-end": {
          const block = blocks.get(part.id);
          if (block && part.providerMetadata) block.providerMetadata = { ...block.providerMetadata, ...part.providerMetadata };
          break;
        }
        case "tool-call": case "tool-result": case "tool-approval-request":
        case "file": case "reasoning-file": case "source": case "custom":
          content.push(part); break;
        // Final tool-call parts carry the complete input; raw transport is omitted.
        case "tool-input-start": case "tool-input-delta": case "tool-input-end": case "raw": break;
      }
    }
    if (!finish) throw new Error("Subscription stream ended without confirmed usage.");
    return { content, ...finish, warnings, request: source.request, response };
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
