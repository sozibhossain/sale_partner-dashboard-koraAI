/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { koraAssistantApi, partnerApi } from "@/lib/api";
import { Header } from "@/components/layout/header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkline } from "@/components/sparkline";
import { formatCurrency, getInitials, timeAgo } from "@/lib/utils";
import { toast } from "sonner";
import {
  ArrowUpRight,
  ArrowDownRight,
  CalendarPlus,
  DollarSign,
  Filter,
  Gift,
  Handshake,
  Link2,
  Megaphone,
  Send,
  Sparkles,
  Target,
  Trophy,
  UserPlus,
  Users,
  Wallet,
  Zap,
} from "lucide-react";

const statusBadge: Record<string, { label: string; variant: any }> = {
  new: { label: "New", variant: "success" },
  contacted: { label: "Contacted", variant: "default" },
  qualified: { label: "Qualified", variant: "purple" },
  proposal: { label: "Follow Up", variant: "warning" },
};

function greetingForNow() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default function PartnerDashboardPage() {
  const router = useRouter();
  const [greeting, setGreeting] = useState("Welcome back");
  const [assistantInput, setAssistantInput] = useState("");
  const [assistantMessages, setAssistantMessages] = useState<
    Array<{ role: "user" | "assistant"; content: string }>
  >([
    {
      role: "assistant",
      content: "Hi! How can I help you today?",
    },
  ]);

  // Compute the time-of-day greeting on the client only — the server's timezone
  // may differ from the browser's, so doing this during render would hydrate-mismatch.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setGreeting(greetingForNow()), []);

  const { data: dashboardResponse, isLoading } = useQuery({
    queryKey: ["sale-partner-dashboard"],
    queryFn: () => partnerApi.getDashboard().then((response) => response.data),
  });

  const dashboard = dashboardResponse?.data || {};
  const metrics = dashboard.metrics || {};
  const growth = dashboard.growth || {};
  const trends = dashboard.trends || {};
  const activeLeads = dashboard.activeLeads || [];
  const firstName =
    (dashboard.partner?.user?.name || "").split(" ")[0] || "Partner";

  const assistantMutation = useMutation({
    mutationFn: (message: string) =>
      koraAssistantApi.sendMessage({ message }).then((r) => r.data),
    onSuccess: (response) => {
      setAssistantMessages((current) => [
        ...current,
        {
          role: "assistant",
          content:
            response?.data?.koraReply ||
            "I pulled that from your live partner data.",
        },
      ]);
    },
    onError: () => {
      setAssistantMessages((current) => [
        ...current,
        {
          role: "assistant",
          content:
            "I couldn't reach the assistant service just now. Try again in a moment.",
        },
      ]);
    },
  });

  const stats = [
    {
      label: "Total Customers",
      value: (metrics.totalCustomers || 0).toLocaleString(),
      growth: growth.customers ?? 0,
      trend: trends.customers || [],
      icon: Users,
      color: "bg-blue-600",
      line: "#3b82f6",
    },
    {
      label: "Total Leads",
      value: (metrics.totalLeads || 0).toLocaleString(),
      growth: growth.leads ?? 0,
      trend: trends.leads || [],
      icon: Target,
      color: "bg-emerald-600",
      line: "#10b981",
    },
    {
      label: "Leads Generated",
      value: (metrics.leadsGenerated || 0).toLocaleString(),
      growth: growth.leadsGenerated ?? 0,
      trend: trends.leadsGenerated || [],
      icon: Filter,
      color: "bg-cyan-600",
      line: "#06b6d4",
    },
    {
      label: "Deals Closed",
      value: (metrics.dealsClosed || 0).toLocaleString(),
      growth: growth.deals ?? 0,
      trend: trends.deals || [],
      icon: Handshake,
      color: "bg-purple-600",
      line: "#a855f7",
    },
    {
      label: "Commission (This Month)",
      value: formatCurrency(metrics.monthlyCommission || 0),
      growth: growth.commission ?? 0,
      trend: trends.commission || [],
      icon: Wallet,
      color: "bg-amber-600",
      line: "#f59e0b",
    },
  ];

  const quickActions = [
    { label: "Create Lead", icon: UserPlus, onClick: () => router.push("/leads") },
    { label: "Generate Leads", icon: Zap, onClick: () => router.push("/lead-generator") },
    { label: "Add Customer", icon: Users, onClick: () => router.push("/customers") },
    { label: "Add Appointment", icon: CalendarPlus, onClick: () => router.push("/calendar") },
    { label: "View Earnings", icon: DollarSign, onClick: () => router.push("/earnings") },
    {
      label: "Share Link",
      icon: Link2,
      onClick: () => {
        const ref = dashboard.partner?.id || "";
        const link =
          typeof window !== "undefined"
            ? `${window.location.origin}/?ref=${ref}`
            : "";
        navigator.clipboard?.writeText(link);
        toast.success("Referral link copied to clipboard");
      },
    },
  ];

  const newLeadCount = activeLeads.filter(
    (lead: any) => lead.status === "new",
  ).length;

  const koraSuggestions = useMemo(
    () => [
      {
        icon: Megaphone,
        color: "text-purple-400 bg-purple-600/15",
        title: "Boost your campaign",
        desc: "Your generated leads could convert faster with a follow-up push.",
      },
      {
        icon: Send,
        color: "text-blue-400 bg-blue-600/15",
        title: `Follow up on ${newLeadCount || activeLeads.length} leads`,
        desc: "These leads are waiting for your response.",
      },
      {
        icon: Gift,
        color: "text-emerald-400 bg-emerald-600/15",
        title: "Invite more partners",
        desc: "Earn 10% lifetime commission from your invites.",
      },
      {
        icon: Trophy,
        color: "text-amber-400 bg-amber-600/15",
        title: "Top performer",
        desc: `${formatCurrency(metrics.totalCommission || 0)} earned lifetime — keep it up!`,
      },
    ],
    [newLeadCount, activeLeads.length, metrics.totalCommission],
  );

  const assistantPrompts = [
    "Show me today's appointments",
    "Move an appointment",
    "Show my weekly performance",
  ];

  function sendAssistantMessage(text?: string) {
    const message = (text ?? assistantInput).trim();
    if (!message || assistantMutation.isPending) return;
    setAssistantMessages((current) => [
      ...current,
      { role: "user", content: message },
    ]);
    assistantMutation.mutate(message);
    setAssistantInput("");
  }

  return (
    <div>
      <Header
        title={`${greeting}, ${firstName}! 👋`}
        subtitle="Here's what's happening with your partnership today."
      />
      <div className="space-y-5 p-3 sm:p-4 lg:p-6">
        {/* KPI cards */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          {isLoading
            ? Array.from({ length: 5 }).map((_, index) => (
                <Card key={index}>
                  <CardContent className="pt-4">
                    <Skeleton className="h-16 w-full" />
                  </CardContent>
                </Card>
              ))
            : stats.map((item) => {
                const up = (item.growth ?? 0) >= 0;
                return (
                  <Card key={item.label}>
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between">
                        <div
                          className={`flex h-9 w-9 items-center justify-center rounded-lg ${item.color}`}
                        >
                          <item.icon className="h-4.5 w-4.5 text-white" />
                        </div>
                        <Sparkline data={item.trend} color={item.line} />
                      </div>
                      <p className="mt-3 text-xl font-bold text-white">
                        {item.value}
                      </p>
                      <p className="text-[11px] text-gray-400">{item.label}</p>
                      <div
                        className={`mt-1 inline-flex items-center gap-0.5 text-[11px] ${up ? "text-emerald-400" : "text-red-400"}`}
                      >
                        {up ? (
                          <ArrowUpRight className="h-3 w-3" />
                        ) : (
                          <ArrowDownRight className="h-3 w-3" />
                        )}
                        {up ? "+" : ""}
                        {item.growth}% <span className="text-gray-500">vs last month</span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
        </div>

        {/* Active leads + Kora assistant */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
          <Card className="lg:col-span-3">
            <CardContent className="pt-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-white">Active Leads</h2>
                <button
                  onClick={() => router.push("/leads")}
                  className="text-xs text-blue-400 hover:underline"
                >
                  View all
                </button>
              </div>
              {isLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <Skeleton key={index} className="h-12 w-full" />
                  ))}
                </div>
              ) : activeLeads.length === 0 ? (
                <p className="py-8 text-center text-sm text-gray-500">
                  No active leads right now.
                </p>
              ) : (
                <div>
                  {activeLeads.map((lead: any) => {
                    const badge = statusBadge[lead.status] || {
                      label: lead.status,
                      variant: "secondary",
                    };
                    return (
                      <div
                        key={lead._id}
                        onClick={() => router.push("/leads")}
                        className="flex cursor-pointer items-center gap-3 border-b border-[#1e2d40] py-2.5 last:border-0 hover:bg-[#0f1c30]"
                      >
                        <Avatar className="h-9 w-9 flex-shrink-0">
                          <AvatarFallback className="text-[10px]">
                            {getInitials(lead.name || "LD")}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium text-gray-100">
                            {lead.name || "Lead"}
                          </p>
                          <p className="truncate text-[10px] text-gray-500">
                            {lead.company || lead.email || "No company"}
                          </p>
                        </div>
                        <Badge variant={badge.variant} className="text-[9px]">
                          {badge.label}
                        </Badge>
                        <span className="hidden w-16 text-right text-[10px] text-gray-500 sm:block">
                          {timeAgo(lead.createdAt)}
                        </span>
                        <div className="w-20 text-right">
                          <p className="text-xs font-semibold text-gray-100">
                            {formatCurrency(lead.estimatedValue || 0)}
                          </p>
                          <p className="text-[9px] text-gray-500">Est. Value</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-blue-600/20 bg-gradient-to-br from-[#0d1a2d] to-[#0a1628] lg:col-span-2">
            <CardContent className="flex h-full flex-col gap-4 pt-5 sm:flex-row">
              <div className="flex min-w-0 flex-1 flex-col">
              <div className="mb-3 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-blue-400" />
                <h2 className="text-sm font-semibold text-white">Kora Assistant</h2>
              </div>
              <div className="mb-3 flex-1 space-y-2 overflow-y-auto" style={{ maxHeight: 220 }}>
                {assistantMessages.map((message, index) => (
                  <div
                    key={`${message.role}-${index}`}
                    className={`flex ${message.role === "user" ? "justify-end" : "items-start gap-2"}`}
                  >
                    {message.role === "assistant" ? (
                      <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-blue-600/20 text-[10px] text-blue-300">
                        AI
                      </div>
                    ) : null}
                    <div
                      className={`max-w-[85%] rounded-xl px-3 py-2 ${message.role === "user" ? "bg-blue-600 text-white" : "bg-[#1e2d40] text-gray-200"}`}
                    >
                      <p className="whitespace-pre-wrap text-xs">{message.content}</p>
                    </div>
                  </div>
                ))}
                {assistantMutation.isPending ? (
                  <div className="flex items-start gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600/20 text-[10px] text-blue-300">
                      AI
                    </div>
                    <div className="rounded-xl bg-[#1e2d40] px-3 py-2.5">
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
              </div>
              {assistantMessages.length <= 1 ? (
                <div className="mb-2 space-y-1.5">
                  {assistantPrompts.map((prompt) => (
                    <button
                      key={prompt}
                      onClick={() => sendAssistantMessage(prompt)}
                      className="flex w-full items-center gap-2 rounded-lg bg-[#1e2d40] px-3 py-2 text-left text-xs text-gray-300 hover:bg-[#243040]"
                    >
                      <Sparkles className="h-3.5 w-3.5 text-blue-400" />
                      {prompt}
                    </button>
                  ))}
                </div>
              ) : null}
              <div className="flex gap-2">
                <input
                  value={assistantInput}
                  onChange={(event) => setAssistantInput(event.target.value)}
                  onKeyDown={(event) =>
                    event.key === "Enter" && sendAssistantMessage()
                  }
                  placeholder="Ask Kora anything..."
                  className="flex-1 rounded-lg border border-[#2a3547] bg-[#1e2d40] px-3 py-2 text-xs text-gray-200 placeholder:text-gray-500 focus:outline-none"
                />
                <Button
                  size="icon"
                  className="h-9 w-9 rounded-full"
                  onClick={() => sendAssistantMessage()}
                  disabled={!assistantInput.trim() || assistantMutation.isPending}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              </div>

              <div className="hidden w-40 shrink-0 items-center justify-center sm:flex">
                <Image
                  src="/kora.png"
                  alt="Kora"
                  width={160}
                  height={160}
                  unoptimized
                  priority
                  className="kora-image h-40 w-40 object-contain"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick actions */}
        <Card>
          <CardContent className="pt-5">
            <div className="mb-3 flex items-center gap-2">
              <Zap className="h-4 w-4 text-[#79C1EC] drop-shadow-[0_0_6px_rgba(121,193,236,0.55)]" />
              <h2 className="text-sm font-semibold text-white">Quick Actions</h2>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
              {quickActions.map((action) => (
                <button
                  key={action.label}
                  onClick={action.onClick}
                  className="group flex min-h-[92px] flex-col items-center justify-center gap-2 rounded-lg border border-[#1c2c43] bg-[#0d1a2d]/90 px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition-colors hover:border-[#79C1EC]/45 hover:bg-[#122238]"
                >
                  <action.icon
                    className="h-8 w-8 text-[#79C1EC] drop-shadow-[0_0_8px_rgba(121,193,236,0.45)] transition-transform group-hover:scale-105"
                    strokeWidth={1.9}
                  />
                  <span className="text-center text-xs font-medium leading-tight text-gray-100">
                    {action.label}
                  </span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Kora suggestions */}
        <Card>
          <CardContent className="pt-5">
            <div className="mb-3 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-blue-400" />
              <h2 className="text-sm font-semibold text-white">Kora Suggestions</h2>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {koraSuggestions.map((suggestion) => (
                <div
                  key={suggestion.title}
                  className="flex items-start gap-3 rounded-xl border border-[#1e2d40] bg-[#0f1c30] p-3"
                >
                  <div
                    className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${suggestion.color}`}
                  >
                    <suggestion.icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-gray-100">
                      {suggestion.title}
                    </p>
                    <p className="mt-0.5 text-[10px] leading-snug text-gray-500">
                      {suggestion.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
