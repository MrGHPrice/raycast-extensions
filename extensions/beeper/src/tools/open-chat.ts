import { openChat } from "../services/openChat";
import { getServiceDisplayName } from "../utils/service-icons";

type Input = {
  /**
   * The name of the person or group chat to open.
   * Can be a full name like "John Smith", partial name like "John",
   * nickname like "mom", or group name like "Family Group".
   * The system will fuzzy-match to find the best contact.
   */
  name: string;
  /**
   * Optional: specific messaging service to filter by.
   * Examples: "whatsapp", "telegram", "signal", "discord", "slack", "imessage"
   * If not specified, will open the first matching chat across all services.
   * Only include this if the user explicitly mentions a service.
   */
  service?: string;
};

/**
 * Opens a chat in Beeper Desktop by searching for a contact or group name.
 * Can optionally filter by messaging service and draft a message.
 */
export default async function (input: Input) {
  const result = await openChat({
    chatName: input.name,
    service: input.service,
  });

  if (!result.success) {
    // Include suggestions in the error for better AI feedback
    const suggestionText = result.suggestions?.length ? ` Similar contacts: ${result.suggestions.join(", ")}` : "";
    throw new Error((result.error || "Failed to open chat") + suggestionText);
  }

  const serviceName = result.chat?.service ? getServiceDisplayName(result.chat.service) : input.service || "Beeper";

  return {
    openedChat: result.chat?.name || input.name,
    service: serviceName,
  };
}
