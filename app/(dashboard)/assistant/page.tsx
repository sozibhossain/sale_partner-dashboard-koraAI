/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { KoraOrb } from "@/components/kora-orb";
import { koraAssistantApi } from "@/lib/api";
import { toast } from "sonner";
import {
  Send,
  Paperclip,
  Sparkles,
  Clock,
  BarChart2,
  FileText,
  CalendarDays,
  MessageSquarePlus,
  ArrowRight,
  DollarSign,
  Users,
  CalendarCheck,
  Lightbulb,
} from "lucide-react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  time: string;
}

const suggestionIcon: Record<string, any> = {
  calendar: CalendarDays,
  revenue: DollarSign,
  lead: Users,
  appointment: CalendarCheck,
};

const suggestionTone: Record<string, string> = {
  info: "text-blue-400 bg-blue-600/15",
  warning: "text-amber-400 bg-amber-600/15",
  success: "text-emerald-400 bg-emerald-600/15",
  tip: "text-purple-400 bg-purple-600/15",
};

function nowLabel() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function AssistantPage() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const firstName =
    ((session?.user as any)?.name || "").split(" ")[0] || "Partner";

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [showCapabilities, setShowCapabilities] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: historyResponse } = useQuery({
    queryKey: ["assistant-history"],
    queryFn: () => koraAssistantApi.getHistory().then((r) => r.data),
  });

  const { data: suggestionsResponse, isLoading: suggestionsLoading } = useQuery({
    queryKey: ["assistant-suggestions"],
    queryFn: () => koraAssistantApi.getSuggestions().then((r) => r.data),
  });

  const { data: capabilitiesResponse } = useQuery({
    queryKey: ["assistant-capabilities"],
    queryFn: () => koraAssistantApi.getCapabilities().then((r) => r.data),
    enabled: showCapabilities,
  });

  const recentConversations: any[] = historyResponse?.data || [];
  const smartSuggestions: any[] = suggestionsResponse?.data || [];
  const capabilities: string[] = capabilitiesResponse?.data || [];

  const sendMutation = useMutation({
    mutationFn: (msg: string) =>
      koraAssistantApi.sendMessage({ message: msg }).then((r) => r.data),
    onSuccess: (res) => {
      setMessages((prev) => [
        ...prev,
        {
          id: `${Date.now()}-a`,
          role: "assistant",
          content:
            res?.data?.koraReply ||
            "Here are the insights based on your partnership data.",
          time: nowLabel(),
        },
      ]);
      queryClient.invalidateQueries({ queryKey: ["assistant-history"] });
    },
    onError: () => {
      setMessages((prev) => [
        ...prev,
        {
          id: `${Date.now()}-e`,
          role: "assistant",
          content:
            "I couldn't reach the assistant service just now. Please try again in a moment.",
          time: nowLabel(),
        },
      ]);
    },
  });

  const clearMutation = useMutation({
    mutationFn: () => koraAssistantApi.clearHistory(),
    onSuccess: () => {
      setMessages([]);
      queryClient.invalidateQueries({ queryKey: ["assistant-history"] });
      toast.success("Started a new conversation");
    },
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sendMutation.isPending]);

  function handleSend(text?: string) {
    const message = (text ?? input).trim();
    if (!message || sendMutation.isPending) return;
    setMessages((prev) => [
      ...prev,
      { id: `${Date.now()}-u`, role: "user", content: message, time: nowLabel() },
    ]);
    sendMutation.mutate(message);
    setInput("");
  }

  const quickPrompts = [
    { icon: Clock, label: "Summarize my day" },
    { icon: CalendarCheck, label: "Check today's schedule" },
    { icon: BarChart2, label: "Show key insights" },
    { icon: FileText, label: "Help with reports" },
  ];

  const hasChat = messages.length > 0;

  return (
    <div>
      <Header
        title="Kora Assistant"
        subtitle="Your AI assistant that understands your business and gets things done."
      />
      <div className="p-3 sm:p-4 lg:p-6">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          {/* Main conversation column */}
          <div className="space-y-5 lg:col-span-2">
            <Card className="border-blue-600/20 bg-gradient-to-br from-[#0d1a2d] to-[#0a1628]">
              <CardContent className="flex flex-col p-0">
                <div
                  className="flex-1 overflow-y-auto p-5"
                  style={{ minHeight: hasChat ? 420 : 380, maxHeight: "calc(100vh - 320px)" }}
                >
                  {!hasChat ? (
                    <div className="flex flex-col items-center py-6 text-center">
                      <KoraOrb size={96} />
                      <h2 className="mt-5 text-2xl font-bold text-white">
                        Hi {firstName}! 👋
                      </h2>
                      <p className="mt-2 max-w-md text-sm text-gray-400">
                        I&apos;m Kora, your AI assistant. I can help you manage your
                        partnership, answer questions, automate tasks and provide
                        insights.
                      </p>
                      <div className="mt-5 flex w-full max-w-lg gap-2">
                        <Input
                          placeholder="Ask me anything about your partnership..."
                          value={input}
                          onChange={(e) => setInput(e.target.value)}
                          onKeyDown={(e) =>
                            e.key === "Enter" && !e.shiftKey && handleSend()
                          }
                          className="flex-1"
                        />
                        <Button
                          size="icon"
                          className="rounded-full"
                          onClick={() => handleSend()}
                          disabled={!input.trim()}
                        >
                          <Send className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="mt-4 flex flex-wrap justify-center gap-2">
                        {quickPrompts.map((prompt) => (
                          <button
                            key={prompt.label}
                            onClick={() => handleSend(prompt.label)}
                            className="inline-flex items-center gap-1.5 rounded-full border border-[#2a3547] bg-[#0f1c30] px-3 py-1.5 text-xs text-gray-300 hover:bg-[#1e2d40]"
                          >
                            <prompt.icon className="h-3.5 w-3.5 text-blue-400" />
                            {prompt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {messages.map((msg) => (
                        <div
                          key={msg.id}
                          className={`flex ${msg.role === "user" ? "justify-end" : "items-start gap-3"}`}
                        >
                          {msg.role === "assistant" ? (
                            <div className="mt-0.5 flex-shrink-0">
                              <KoraOrb size={28} />
                            </div>
                          ) : null}
                          <div
                            className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${msg.role === "user" ? "bg-blue-600 text-white" : "bg-[#1e2d40] text-gray-200"}`}
                          >
                            <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
                            <p
                              className={`mt-1 text-[10px] ${msg.role === "user" ? "text-blue-200" : "text-gray-500"}`}
                            >
                              {msg.time}
                            </p>
                          </div>
                        </div>
                      ))}
                      {sendMutation.isPending ? (
                        <div className="flex items-start gap-3">
                          <KoraOrb size={28} />
                          <div className="rounded-2xl bg-[#1e2d40] px-4 py-3">
                            <div className="flex gap-1">
                              {[0, 1, 2].map((i) => (
                                <span
                                  key={i}
                                  className="h-1.5 w-1.5 animate-bounce rounded-full bg-blue-400"
                                  style={{ animationDelay: `${i * 150}ms` }}
                                />
                              ))}
                            </div>
                          </div>
                        </div>
                      ) : null}
                      <div ref={bottomRef} />
                    </div>
                  )}
                </div>

                {hasChat ? (
                  <div className="border-t border-[#1e2d40] p-4">
                    <div className="flex gap-2">
                      <Button variant="ghost" size="icon">
                        <Paperclip className="h-4 w-4" />
                      </Button>
                      <Input
                        placeholder="Ask Kora anything..."
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) =>
                          e.key === "Enter" && !e.shiftKey && handleSend()
                        }
                        className="flex-1"
                      />
                      <Button onClick={() => handleSend()} disabled={!input.trim()}>
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ) : null}
              </CardContent>
            </Card>

            {/* Recent conversations */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">Recent Conversations</CardTitle>
                  <button
                    onClick={() => clearMutation.mutate()}
                    className="inline-flex items-center gap-1 text-xs text-blue-400 hover:underline"
                  >
                    <MessageSquarePlus className="h-3.5 w-3.5" />
                    Start new
                  </button>
                </div>
              </CardHeader>
              <CardContent>
                {recentConversations.length === 0 ? (
                  <p className="py-4 text-center text-sm text-gray-500">
                    No conversations yet. Ask Kora something to get started.
                  </p>
                ) : (
                  <div className="space-y-1">
                    {recentConversations.slice(0, 6).map((conversation, index) => (
                      <button
                        key={conversation.index ?? index}
                        onClick={() => handleSend(conversation.userMessage)}
                        className="flex w-full items-start gap-3 rounded-lg px-2 py-2 text-left hover:bg-[#1e2d40]"
                      >
                        <MessageSquarePlus className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-500" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium text-gray-200">
                            {conversation.userMessage || "Conversation"}
                          </p>
                          <p className="truncate text-[11px] text-gray-500">
                            {conversation.koraReply}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right column */}
          <div className="space-y-5">
            {/* Status */}
            <Card className="border-blue-600/20">
              <CardContent className="flex flex-col items-center pt-6 text-center">
                <KoraOrb size={88} />
                <p className="mt-4 font-medium text-white">Kora is active</p>
                <p className="mt-1 text-xs text-gray-400">Always here to help you</p>
                <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-600/15 px-2.5 py-1 text-xs text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  Online
                </span>
              </CardContent>
            </Card>

            {/* Smart suggestions */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-1.5 text-sm">
                  <Sparkles className="h-3.5 w-3.5 text-blue-400" />
                  Smart Suggestions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                {suggestionsLoading ? (
                  <p className="py-3 text-center text-xs text-gray-500">
                    Generating suggestions…
                  </p>
                ) : smartSuggestions.length === 0 ? (
                  <p className="py-3 text-center text-xs text-gray-500">
                    No suggestions right now.
                  </p>
                ) : (
                  smartSuggestions.map((suggestion, index) => {
                    const Icon = suggestionIcon[suggestion.icon] || Lightbulb;
                    const tone = suggestionTone[suggestion.type] || suggestionTone.info;
                    return (
                      <button
                        key={index}
                        onClick={() => handleSend(suggestion.title)}
                        className="flex w-full items-start gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-[#1e2d40]"
                      >
                        <div
                          className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg ${tone}`}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-gray-200">
                            {suggestion.title}
                          </p>
                          <p className="text-[10px] text-gray-500">{suggestion.message}</p>
                        </div>
                        <ArrowRight className="mt-1 h-3.5 w-3.5 flex-shrink-0 text-gray-600" />
                      </button>
                    );
                  })
                )}
              </CardContent>
            </Card>

            {/* Learn more */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Learn more about Kora</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-gray-400">
                  Discover what Kora can do for your business.
                </p>
                <Button
                  variant="secondary"
                  className="mt-3 w-full"
                  onClick={() => setShowCapabilities((value) => !value)}
                >
                  {showCapabilities ? "Hide capabilities" : "Explore all capabilities"}
                  <ArrowRight className="h-4 w-4" />
                </Button>
                {showCapabilities ? (
                  <ul className="mt-3 space-y-1.5">
                    {capabilities.length === 0 ? (
                      <li className="text-xs text-gray-500">Loading…</li>
                    ) : (
                      capabilities.map((capability) => (
                        <li
                          key={capability}
                          className="flex items-start gap-2 text-xs text-gray-300"
                        >
                          <Sparkles className="mt-0.5 h-3 w-3 flex-shrink-0 text-blue-400" />
                          {capability}
                        </li>
                      ))
                    )}
                  </ul>
                ) : null}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
