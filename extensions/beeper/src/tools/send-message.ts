import { Tool } from "@raycast/api";
import { sendMessage } from "../services/sendMessage";
import { getServiceDisplayName } from "../utils/service-icons";

type Input = {
  /**
   * The name of the person or group to send a message to.
   * Can be a full name like "John Smith", partial name like "John",
   * nickname like "mom", or group name like "Family Group".
   * The system will fuzzy-match to find the best contact.
   */
  name: string;
  /**
   * The message content to send. This is the actual text that will
   * be delivered to the recipient.
   */
  message: string;
  /**
   * Optional: specific messaging service to use.
   * Examples: "whatsapp", "telegram", "signal", "discord", "slack", "imessage"
   * If not specified, will send via the first matching chat across all services.
   * Only include this if the user explicitly mentions a service.
   */
  service?: string;
};

/**
 * Sends a message to a contact or group via Beeper.
 * Can optionally specify which messaging service to use.
 */
export default async function (input: Input) {
  const result = await sendMessage({
    chatName: input.name,
    message: input.message,
    service: input.service,
  });

  if (!result.success) {
    // Include suggestions in the error for better AI feedback
    const suggestionText = result.suggestions?.length ? ` Similar contacts: ${result.suggestions.join(", ")}` : "";
    throw new Error((result.error || "Failed to send message") + suggestionText);
  }

  const serviceName = result.service ? getServiceDisplayName(result.service) : input.service || "Beeper";

  return {
    sentTo: result.sentTo || input.name,
    service: serviceName,
    messageSent: true,
  };
}

/**
 * Confirmation dialog before sending the message
 */
export const confirmation: Tool.Confirmation<Input> = async (input) => {
  const servicePart = input.service ? ` via ${input.service}` : "";

  return {
    message: `Send message to "${input.name}"${servicePart}?`,
    info: [
      {
        name: "Recipient",
        value: input.name,
      },
      {
        name: "Message",
        value: input.message.length > 100 ? input.message.substring(0, 100) + "..." : input.message,
      },
      {
        name: "Service",
        value: input.service || "Auto-detect (first matching chat)",
      },
    ],
  };
};
