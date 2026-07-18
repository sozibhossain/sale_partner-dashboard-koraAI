/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { earningsApi } from "@/lib/api";
import { Header } from "@/components/layout/header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { KoraOrb } from "@/components/kora-orb";
import { asArray, formatCurrency, formatDate, getInitials } from "@/lib/utils";
import { toast } from "sonner";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowUpRight,
  Banknote,
  BarChart3,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Clock,
  Copy,
  Download,
  ExternalLink,
  FileDown,
  Filter,
  HandCoins,
  MoreVertical,
  PieChart,
  Send,
  Sparkles,
  TrendingUp,
  Users,
  WalletCards,
} from "lucide-react";
import Image from "next/image";

const EURO = "\u20ac";

const STATUS_TABS = [
  { value: "all", label: "Deals" },
  { value: "sources", label: "Sources" },
  { value: "payouts", label: "Payouts" },
];

const PERIOD_OPTIONS = ["Day", "Week", "Month", "Year"];

const STATUS_BADGE: Record<
  string,
  "success" | "warning" | "destructive" | "secondary"
> = {
  active: "success",
  approved: "success",
  paid: "success",
  pending: "warning",
  suspended: "warning",
  failed: "destructive",
  cancelled: "destructive",
};

const toNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const money = (amount: number) => formatCurrency(amount, EURO);

const planName = (earning: any) => {
  const raw =
    earning?.plan_id?.plan_name ||
    earning?.plan_id?.name ||
    earning?.plan?.name ||
    earning?.package ||
    earning?.packageName ||
    earning?.customer_id?.plan ||
    "Unassigned";
  return String(raw);
};

const planCommission = (_plan: string, fallback?: number) => {
  return toNumber(fallback);
};

const customerName = (earning: any) =>
  earning?.customer_id?.name ||
  earning?.customer?.name ||
  earning?.customerName ||
  "Customer";

const customerEmail = (earning: any) =>
  earning?.customer_id?.email ||
  earning?.customer?.email ||
  earning?.businessType ||
  "Subscription";

const earningDate = (earning: any) =>
  earning.closedAt ||
  earning.deal_id?.closedAt ||
  earning.paidAt ||
  earning.createdAt;

export default function EarningsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [activeTab, setActiveTab] = useState("all");
  const [chartMetric, setChartMetric] = useState<
    "commission" | "deals" | "leads"
  >("commission");
  const [period, setPeriod] = useState("Month");
  const limit = 10;

  const { data: dashboardResponse, isLoading: dashboardLoading } = useQuery({
    queryKey: ["sp-earnings-dashboard"],
    queryFn: () =>
      earningsApi.getDashboard().then((response) => response.data?.data),
  });

  const { data: earningsResponse, isLoading: listLoading } = useQuery({
    queryKey: ["sp-earnings-list", page],
    queryFn: () =>
      earningsApi
        .getAll({
          page,
          limit,
        })
        .then((response) => response.data),
  });

  const { data: payoutsResponse, isLoading: payoutsLoading } = useQuery({
    queryKey: ["sp-earnings-payouts"],
    queryFn: () =>
      earningsApi.getPayouts({ limit: 5 }).then((response) => response.data),
  });

  const dashboard: any = useMemo(
    () => dashboardResponse || {},
    [dashboardResponse],
  );
  const earnings: any[] = asArray(earningsResponse?.data);
  const payouts: any[] = asArray(payoutsResponse?.data);
  const meta = earningsResponse?.meta || { total: earnings.length || 0 };
  const totalPages = Math.max(1, Math.ceil((meta.total || 0) / limit));

  const chartData = useMemo(() => {
    const apiData = asArray<any>(dashboard.earningsOverTime).map(
      (entry: any) => {
        const id = entry?._id || {};
        const date =
          id.year && id.month && id.day
            ? new Date(id.year, id.month - 1, id.day).toLocaleDateString(
                "en-US",
                {
                  month: "short",
                  day: "numeric",
                },
              )
            : entry.date || entry.label || "";
        return {
          date,
          commission: toNumber(
            entry.commission || entry.earnings || entry.amount,
          ),
          deals: toNumber(entry.deals || entry.closedDeals || entry.customers),
          leads: toNumber(
            entry.leads || entry.leadsConverted || entry.conversions,
          ),
        };
      },
    );
    return apiData;
  }, [dashboard]);

  const forecast = useMemo(() => {
    return asArray<any>(dashboard.forecast).map((item) => ({
      plan: item.plan || item.name || "Plan",
      count: toNumber(item.customers || item.count),
      amount: toNumber(item.monthlyCommission || item.amount),
      projectedMonthly: toNumber(item.projectedMonthly),
    }));
  }, [dashboard]);

  const sourceRows = useMemo(
    () => asArray<any>(dashboard.sourceAnalytics),
    [dashboard],
  );
  const commissionPlans = useMemo(
    () => asArray<any>(dashboard.commissionPlans),
    [dashboard],
  );
  const insights = useMemo(() => asArray<any>(dashboard.insights), [dashboard]);
  const projectedMonthly = toNumber(dashboard.projectedMonthly);
  const conversionRate = toNumber(
    dashboard.conversionRate || dashboard.conversion,
  );
  const activeCustomers = toNumber(dashboard.activeCustomers);
  const growth = dashboard.growth || {};

  const withdrawMutation = useMutation({
    mutationFn: () => earningsApi.requestWithdrawal({}),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ["sp-earnings-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["sp-earnings-list"] });
      queryClient.invalidateQueries({ queryKey: ["sp-earnings-payouts"] });
      const amount = response.data?.data?.withdrawnAmount || 0;
      toast.success(`Withdrawal requested: ${money(amount)}`);
    },
    onError: (error: any) =>
      toast.error(
        error?.response?.data?.message || "No pending earnings to withdraw",
      ),
  });

  const handleExport = async () => {
    try {
      const response = await earningsApi.exportReport();
      const blob = new Blob([response.data], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `earnings-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success("Report exported");
    } catch (error: any) {
      toast.error(error?.message || "Export failed");
    }
  };

  const stats = [
    {
      label: "Total Earnings",
      value: money(toNumber(dashboard.totalEarnings)),
      icon: WalletCards,
      color: "from-emerald-500/25 to-emerald-500/5 text-emerald-300",
      delta: toNumber(growth.totalEarnings),
    },
    {
      label: "This Month",
      value: money(toNumber(dashboard.thisMonth)),
      icon: TrendingUp,
      color: "from-blue-500/25 to-blue-500/5 text-blue-300",
      delta: toNumber(growth.thisMonth),
    },
    {
      label: "Pending Payout",
      value: money(toNumber(dashboard.pendingPayout)),
      icon: Clock,
      color: "from-purple-500/25 to-purple-500/5 text-purple-300",
      delta: toNumber(growth.pendingPayout),
    },
    {
      label: "Avg. Commission",
      value: money(
        toNumber(dashboard.avgCommission || dashboard.averageCommission),
      ),
      icon: CircleDollarSign,
      color: "from-orange-500/25 to-orange-500/5 text-orange-300",
      delta: toNumber(growth.avgCommission),
    },
    {
      label: "Conversion Rate",
      value: `${conversionRate.toFixed(1)}%`,
      icon: Filter,
      color: "from-cyan-500/25 to-cyan-500/5 text-cyan-300",
      delta: toNumber(growth.conversionRate),
    },
  ];

  const quickActions = [
    {
      label: "Withdraw Earnings",
      icon: HandCoins,
      onClick: () => withdrawMutation.mutate(),
      disabled:
        withdrawMutation.isPending || toNumber(dashboard.pendingPayout) <= 0,
    },
    { label: "View Deals", icon: Users, onClick: () => setActiveTab("all") },
    { label: "Export Report", icon: FileDown, onClick: handleExport },
    {
      label: "Share Referral Link",
      icon: Send,
      onClick: () => {
        navigator.clipboard?.writeText(window.location.origin);
        toast.success("Referral link copied");
      },
    },
  ];

  return (
    <div>
      <Header
        title="Earnings"
        subtitle="Track recurring commissions, payouts, closed deals, and revenue performance."
        action={
          <Button size="sm" variant="outline" onClick={handleExport}>
            <Download className="mr-1 h-3.5 w-3.5" />
            Export
          </Button>
        }
      />

      <div className="space-y-5 p-3 sm:p-4 lg:p-6">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {dashboardLoading
            ? Array.from({ length: 5 }).map((_, index) => (
                <Card key={index}>
                  <CardContent className="p-4">
                    <Skeleton className="h-16 w-full" />
                  </CardContent>
                </Card>
              ))
            : stats.map((stat) => (
                <Card key={stat.label} className="overflow-hidden">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div
                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${stat.color}`}
                      >
                        <stat.icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium text-gray-300">
                          {stat.label}
                        </p>
                        <p className="mt-2 text-2xl font-bold leading-none text-white">
                          {stat.value}
                        </p>
                        <p
                          className={`mt-2 flex items-center gap-1 text-[11px] ${
                            stat.delta >= 0
                              ? "text-emerald-400"
                              : "text-red-400"
                          }`}
                        >
                          {stat.delta >= 0 ? "+" : ""}
                          {stat.delta.toFixed(1)}% vs last month{" "}
                          <ArrowUpRight className="h-3 w-3" />
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_350px]">
          <div className="space-y-5">
            <Card>
              <CardContent className="p-4">
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-white">
                      Earnings Overview
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      Recurring commission growth across paid subscriptions.
                    </p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="flex h-8 items-center gap-1 rounded-lg border border-[#1e2d40] px-3 text-xs text-gray-300 transition-colors hover:bg-[#0d1a2d]">
                        {period} <ChevronDown className="h-3.5 w-3.5" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-32">
                      {PERIOD_OPTIONS.map((item) => (
                        <DropdownMenuItem
                          key={item}
                          onClick={() => setPeriod(item)}
                          className={`text-xs ${
                            period === item ? "bg-[#1e2d40] text-white" : ""
                          }`}
                        >
                          {item}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {chartData.length === 0 ? (
                  <div className="flex h-[260px] items-center justify-center text-sm text-gray-500">
                    No earnings chart data yet.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <AreaChart
                      data={chartData}
                      margin={{ top: 10, right: 8, left: -16, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient
                          id="earningsGradient"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="5%"
                            stopColor="#10b981"
                            stopOpacity={0.42}
                          />
                          <stop
                            offset="95%"
                            stopColor="#10b981"
                            stopOpacity={0.02}
                          />
                        </linearGradient>
                      </defs>
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 11, fill: "#94a3b8" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: "#64748b" }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(value) =>
                          chartMetric === "commission"
                            ? `${EURO}${Number(value) / 1000}K`
                            : value
                        }
                      />
                      <Tooltip
                        contentStyle={{
                          background: "#0d1a2d",
                          border: "1px solid #1e2d40",
                          borderRadius: "8px",
                          fontSize: "12px",
                        }}
                        labelStyle={{ color: "#cbd5e1" }}
                        formatter={(value: any) =>
                          chartMetric === "commission"
                            ? money(toNumber(value))
                            : value
                        }
                      />
                      <Area
                        type="monotone"
                        dataKey={chartMetric}
                        stroke="#22c55e"
                        fill="url(#earningsGradient)"
                        strokeWidth={3}
                        dot={{
                          r: 3,
                          strokeWidth: 2,
                          fill: "#0d1a2d",
                          stroke: "#22c55e",
                        }}
                        activeDot={{
                          r: 6,
                          fill: "#22c55e",
                          stroke: "#064e3b",
                          strokeWidth: 3,
                        }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}

                <div className="mt-4 flex flex-wrap gap-2">
                  {[
                    { value: "commission", label: "Earnings" },
                    { value: "deals", label: "Deals Closed" },
                    { value: "leads", label: "Leads Converted" },
                  ].map((item) => (
                    <button
                      key={item.value}
                      onClick={() => setChartMetric(item.value as any)}
                      className={`rounded-full border px-4 py-2 text-xs transition-colors ${
                        chartMetric === item.value
                          ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-300"
                          : "border-[#1e2d40] text-gray-400 hover:bg-[#0d1a2d]"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-0">
                <div className="border-b border-[#1e2d40] p-4">
                  <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <TabsList className="h-9">
                      {STATUS_TABS.map((tab) => (
                        <TabsTrigger
                          key={tab.value}
                          value={tab.value}
                          className="h-8 text-xs"
                        >
                          {tab.label}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                  </Tabs>
                </div>

                {activeTab === "all" ? (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-[#1e2d40]">
                            {[
                              "Customer",
                              "Package",
                              "Subscription",
                              "Commission",
                              "Date Closed",
                              "Status",
                              "",
                            ].map((heading) => (
                              <th
                                key={heading}
                                className="whitespace-nowrap px-4 py-3 text-left text-xs font-medium text-gray-500"
                              >
                                {heading}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {listLoading ? (
                            Array.from({ length: 5 }).map((_, rowIndex) => (
                              <tr
                                key={rowIndex}
                                className="border-b border-[#1e2d40]"
                              >
                                {Array.from({ length: 7 }).map(
                                  (__, cellIndex) => (
                                    <td key={cellIndex} className="px-4 py-3">
                                      <Skeleton className="h-4 w-20" />
                                    </td>
                                  ),
                                )}
                              </tr>
                            ))
                          ) : earnings.length === 0 ? (
                            <tr>
                              <td
                                colSpan={7}
                                className="px-4 py-10 text-center text-sm text-gray-500"
                              >
                                No commission-generating subscriptions yet.
                              </td>
                            </tr>
                          ) : (
                            earnings.map((earning) => {
                              const plan = planName(earning);
                              const commission = planCommission(
                                plan,
                                earning.commission ||
                                  earning.plan_id?.partnerCommission,
                              );
                              const status = String(
                                earning.status || "active",
                              ).toLowerCase();
                              return (
                                <tr
                                  key={earning._id}
                                  className="border-b border-[#1e2d40] transition-colors hover:bg-[#0d1a2d]"
                                >
                                  <td className="px-4 py-3">
                                    <div className="flex items-center gap-3">
                                      <div className="flex h-9 w-9 items-center justify-center rounded-full border border-[#2a3547] bg-black text-[10px] font-bold text-gray-200">
                                        {getInitials(customerName(earning))}
                                      </div>
                                      <div>
                                        <p className="text-xs font-medium text-gray-200">
                                          {customerName(earning)}
                                        </p>
                                        <p className="text-[10px] text-gray-500">
                                          {customerEmail(earning)}
                                        </p>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-4 py-3 text-xs text-gray-300">
                                    {plan}
                                  </td>
                                  <td className="px-4 py-3 text-xs font-medium text-gray-200">
                                    {money(
                                      toNumber(
                                        earning.amount ||
                                          earning.subscriptionValue ||
                                          earning.plan_id?.monthlyPrice,
                                      ),
                                    )}
                                  </td>
                                  <td className="px-4 py-3">
                                    <p className="text-xs font-semibold text-emerald-400">
                                      {money(commission)}
                                    </p>
                                    <p className="text-[10px] text-gray-500">
                                      monthly recurring
                                    </p>
                                  </td>
                                  <td className="px-4 py-3 text-xs text-gray-400">
                                    {earningDate(earning)
                                      ? formatDate(earningDate(earning))
                                      : "-"}
                                  </td>
                                  <td className="px-4 py-3">
                                    <Badge
                                      variant={
                                        STATUS_BADGE[status] || "secondary"
                                      }
                                      className="text-[10px] capitalize"
                                    >
                                      {status}
                                    </Badge>
                                  </td>
                                  <td className="px-4 py-3 text-right">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7"
                                    >
                                      <MoreVertical className="h-4 w-4" />
                                    </Button>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                    <div className="flex items-center justify-between border-t border-[#1e2d40] px-4 py-3">
                      <p className="text-xs text-gray-500">
                        {meta.total > 0
                          ? `Showing ${(page - 1) * limit + 1} to ${Math.min(
                              page * limit,
                              meta.total,
                            )} of ${meta.total} deals`
                          : "0 deals"}
                      </p>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() =>
                            setPage((current) => Math.max(1, current - 1))
                          }
                          disabled={page === 1}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="px-2 text-xs text-gray-300">
                          Page {page} of {totalPages}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => setPage((current) => current + 1)}
                          disabled={page >= totalPages}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </>
                ) : null}

                {activeTab === "sources" ? (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-[#1e2d40]">
                          {[
                            "Source",
                            "Customers",
                            "Revenue Generated",
                            "Commission Earned",
                            "Conversion",
                          ].map((heading) => (
                            <th
                              key={heading}
                              className="whitespace-nowrap px-4 py-3 text-left text-xs font-medium text-gray-500"
                            >
                              {heading}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {sourceRows.length === 0 ? (
                          <tr>
                            <td
                              colSpan={5}
                              className="px-4 py-10 text-center text-sm text-gray-500"
                            >
                              No source analytics yet.
                            </td>
                          </tr>
                        ) : (
                          sourceRows.map((row) => (
                            <tr
                              key={row.source || row.label}
                              className="border-b border-[#1e2d40]"
                            >
                              <td className="px-4 py-3 text-xs font-medium text-gray-200">
                                {row.label || row.source}
                              </td>
                              <td className="px-4 py-3 text-xs text-gray-300">
                                {toNumber(row.customers)}
                              </td>
                              <td className="px-4 py-3 text-xs text-gray-300">
                                {money(toNumber(row.revenue))}
                              </td>
                              <td className="px-4 py-3 text-xs font-semibold text-emerald-400">
                                {money(toNumber(row.commission))}
                              </td>
                              <td className="px-4 py-3 text-xs text-gray-300">
                                {toNumber(row.conversionRate).toFixed(1)}%
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                ) : null}

                {activeTab === "payouts" ? (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-[#1e2d40]">
                          {[
                            "Payout ID",
                            "Amount",
                            "Date",
                            "Status",
                            "Payment Method",
                          ].map((heading) => (
                            <th
                              key={heading}
                              className="whitespace-nowrap px-4 py-3 text-left text-xs font-medium text-gray-500"
                            >
                              {heading}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {payoutsLoading ? (
                          Array.from({ length: 4 }).map((_, rowIndex) => (
                            <tr
                              key={rowIndex}
                              className="border-b border-[#1e2d40]"
                            >
                              {Array.from({ length: 5 }).map(
                                (__, cellIndex) => (
                                  <td key={cellIndex} className="px-4 py-3">
                                    <Skeleton className="h-4 w-20" />
                                  </td>
                                ),
                              )}
                            </tr>
                          ))
                        ) : payouts.length === 0 ? (
                          <tr>
                            <td
                              colSpan={5}
                              className="px-4 py-10 text-center text-sm text-gray-500"
                            >
                              No payout records yet.
                            </td>
                          </tr>
                        ) : (
                          payouts.map((payout) => {
                            const status = String(
                              payout.status || "pending",
                            ).toLowerCase();
                            return (
                              <tr
                                key={payout._id || payout.id}
                                className="border-b border-[#1e2d40]"
                              >
                                <td className="px-4 py-3 text-xs font-medium text-gray-200">
                                  {payout.payoutId || payout.id || payout._id}
                                </td>
                                <td className="px-4 py-3 text-xs font-semibold text-emerald-400">
                                  {money(toNumber(payout.amount))}
                                </td>
                                <td className="px-4 py-3 text-xs text-gray-400">
                                  {formatDate(
                                    payout.payout_date ||
                                      payout.payoutDate ||
                                      payout.createdAt,
                                  )}
                                </td>
                                <td className="px-4 py-3">
                                  <Badge
                                    variant={
                                      STATUS_BADGE[status] || "secondary"
                                    }
                                    className="text-[10px] capitalize"
                                  >
                                    {status}
                                  </Badge>
                                </td>
                                <td className="px-4 py-3 text-xs text-gray-300">
                                  {payout.paymentMethod || "Bank transfer"}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-5">
            <Card>
              <CardContent className="p-4">
                <div className="mb-3 flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  <p className="text-sm font-semibold text-white">
                    Kora is active
                  </p>
                </div>
                <div className="flex flex-col items-center py-2 text-center">
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
                  <p className="mt-2 text-sm text-gray-200">
                    Always here to help you
                  </p>
                  <Badge variant="success" className="mt-3 gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
                    Online
                  </Badge>
                </div>
                <div className="mt-4 space-y-2">
                  {insights.length === 0 ? (
                    <div className="rounded-lg border border-[#1e2d40] bg-[#0d1a2d] p-3 text-xs text-gray-500">
                      No earnings insights yet.
                    </div>
                  ) : (
                    insights.map((item) => {
                      const Icon =
                        item.type === "source"
                          ? Sparkles
                          : item.type === "opportunity"
                            ? Users
                            : TrendingUp;
                      const tone =
                        item.type === "source"
                          ? "text-amber-300 bg-amber-600/15"
                          : item.type === "opportunity"
                            ? "text-cyan-300 bg-cyan-600/15"
                            : "text-emerald-300 bg-emerald-600/15";
                      return (
                        <button
                          key={`${item.type}-${item.message}`}
                          className="flex w-full items-center gap-3 rounded-lg border border-[#1e2d40] bg-[#0d1a2d] p-3 text-left transition-colors hover:bg-[#111f34]"
                        >
                          <span
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${tone}`}
                          >
                            <Icon className="h-4 w-4" />
                          </span>
                          <span className="flex-1 text-xs leading-5 text-gray-200">
                            {item.message}
                          </span>
                          <ChevronRight className="h-4 w-4 text-gray-500" />
                        </button>
                      );
                    })
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="mb-4 flex items-center justify-between">
                  <p className="text-sm font-semibold text-white">
                    Recurring Revenue Forecast
                  </p>
                  <CalendarClock className="h-4 w-4 text-blue-400" />
                </div>
                <div className="space-y-3">
                  {forecast.length === 0 ? (
                    <p className="text-xs text-gray-500">
                      No active referred subscriptions yet.
                    </p>
                  ) : (
                    forecast.map((item) => (
                      <div
                        key={item.plan}
                        className="flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-emerald-400" />
                          <p className="text-xs text-gray-300">
                            {item.count} {item.plan}
                          </p>
                        </div>
                        <p className="text-xs font-semibold text-gray-100">
                          {money(item.projectedMonthly)}
                        </p>
                      </div>
                    ))
                  )}
                </div>
                <div className="mt-4 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3">
                  <p className="text-[11px] uppercase tracking-wide text-emerald-300">
                    Projected monthly earnings
                  </p>
                  <p className="mt-1 text-2xl font-bold text-white">
                    {money(projectedMonthly)}
                  </p>
                  <p className="mt-1 text-xs text-gray-400">
                    Based on {activeCustomers} active paying customers.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <p className="mb-4 text-sm font-semibold text-white">
                  Commission Rules
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {commissionPlans.length === 0 ? (
                    <p className="col-span-2 text-xs text-gray-500">
                      No active commission plans configured.
                    </p>
                  ) : (
                    commissionPlans.map((plan) => (
                      <div
                        key={plan.id || plan.slug || plan.name}
                        className="rounded-lg border border-[#1e2d40] bg-[#0d1a2d] p-3"
                      >
                        <p className="text-xs text-gray-400">{plan.name}</p>
                        <p className="mt-1 text-lg font-bold text-white">
                          {money(toNumber(plan.partnerCommission))}
                        </p>
                        <p className="mt-1 text-[10px] text-gray-500">
                          per active paid month
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <p className="mb-4 text-sm font-semibold text-white">
                  Quick Actions
                </p>
                <div className="space-y-2">
                  {quickActions.map((action) => (
                    <button
                      key={action.label}
                      onClick={action.onClick}
                      disabled={action.disabled}
                      className="flex w-full items-center gap-3 rounded-lg border border-[#1e2d40] bg-[#0d1a2d] p-3 text-left transition-colors hover:bg-[#111f34] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <action.icon className="h-4 w-4 text-gray-300" />
                      <span className="flex-1 text-xs text-gray-200">
                        {action.label}
                      </span>
                      {action.label === "Share Referral Link" ? (
                        <Copy className="h-4 w-4 text-gray-500" />
                      ) : action.label === "View Deals" ? (
                        <ExternalLink className="h-4 w-4 text-gray-500" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-gray-500" />
                      )}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <p className="mb-3 text-sm font-semibold text-white">
                  Billing Cycle Engine
                </p>
                <div className="space-y-2 text-xs text-gray-400">
                  <p className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    Active customer payment succeeds
                  </p>
                  <p className="flex items-center gap-2">
                    <Banknote className="h-4 w-4 text-blue-400" />
                    Monthly commission is approved
                  </p>
                  <p className="flex items-center gap-2">
                    <PieChart className="h-4 w-4 text-purple-400" />
                    Upgrades and downgrades update automatically
                  </p>
                  <p className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-amber-400" />
                    Failed payments pause future commissions
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
