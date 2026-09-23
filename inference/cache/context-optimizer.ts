export interface ContextOptimizationOptions {
  maxRecentDetailedTurns?: number;
  maxToolResultChars?: number;
  maxFileContextChars?: number;
}

export interface OptimizationResult {
  optimizedMessages: any[];
  optimizedSystem?: string;
  retainedTokensEstimate: number;
  prunedTokensEstimate: number;
  prefixInvariantText: string;
}

export class ContextOptimizer {
  private readonly defaultOptions: Required<ContextOptimizationOptions> = {
    maxRecentDetailedTurns: 3,
    maxToolResultChars: 400,
    maxFileContextChars: 12000, // ~3000 tokens
  };

  /**
   * Optimize messages for repeated agent turns and context budgeting
   */
  optimizeMessages(
    messages: any[],
    systemPrompt?: string,
    options?: ContextOptimizationOptions,
  ): OptimizationResult {
    const opts = { ...this.defaultOptions, ...options };
    if (!messages || messages.length === 0) {
      return {
        optimizedMessages: [],
        optimizedSystem: systemPrompt,
        retainedTokensEstimate: 0,
        prunedTokensEstimate: 0,
        prefixInvariantText: systemPrompt || "",
      };
    }

    let initialLength = 0;
    for (const m of messages) {
      initialLength += this.getMessageCharLength(m);
    }

    const totalMessages = messages.length;
    // Calculate the cutoff index: keep messages from the last `maxRecentDetailedTurns * 2` uncompressed
    const recentCutoffIndex = Math.max(0, totalMessages - opts.maxRecentDetailedTurns * 2);

    const optimizedMessages = messages.map((msg, index) => {
      // Recent messages stay untouched
      if (index >= recentCutoffIndex) {
        return msg;
      }

      // Older messages: compress bulky tool results or verbose text
      return this.compressOldMessage(msg, opts.maxToolResultChars);
    });

    let finalLength = 0;
    for (const m of optimizedMessages) {
      finalLength += this.getMessageCharLength(m);
    }

    const prunedChars = Math.max(0, initialLength - finalLength);
    const retainedTokens = Math.ceil(finalLength / 3.8);
    const prunedTokens = Math.ceil(prunedChars / 3.8);

    return {
      optimizedMessages,
      optimizedSystem: systemPrompt,
      retainedTokensEstimate: retainedTokens,
      prunedTokensEstimate: prunedTokens,
      prefixInvariantText: systemPrompt || "",
    };
  }

  /**
   * Compress older messages containing bulky tool results or lengthy outputs
   */
  private compressOldMessage(msg: any, maxChars: number): any {
    if (!msg) return msg;

    // Standard Vercel AI SDK / OpenAI message structure
    if (msg.role === "tool" || (msg.content && Array.isArray(msg.content))) {
      if (Array.isArray(msg.content)) {
        const compressedContent = msg.content.map((part: any) => {
          if (part.type === "tool-result" && typeof part.result === "string" && part.result.length > maxChars) {
            const preview = part.result.slice(0, Math.floor(maxChars * 0.7));
            const omitted = part.result.length - preview.length;
            return {
              ...part,
              result: `${preview}\n... [${omitted} chars truncated from earlier turn history]`,
            };
          }
          if (part.type === "text" && typeof part.text === "string" && part.text.length > maxChars * 2) {
            const preview = part.text.slice(0, maxChars);
            return {
              ...part,
              text: `${preview}\n... [earlier turn output condensed]`,
            };
          }
          return part;
        });
        return { ...msg, content: compressedContent };
      }

      // If content is string
      if (typeof msg.content === "string" && msg.content.length > maxChars) {
        return {
          ...msg,
          content: `${msg.content.slice(0, maxChars)}\n... [truncated for context efficiency]`,
        };
      }
    }

    return msg;
  }

  private getMessageCharLength(msg: any): number {
    if (!msg) return 0;
    if (typeof msg.content === "string") return msg.content.length;
    if (Array.isArray(msg.content)) {
      return msg.content.reduce((acc: number, part: any) => {
        if (typeof part.text === "string") return acc + part.text.length;
        if (typeof part.result === "string") return acc + part.result.length;
        if (typeof part.output === "string") return acc + part.output.length;
        return acc + 50;
      }, 0);
    }
    return 100;
  }

  /**
   * Structure invariant prefix: System prompt + Tool descriptions
   */
  buildInvariantPrefix(systemPrompt: string, tools?: Record<string, any>): string {
    const parts = [systemPrompt.trim()];
    if (tools && Object.keys(tools).length > 0) {
      const toolNames = Object.keys(tools).sort().join(",");
      parts.push(`Available tools: ${toolNames}`);
    }
    return parts.join("\n---\n");
  }
}

export const contextOptimizer = new ContextOptimizer();
