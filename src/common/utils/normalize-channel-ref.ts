const CHANNEL_LINK_REGEX = /^(?:https?:\/\/)?(?:t\.me|telegram\.me)\/(.+)$/i;

export function normalizeChannelRef(input: string): { username?: string; link?: string } {
  const trimmed = input.trim();
  if (!trimmed) {
    return {};
  }

  if (trimmed.startsWith("@")) {
    return { username: trimmed.slice(1).toLowerCase() };
  }

  const linkMatch = trimmed.match(CHANNEL_LINK_REGEX);
  if (linkMatch?.[1]) {
    const linkUsername = linkMatch[1].replace(/\/$/, "");
    return { username: linkUsername.toLowerCase(), link: trimmed };
  }

  return { username: trimmed.toLowerCase() };
}
