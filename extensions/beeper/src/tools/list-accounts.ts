import { getBeeperClient, checkBeeperConnection } from "../services/beeper-client";
import { parseService } from "../utils/types";
import { getServiceDisplayName } from "../utils/service-icons";

/**
 * Lists all connected messaging service accounts in Beeper.
 * Returns the service name, display name, and connection status for each account.
 */
export default async function () {
  const connectionStatus = await checkBeeperConnection();
  if (!connectionStatus.connected) {
    throw new Error(connectionStatus.error || "Cannot connect to Beeper Desktop");
  }

  const client = await getBeeperClient();
  const accounts = await client.accounts.list();

  return (accounts || []).map((account) => {
    const service = parseService(account.network);
    return {
      service: getServiceDisplayName(service),
      serviceId: service,
      displayName: account.user?.fullName || account.network || "Unknown",
      username: account.user?.username,
      isConnected: true, // API only returns connected accounts
    };
  });
}
