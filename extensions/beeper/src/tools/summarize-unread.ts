import { getBeeperClient, checkBeeperConnection } from "../services/beeper-client";
import { getServiceDisplayName } from "../utils/service-icons";
import { parseService } from "../utils/types";
import { rankChatMatches, getSuggestionMessage } from "../utils/contact-matching";

type Input = {
  /**
   * The name of the chat to summarize unread messages from.
   * Can be a person's name like "John Smith", partial name like "John",
   * nickname like "mom", or group name like "Family Group".
   */
  chatName: string;
  /**
   * Optional: specific messaging service to filter by.
   * Examples: "whatsapp", "telegram", "signal", "discord", "slack", "imessage"
   * If not specified, will find the first matching chat across all services.
   */
  service?: string;
};

interface UnreadMessage {
  sender: string;
  text: string;
  timestamp: string;
}

interface SummarizeResult {
  chatName: string;
  service: string;
  unreadCount: number;
  messages: UnreadMessage[];
}

/**
 * Gets unread messages from a specific chat for AI summarization.
 * Searches for the chat by name, fetches recent messages, and filters for unread ones.
 */
export default async function (input: Input): Promise<SummarizeResult> {
  // 1. Check Beeper connection
  const connectionStatus = await checkBeeperConnection();
  if (!connectionStatus.connected) {
    throw new Error(connectionStatus.error || "Cannot connect to Beeper Desktop");
  }

  const client = await getBeeperClient();

  // 2. Search for chat by name
  const searchCursor = await client.chats.search({
    query: input.chatName,
    limit: 20,
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

  // 3. Rank matches using similarity scoring
  const rankedMatches = rankChatMatches(allMatches, input.chatName, {
    service: input.service,
    minScore: 0.4,
    maxResults: 5,
  });

  if (rankedMatches.length === 0) {
    // Get suggestions from all matches for better error message
    const allRanked = rankChatMatches(allMatches, input.chatName, {
      minScore: 0.3,
      maxResults: 3,
    });
    throw new Error(getSuggestionMessage(input.chatName, allRanked, input.service));
  }

  // Use best match
  const bestMatch = rankedMatches[0].chat;
  const chatId = bestMatch.id;
  const chatName = bestMatch.title || input.chatName;
  const service = getServiceDisplayName(parseService(bestMatch.network));
  const unreadCount = bestMatch.unreadCount || 0;

  // 4. Check if there are unread messages
  if (unreadCount === 0) {
    return {
      chatName,
      service,
      unreadCount: 0,
      messages: [],
    };
  }

  // 5. Fetch recent messages for this chat
  // We need to fetch enough messages to find the unread ones
  const messageCursor = await client.messages.search({
    query: "", // Empty query to get all messages
    chatIDs: [chatId],
    includeMuted: true,
  });

  // 6. Collect messages and filter for unread
  const unreadMessages: UnreadMessage[] = [];
  let messagesChecked = 0;
  const maxMessagesToCheck = 50; // Limit to prevent too many API calls

  for await (const msg of messageCursor) {
    messagesChecked++;

    // Check if message is unread (from others, not from self)
    if (msg.isUnread && !msg.isSender) {
      const senderName = msg.senderName || msg.senderID?.split(":")[0]?.replace("@", "") || "Unknown";

      unreadMessages.push({
        sender: senderName,
        text: msg.text || "[Attachment or media message]",
        timestamp: msg.timestamp,
      });

      // Stop if we've collected enough unread messages
      if (unreadMessages.length >= unreadCount || unreadMessages.length >= 20) {
        break;
      }
    }

    // Safety limit to prevent infinite loops
    if (messagesChecked >= maxMessagesToCheck) {
      break;
    }
  }

  // Sort messages by timestamp (oldest first for chronological reading)
  unreadMessages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  return {
    chatName,
    service,
    unreadCount,
    messages: unreadMessages,
  };
}
