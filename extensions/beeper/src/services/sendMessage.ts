import { getBeeperClient } from "./beeper-client";
import { parseService, BeeperService } from "../utils/types";
import { rankChatMatches, getSuggestionMessage } from "../utils/contact-matching";

interface SendMessageOptions {
  chatId?: string;
  chatName?: string;
  service?: string;
  message: string;
}

interface SendMessageResult {
  success: boolean;
  sentTo?: string;
  service?: BeeperService;
  error?: string;
  suggestions?: string[];
}

/**
 * Send a message via Beeper
 * Can send by chat ID directly, or search by contact name
 */
export async function sendMessage(options: SendMessageOptions): Promise<SendMessageResult> {
  const client = await getBeeperClient();

  try {
    let chatId = options.chatId;
    let chatName: string | undefined;
    let chatService: BeeperService = "unknown";

    // If no chat ID, search by name
    if (!chatId && options.chatName) {
      const searchCursor = await client.chats.search({
        query: options.chatName,
        limit: 20, // Increased limit for better ranking candidates
      });

      // Collect results from cursor
      const allMatches: Array<{ id: string; title: string; network: string }> = [];
      for await (const chat of searchCursor) {
        allMatches.push(chat);
        if (allMatches.length >= 20) break;
      }

      // Rank matches using similarity scoring
      const rankedMatches = rankChatMatches(allMatches, options.chatName, {
        service: options.service,
        minScore: 0.4,
        maxResults: 5,
      });

      if (rankedMatches.length === 0) {
        // Get suggestions from all matches (without service filter) for better error message
        const allRanked = rankChatMatches(allMatches, options.chatName, {
          minScore: 0.3,
          maxResults: 3,
        });

        return {
          success: false,
          error: getSuggestionMessage(options.chatName, allRanked, options.service),
          suggestions: allRanked.map((m) => m.chat.title),
        };
      }

      // Use best match
      const bestMatch = rankedMatches[0].chat;
      chatId = bestMatch.id;
      chatName = bestMatch.title;
      chatService = parseService(bestMatch.network);
    }

    if (!chatId) {
      return { success: false, error: "No chat ID or name provided" };
    }

    // Send the message
    await client.messages.send({
      chatID: chatId,
      text: options.message,
    });

    return {
      success: true,
      sentTo: chatName || chatId,
      service: chatService,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Failed to send message";
    return { success: false, error: errorMessage };
  }
}
