// Which chat is open right now (null = none). The chat page sets it; the notifier reads it,
// so you don't get a "new message" popup for the conversation you're already looking at.
export const activeChat: { id: number | null } = { id: null };
