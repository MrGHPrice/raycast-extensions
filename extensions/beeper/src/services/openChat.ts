import { getBeeperClient } from "./beeper-client";
import { BeeperChat, parseService } from "../utils/types";
import { open, closeMainWindow } from "@raycast/api";
import { rankChatMatches, getSuggestionMessage } from "../utils/contact-matching";

interface OpenChatOptions {
  chatId?: string;
  chatName?: string;
  service?: string;
}

interface OpenChatResult {
  success: boolean;
  chat?: BeeperChat;
  error?: string;
  suggestions?: string[];
}

/**
 * Open a chat in Beeper Desktop
 * Can open by chat ID directly, or search by name
 */
export async function openChat(options: OpenChatOptions): Promise<OpenChatResult> {
  const client = await getBeeperClient();

  try {
    let chatId = options.chatId;
    let foundChat: BeeperChat | undefined;

    // If no chat ID, search by name
    if (!chatId && options.chatName) {
      const searchCursor = await client.chats.search({
        query: options.chatName,
        limit: 20, // Increased limit for better ranking candidates
      });

      // Collect results from cursor
      const allMatches: Array<{
        id: string;
        title: string;
        network: string;
        accountID?: string;
        type?: string;
        lastActivity?: string;
        unreadCount?: number;
        isMuted?: boolean;
        isArchived?: boolean;
      }> = [];
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
      foundChat = {
        id: chatId,
        name: bestMatch.title || "Unknown",
        service: parseService(bestMatch.network),
        accountId: bestMatch.accountID || "",
        type: (bestMatch.type as "single" | "group" | "space") || "single",
        lastMessageAt: bestMatch.lastActivity,
        unreadCount: bestMatch.unreadCount,
        isMuted: bestMatch.isMuted,
        isArchived: bestMatch.isArchived,
      };
    }

    if (!chatId) {
      return { success: false, error: "No chat ID or name provided" };
    }

    // Open the chat in Beeper Desktop
    try {
      await client.app.open({ chatID: chatId });
      await closeMainWindow();
    } catch (openError) {
      console.error("Failed to open chat:", openError);
      // Fallback: just open Beeper app
      try {
        await open("beeper://");
        await closeMainWindow();
      } catch {
        throw new Error("Could not open chat in Beeper Desktop");
      }
    }

    return { success: true, chat: foundChat };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Failed to open chat";
    return { success: false, error: errorMessage };
  }
}
