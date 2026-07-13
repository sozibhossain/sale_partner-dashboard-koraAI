/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import Image from "next/image";
import { useCallback, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { appointmentsApi, calendarApi, customersApi, employeesApi } from "@/lib/api";
import { Header } from "@/components/layout/header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { asArray, getInitials } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Bell,
  CalendarDays,
  CheckSquare,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Coffee,
  Eye,
  Filter,
  Globe2,
  Palette,
  Plus,
  RefreshCw,
  Settings,
  Settings2,
  ShieldCheck,
  Star,
  StopCircle,
  User,
} from "lucide-react";
import { CreateAppointmentDialog } from "@/components/create-appointment-dialog";
import { AppointmentDetailsDialog } from "@/components/appointment-details-dialog";

const VIEWS = ["Day", "Week", "Month", "Agenda"] as const;
const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HOURS = Array.from({ length: 12 }, (_, index) => 8 + index);
const STATUS_FILTERS = ["all", "upcoming", "started", "completed", "cancelled", "blocked"] as const;
const ACTIVITY_FILTERS = ["all", "Customer Appointments", "Partner Meetings", "Blocks", "Breaks"] as const;

const TEAM_COLOR_POOL = [
  "#3b82f6",
  "#22c55e",
  "#a855f7",
  "#f59e0b",
  "#ec4899",
  "#06b6d4",
  "#ef4444",
  "#10b981",
];

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  upcoming: { label: "Upcoming", color: "text-gray-400" },
  rescheduled: { label: "Rescheduled", color: "text-blue-400" },
  started: { label: "In Progress", color: "text-amber-400" },
  ongoing: { label: "In Progress", color: "text-amber-400" },
  completed: { label: "Completed", color: "text-emerald-400" },
  cancelled: { label: "Cancelled", color: "text-red-400" },
  no_show: { label: "Missed", color: "text-red-400" },
  blocked: { label: "Unavailable", color: "text-amber-400" },
};

const APPOINTMENT_TYPE_PRESETS = [
  { name: "Consultation", color: "#2563eb", duration: "30 min", visibility: "Customer" },
  { name: "Strategy Call", color: "#7c3aed", duration: "60 min", visibility: "Partner" },
  { name: "Review", color: "#16a34a", duration: "45 min", visibility: "Customer" },
  { name: "Follow-up", color: "#0891b2", duration: "30 min", visibility: "Customer" },
  { name: "Internal Meeting", color: "#f97316", duration: "60 min", visibility: "Team" },
];

const startOfWeek = (date: Date) => {
  const next = new Date(date);
  const day = next.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  next.setDate(next.getDate() + diff);
  next.setHours(0, 0, 0, 0);
  return next;
};

const endOfWeek = (date: Date) => {
  const next = startOfWeek(date);
  next.setDate(next.getDate() + 6);
  next.setHours(23, 59, 59, 999);
  return next;
};

const startOfMonthGrid = (date: Date) =>
  startOfWeek(new Date(date.getFullYear(), date.getMonth(), 1));

const endOfMonthGrid = (date: Date) => {
  const end = endOfWeek(new Date(date.getFullYear(), date.getMonth() + 1, 0));
  end.setHours(23, 59, 59, 999);
  return end;
};

const isSameDay = (first: Date, second: Date) =>
  first.getFullYear() === second.getFullYear() &&
  first.getMonth() === second.getMonth() &&
  first.getDate() === second.getDate();

const formatMonthDay = (date: Date) =>
  date.toLocaleDateString("en-US", { month: "short", day: "numeric" });

const formatHourLabel = (hour: number) => `${String(hour).padStart(2, "0")}:00`;

const formatRange = (start: string, end: string) => {
  if (!start || !end) return "";
  return `${start.slice(0, 5)} - ${end.slice(0, 5)}`;
};

const toDateInputValue = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const toTimeInputValue = (date: Date) => {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
};

const addMinutesToTime = (timeValue: string, minutes: number) => {
  const [hours, mins] = timeValue.split(":").map(Number);
  const total = hours * 60 + mins + minutes;
  const nextHours = Math.floor(total / 60) % 24;
  const nextMinutes = total % 60;
  return `${String(nextHours).padStart(2, "0")}:${String(nextMinutes).padStart(2, "0")}`;
};

const minutesBetweenTimes = (start: string, end: string) => {
  const [startHour, startMinute] = start.split(":").map(Number);
  const [endHour, endMinute] = end.split(":").map(Number);
  return endHour * 60 + endMinute - (startHour * 60 + startMinute);
};

export default function CalendarPage() {
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [blockDialogType, setBlockDialogType] = useState<"block" | "break" | null>(null);
  const [showAppointmentTypesDialog, setShowAppointmentTypesDialog] = useState(false);
  const [showCalendarSettingsDialog, setShowCalendarSettingsDialog] = useState(false);
  const [appointmentTypes, setAppointmentTypes] = useState(APPOINTMENT_TYPE_PRESETS);
  const [newAppointmentType, setNewAppointmentType] = useState("");
  const [newAppointmentTypeDuration, setNewAppointmentTypeDuration] = useState("30 min");
  const [newAppointmentTypeVisibility, setNewAppointmentTypeVisibility] = useState("Customer");
  const [newAppointmentTypeColor, setNewAppointmentTypeColor] = useState("#2563eb");
  const [appointmentDefaultDate, setAppointmentDefaultDate] = useState<Date | null>(null);
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const [view, setView] = useState<(typeof VIEWS)[number]>("Week");
  const [weekAnchor, setWeekAnchor] = useState(() => startOfWeek(new Date()));
  const [showFilters, setShowFilters] = useState(false);
  const [showSync, setShowSync] = useState(true);
  const [selectedDayIndex, setSelectedDayIndex] = useState<number | null>(null);
  const [selectedEmployees, setSelectedEmployees] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]>("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [customerFilter, setCustomerFilter] = useState("all");
  const [activityFilter, setActivityFilter] = useState<(typeof ACTIVITY_FILTERS)[number]>("all");
  const [blockDate, setBlockDate] = useState(() => toDateInputValue(new Date()));
  const [blockStartTime, setBlockStartTime] = useState(() => toTimeInputValue(new Date()));
  const [blockEndTime, setBlockEndTime] = useState(() => addMinutesToTime(toTimeInputValue(new Date()), 60));
  const [blockTitle, setBlockTitle] = useState("");
  const [blockNotes, setBlockNotes] = useState("");
  const [calendarSettings, setCalendarSettings] = useState({
    defaultView: "Week",
    timeZone: "Asia/Dhaka",
    weekStartsOn: "Monday",
    workingStart: "09:00",
    workingEnd: "18:00",
    defaultDuration: "60",
    reminder: "15",
    eventDensity: "Comfortable",
    syncGoogle: true,
    showWeekends: true,
    showDeclined: false,
    publicBooking: true,
    autoAccept: false,
  });
  const now = useMemo(() => new Date(), []);
  const currentUserId = session?.user?._id || "";

  const weekStart = weekAnchor;
  const weekEnd = useMemo(() => endOfWeek(weekStart), [weekStart]);
  const rangeStart = useMemo(
    () => (view === "Month" ? startOfMonthGrid(weekAnchor) : weekStart),
    [view, weekAnchor, weekStart]
  );
  const rangeEnd = useMemo(
    () => (view === "Month" ? endOfMonthGrid(weekAnchor) : weekEnd),
    [view, weekAnchor, weekEnd]
  );

  const days = useMemo(
    () =>
      Array.from({ length: 7 }, (_, index) => {
        const current = new Date(weekStart);
        current.setDate(weekStart.getDate() + index);
        return current;
      }),
    [weekStart]
  );

  const monthDays = useMemo(
    () =>
      Array.from({ length: 42 }, (_, index) => {
        const current = new Date(startOfMonthGrid(weekAnchor));
        current.setDate(current.getDate() + index);
        return current;
      }),
    [weekAnchor]
  );

  const { data: appointmentsResponse, isLoading: appointmentsLoading } = useQuery({
    queryKey: ["calendar-appointments", rangeStart.toISOString(), rangeEnd.toISOString()],
    queryFn: () =>
      appointmentsApi
        .getAll({
          startDate: rangeStart.toISOString(),
          endDate: rangeEnd.toISOString(),
          limit: 200,
        })
        .then((response) => response.data),
  });

  const { data: employeesResponse } = useQuery({
    queryKey: ["calendar-team"],
    queryFn: () => employeesApi.getAll({ limit: 50 }).then((response) => response.data),
  });

  const { data: customersResponse } = useQuery({
    queryKey: ["calendar-customers"],
    queryFn: () => customersApi.getAll({ limit: 100 }).then((response) => response.data),
  });

  const { data: calendarEventsResponse, isLoading: calendarEventsLoading } = useQuery({
    queryKey: ["calendar-events", rangeStart.toISOString(), rangeEnd.toISOString()],
    queryFn: () =>
      calendarApi
        .getEvents({
          startDate: rangeStart.toISOString(),
          endDate: rangeEnd.toISOString(),
          limit: 200,
        })
        .then((response) => response.data),
  });

  const syncMutation = useMutation({
    mutationFn: () => calendarApi.sync(),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ["calendar-appointments"] });
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
      const result = response.data?.data;
      toast.success(
        result
          ? `Sync complete: ${result.eventsAdded} added, ${result.eventsUpdated} updated`
          : "Calendar synced successfully"
      );
    },
    onError: (error: any) =>
      toast.error(error?.response?.data?.message || "Failed to sync calendar"),
  });

  const blockMutation = useMutation({
    mutationFn: () => {
      const start = new Date(`${blockDate}T${blockStartTime}:00`);
      const end = new Date(`${blockDate}T${blockEndTime}:00`);
      return calendarApi.createEvent({
        title: blockTitle || (blockDialogType === "break" ? "Break" : "Blocked Time"),
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        notes: blockNotes,
        color: blockDialogType === "break" ? "#14b8a6" : "#f97316",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
      toast.success(blockDialogType === "break" ? "Break added" : "Block added");
      setBlockDialogType(null);
      setBlockTitle("");
      setBlockNotes("");
    },
    onError: (error: any) =>
      toast.error(error?.response?.data?.message || "Failed to create calendar event"),
  });

  const appointments: any[] = asArray(
    appointmentsResponse?.data?.appointments ||
      appointmentsResponse?.data?.data?.appointments ||
      appointmentsResponse?.data
  );
  const employees: any[] = asArray(
    employeesResponse?.data?.employees ||
      employeesResponse?.data?.data?.employees ||
      employeesResponse?.data
  );
  const customers: any[] = asArray(
    customersResponse?.data?.customers ||
      customersResponse?.data?.data?.customers ||
      customersResponse?.data?.data ||
      customersResponse?.data ||
      customersResponse
  );
  const calendarEvents: any[] = asArray(
    calendarEventsResponse?.data?.events ||
      calendarEventsResponse?.data?.data?.events ||
      calendarEventsResponse?.data?.data ||
      calendarEventsResponse?.data ||
      calendarEventsResponse
  );

  const standaloneCalendarEvents = useMemo(
    () =>
      calendarEvents
        .filter((event) => !event.related_appointment_id)
        .map((event) => ({
          ...event,
          _id: `event-${event._id}`,
          calendarEventId: event._id,
          appointmentDate: event.start_time,
          startTime: toTimeInputValue(new Date(event.start_time)),
          endTime: toTimeInputValue(new Date(event.end_time)),
          service: event.title?.toLowerCase().includes("break") ? "Break" : "Block",
          status: "blocked",
          isCalendarEvent: true,
        })),
    [calendarEvents]
  );

  const calendarItems = useMemo(
    () => [...appointments, ...standaloneCalendarEvents],
    [appointments, standaloneCalendarEvents]
  );

  const teamMembers = useMemo(() => {
    if (!employees.length) {
      return Array.from({ length: 5 }, (_, index) => ({
        id: index === 0 ? currentUserId || "me" : `partner-${index}`,
        name: index === 0 ? "My Calendar" : `Partner ${index}`,
        color: TEAM_COLOR_POOL[index % TEAM_COLOR_POOL.length],
        imageUrl: "",
      }));
    }

    return employees.slice(0, 6).map((employee, index) => ({
      id: String(employee.userId?._id || employee._id || index),
      name: employee.userId?.name || employee.name || (index === 0 ? "Me" : `Partner ${index}`),
      imageUrl: employee.userId?.profileImage?.url || employee.profileImage?.url || "",
      color: TEAM_COLOR_POOL[index % TEAM_COLOR_POOL.length],
    }));
  }, [currentUserId, employees]);

  const memberColorMap = useMemo(() => {
    const map = new Map<string, string>();
    teamMembers.forEach((member) => map.set(member.id, member.color));
    return map;
  }, [teamMembers]);

  const appointmentTitle = useCallback(
    (appointment: any) =>
      appointment.customer?.name ||
      appointment.client?.name ||
      appointment.title ||
      "Appointment",
    []
  );

  const appointmentMeta = useCallback((appointment: any) => {
    if (typeof appointment.service === "string") return appointment.service;
    if (appointment.service?.name) return appointment.service.name;
    return appointment.location || appointment.type || "";
  }, []);

  const appointmentEmployeeId = useCallback(
    (appointment: any) =>
      String(
        appointment.employee?._id ||
          appointment.employee?.userId?._id ||
          appointment.related_employee_id?._id ||
          appointment.related_employee_id ||
          appointment.employee ||
          appointment.user_id?._id ||
          appointment.user_id ||
          ""
      ),
    []
  );

  const appointmentCustomerId = useCallback(
    (appointment: any) =>
      String(
        appointment.customer?._id ||
          appointment.customer ||
          appointment.client?._id ||
          appointment.client ||
          ""
      ),
    []
  );

  const appointmentActivity = useCallback(
    (appointment: any): (typeof ACTIVITY_FILTERS)[number] => {
      if (appointment.isCalendarEvent) {
        return appointmentMeta(appointment).toLowerCase().includes("break") ? "Breaks" : "Blocks";
      }

      const text = `${appointmentTitle(appointment)} ${appointmentMeta(appointment)}`.toLowerCase();
      if (
        text.includes("partner") ||
        text.includes("team") ||
        text.includes("internal") ||
        text.includes("strategy") ||
        text.includes("review")
      ) {
        return "Partner Meetings";
      }
      return "Customer Appointments";
    },
    [appointmentMeta, appointmentTitle]
  );

  const isViewingOtherCalendar =
    Boolean(currentUserId) && selectedEmployees.size > 0 && !selectedEmployees.has(currentUserId);

  const openCreateAppointmentDialog = (date?: Date | null) => {
    if (isViewingOtherCalendar) {
      toast.info("Other partner calendars are read-only");
      return;
    }
    setAppointmentDefaultDate(date || selectedDay?.day || null);
    setShowCreateDialog(true);
  };

  const openBlockDialog = (type: "block" | "break", date?: Date | null) => {
    if (isViewingOtherCalendar) {
      toast.info("Other partner calendars are read-only");
      return;
    }
    const baseDate = date || selectedDay?.day || new Date();
    const start = new Date();
    const end = new Date(start.getTime() + (type === "break" ? 30 : 60) * 60 * 1000);
    setBlockDialogType(type);
    setBlockDate(toDateInputValue(baseDate));
    setBlockStartTime(toTimeInputValue(start));
    setBlockEndTime(toTimeInputValue(end));
    setBlockTitle(type === "break" ? "Break" : "Blocked Time");
    setBlockNotes("");
  };

  const filteredAppointments = useMemo(() => {
    return calendarItems.filter((appointment) => {
      const employeeId = appointmentEmployeeId(appointment);
      if (selectedEmployees.size > 0 && !selectedEmployees.has(employeeId)) return false;
      if (statusFilter !== "all" && appointment.status !== statusFilter) return false;
      if (typeFilter !== "all" && appointmentMeta(appointment) !== typeFilter) return false;
      if (customerFilter !== "all" && appointmentCustomerId(appointment) !== customerFilter) return false;
      if (activityFilter !== "all" && appointmentActivity(appointment) !== activityFilter) return false;
      return true;
    });
  }, [
    activityFilter,
    appointmentActivity,
    appointmentCustomerId,
    appointmentEmployeeId,
    appointmentMeta,
    calendarItems,
    customerFilter,
    selectedEmployees,
    statusFilter,
    typeFilter,
  ]);

  const typeOptions = useMemo(() => {
    const values = new Set<string>();
    calendarItems.forEach((appointment) => {
      const type = appointmentMeta(appointment);
      if (type) values.add(type);
    });
    return Array.from(values).sort();
  }, [appointmentMeta, calendarItems]);

  const dayBuckets = useMemo(
    () =>
      days.map((day) => {
        const dayAppointments = filteredAppointments.filter((appointment) => {
          const dateValue = new Date(appointment.appointmentDate || appointment.start_time);
          return isSameDay(dateValue, day);
        });

        return {
          day,
          appointments: dayAppointments,
          capacity: Math.min(120, Math.round((dayAppointments.length / 8) * 100)),
        };
      }),
    [days, filteredAppointments]
  );

  const selectedDay =
    selectedDayIndex === null
      ? dayBuckets[dayBuckets.findIndex((bucket) => isSameDay(bucket.day, now))] ||
        dayBuckets[0] ||
        null
      : dayBuckets[selectedDayIndex] || null;

  const selectedDayAppointments = selectedDay?.appointments || [];
  const isCurrentWeekVisible = days.some((day) => isSameDay(day, now));
  const currentMinuteOffset = `${Math.max(2, Math.min(98, (now.getMinutes() / 60) * 100))}%`;
  const busiestDay = useMemo(
    () =>
      dayBuckets.reduce(
        (best, bucket) =>
          bucket.appointments.length > best.appointments.length ? bucket : best,
        dayBuckets[0] || { day: now, appointments: [], capacity: 0 }
      ),
    [dayBuckets, now]
  );
  const capacityAlerts = dayBuckets.filter((bucket) => bucket.capacity >= 80).length;

  const insightCards = [
    {
      title: "Capacity Warning",
      value: capacityAlerts ? `${capacityAlerts} days` : "Clear",
      detail: capacityAlerts ? "Near capacity this week" : "No capacity alerts",
      icon: AlertTriangle,
      tone: "text-amber-300 bg-amber-500/15",
    },
    {
      title: "Daily Workload",
      value: String(selectedDayAppointments.length),
      detail: "appointments selected day",
      icon: CalendarDays,
      tone: "text-emerald-300 bg-emerald-500/15",
    },
    {
      title: "Busiest Day",
      value: busiestDay.day.toLocaleDateString("en-US", { weekday: "long" }),
      detail: `${busiestDay.appointments.length} events scheduled`,
      icon: BarChart3,
      tone: "text-blue-300 bg-blue-500/15",
    },
    {
      title: "Follow-ups",
      value: String(filteredAppointments.filter((item) => appointmentMeta(item).toLowerCase().includes("follow")).length),
      detail: "follow-up items visible",
      icon: CheckSquare,
      tone: "text-cyan-300 bg-cyan-500/15",
    },
  ];

  const navigateWeek = (delta: number) => {
    setWeekAnchor((current) => {
      const next = new Date(current);
      next.setDate(next.getDate() + delta * 7);
      return startOfWeek(next);
    });
  };

  const toggleMember = (id: string) => {
    setSelectedEmployees((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const employeeColor = (appointment: any) => {
    if (appointment.color) return appointment.color;
    const employeeId = appointmentEmployeeId(appointment);
    return memberColorMap.get(employeeId) || TEAM_COLOR_POOL[0];
  };

  const renderAppointmentCard = (appointment: any, dense = false) => {
    const color = employeeColor(appointment);
    return (
      <button
        key={appointment._id}
        onClick={(event) => {
          event.stopPropagation();
          if (appointment.isCalendarEvent) {
            toast.info(`${appointmentTitle(appointment)} is a calendar event`);
            return;
          }
          setDetailsId(String(appointment._id));
        }}
        className="mb-1 w-full rounded-md border px-2 py-2 text-left transition-opacity hover:opacity-90"
        style={{ backgroundColor: `${color}25`, borderColor: `${color}88` }}
      >
        <span className="block truncate text-[11px] font-medium" style={{ color }}>
          {formatRange(appointment.startTime, appointment.endTime)}
        </span>
        <span className={`${dense ? "text-[11px]" : "text-xs"} mt-1 flex items-center gap-1 truncate font-semibold text-gray-100`}>
          {appointmentTitle(appointment)}
          <User className="h-3 w-3 shrink-0 text-gray-400" />
        </span>
        <span className="mt-1 block truncate text-[10px] text-gray-400">
          {appointmentMeta(appointment)}
        </span>
      </button>
    );
  };

  const updateCalendarSetting = (key: keyof typeof calendarSettings, value: string | boolean) => {
    setCalendarSettings((current) => ({ ...current, [key]: value }));
  };

  return (
    <div>
      <Header
        title="Calendar"
        subtitle="Manage appointments across your organization. Stay organized, save time."
        action={
          <div className="flex items-center gap-1 rounded-lg bg-blue-600 pr-1">
            <Button
              size="sm"
              className="h-8 rounded-l-lg rounded-r-none bg-blue-600 text-xs hover:bg-blue-700"
              onClick={() => openCreateAppointmentDialog()}
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              Create Appointment
            </Button>
            <button
              className="rounded-md p-1 text-white hover:bg-blue-700"
              onClick={() => openCreateAppointmentDialog()}
              aria-label="More"
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
          </div>
        }
      />

      <div className="space-y-4 p-3 sm:p-4 lg:p-6">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-1 rounded-lg bg-[#0d1a2d] p-1">
            {VIEWS.map((option) => (
              <button
                key={option}
                onClick={() => setView(option)}
                className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                  view === option ? "bg-blue-600 text-white" : "text-gray-400 hover:text-gray-200"
                }`}
              >
                {option}
              </button>
            ))}
          </div>

          <button onClick={() => navigateWeek(-1)} className="rounded-md p-1 text-gray-400 hover:bg-[#1e2d40] hover:text-gray-200" aria-label="Previous period">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-medium text-gray-200">
            {view === "Month"
              ? weekAnchor.toLocaleDateString("en-US", { month: "long", year: "numeric" })
              : `${formatMonthDay(weekStart)} - ${formatMonthDay(weekEnd)}, ${weekEnd.getFullYear()}`}
          </span>
          <button onClick={() => navigateWeek(1)} className="rounded-md p-1 text-gray-400 hover:bg-[#1e2d40] hover:text-gray-200" aria-label="Next period">
            <ChevronRight className="h-4 w-4" />
          </button>

          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setWeekAnchor(startOfWeek(new Date()))}>
            Today
          </Button>

          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setShowFilters((value) => !value)}>
              <Filter className="mr-1 h-3.5 w-3.5" />
              Filters
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Calendar settings">
              <Settings className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
          <div className="space-y-4 xl:col-span-3">
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[#15304f] bg-[#071321] p-2">
              <span className="text-xs text-gray-300">Team Calendars</span>
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#1e2d40] text-[9px] text-gray-500">
                ?
              </span>
              {teamMembers.map((member, index) => {
                const isActive = selectedEmployees.size === 0 || selectedEmployees.has(member.id);
                return (
                  <button
                    key={member.id}
                    onClick={() => toggleMember(member.id)}
                    className={`flex items-center gap-2 rounded-full border px-2 py-1 transition-colors ${
                      isActive ? "border-[#2a3547] bg-[#1e2d40]" : "border-[#1e2d40] bg-transparent opacity-50"
                    }`}
                    style={isActive ? { borderColor: `${member.color}55` } : undefined}
                    title={index === 0 ? "Own calendar: full access" : "Other partner calendar: read-only"}
                  >
                    <Avatar className="h-5 w-5">
                      {member.imageUrl ? <AvatarImage src={member.imageUrl} alt={member.name} /> : null}
                      <AvatarFallback className="text-[9px]" style={{ backgroundColor: `${member.color}33`, color: member.color }}>
                        {getInitials(member.name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-xs text-gray-200">
                      {index === 0 ? `${member.name} (me)` : member.name}
                    </span>
                  </button>
                );
              })}
              <button className="flex h-8 w-8 items-center justify-center rounded-md border border-[#183657] bg-[#071321] text-gray-400 hover:text-white" aria-label="Add calendar">
                <Plus className="h-3.5 w-3.5" />
              </button>
              <button className="flex h-8 w-8 items-center justify-center rounded-md border border-[#183657] bg-[#071321] text-gray-400 hover:text-white" aria-label="Add partner calendar">
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>

            {showFilters ? (
              <div className="grid gap-3 rounded-2xl border border-[#1e2d40] bg-[#0d1a2d] p-3 md:grid-cols-2 xl:grid-cols-5">
                <div>
                  <p className="mb-2 text-xs font-medium text-gray-300">Status</p>
                  <div className="flex flex-wrap gap-2">
                    {STATUS_FILTERS.map((status) => (
                      <button
                        key={status}
                        onClick={() => setStatusFilter(status)}
                        className={`rounded-md px-3 py-1.5 text-xs capitalize ${
                          statusFilter === status ? "bg-blue-600 text-white" : "bg-[#1e2d40] text-gray-300 hover:bg-[#2a3547]"
                        }`}
                      >
                        {status.replace(/_/g, " ")}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-xs font-medium text-gray-300">Appointment Type</p>
                  <div className="flex flex-wrap gap-2">
                    {["all", ...typeOptions].map((type) => (
                      <button
                        key={type}
                        onClick={() => setTypeFilter(type)}
                        className={`rounded-md px-3 py-1.5 text-xs ${
                          typeFilter === type ? "bg-blue-600 text-white" : "bg-[#1e2d40] text-gray-300 hover:bg-[#2a3547]"
                        }`}
                      >
                        {type === "all" ? "All types" : type}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-xs font-medium text-gray-300">Customer</p>
                  <select
                    value={customerFilter}
                    onChange={(event) => setCustomerFilter(event.target.value)}
                    className="h-9 w-full rounded-md border border-[#2a3547] bg-[#111827] px-3 text-xs text-gray-200 outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">All customers</option>
                    {customers.map((customer: any, index: number) => {
                      const id = String(customer._id || customer.id || index);
                      return (
                        <option key={id} value={id}>
                          {customer.name || customer.fullName || customer.email || "Customer"}
                        </option>
                      );
                    })}
                  </select>
                </div>
                <div>
                  <p className="mb-2 text-xs font-medium text-gray-300">Activity</p>
                  <select
                    value={activityFilter}
                    onChange={(event) => setActivityFilter(event.target.value as (typeof ACTIVITY_FILTERS)[number])}
                    className="h-9 w-full rounded-md border border-[#2a3547] bg-[#111827] px-3 text-xs text-gray-200 outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {ACTIVITY_FILTERS.map((activity) => (
                      <option key={activity} value={activity}>
                        {activity === "all" ? "All activity" : activity}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <p className="mb-2 text-xs font-medium text-gray-300">Range</p>
                  <div className="rounded-md bg-[#1e2d40] px-3 py-2 text-xs text-gray-300">
                    {formatMonthDay(rangeStart)} - {formatMonthDay(rangeEnd)}
                  </div>
                </div>
              </div>
            ) : null}

            <div className="grid gap-4 rounded-xl border border-[#15304f] bg-[radial-gradient(circle_at_5%_50%,rgba(37,99,235,0.22),transparent_14%),linear-gradient(135deg,#071321,#0b1a2f)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] md:grid-cols-[92px_minmax(0,1fr)]">
              <div className="flex h-[92px] w-[92px] items-center justify-center self-center">
                <Image
                  src="/kora.png"
                  alt="Kora Insights"
                  width={92}
                  height={92}
                  unoptimized
                  className="h-[92px] w-[92px] object-contain drop-shadow-[0_0_24px_rgba(59,130,246,0.55)]"
                />
              </div>
              <div className="min-w-0 space-y-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2">
                    <Star className="h-4 w-4 text-blue-300" />
                    <p className="text-sm font-semibold text-white">Kora Insights</p>
                  </div>
                  <button className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#183657] bg-[#0b1c32] px-3 py-2 text-xs text-gray-200 hover:bg-[#102944] sm:w-auto">
                    View all insights
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="grid grid-cols-1 gap-2 lg:grid-cols-3">
                  {insightCards.slice(0, 3).map((insight) => (
                    <div key={insight.title} className="flex min-w-0 items-center gap-3 rounded-lg border border-[#173050] bg-[#0d1a2d]/85 p-3">
                      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${insight.tone}`}>
                        <insight.icon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-gray-100">{insight.value}</p>
                        <p className="truncate text-[11px] text-gray-500">{insight.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <Card className="overflow-hidden rounded-xl border-[#15304f] bg-[#071321]">
              <CardContent className="p-0">
                {view === "Day" ? (
                  <div className="p-4">
                    <div className="mb-4 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-white">
                          {selectedDay?.day.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
                        </p>
                        <p className="text-xs text-gray-500">{selectedDayAppointments.length} appointments</p>
                      </div>
                      <Button size="sm" onClick={() => openCreateAppointmentDialog(selectedDay?.day)}>
                        <Plus className="mr-2 h-4 w-4" />
                        Add Appointment
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {HOURS.map((hour) => {
                        const items = selectedDayAppointments.filter((appointment) => parseInt((appointment.startTime || "00:00").slice(0, 2), 10) === hour);
                        return (
                          <div key={hour} className="grid min-h-[76px] grid-cols-[72px_minmax(0,1fr)] rounded-lg border border-[#1e2d40]">
                            <div className="border-r border-[#1e2d40] px-3 py-3 text-sm text-gray-400">{formatHourLabel(hour)}</div>
                            <div className="group relative p-2">
                              {items.length === 0 ? (
                                <button onClick={() => openCreateAppointmentDialog(selectedDay?.day)} className="hidden h-8 items-center rounded-md bg-[#1e2d40] px-3 text-xs text-gray-300 group-hover:flex">
                                  <Plus className="mr-1 h-3 w-3" />
                                  Add appointment
                                </button>
                              ) : null}
                              {items.map((appointment) => renderAppointmentCard(appointment))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : view === "Month" ? (
                  <div className="p-4">
                    <div className="mb-3 grid grid-cols-7 text-center text-xs font-medium text-gray-400">
                      {DAY_LABELS.map((label) => (
                        <div key={label} className="py-2">{label}</div>
                      ))}
                    </div>
                    <div className="grid grid-cols-7 overflow-hidden rounded-lg border border-[#1e2d40]">
                      {monthDays.map((day) => {
                        const items = filteredAppointments.filter((appointment) =>
                          isSameDay(new Date(appointment.appointmentDate || appointment.start_time), day)
                        );
                        const muted = day.getMonth() !== weekAnchor.getMonth();
                        return (
                          <button
                            key={day.toISOString()}
                            onClick={() => {
                              setWeekAnchor(startOfWeek(day));
                              openCreateAppointmentDialog(day);
                            }}
                            className={`min-h-[112px] border-b border-r border-[#1e2d40] p-2 text-left hover:bg-[#071d35] ${
                              muted ? "bg-[#071321] text-gray-600" : "bg-[#0d1a2d] text-gray-200"
                            }`}
                          >
                            <span className={isSameDay(day, now) ? "inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-xs text-white" : "text-xs"}>
                              {day.getDate()}
                            </span>
                            <div className="mt-2 space-y-1">
                              {items.slice(0, 3).map((appointment) => {
                                const color = employeeColor(appointment);
                                return (
                                  <div key={appointment._id} className="truncate rounded px-2 py-1 text-[10px]" style={{ backgroundColor: `${color}25`, color }}>
                                    {appointmentTitle(appointment)}
                                  </div>
                                );
                              })}
                              {items.length > 3 ? <p className="text-[10px] text-gray-500">+{items.length - 3} more</p> : null}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : view === "Agenda" ? (
                  <div className="divide-y divide-[#1e2d40]">
                    {filteredAppointments.length === 0 ? (
                      <div className="p-8 text-center text-sm text-gray-500">No appointments in this range.</div>
                    ) : (
                      [...filteredAppointments]
                        .sort((a, b) => {
                          const dateCompare = new Date(a.appointmentDate || a.start_time).getTime() - new Date(b.appointmentDate || b.start_time).getTime();
                          if (dateCompare !== 0) return dateCompare;
                          return (a.startTime || "").localeCompare(b.startTime || "");
                        })
                        .map((appointment) => {
                          const color = employeeColor(appointment);
                          const date = new Date(appointment.appointmentDate || appointment.start_time);
                          return (
                            <button
                              key={appointment._id}
                              onClick={() =>
                                appointment.isCalendarEvent
                                  ? toast.info(`${appointmentTitle(appointment)} is a calendar event`)
                                  : setDetailsId(String(appointment._id))
                              }
                              className="grid w-full grid-cols-[110px_minmax(0,1fr)_120px] gap-4 px-4 py-3 text-left hover:bg-[#071d35]"
                            >
                              <div>
                                <p className="text-xs font-medium text-gray-200">{date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</p>
                                <p className="text-[11px] text-gray-500">{date.toLocaleDateString("en-US", { weekday: "long" })}</p>
                              </div>
                              <div className="min-w-0 border-l-2 pl-3" style={{ borderColor: color }}>
                                <p className="truncate text-sm font-semibold text-gray-100">{appointmentTitle(appointment)}</p>
                                <p className="truncate text-xs text-gray-500">{appointmentMeta(appointment)}</p>
                              </div>
                              <div className="text-right text-xs text-gray-300">{formatRange(appointment.startTime, appointment.endTime)}</div>
                            </button>
                          );
                        })
                    )}
                  </div>
                ) : (
                  <>
                  <div className="overflow-x-auto">
                    <div className="min-w-[860px]">
                      <div className="grid grid-cols-[60px_repeat(7,minmax(0,1fr))] border-b border-[#1e2d40]">
                        <div className="px-2 py-3 text-[10px] text-gray-500">GMT+1</div>
                        {dayBuckets.map((bucket, index) => {
                          const isToday = isSameDay(bucket.day, now);
                          return (
                            <div key={bucket.day.toISOString()} className="border-l border-[#1e2d40] px-2 py-2 text-center">
                              <p className="text-[11px] text-gray-400">{DAY_LABELS[index]} {bucket.day.getDate()}</p>
                              {bucket.capacity > 70 ? (
                                <p className={`mt-0.5 text-[10px] ${bucket.capacity >= 100 ? "text-red-400" : bucket.capacity >= 90 ? "text-amber-400" : "text-emerald-400"}`}>
                                  {bucket.capacity}% booked
                                </p>
                              ) : null}
                              {isToday ? <span className="mt-0.5 inline-block h-1 w-1 rounded-full bg-blue-400" /> : null}
                            </div>
                          );
                        })}
                      </div>

                      {appointmentsLoading || calendarEventsLoading ? (
                        <div className="space-y-2 p-3">
                          {Array.from({ length: 8 }).map((_, index) => <Skeleton key={index} className="h-12 w-full" />)}
                        </div>
                      ) : (
                        HOURS.map((hour) => (
                          <div key={hour} className="relative grid min-h-[68px] grid-cols-[60px_repeat(7,minmax(0,1fr))] border-b border-[#1e2d40]">
                            {isCurrentWeekVisible && now.getHours() === hour ? (
                              <div
                                className="pointer-events-none absolute left-[60px] right-0 z-10 h-px bg-blue-500"
                                style={{ top: currentMinuteOffset }}
                              >
                                <span className="absolute -left-[50px] -top-2 rounded bg-blue-600 px-1.5 py-0.5 text-[10px] font-medium text-white">
                                  {toTimeInputValue(now)}
                                </span>
                              </div>
                            ) : null}
                            <div className="px-2 py-1 text-[10px] text-gray-500">{formatHourLabel(hour)}</div>
                            {dayBuckets.map((bucket, dayIndex) => {
                              const slotAppointments = bucket.appointments.filter((appointment) => parseInt((appointment.startTime || "00:00").slice(0, 2), 10) === hour);
                              return (
                                <div key={bucket.day.toISOString()} className="group relative border-l border-[#1e2d40] px-1 py-1" onClick={() => setSelectedDayIndex(dayIndex)}>
                                  {slotAppointments.length === 0 ? (
                                    <button
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        setSelectedDayIndex(dayIndex);
                                        openCreateAppointmentDialog(bucket.day);
                                      }}
                                      className="absolute right-1 top-1 hidden h-5 w-5 items-center justify-center rounded-md bg-[#1e2d40] text-gray-400 group-hover:flex hover:text-blue-400"
                                      aria-label="Add appointment"
                                    >
                                      <Plus className="h-3 w-3" />
                                    </button>
                                  ) : null}
                                  {slotAppointments.slice(0, 2).map((appointment) => renderAppointmentCard(appointment, true))}
                                </div>
                              );
                            })}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                  <div className="flex justify-end border-t border-[#15304f] px-4 py-2">
                    <button className="flex items-center gap-2 rounded-lg border border-[#183657] bg-[#071321] px-3 py-2 text-xs text-gray-300 hover:bg-[#102944]">
                      <Settings2 className="h-3.5 w-3.5 text-blue-300" />
                      Manage calendars
                    </button>
                  </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            {selectedDay ? (
              <Card className="rounded-xl border-[#15304f] bg-[#071321]">
                <CardContent className="space-y-3 pt-4">
                  <div>
                    <p className="text-sm font-semibold text-gray-100">
                      {selectedDay.day.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
                    </p>
                    <div className="mt-0.5 flex items-center gap-1.5">
                      <span className={`h-1.5 w-1.5 rounded-full ${selectedDay.capacity >= 100 ? "bg-red-400" : selectedDay.capacity >= 80 ? "bg-amber-400" : "bg-emerald-400"}`} />
                      <span className={`text-[11px] font-medium ${selectedDay.capacity >= 100 ? "text-red-400" : selectedDay.capacity >= 80 ? "text-amber-400" : "text-emerald-400"}`}>
                        {selectedDay.capacity >= 100 ? "Overbooked" : selectedDay.capacity >= 80 ? "Almost Full" : "Available"}
                      </span>
                    </div>
                  </div>

                  <div>
                    <div className="mb-1 flex justify-between text-[10px]">
                      <span className="text-gray-400">{selectedDay.appointments.length} Appointments</span>
                      <span className={selectedDay.capacity >= 100 ? "text-red-400" : selectedDay.capacity >= 80 ? "text-amber-400" : "text-emerald-400"}>
                        {selectedDay.capacity}% booked
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-[#1e2d40]">
                      <div className={`h-full transition-all ${selectedDay.capacity >= 100 ? "bg-red-500" : selectedDay.capacity >= 80 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${Math.min(selectedDay.capacity, 100)}%` }} />
                    </div>
                  </div>

                  <div className="space-y-2">
                    {selectedDay.appointments.length === 0 ? (
                      <p className="text-xs text-gray-500">No appointments scheduled.</p>
                    ) : (
                      selectedDay.appointments
                        .sort((a, b) => (a.startTime || "").localeCompare(b.startTime || ""))
                        .slice(0, 6)
                        .map((appointment) => {
                          const statusInfo = STATUS_LABELS[appointment.status] || { label: appointment.status || "Upcoming", color: "text-gray-400" };
                          return (
                            <button
                              key={appointment._id}
                              onClick={() =>
                                appointment.isCalendarEvent
                                  ? toast.info(`${appointmentTitle(appointment)} is a calendar event`)
                                  : setDetailsId(String(appointment._id))
                              }
                              className="flex w-full cursor-pointer items-center gap-2 rounded-md px-1 py-1 text-left hover:bg-[#1e2d40]"
                            >
                              <span className="w-10 shrink-0 text-[10px] text-gray-500">{(appointment.startTime || "").slice(0, 5)}</span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-xs text-gray-100">{appointmentTitle(appointment)}</span>
                                <span className="block truncate text-[10px] text-gray-500">{appointmentMeta(appointment)}</span>
                              </span>
                              <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-medium ${statusInfo.color}`}>{statusInfo.label}</span>
                            </button>
                          );
                        })
                    )}
                  </div>
                  <button className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#183657] bg-[#0b1c32] px-3 py-2 text-xs font-medium text-gray-200 hover:bg-[#102944]">
                    View full day
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </CardContent>
              </Card>
            ) : null}

            <Card className="rounded-xl border-[#15304f] bg-[#071321]">
              <CardContent className="pt-4">
                <p className="mb-3 text-xs font-medium text-gray-300">Quick Actions</p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: "Add Appointment", icon: Plus, action: () => openCreateAppointmentDialog() },
                    { label: "Add Block", icon: StopCircle, action: () => openBlockDialog("block") },
                    { label: "Add Break", icon: Coffee, action: () => openBlockDialog("break") },
                    { label: "Appointment Types", icon: Settings2, action: () => setShowAppointmentTypesDialog(true) },
                    { label: "Calendar Settings", icon: Settings, action: () => setShowCalendarSettingsDialog(true) },
                  ].map((action) => (
                    <button key={action.label} onClick={action.action} className="flex flex-col items-center gap-1.5 rounded-lg bg-[#1e2d40] p-3 transition-colors hover:bg-[#2a3547]">
                      <div className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-600/15">
                        <action.icon className="h-3.5 w-3.5 text-blue-400" />
                      </div>
                      <span className="text-center text-[10px] leading-tight text-gray-300">{action.label}</span>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-xl border-[#15304f] bg-[#071321]">
              <CardContent className="pt-4">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-medium text-gray-300">Calendar Sync</p>
                  <button onClick={() => setShowSync((value) => !value)} className="text-gray-400 hover:text-gray-200" aria-label="Toggle sync details">
                    {showSync ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  </button>
                </div>
                {showSync ? (
                  <>
                    <div className="mb-3 flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      <span className="text-[11px] text-emerald-400">Connected</span>
                    </div>
                    <div className="mb-3 flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-600 text-[11px] font-bold text-white">
                        31
                      </div>
                      <span className="text-xs text-gray-200">Google Calendar</span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 w-full text-xs"
                      onClick={() => setShowCalendarSettingsDialog(true)}
                    >
                      <RefreshCw className="mr-1 h-3 w-3" />
                      Sync Settings
                    </Button>
                  </>
                ) : null}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <Dialog open={Boolean(blockDialogType)} onOpenChange={(open) => !open && setBlockDialogType(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600/15 text-blue-400">
                {blockDialogType === "break" ? <Coffee className="h-5 w-5" /> : <StopCircle className="h-5 w-5" />}
              </div>
              <DialogTitle>{blockDialogType === "break" ? "Add Break" : "Add Block"}</DialogTitle>
            </div>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-300">Title</label>
              <Input
                value={blockTitle}
                onChange={(event) => setBlockTitle(event.target.value)}
                placeholder={blockDialogType === "break" ? "Lunch break" : "Unavailable"}
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-300">Date</label>
                <Input type="date" value={blockDate} onChange={(event) => setBlockDate(event.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-300">Start</label>
                <Input
                  type="time"
                  value={blockStartTime}
                  onChange={(event) => {
                    const next = event.target.value;
                    setBlockStartTime(next);
                    if (minutesBetweenTimes(next, blockEndTime) <= 0) {
                      setBlockEndTime(addMinutesToTime(next, blockDialogType === "break" ? 30 : 60));
                    }
                  }}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-300">End</label>
                <Input type="time" value={blockEndTime} onChange={(event) => setBlockEndTime(event.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-300">Notes</label>
              <textarea
                value={blockNotes}
                onChange={(event) => setBlockNotes(event.target.value)}
                placeholder="Optional notes..."
                className="min-h-[92px] w-full rounded-lg border border-[#2a3547] bg-[#0d1526] px-3 py-2 text-sm text-gray-200 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            {minutesBetweenTimes(blockStartTime, blockEndTime) <= 0 ? (
              <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                End time must be after start time.
              </p>
            ) : null}
            <div className="flex items-center justify-between border-t border-[#1e2d40] pt-4">
              <p className="text-[11px] text-gray-500">
                Duration: {Math.max(0, minutesBetweenTimes(blockStartTime, blockEndTime))} min
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setBlockDialogType(null)} disabled={blockMutation.isPending}>
                  Cancel
                </Button>
                <Button
                  onClick={() => blockMutation.mutate()}
                  disabled={!blockDate || !blockTitle.trim() || minutesBetweenTimes(blockStartTime, blockEndTime) <= 0 || blockMutation.isPending}
                >
                  {blockMutation.isPending ? "Saving..." : blockDialogType === "break" ? "Add Break" : "Add Block"}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showAppointmentTypesDialog} onOpenChange={setShowAppointmentTypesDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600/15 text-blue-400">
                <Settings2 className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle>Appointment Types</DialogTitle>
                <p className="mt-1 text-xs text-gray-500">
                  Define the meeting types partners can create from this calendar.
                </p>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-[minmax(0,1.2fr)_90px_90px_100px] gap-2 px-2 text-[10px] font-medium uppercase tracking-wide text-gray-500">
              <span>Type</span>
              <span>Duration</span>
              <span>Visible To</span>
              <span>Color</span>
            </div>
            <div className="space-y-2">
              {appointmentTypes.map((type) => (
                <div
                  key={type.name}
                  className="grid grid-cols-[minmax(0,1.2fr)_90px_90px_100px] items-center gap-2 rounded-lg border border-[#1e2d40] bg-[#0d1a2d] p-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-gray-100">{type.name}</p>
                    <p className="truncate text-[11px] text-gray-500">
                      Used for scheduling, filters, and calendar color rules.
                    </p>
                  </div>
                  <span className="text-xs text-gray-300">{type.duration}</span>
                  <span className="text-xs text-gray-300">{type.visibility}</span>
                  <div className="flex items-center gap-2">
                    <span className="h-5 w-5 rounded-full border border-white/20" style={{ backgroundColor: type.color }} />
                    <span className="text-[10px] text-gray-500">{type.color}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid gap-3 rounded-lg border border-dashed border-[#24405f] bg-[#071321] p-3 md:grid-cols-[minmax(0,1fr)_110px_110px_84px]">
              <Input
                value={newAppointmentType}
                onChange={(event) => setNewAppointmentType(event.target.value)}
                placeholder="New type name"
              />
              <select
                value={newAppointmentTypeDuration}
                onChange={(event) => setNewAppointmentTypeDuration(event.target.value)}
                className="h-10 rounded-lg border border-[#2a3547] bg-[#0d1526] px-3 text-xs text-gray-200 outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option>30 min</option>
                <option>45 min</option>
                <option>60 min</option>
                <option>90 min</option>
              </select>
              <select
                value={newAppointmentTypeVisibility}
                onChange={(event) => setNewAppointmentTypeVisibility(event.target.value)}
                className="h-10 rounded-lg border border-[#2a3547] bg-[#0d1526] px-3 text-xs text-gray-200 outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option>Customer</option>
                <option>Partner</option>
                <option>Team</option>
              </select>
              <Button
                onClick={() => {
                  if (!newAppointmentType.trim()) {
                    toast.error("Type name is required");
                    return;
                  }
                  setAppointmentTypes((current) => [
                    ...current,
                    {
                      name: newAppointmentType.trim(),
                      duration: newAppointmentTypeDuration,
                      visibility: newAppointmentTypeVisibility,
                      color: newAppointmentTypeColor,
                    },
                  ]);
                  setNewAppointmentType("");
                  toast.success("Appointment type added");
                }}
                className="h-10 text-xs"
              >
                Add
              </Button>
            </div>
            <div className="flex items-center gap-2 px-1">
              <span className="text-xs text-gray-500">New type color</span>
              <input
                type="color"
                value={newAppointmentTypeColor}
                onChange={(event) => setNewAppointmentTypeColor(event.target.value)}
                className="h-8 w-12 rounded border border-[#2a3547] bg-[#0d1526]"
              />
            </div>
            <div className="flex items-center justify-between border-t border-[#1e2d40] pt-4">
              <p className="text-[11px] text-gray-500">
                Types are used by Create Appointment, filters, and event color rules.
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowAppointmentTypesDialog(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    window.localStorage.setItem(
                      "sales-partner-appointment-types",
                      JSON.stringify(appointmentTypes)
                    );
                    toast.success("Appointment type settings saved");
                    setShowAppointmentTypesDialog(false);
                  }}
                >
                  Save Types
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showCalendarSettingsDialog} onOpenChange={setShowCalendarSettingsDialog}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600/15 text-blue-400">
                <Settings className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle>Calendar Settings</DialogTitle>
                <p className="mt-1 text-xs text-gray-500">
                  Configure scheduling, Google sync, availability, and booking defaults for this sales calendar.
                </p>
              </div>
            </div>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="space-y-3 rounded-xl border border-[#1e2d40] bg-[#0d1a2d] p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-100">
                <CalendarDays className="h-4 w-4 text-blue-400" />
                Calendar Display
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="space-y-1.5">
                  <span className="text-xs text-gray-400">Default view</span>
                  <select
                    value={calendarSettings.defaultView}
                    onChange={(event) => updateCalendarSetting("defaultView", event.target.value)}
                    className="h-10 w-full rounded-lg border border-[#2a3547] bg-[#0d1526] px-3 text-sm text-gray-200 outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {VIEWS.map((option) => (
                      <option key={option}>{option}</option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1.5">
                  <span className="text-xs text-gray-400">Event density</span>
                  <select
                    value={calendarSettings.eventDensity}
                    onChange={(event) => updateCalendarSetting("eventDensity", event.target.value)}
                    className="h-10 w-full rounded-lg border border-[#2a3547] bg-[#0d1526] px-3 text-sm text-gray-200 outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option>Compact</option>
                    <option>Comfortable</option>
                    <option>Detailed</option>
                  </select>
                </label>
                <label className="space-y-1.5">
                  <span className="text-xs text-gray-400">Week starts on</span>
                  <select
                    value={calendarSettings.weekStartsOn}
                    onChange={(event) => updateCalendarSetting("weekStartsOn", event.target.value)}
                    className="h-10 w-full rounded-lg border border-[#2a3547] bg-[#0d1526] px-3 text-sm text-gray-200 outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option>Monday</option>
                    <option>Sunday</option>
                    <option>Saturday</option>
                  </select>
                </label>
                <label className="space-y-1.5">
                  <span className="text-xs text-gray-400">Timezone</span>
                  <select
                    value={calendarSettings.timeZone}
                    onChange={(event) => updateCalendarSetting("timeZone", event.target.value)}
                    className="h-10 w-full rounded-lg border border-[#2a3547] bg-[#0d1526] px-3 text-sm text-gray-200 outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option>Asia/Dhaka</option>
                    <option>America/New_York</option>
                    <option>Europe/London</option>
                    <option>UTC</option>
                  </select>
                </label>
              </div>
              <label className="flex items-center justify-between rounded-lg border border-[#203651] bg-[#071321] px-3 py-2">
                <span className="text-xs text-gray-300">Show weekends</span>
                <input
                  type="checkbox"
                  checked={calendarSettings.showWeekends}
                  onChange={(event) => updateCalendarSetting("showWeekends", event.target.checked)}
                  className="h-4 w-4 rounded border-[#2a3547] bg-[#0d1526]"
                />
              </label>
              <label className="flex items-center justify-between rounded-lg border border-[#203651] bg-[#071321] px-3 py-2">
                <span className="text-xs text-gray-300">Show declined or cancelled appointments</span>
                <input
                  type="checkbox"
                  checked={calendarSettings.showDeclined}
                  onChange={(event) => updateCalendarSetting("showDeclined", event.target.checked)}
                  className="h-4 w-4 rounded border-[#2a3547] bg-[#0d1526]"
                />
              </label>
            </div>

            <div className="space-y-3 rounded-xl border border-[#1e2d40] bg-[#0d1a2d] p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-100">
                <Bell className="h-4 w-4 text-blue-400" />
                Scheduling Defaults
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="space-y-1.5">
                  <span className="text-xs text-gray-400">Default duration</span>
                  <select
                    value={calendarSettings.defaultDuration}
                    onChange={(event) => updateCalendarSetting("defaultDuration", event.target.value)}
                    className="h-10 w-full rounded-lg border border-[#2a3547] bg-[#0d1526] px-3 text-sm text-gray-200 outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="15">15 min</option>
                    <option value="30">30 min</option>
                    <option value="45">45 min</option>
                    <option value="60">60 min</option>
                    <option value="90">90 min</option>
                  </select>
                </label>
                <label className="space-y-1.5">
                  <span className="text-xs text-gray-400">Default reminder</span>
                  <select
                    value={calendarSettings.reminder}
                    onChange={(event) => updateCalendarSetting("reminder", event.target.value)}
                    className="h-10 w-full rounded-lg border border-[#2a3547] bg-[#0d1526] px-3 text-sm text-gray-200 outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="0">At start time</option>
                    <option value="5">5 min before</option>
                    <option value="15">15 min before</option>
                    <option value="30">30 min before</option>
                    <option value="60">1 hour before</option>
                  </select>
                </label>
                <label className="space-y-1.5">
                  <span className="text-xs text-gray-400">Working start</span>
                  <Input
                    type="time"
                    value={calendarSettings.workingStart}
                    onChange={(event) => updateCalendarSetting("workingStart", event.target.value)}
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="text-xs text-gray-400">Working end</span>
                  <Input
                    type="time"
                    value={calendarSettings.workingEnd}
                    onChange={(event) => updateCalendarSetting("workingEnd", event.target.value)}
                  />
                </label>
              </div>
              <label className="flex items-center justify-between rounded-lg border border-[#203651] bg-[#071321] px-3 py-2">
                <span className="text-xs text-gray-300">Public booking link enabled</span>
                <input
                  type="checkbox"
                  checked={calendarSettings.publicBooking}
                  onChange={(event) => updateCalendarSetting("publicBooking", event.target.checked)}
                  className="h-4 w-4 rounded border-[#2a3547] bg-[#0d1526]"
                />
              </label>
              <label className="flex items-center justify-between rounded-lg border border-[#203651] bg-[#071321] px-3 py-2">
                <span className="text-xs text-gray-300">Auto-accept appointments inside availability</span>
                <input
                  type="checkbox"
                  checked={calendarSettings.autoAccept}
                  onChange={(event) => updateCalendarSetting("autoAccept", event.target.checked)}
                  className="h-4 w-4 rounded border-[#2a3547] bg-[#0d1526]"
                />
              </label>
            </div>

            <div className="space-y-3 rounded-xl border border-[#1e2d40] bg-[#0d1a2d] p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-100">
                <Globe2 className="h-4 w-4 text-blue-400" />
                Google Calendar Sync
              </div>
              <label className="flex items-center justify-between rounded-lg border border-[#203651] bg-[#071321] px-3 py-2">
                <span className="text-xs text-gray-300">Two-way Google sync</span>
                <input
                  type="checkbox"
                  checked={calendarSettings.syncGoogle}
                  onChange={(event) => updateCalendarSetting("syncGoogle", event.target.checked)}
                  className="h-4 w-4 rounded border-[#2a3547] bg-[#0d1526]"
                />
              </label>
              <div className="grid gap-2 text-xs text-gray-400">
                <div className="flex items-center gap-2 rounded-lg border border-[#203651] bg-[#071321] px-3 py-2">
                  <RefreshCw className="h-3.5 w-3.5 text-blue-400" />
                  Sync appointments, blocks, breaks, and status changes.
                </div>
                <div className="flex items-center gap-2 rounded-lg border border-[#203651] bg-[#071321] px-3 py-2">
                  <Palette className="h-3.5 w-3.5 text-blue-400" />
                  Match event colors with appointment type colors.
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-9 w-full text-xs"
                onClick={() => syncMutation.mutate()}
                disabled={syncMutation.isPending}
              >
                <RefreshCw className="mr-1 h-3.5 w-3.5" />
                {syncMutation.isPending ? "Syncing..." : "Sync Google Calendar Now"}
              </Button>
            </div>

            <div className="space-y-3 rounded-xl border border-[#1e2d40] bg-[#0d1a2d] p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-100">
                <ShieldCheck className="h-4 w-4 text-blue-400" />
                Access and Visibility
              </div>
              <div className="grid gap-2 text-xs text-gray-400">
                <div className="flex items-center gap-2 rounded-lg border border-[#203651] bg-[#071321] px-3 py-2">
                  <Eye className="h-3.5 w-3.5 text-blue-400" />
                  My calendar: full create, edit, reschedule, and cancel access.
                </div>
                <div className="flex items-center gap-2 rounded-lg border border-[#203651] bg-[#071321] px-3 py-2">
                  <User className="h-3.5 w-3.5 text-blue-400" />
                  Team calendars: view-only unless admin grants permission.
                </div>
              </div>
              <div className="rounded-lg border border-[#203651] bg-[#071321] p-3">
                <p className="text-xs font-medium text-gray-300">Booking link</p>
                <p className="mt-1 truncate text-[11px] text-blue-300">
                  /booking/sales-partner/{session?.user?.name?.toLowerCase().replace(/\s+/g, "-") || "partner"}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-[#1e2d40] pt-4">
            <p className="text-[11px] text-gray-500">
              These settings define calendar behavior for the Sales Partner dashboard.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowCalendarSettingsDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  window.localStorage.setItem(
                    "sales-partner-calendar-settings",
                    JSON.stringify(calendarSettings)
                  );
                  toast.success("Calendar settings saved");
                  setShowCalendarSettingsDialog(false);
                }}
              >
                Save Settings
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <CreateAppointmentDialog
        key={appointmentDefaultDate?.toISOString() || "today"}
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        defaultDate={appointmentDefaultDate}
      />

      <AppointmentDetailsDialog
        open={Boolean(detailsId)}
        onOpenChange={(open) => {
          if (!open) setDetailsId(null);
        }}
        appointmentId={detailsId}
      />
    </div>
  );
}
