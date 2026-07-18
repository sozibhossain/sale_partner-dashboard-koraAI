/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  activityApi,
  customersApi,
  inboxApi,
  leadsApi,
  supportApi,
  workflowApi,
} from "@/lib/api";
import { Header } from "@/components/layout/header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { KoraOrb } from "@/components/kora-orb";
import { asArray, timeAgo } from "@/lib/utils";
import { toast } from "sonner";
import {
  Building2,
  CalendarCheck,
  ChevronRight,
  ClipboardEdit,
  Clock,
  FileText,
  Filter,
  Headphones,
  KeyRound,
  Lock,
  MessageSquareText,
  MoreVertical,
  Search,
  Send,
  ShieldCheck,
  Target,
  UserPlus,
} from "lucide-react";
import Image from "next/image";

type WorkflowCategory =
  | "important"
  | "customers"
  | "sales"
  | "security"
  | "support";
type FieldType =
  | "text"
  | "email"
  | "tel"
  | "select"
  | "textarea"
  | "date"
  | "datetime-local";

type WorkflowField = {
  key: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  options?: string[];
  source?: "customers" | "leads";
  required?: boolean;
};

type WorkflowStep = {
  name: string;
  description?: string;
  fields: WorkflowField[];
};

type WorkflowTemplate = {
  id: string;
  title: string;
  description: string;
  category: WorkflowCategory;
  backendCategory: string;
  priority: "urgent" | "high" | "medium" | "low";
  icon: any;
  tone: string;
  steps: WorkflowStep[];
};

const FILTERS: Array<{ value: "all" | WorkflowCategory; label: string }> = [
  { value: "all", label: "All" },
  { value: "important", label: "Important" },
  { value: "customers", label: "Customers" },
  { value: "sales", label: "Sales" },
  { value: "security", label: "Security" },
  { value: "support", label: "Support" },
];

const statusBadge: Record<
  string,
  "default" | "warning" | "success" | "destructive" | "secondary"
> = {
  open: "default",
  pending: "warning",
  in_progress: "warning",
  waiting: "secondary",
  completed: "success",
  cancelled: "secondary",
  failed: "destructive",
};

const priorityTone: Record<string, string> = {
  urgent: "text-red-400",
  high: "text-amber-400",
  medium: "text-blue-400",
  low: "text-emerald-400",
};

const WORKFLOWS: WorkflowTemplate[] = [
  {
    id: "add_new_customer",
    title: "Add New Customer",
    description: "Create a customer record and start onboarding.",
    category: "important",
    backendCategory: "customer_management",
    priority: "high",
    icon: UserPlus,
    tone: "bg-emerald-600/15 text-emerald-300",
    steps: [
      {
        name: "Customer Information",
        fields: [
          { key: "customer_name", label: "Name", type: "text", required: true },
          { key: "business_name", label: "Business Name", type: "text" },
          { key: "email", label: "Email", type: "email", required: true },
          { key: "phone", label: "Phone", type: "tel", required: true },
        ],
      },
      {
        name: "Package Selection",
        fields: [
          {
            key: "package",
            label: "Package",
            type: "select",
            options: ["Starter", "Pro", "Scale", "Enterprise"],
            required: true,
          },
        ],
      },
      {
        name: "Assign Owner",
        fields: [
          {
            key: "owner",
            label: "Owner",
            type: "select",
            options: ["Partner", "Team Member"],
            required: true,
          },
        ],
      },
      { name: "Confirmation", fields: [] },
    ],
  },
  {
    id: "generate_access_code",
    title: "Generate Access Code",
    description: "Create and send an activation code.",
    category: "important",
    backendCategory: "support_actions",
    priority: "medium",
    icon: KeyRound,
    tone: "bg-blue-600/15 text-blue-300",
    steps: [
      {
        name: "Select Customer",
        fields: [
          {
            key: "customer_id",
            label: "Customer",
            type: "select",
            source: "customers",
            required: true,
          },
        ],
      },
      {
        name: "Generate Code",
        fields: [
          {
            key: "code_type",
            label: "Code Type",
            type: "select",
            options: ["Activation", "Password Reset", "Device Login"],
            required: true,
          },
        ],
      },
      {
        name: "Send",
        fields: [
          {
            key: "channel",
            label: "Send Via",
            type: "select",
            options: ["Email", "SMS"],
            required: true,
          },
        ],
      },
    ],
  },
  {
    id: "edit_organization_data",
    title: "Edit Organization Data",
    description: "Update customer contact and company details.",
    category: "important",
    backendCategory: "customer_management",
    priority: "medium",
    icon: Building2,
    tone: "bg-purple-600/15 text-purple-300",
    steps: [
      {
        name: "Select Customer",
        fields: [
          {
            key: "customer_id",
            label: "Customer",
            type: "select",
            source: "customers",
            required: true,
          },
        ],
      },
      {
        name: "Organization Details",
        fields: [
          { key: "company_name", label: "Company Name", type: "text" },
          { key: "address", label: "Address", type: "text" },
          { key: "contact_person", label: "Contact Person", type: "text" },
          { key: "phone", label: "Phone", type: "tel" },
          { key: "email", label: "Email", type: "email" },
        ],
      },
      { name: "Confirmation", fields: [] },
    ],
  },
  {
    id: "login_access_help",
    title: "Login / Access Help",
    description: "Reset login, resend access, or unlock access requests.",
    category: "support",
    backendCategory: "support_actions",
    priority: "high",
    icon: Headphones,
    tone: "bg-orange-600/15 text-orange-300",
    steps: [
      {
        name: "Select Customer",
        fields: [
          {
            key: "customer_id",
            label: "Customer",
            type: "select",
            source: "customers",
            required: true,
          },
        ],
      },
      {
        name: "Select Issue",
        fields: [
          {
            key: "issue",
            label: "Issue",
            type: "select",
            options: [
              "Forgot Password",
              "Login Failed",
              "MFA Issue",
              "Locked Account",
            ],
            required: true,
          },
        ],
      },
      {
        name: "Resolution",
        fields: [
          {
            key: "resolution",
            label: "Resolution",
            type: "select",
            options: [
              "Reset Password",
              "Send Login Link",
              "Unlock Account Request",
            ],
            required: true,
          },
        ],
      },
      { name: "Confirm Action", fields: [] },
    ],
  },
  {
    id: "calendar_booking_fix",
    title: "Calendar / Booking Fix",
    description: "Create a support action for appointment sync issues.",
    category: "support",
    backendCategory: "support_actions",
    priority: "medium",
    icon: CalendarCheck,
    tone: "bg-cyan-600/15 text-cyan-300",
    steps: [
      {
        name: "Issue Type",
        fields: [
          {
            key: "issue",
            label: "Issue",
            type: "select",
            options: [
              "Missing Appointment",
              "Double Booking",
              "Availability Issue",
              "Sync Issue",
            ],
            required: true,
          },
        ],
      },
      {
        name: "Details",
        fields: [
          {
            key: "details",
            label: "Details",
            type: "textarea",
            required: true,
          },
        ],
      },
      { name: "Confirm", fields: [] },
    ],
  },
  {
    id: "create_appointment",
    title: "Create Appointment",
    description: "Fast appointment workflow with confirmation.",
    category: "support",
    backendCategory: "support_actions",
    priority: "medium",
    icon: CalendarCheck,
    tone: "bg-purple-600/15 text-purple-300",
    steps: [
      {
        name: "Select Customer",
        fields: [
          {
            key: "customer_id",
            label: "Customer",
            type: "select",
            source: "customers",
            required: true,
          },
        ],
      },
      {
        name: "Service",
        fields: [
          { key: "service", label: "Service", type: "text", required: true },
        ],
      },
      {
        name: "Time",
        fields: [
          {
            key: "appointment_time",
            label: "Time",
            type: "datetime-local",
            required: true,
          },
        ],
      },
      { name: "Confirm", fields: [] },
    ],
  },
  {
    id: "send_message",
    title: "Send Message",
    description: "Prepare a guided customer communication.",
    category: "support",
    backendCategory: "support_actions",
    priority: "medium",
    icon: MessageSquareText,
    tone: "bg-cyan-600/15 text-cyan-300",
    steps: [
      {
        name: "Select Customer",
        fields: [
          {
            key: "customer_id",
            label: "Customer",
            type: "select",
            source: "customers",
            required: true,
          },
        ],
      },
      {
        name: "Template",
        fields: [
          {
            key: "template",
            label: "Template",
            type: "select",
            options: [
              "Follow Up",
              "Appointment Reminder",
              "Access Help",
              "Custom",
            ],
            required: true,
          },
        ],
      },
      {
        name: "Message",
        fields: [
          {
            key: "message",
            label: "Message",
            type: "textarea",
            required: true,
          },
        ],
      },
      {
        name: "Send",
        fields: [
          {
            key: "channel",
            label: "Channel",
            type: "select",
            options: ["Internal Chat", "Email", "SMS"],
            required: true,
          },
        ],
      },
    ],
  },
  {
    id: "change_lead_status",
    title: "Change Lead Status",
    description: "Update a lead pipeline stage and log the action.",
    category: "sales",
    backendCategory: "sales_control",
    priority: "medium",
    icon: Filter,
    tone: "bg-amber-600/15 text-amber-300",
    steps: [
      {
        name: "Select Lead",
        fields: [
          {
            key: "lead_id",
            label: "Lead",
            type: "select",
            source: "leads",
            required: true,
          },
        ],
      },
      {
        name: "New Status",
        fields: [
          {
            key: "status",
            label: "Status",
            type: "select",
            options: [
              "new",
              "contacted",
              "qualified",
              "proposal",
              "won",
              "lost",
            ],
            required: true,
          },
        ],
      },
      { name: "Confirm", fields: [] },
    ],
  },
  {
    id: "add_note_call_log",
    title: "Add Note / Call Log",
    description: "Record calls, meetings, and internal notes.",
    category: "sales",
    backendCategory: "sales_control",
    priority: "low",
    icon: FileText,
    tone: "bg-blue-600/15 text-blue-300",
    steps: [
      {
        name: "Select Customer",
        fields: [
          {
            key: "customer_id",
            label: "Customer",
            type: "select",
            source: "customers",
            required: true,
          },
        ],
      },
      {
        name: "Type",
        fields: [
          {
            key: "type",
            label: "Type",
            type: "select",
            options: ["Call", "Meeting", "Internal Note"],
            required: true,
          },
        ],
      },
      {
        name: "Details",
        fields: [
          {
            key: "details",
            label: "Details",
            type: "textarea",
            required: true,
          },
        ],
      },
      { name: "Save", fields: [] },
    ],
  },
  {
    id: "assign_task",
    title: "Assign Task",
    description: "Create a customer or lead task with a due date.",
    category: "sales",
    backendCategory: "sales_control",
    priority: "medium",
    icon: ClipboardEdit,
    tone: "bg-emerald-600/15 text-emerald-300",
    steps: [
      {
        name: "Task",
        fields: [
          { key: "title", label: "Task Title", type: "text", required: true },
          {
            key: "related_to",
            label: "Related To",
            type: "select",
            options: ["Customer", "Lead", "Internal"],
            required: true,
          },
        ],
      },
      {
        name: "Details",
        fields: [
          { key: "description", label: "Description", type: "textarea" },
          { key: "due_date", label: "Due Date", type: "date" },
        ],
      },
      { name: "Confirm", fields: [] },
    ],
  },
  {
    id: "follow_up",
    title: "Follow Up",
    description: "Create a follow-up reminder and activity entry.",
    category: "sales",
    backendCategory: "sales_control",
    priority: "medium",
    icon: Target,
    tone: "bg-violet-600/15 text-violet-300",
    steps: [
      {
        name: "Subject",
        fields: [
          { key: "subject", label: "Subject", type: "text", required: true },
        ],
      },
      {
        name: "Reason",
        fields: [
          {
            key: "reason",
            label: "Reason",
            type: "select",
            options: ["Customer inactive", "Lead waiting", "Proposal pending"],
            required: true,
          },
        ],
      },
      {
        name: "Reminder",
        fields: [
          {
            key: "reminder_date",
            label: "Reminder Date",
            type: "date",
            required: true,
          },
        ],
      },
      { name: "Confirm", fields: [] },
    ],
  },
  {
    id: "emergency_lock",
    title: "Emergency Lock",
    description: "Submit a security lock request for admin review.",
    category: "security",
    backendCategory: "system_operations",
    priority: "urgent",
    icon: Lock,
    tone: "bg-red-600/15 text-red-300",
    steps: [
      {
        name: "Select Customer",
        fields: [
          {
            key: "customer_id",
            label: "Customer",
            type: "select",
            source: "customers",
            required: true,
          },
        ],
      },
      {
        name: "Reason",
        fields: [
          { key: "reason", label: "Reason", type: "textarea", required: true },
        ],
      },
      {
        name: "Submit Request",
        description: "Administrators must approve before any lock is executed.",
        fields: [],
      },
    ],
  },
  {
    id: "impersonate_customer",
    title: "Impersonate Customer",
    description: "Request temporary customer-approved support access.",
    category: "security",
    backendCategory: "system_operations",
    priority: "high",
    icon: ShieldCheck,
    tone: "bg-blue-600/15 text-blue-300",
    steps: [
      {
        name: "Select Customer",
        fields: [
          {
            key: "customer_id",
            label: "Customer",
            type: "select",
            source: "customers",
            required: true,
          },
        ],
      },
      {
        name: "Reason Required",
        fields: [
          { key: "reason", label: "Reason", type: "textarea", required: true },
        ],
      },
      {
        name: "Customer Approval",
        description: "Customer approval is required before access is granted.",
        fields: [],
      },
      {
        name: "Temporary Session",
        description: "Session is logged, audited, and time limited.",
        fields: [],
      },
    ],
  },
];

const categoryTitles: Record<WorkflowCategory, string> = {
  important: "Important",
  customers: "Customers",
  support: "Support",
  sales: "Sales",
  security: "Security",
};

const titleCase = (value: string) =>
  String(value || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

export default function ActionsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | WorkflowCategory>("all");
  const [selected, setSelected] = useState<WorkflowTemplate | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [form, setForm] = useState<Record<string, string>>({});
  const [assistantText, setAssistantText] = useState("");

  const { data: workflowResponse, isLoading: workflowLoading } = useQuery({
    queryKey: ["actions-workflows"],
    queryFn: () =>
      workflowApi.getAll({ limit: 8 }).then((response) => response.data),
  });

  const { data: customerResponse } = useQuery({
    queryKey: ["actions-customers"],
    queryFn: () =>
      customersApi.getAll({ limit: 100 }).then((response) => response.data),
  });

  const { data: leadResponse } = useQuery({
    queryKey: ["actions-leads"],
    queryFn: () =>
      leadsApi.getAll({ limit: 100 }).then((response) => response.data),
  });

  const { data: ticketsResponse } = useQuery({
    queryKey: ["actions-tickets"],
    queryFn: () =>
      supportApi.getAll({ limit: 5 }).then((response) => response.data),
  });

  const { data: inboxResponse } = useQuery({
    queryKey: ["actions-inbox"],
    queryFn: () =>
      inboxApi.getChats({ limit: 5 }).then((response) => response.data),
  });

  const { data: activityResponse } = useQuery({
    queryKey: ["actions-activity"],
    queryFn: () =>
      activityApi.getAll({ limit: 5 }).then((response) => response.data),
  });

  const workflows: any[] = asArray(workflowResponse?.data);
  const customers: any[] = asArray(customerResponse?.data);
  const leads: any[] = asArray(leadResponse?.data);
  const openTickets: any[] = asArray(ticketsResponse?.data).filter(
    (ticket: any) => !["closed", "resolved"].includes(ticket.status),
  );
  const chats: any[] = asArray(inboxResponse?.data);
  const activities: any[] = asArray(activityResponse?.data);

  const filteredTemplates = useMemo(() => {
    const term = search.trim().toLowerCase();
    return WORKFLOWS.filter((workflow) => {
      const matchesFilter = filter === "all" || workflow.category === filter;
      const matchesSearch =
        !term ||
        workflow.title.toLowerCase().includes(term) ||
        workflow.description.toLowerCase().includes(term) ||
        workflow.category.toLowerCase().includes(term);
      return matchesFilter && matchesSearch;
    });
  }, [filter, search]);

  const groupedTemplates = useMemo(() => {
    return filteredTemplates.reduce<
      Record<WorkflowCategory, WorkflowTemplate[]>
    >(
      (groups, workflow) => {
        const groupKey =
          workflow.category === "customers" ? "important" : workflow.category;
        groups[groupKey] = [...(groups[groupKey] || []), workflow];
        return groups;
      },
      { important: [], customers: [], support: [], sales: [], security: [] },
    );
  }, [filteredTemplates]);

  const createWorkflowMutation = useMutation({
    mutationFn: (template: WorkflowTemplate) =>
      workflowApi.create({
        name: template.title,
        category: template.backendCategory,
        workflow_type: template.id,
        priority: template.priority,
        status: template.category === "security" ? "waiting" : "open",
        payload: form,
        steps: template.steps.map((step, index) => ({
          step_number: index + 1,
          step_name: step.name,
          completed: index <= stepIndex,
        })),
      }),
    onSuccess: () => {
      toast.success("Workflow started");
      queryClient.invalidateQueries({ queryKey: ["actions-workflows"] });
      setSelected(null);
      setStepIndex(0);
      setForm({});
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || "Could not start workflow");
    },
  });

  const openWorkflow = (workflow: WorkflowTemplate) => {
    setSelected(workflow);
    setStepIndex(0);
    setForm({});
  };

  const currentStep = selected?.steps[stepIndex];
  const isLastStep = selected ? stepIndex === selected.steps.length - 1 : false;
  const stepComplete =
    !currentStep ||
    currentStep.fields.every(
      (field) => !field.required || String(form[field.key] || "").trim(),
    );

  const updateField = (key: string, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  const selectOptions = (field: WorkflowField) => {
    if (field.options)
      return field.options.map((value) => ({ value, label: titleCase(value) }));
    if (field.source === "customers") {
      return customers.map((customer) => ({
        value: String(customer._id),
        label: customer.name || customer.email || "Customer",
      }));
    }
    if (field.source === "leads") {
      return leads.map((lead) => ({
        value: String(lead._id),
        label: lead.name || lead.company || "Lead",
      }));
    }
    return [];
  };

  const renderField = (field: WorkflowField) => {
    if (field.type === "select") {
      const options = selectOptions(field);
      return (
        <Select
          value={form[field.key] || ""}
          onValueChange={(value) => updateField(field.key, value)}
        >
          <SelectTrigger>
            <SelectValue placeholder={`Select ${field.label.toLowerCase()}`} />
          </SelectTrigger>
          <SelectContent>
            {options.length === 0 ? (
              <SelectItem value="none" disabled>
                No options available
              </SelectItem>
            ) : (
              options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      );
    }

    if (field.type === "textarea") {
      return (
        <textarea
          value={form[field.key] || ""}
          onChange={(event) => updateField(field.key, event.target.value)}
          placeholder={field.placeholder || field.label}
          className="min-h-24 w-full rounded-lg border border-[#2a3547] bg-[#0d1526] px-3 py-2 text-sm text-gray-200 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      );
    }

    return (
      <Input
        type={field.type}
        value={form[field.key] || ""}
        onChange={(event) => updateField(field.key, event.target.value)}
        placeholder={field.placeholder || field.label}
      />
    );
  };

  const assistantLaunch = () => {
    const term = assistantText.toLowerCase();
    const match =
      WORKFLOWS.find((workflow) =>
        workflow.title.toLowerCase().includes(term),
      ) ||
      WORKFLOWS.find((workflow) =>
        term.includes(workflow.title.toLowerCase().split(" ")[0]),
      ) ||
      (term.includes("appointment")
        ? WORKFLOWS.find((workflow) => workflow.id === "create_appointment")
        : term.includes("access") || term.includes("code")
          ? WORKFLOWS.find((workflow) => workflow.id === "generate_access_code")
          : term.includes("customer")
            ? WORKFLOWS.find((workflow) => workflow.id === "add_new_customer")
            : term.includes("follow")
              ? WORKFLOWS.find((workflow) => workflow.id === "follow_up")
              : null);

    if (!match) {
      toast.error("No matching workflow found");
      return;
    }
    openWorkflow(match);
    setAssistantText("");
  };

  const activeActions = workflows.filter(
    (workflow) =>
      !["completed", "cancelled", "failed"].includes(workflow.status),
  );
  const activityCount =
    activeActions.length + openTickets.length + chats.length;

  return (
    <div>
      <Header
        title="Actions"
        subtitle="Manage tasks, guided workflows, support cases, and sales processes in one place."
      />

      <div className="grid grid-cols-1 gap-5 p-3 sm:p-4 lg:grid-cols-[minmax(0,1fr)_350px] lg:p-6">
        <div className="space-y-5">
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
                <div className="relative min-w-0 flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search workflow, customer, lead, or task..."
                    className="pl-9"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  {FILTERS.map((item) => (
                    <button
                      key={item.value}
                      onClick={() => setFilter(item.value)}
                      className={`h-9 rounded-lg border px-4 text-xs font-medium transition-colors ${
                        filter === item.value
                          ? "border-blue-500 bg-blue-600 text-white"
                          : "border-[#1e2d40] bg-[#0d1526] text-gray-300 hover:bg-[#1e2d40]"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {(
            ["important", "support", "sales", "security"] as WorkflowCategory[]
          ).map((group) =>
            groupedTemplates[group].length > 0 ? (
              <section key={group}>
                <h2 className="mb-3 text-sm font-semibold text-gray-200">
                  {categoryTitles[group]}
                </h2>
                <div
                  className={`grid grid-cols-1 gap-3 ${
                    group === "security"
                      ? "md:grid-cols-2"
                      : "md:grid-cols-2 xl:grid-cols-3"
                  }`}
                >
                  {groupedTemplates[group].map((workflow) => {
                    const Icon = workflow.icon;
                    return (
                      <Card
                        key={workflow.id}
                        className="group cursor-pointer transition-colors hover:border-blue-500/50"
                        onClick={() => openWorkflow(workflow)}
                      >
                        <CardContent className="p-4">
                          <div className="mb-4 flex items-start justify-between gap-3">
                            <div
                              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${workflow.tone}`}
                            >
                              <Icon className="h-5 w-5" />
                            </div>
                            <ChevronRight className="mt-2 h-4 w-4 text-gray-500 transition-transform group-hover:translate-x-0.5 group-hover:text-gray-300" />
                          </div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-gray-100">
                              {workflow.title}
                            </p>
                            {workflow.id === "impersonate_customer" ? (
                              <Badge variant="default" className="text-[9px]">
                                New
                              </Badge>
                            ) : null}
                          </div>
                          <p className="mt-2 min-h-10 text-xs leading-5 text-gray-500">
                            {workflow.description}
                          </p>
                          <Button
                            size="sm"
                            className="mt-4 h-8 text-xs"
                            variant="outline"
                          >
                            Start Workflow
                          </Button>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </section>
            ) : null,
          )}
        </div>

        <aside className="space-y-5">
          <Card>
            <CardContent className="p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-white">
                    Active Actions
                  </p>
                  <Badge variant="secondary" className="text-[10px]">
                    {activityCount}
                  </Badge>
                </div>
                <button
                  onClick={() => router.push("/support")}
                  className="text-xs text-blue-400"
                >
                  View all
                </button>
              </div>

              <div className="space-y-1">
                {workflowLoading ? (
                  Array.from({ length: 5 }).map((_, index) => (
                    <Skeleton key={index} className="h-14 w-full" />
                  ))
                ) : activeActions.length === 0 ? (
                  <p className="rounded-lg border border-[#1e2d40] p-3 text-xs text-gray-500">
                    No active workflows.
                  </p>
                ) : (
                  activeActions.slice(0, 5).map((workflow) => (
                    <div
                      key={workflow._id}
                      className="flex items-center gap-3 border-b border-[#1e2d40] py-3 last:border-0"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-600/15 text-blue-300">
                        <Clock className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-gray-200">
                          {workflow.name}
                        </p>
                        <p className="truncate text-[10px] text-gray-500">
                          {workflow.workflow_id || titleCase(workflow.category)}
                        </p>
                        <p
                          className={`mt-1 text-[10px] ${priorityTone[workflow.priority] || "text-blue-400"}`}
                        >
                          {titleCase(workflow.priority || "medium")}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <Badge
                          variant={statusBadge[workflow.status] || "secondary"}
                          className="text-[9px]"
                        >
                          {titleCase(workflow.status)}
                        </Badge>
                        <span className="text-[10px] text-gray-500">
                          {timeAgo(workflow.createdAt)}
                        </span>
                      </div>
                      <MoreVertical className="h-4 w-4 text-gray-500" />
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  <p className="text-sm font-semibold text-white">
                    Kora Assistant
                  </p>
                </div>
                <Badge variant="success" className="text-[10px]">
                  Online
                </Badge>
              </div>
              <div className="flex gap-3 rounded-lg border border-[#1e2d40] bg-[#0d1a2d] p-3">
                <div className="hidden w-40 shrink-0 justify-center sm:flex">
                  <Image
                    src="/kora.png"
                    alt="Kora"
                    width={60}
                    height={60}
                    unoptimized
                    priority
                    className="kora-image h-15 w-15 object-contain"
                  />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-gray-200">
                    Tell Kora what workflow to start.
                  </p>
                  <p className="mt-1 text-[10px] text-gray-500">
                    Try: add customer, create appointment, follow up.
                  </p>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <Input
                  value={assistantText}
                  onChange={(event) => setAssistantText(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") assistantLaunch();
                  }}
                  placeholder="Type your request..."
                  className="h-10 text-xs"
                />
                <Button size="icon" onClick={assistantLaunch}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <p className="mb-3 text-sm font-semibold text-white">
                Workflow Signals
              </p>
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-lg border border-[#1e2d40] bg-[#0d1a2d] p-3">
                  <p className="text-lg font-bold text-blue-300">
                    {leads.length}
                  </p>
                  <p className="text-[10px] text-gray-500">Leads</p>
                </div>
                <div className="rounded-lg border border-[#1e2d40] bg-[#0d1a2d] p-3">
                  <p className="text-lg font-bold text-amber-300">
                    {openTickets.length}
                  </p>
                  <p className="text-[10px] text-gray-500">Tickets</p>
                </div>
                <div className="rounded-lg border border-[#1e2d40] bg-[#0d1a2d] p-3">
                  <p className="text-lg font-bold text-purple-300">
                    {chats.length}
                  </p>
                  <p className="text-[10px] text-gray-500">Chats</p>
                </div>
              </div>
              <div className="mt-3 space-y-2">
                {activities.slice(0, 3).map((activity) => (
                  <div
                    key={activity._id}
                    className="flex items-center gap-2 text-xs"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
                    <span className="min-w-0 flex-1 truncate text-gray-300">
                      {activity.action}
                    </span>
                    <span className="shrink-0 text-[10px] text-gray-500">
                      {timeAgo(activity.timestamp || activity.createdAt)}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>

      <Dialog
        open={Boolean(selected)}
        onOpenChange={(open) => !open && setSelected(null)}
      >
        <DialogContent className="max-w-2xl">
          {selected ? (
            <>
              <DialogHeader>
                <DialogTitle>{selected.title}</DialogTitle>
                <DialogDescription>{selected.description}</DialogDescription>
              </DialogHeader>

              <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {selected.steps.map((step, index) => (
                  <div
                    key={step.name}
                    className={`rounded-lg border p-2 ${
                      index === stepIndex
                        ? "border-blue-500 bg-blue-600/10"
                        : index < stepIndex
                          ? "border-emerald-500/40 bg-emerald-600/10"
                          : "border-[#1e2d40] bg-[#0d1a2d]"
                    }`}
                  >
                    <p className="text-[10px] text-gray-500">
                      Step {index + 1}
                    </p>
                    <p className="truncate text-xs font-medium text-gray-200">
                      {step.name}
                    </p>
                  </div>
                ))}
              </div>

              <div className="rounded-xl border border-[#1e2d40] bg-[#0d1a2d] p-4">
                <div className="mb-4">
                  <p className="text-sm font-semibold text-white">
                    {currentStep?.name}
                  </p>
                  {currentStep?.description ? (
                    <p className="mt-1 text-xs text-gray-500">
                      {currentStep.description}
                    </p>
                  ) : null}
                </div>

                {currentStep?.fields.length ? (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {currentStep.fields.map((field) => (
                      <label
                        key={field.key}
                        className={
                          field.type === "textarea" ? "sm:col-span-2" : ""
                        }
                      >
                        <span className="mb-1.5 block text-xs font-medium text-gray-300">
                          {field.label}
                          {field.required ? (
                            <span className="text-red-400"> *</span>
                          ) : null}
                        </span>
                        {renderField(field)}
                      </label>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-lg border border-[#1e2d40] bg-[#08111f] p-4 text-xs leading-5 text-gray-400">
                    Review the workflow details. Security actions are submitted
                    as requests and require admin or customer approval before
                    any sensitive operation is executed.
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() =>
                    setStepIndex((current) => Math.max(0, current - 1))
                  }
                  disabled={stepIndex === 0 || createWorkflowMutation.isPending}
                >
                  Back
                </Button>
                {isLastStep ? (
                  <Button
                    onClick={() => createWorkflowMutation.mutate(selected)}
                    disabled={!stepComplete || createWorkflowMutation.isPending}
                  >
                    {createWorkflowMutation.isPending
                      ? "Starting..."
                      : "Start Workflow"}
                  </Button>
                ) : (
                  <Button
                    onClick={() => setStepIndex((current) => current + 1)}
                    disabled={!stepComplete}
                  >
                    Continue
                  </Button>
                )}
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
