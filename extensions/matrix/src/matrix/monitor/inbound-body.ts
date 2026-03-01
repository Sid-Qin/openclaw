export function resolveMatrixSenderUsername(senderId: string): string | undefined {
  const username = senderId.split(":")[0]?.replace(/^@/, "").trim();
  return username ? username : undefined;
}

export function resolveMatrixInboundSenderLabel(params: {
  senderName: string;
  senderId: string;
  senderUsername?: string;
}): string {
  const senderName = params.senderName.trim();
  const senderUsername = params.senderUsername ?? resolveMatrixSenderUsername(params.senderId);
  if (senderName && senderUsername && senderName !== senderUsername) {
    return `${senderName} (${senderUsername})`;
  }
  return senderName || senderUsername || params.senderId;
}

export function resolveMatrixBodyForAgent(params: {
  isDirectMessage: boolean;
  bodyText: string;
  senderLabel: string;
  bufferedRoomContextLines?: string[];
}): string {
  if (params.isDirectMessage) {
    return params.bodyText;
  }
  const bufferedContext = (params.bufferedRoomContextLines ?? [])
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");
  if (bufferedContext) {
    return `${bufferedContext}\n${params.senderLabel}: ${params.bodyText}`;
  }
  return `${params.senderLabel}: ${params.bodyText}`;
}
