"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useChat, useLocalParticipant } from "@livekit/components-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge, Notice } from "@/components/ui/notice";

const MAX_CHAT_LENGTH = 500;

/**
 * Ephemeral in-room chat over LiveKit data packets (PRD §6/§7, FLOW §5.3).
 *
 * `useChat` keeps messages in component memory only — nothing is written to
 * any database, and history is lost when the session ends. The UI says so
 * explicitly so users are never misled about persistence.
 *
 * Chat needs only the room data connection: it keeps working when
 * microphone/camera permission is denied (PRD §4 acceptance criterion).
 */
export function ChatPanel() {
  const { chatMessages, send, isSending } = useChat();
  const { localParticipant } = useLocalParticipant();
  const myIdentity = localParticipant.identity;
  const [draft, setDraft] = useState("");
  const [sendError, setSendError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Follow the newest message (DOM-only side effect — no state update).
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chatMessages.length]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setSendError(null);
    try {
      await send(text);
      setDraft("");
    } catch {
      // Truthful failure: the message was NOT delivered anywhere.
      setSendError(
        "Message could not be sent — connection issue. It was not delivered.",
      );
    }
  }

  return (
    <section className="flex min-h-64 flex-col rounded-lg border border-border bg-muted/40">
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
        <h3 className="text-sm font-semibold">Room chat</h3>
        <Badge tone="info">Temporary — not stored</Badge>
      </div>

      <div
        ref={listRef}
        className="max-h-64 min-h-40 flex-1 space-y-2 overflow-y-auto px-3 py-3 text-sm"
        aria-live="polite"
      >
        {chatMessages.length === 0 && (
          <p className="text-xs text-muted-foreground">
            No messages yet — say hi. Messages disappear when the session
            ends; there is no history.
          </p>
        )}
        {chatMessages.map((message, index) => {
          const isOwn = message.from?.identity === myIdentity;
          const sender = isOwn
            ? "You"
            : (message.from?.name || message.from?.identity || "Member");
          return (
            <div key={message.id ?? `${message.timestamp}-${index}`} className="leading-snug">
              <span className="font-semibold text-foreground">{sender}: </span>
              <span className="break-words text-muted-foreground">
                {message.message}
              </span>
            </div>
          );
        })}
      </div>

      {sendError && (
        <Notice tone="warning" className="mx-3 mb-2">
          {sendError}
        </Notice>
      )}

      <form onSubmit={onSubmit} className="flex gap-2 border-t border-border p-3">
        <Input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Message the room…"
          maxLength={MAX_CHAT_LENGTH}
          aria-label="Chat message"
          autoComplete="off"
        />
        <Button
          type="submit"
          size="sm"
          loading={isSending}
          disabled={draft.trim().length === 0}
        >
          Send
        </Button>
      </form>
    </section>
  );
}
