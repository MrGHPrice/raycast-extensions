import { Action, ActionPanel, Icon, List, showToast, Toast } from "@raycast/api";
import { withAccessToken } from "@raycast/utils";
import { useState, useEffect, useRef, useCallback } from "react";
import { getBeeperClient, checkBeeperConnection, createBeeperOAuth } from "./services/beeper-client";
import { openChat } from "./services/openChat";
import { getServiceIcon, getServiceDisplayName } from "./utils/service-icons";
import { parseService, BeeperService } from "./utils/types";
import formatTimeDistance from "fromnow";

interface SearchChatItem {
  id: string;
  name: string;
  type: "single" | "group" | "space";
  service: BeeperService;
  networkRaw: string;
  accountId: string;
  lastMessageAt?: string;
  unreadCount?: number;
  isMuted?: boolean;
  isArchived?: boolean;
  participantNames?: string;
}

type SearchScope = "titles" | "participants";
type ChatType = "any" | "single" | "group";

/**
 * Get the best display name for a chat
 */
function getBestChatName(chat: {
  title: string;
  type: string;
  participants?: { items: Array<{ fullName?: string; id: string }> };
}): string {
  const title = chat.title;

  if (title && title.includes("@") && title.includes(":")) {
    if (chat.type === "single" && chat.participants?.items?.[0]?.fullName) {
      return chat.participants.items[0].fullName;
    }
    const match = title.match(/@([^:]+):/);
    if (match) {
      return match[1];
    }
  }

  return title || "Unknown Chat";
}

/**
 * Get participant names as a string for display
 */
function getParticipantNames(participants?: { items: Array<{ fullName?: string; id: string }> }): string {
  if (!participants?.items?.length) return "";
  return participants.items
    .slice(0, 3)
    .map((p) => p.fullName || p.id.split(":")[0].replace("@", ""))
    .join(", ");
}

function SearchChatsCommand() {
  const [searchText, setSearchText] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [serviceFilter, setServiceFilter] = useState<string>("all");
  const [scopeFilter, setScopeFilter] = useState<SearchScope>("titles");
  const [typeFilter, setTypeFilter] = useState<ChatType>("any");

  const [chats, setChats] = useState<SearchChatItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableNetworks, setAvailableNetworks] = useState<string[]>([]);

  const abortControllerRef = useRef<AbortController | null>(null);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchText);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchText]);

  // Perform search when debounced query or filters change
  const performSearch = useCallback(async () => {
    // Cancel any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setIsLoading(true);
    setError(null);

    try {
      const connectionStatus = await checkBeeperConnection();
      if (!connectionStatus.connected) {
        throw new Error(connectionStatus.error || "Cannot connect to Beeper Desktop");
      }

      const client = await getBeeperClient();

      // Build search params
      const searchParams: {
        query?: string;
        scope?: "titles" | "participants";
        type?: "single" | "group" | "any";
        limit: number;
        includeMuted: boolean;
      } = {
        limit: 50,
        includeMuted: true,
      };

      if (debouncedSearch.trim()) {
        searchParams.query = debouncedSearch.trim();
        searchParams.scope = scopeFilter;
      }

      if (typeFilter !== "any") {
        searchParams.type = typeFilter;
      }

      const searchCursor = await client.chats.search(searchParams);

      // Collect results
      const chatsFromApi: Array<{
        id: string;
        title: string;
        type: "single" | "group";
        network: string;
        accountID: string;
        lastActivity?: string;
        unreadCount: number;
        isMuted?: boolean;
        isArchived?: boolean;
        participants?: { items: Array<{ fullName?: string; id: string }> };
      }> = [];

      for await (const chat of searchCursor) {
        chatsFromApi.push(chat);
        if (chatsFromApi.length >= 50) break;
      }

      // Transform results
      const transformedChats: SearchChatItem[] = chatsFromApi.map((chat) => ({
        id: chat.id || "",
        name: getBestChatName(chat),
        type: chat.type || "single",
        service: parseService(chat.network),
        networkRaw: chat.network || "Unknown",
        accountId: chat.accountID || "",
        lastMessageAt: chat.lastActivity,
        unreadCount: chat.unreadCount,
        isMuted: chat.isMuted,
        isArchived: chat.isArchived,
        participantNames: getParticipantNames(chat.participants),
      }));

      // Sort by last activity
      transformedChats.sort((a, b) => {
        const timeA = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
        const timeB = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
        return timeB - timeA;
      });

      // Update available networks for filter
      const networks = [...new Set(transformedChats.map((c) => c.networkRaw))].sort();
      setAvailableNetworks(networks);

      setChats(transformedChats);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return; // Ignore aborted requests
      }
      const message = err instanceof Error ? err.message : "Search failed";
      setError(message);
      showToast({
        style: Toast.Style.Failure,
        title: "Search failed",
        message,
      });
    } finally {
      setIsLoading(false);
    }
  }, [debouncedSearch, scopeFilter, typeFilter]);

  // Trigger search on filter/query changes
  useEffect(() => {
    performSearch();
  }, [performSearch]);

  // Filter by service (client-side since API doesn't support network filter directly)
  const filteredChats = serviceFilter === "all" ? chats : chats.filter((chat) => chat.networkRaw === serviceFilter);

  return (
    <List
      isLoading={isLoading}
      searchText={searchText}
      onSearchTextChange={setSearchText}
      searchBarPlaceholder="Search chats..."
      searchBarAccessory={
        <List.Dropdown
          tooltip="Filters"
          value={`${serviceFilter}|${scopeFilter}|${typeFilter}`}
          onChange={(value) => {
            const [service, scope, type] = value.split("|");
            setServiceFilter(service);
            setScopeFilter(scope as SearchScope);
            setTypeFilter(type as ChatType);
          }}
        >
          <List.Dropdown.Section title="Service">
            <List.Dropdown.Item title="All Services" value={`all|${scopeFilter}|${typeFilter}`} icon={Icon.Globe} />
            {availableNetworks.map((network) => {
              const iconConfig = getServiceIcon(parseService(network));
              return (
                <List.Dropdown.Item
                  key={network}
                  title={network}
                  value={`${network}|${scopeFilter}|${typeFilter}`}
                  icon={{ source: iconConfig.icon as Icon, tintColor: iconConfig.tintColor }}
                />
              );
            })}
          </List.Dropdown.Section>
          <List.Dropdown.Section title="Search In">
            <List.Dropdown.Item title="Chat Names" value={`${serviceFilter}|titles|${typeFilter}`} icon={Icon.Text} />
            <List.Dropdown.Item
              title="Participants"
              value={`${serviceFilter}|participants|${typeFilter}`}
              icon={Icon.Person}
            />
          </List.Dropdown.Section>
          <List.Dropdown.Section title="Chat Type">
            <List.Dropdown.Item title="All Chats" value={`${serviceFilter}|${scopeFilter}|any`} icon={Icon.Message} />
            <List.Dropdown.Item
              title="Direct Messages"
              value={`${serviceFilter}|${scopeFilter}|single`}
              icon={Icon.Person}
            />
            <List.Dropdown.Item title="Groups" value={`${serviceFilter}|${scopeFilter}|group`} icon={Icon.TwoPeople} />
          </List.Dropdown.Section>
        </List.Dropdown>
      }
    >
      {error ? (
        <List.EmptyView
          icon={Icon.ExclamationMark}
          title="Cannot connect to Beeper"
          description={error}
          actions={
            <ActionPanel>
              <Action title="Retry" icon={Icon.ArrowClockwise} onAction={performSearch} />
            </ActionPanel>
          }
        />
      ) : !debouncedSearch.trim() && chats.length === 0 ? (
        <List.EmptyView
          icon={Icon.MagnifyingGlass}
          title="Search your chats"
          description="Type to search across all your Beeper chats"
        />
      ) : filteredChats.length === 0 ? (
        <List.EmptyView
          icon={Icon.MagnifyingGlass}
          title="No chats found"
          description={`No results for "${debouncedSearch}"${serviceFilter !== "all" ? ` in ${serviceFilter}` : ""}`}
        />
      ) : (
        filteredChats.map((chat) => <ChatListItem key={chat.id} chat={chat} onRefresh={performSearch} />)
      )}
    </List>
  );
}

export default withAccessToken(createBeeperOAuth())(SearchChatsCommand);

interface ChatListItemProps {
  chat: SearchChatItem;
  onRefresh?: () => void;
}

function ChatListItem({ chat, onRefresh }: ChatListItemProps) {
  const serviceInfo = getServiceIcon(chat.service);
  const accessoryTitle = chat.lastMessageAt
    ? formatTimeDistance(new Date(chat.lastMessageAt).getTime(), { suffix: true, max: 1 })
    : "";

  async function handleOpenChat() {
    const result = await openChat({ chatId: chat.id });

    if (result.success) {
      showToast({
        style: Toast.Style.Success,
        title: "Opened chat",
        message: chat.name,
      });
    } else {
      showToast({
        style: Toast.Style.Failure,
        title: "Failed to open chat",
        message: result.error,
      });
    }
  }

  const accessories: List.Item.Accessory[] = [{ text: accessoryTitle, tooltip: "Last message" }];

  if (chat.unreadCount && chat.unreadCount > 0) {
    accessories.unshift({
      tag: { value: String(chat.unreadCount), color: serviceInfo.color },
      tooltip: "Unread messages",
    });
  }

  if (chat.isMuted) {
    accessories.unshift({ icon: Icon.BellDisabled, tooltip: "Muted" });
  }

  const subtitle = chat.participantNames
    ? `${chat.networkRaw} · ${chat.participantNames}`
    : chat.networkRaw + (chat.type === "group" ? " · Group" : "");

  return (
    <List.Item
      id={chat.id}
      title={chat.name}
      subtitle={subtitle}
      icon={{ source: serviceInfo.icon as Icon, tintColor: serviceInfo.tintColor }}
      accessories={accessories}
      keywords={[chat.networkRaw, chat.service, getServiceDisplayName(chat.service), chat.participantNames || ""]}
      actions={
        <ActionPanel>
          <ActionPanel.Section>
            <Action title="Open in Beeper" icon={Icon.Message} onAction={handleOpenChat} />
          </ActionPanel.Section>
          <ActionPanel.Section>
            <Action.CopyToClipboard content={chat.name} title="Copy Name" />
            <Action.CopyToClipboard content={chat.id} title="Copy Chat Id" />
          </ActionPanel.Section>
          <ActionPanel.Section>
            <Action
              title="Refresh"
              icon={Icon.ArrowClockwise}
              shortcut={{ modifiers: ["cmd"], key: "r" }}
              onAction={onRefresh}
            />
          </ActionPanel.Section>
        </ActionPanel>
      }
    />
  );
}
