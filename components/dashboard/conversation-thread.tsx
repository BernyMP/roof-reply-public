"use client";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

export interface ConversationMessage {
  _id: string;
  sender: "lead" | "ai";
  content: string;
  createdAt: number;
  delivery?: string;
}
const deliveryLabels: Record<string, string> = {
  queued: "Queued",
  sending: "Sending",
  accepted: "Awaiting delivery",
  delivered: "Delivered",
  failed: "Not delivered",
  uncertain: "Delivery needs review",
  suppressed: "Not sent",
};
export function ConversationThread({
  messages,
  businessName = "Business",
  customerName = "Customer",
  emptyText = "The conversation will appear here.",
}: {
  messages: ConversationMessage[];
  businessName?: string;
  customerName?: string;
  emptyText?: string;
}) {
  const scroll = useRef<HTMLDivElement>(null);
  const follow = useRef(true);
  useEffect(() => {
    if (follow.current && scroll.current)
      scroll.current.scrollTop = scroll.current.scrollHeight;
  }, [messages.length]);
  return (
    <div
      ref={scroll}
      onScroll={() => {
        const el = scroll.current;
        if (el)
          follow.current =
            el.scrollHeight - el.scrollTop - el.clientHeight < 80;
      }}
      className="min-h-64 flex-1 space-y-5 overflow-y-auto overscroll-contain px-4 py-6 sm:px-6"
      tabIndex={0}
      role="log"
      aria-label="Customer conversation"
      aria-live="polite"
      aria-relevant="additions"
    >
      {!messages.length && (
        <p className="mx-auto max-w-xs py-16 text-center text-sm leading-6 text-slate-600">
          {emptyText}
        </p>
      )}
      {messages.map((message, index) => {
        const outgoing = message.sender === "ai";
        const showName =
          index === 0 || messages[index - 1].sender !== message.sender;
        const failed = ["failed", "uncertain", "suppressed"].includes(
          message.delivery || "",
        );
        return (
          <div
            key={message._id}
            className={cn(
              "flex flex-col",
              outgoing ? "items-end" : "items-start",
            )}
          >
            {showName && (
              <span className="mb-1.5 px-1 text-xs font-medium text-slate-600">
                {outgoing ? businessName : customerName}
              </span>
            )}
            <p
              className={cn(
                "max-w-[90%] whitespace-pre-wrap break-words rounded-2xl px-4 py-3 text-[15px] leading-6 sm:max-w-[80%]",
                outgoing
                  ? "rounded-br-md bg-[#ffe3c7] text-slate-950"
                  : "rounded-bl-md bg-[#e9edec] text-slate-950",
              )}
            >
              {message.content}
            </p>
            <span
              className={cn(
                "mt-1.5 px-1 text-xs",
                failed ? "text-red-700" : "text-slate-600",
              )}
            >
              <time dateTime={new Date(message.createdAt).toISOString()}>
                {new Date(message.createdAt).toLocaleTimeString([], {
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </time>
              {outgoing &&
                message.delivery &&
                ` · ${deliveryLabels[message.delivery] || message.delivery}`}
            </span>
          </div>
        );
      })}
    </div>
  );
}
