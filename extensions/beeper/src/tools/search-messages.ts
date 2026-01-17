import { getBeeperClient, checkBeeperConnection } from "../services/beeper-client";
import { getServiceDisplayName } from "../utils/service-icons";
import { parseService } from "../utils/types";

type Input = {
  /**
   * The search query to find in message content.
   * Will search across all messages in all chats.
   */
  query: string;
  /**
   * Optional: filter by sender.
   * "me" - only messages you sent
   * "others" - only messages from others
   * If not specified, searches all messages.
   */
  sender?: "me" | "others";
};

interface MessageResult {
  text: string;
  sender: string;
  service: string;
  timestamp: string;
  chatId: string;
}

/**
 * Searches message content across all Beeper chats.
 * Returns matching messages with sender info, service, and timestamps.
 */
export default async function (input: Input): Promise<{ messages: MessageResult[]; count: number }> {
  const connectionStatus = await checkBeeperConnection();
  if (!connectionStatus.connected) {
    throw new Error(connectionStatus.error || "Cannot connect to Beeper Desktop");
  }

  const client = await getBeeperClient();

  // Build search params - only use API-supported parameters
  const searchParams: {
    query: string;
    sender?: "me" | "others";
    includeMuted: boolean;
  } = {
    query: input.query,
    includeMuted: true,
  };

  if (input.sender) {
    searchParams.sender = input.sender;
  }

  const searchCursor = await client.messages.search(searchParams);

  // Collect up to 10 results for AI response
  const messages: MessageResult[] = [];

  for await (const msg of searchCursor) {
    const senderName = msg.isSender
      ? "You"
      : msg.senderName || msg.senderID?.split(":")[0]?.replace("@", "") || "Unknown";

    messages.push({
      text: msg.text || "[No text content]",
      sender: senderName,
      service: getServiceDisplayName(parseService(msg.accountID)),
      timestamp: msg.timestamp,
      chatId: msg.chatID,
    });

    if (messages.length >= 10) break;
  }

  if (messages.length === 0) {
    throw new Error(`No messages found matching "${input.query}"`);
  }

  return {
    messages,
    count: messages.length,
  };
}
