"use client";

import { createContext, useContext, useMemo, useSyncExternalStore } from "react";
import { clearAtpSession } from "./atp/session";
import { clearDfsSession } from "./dfs/session";
import { isKeywordOrigin, normalizeCustomers, normalizeMeasured, originLabel } from "./keyword-origin";
import { recommendFor, toStored } from "./recommend";
import { DEFAULT_SETTINGS, mergeSavedMarkets } from "./markets";
import type {
  AppState,
  CategoryId,
  CheckState,
  Customer,
  Inquiry,
  MarketId,
  MeasuredKeyword,
  SavedCase,
  SerpRow,
  Settings,
  Workspace,
} from "./types";

const KEY = "yixuan.v1";

const SEED_INQUIRY: Inquiry = {
  id: "seed-inquiry",
  title: "示例询盘 · 美国节日搞怪小礼品",
  customer: "示例客户（礼品公司）",
  market: "US",
  category: "funny",
  requirements: "美国礼品公司，想找圣诞还能出的搞怪小礼品，零售大约 15 美元，希望 FOB 在 3 美元以内，能贴牌，不要带复杂电子医疗宣称。",
  priceMin: 0.8,
  priceMax: 3,
  moq: 500,
  certs: ["CPSIA"],
  buyerType: "礼品公司",
  notes: "这是预置示例询盘，用来演示按需推荐，不是真实客户。",
  createdAt: "2026-11-26T00:00:00.000Z",
  sampleCase: true,
};

function seedState(): AppState {
  const results = toStored(recommendFor(SEED_INQUIRY)).slice(0, 5);
  const saved: SavedCase = {
    id: "seed-case",
    createdAt: "2026-11-26T00:00:00.000Z",
    inquiry: SEED_INQUIRY,
    results,
    selectedProductIds: results.slice(0, 3).map((item) => item.productId),
    note: "预置示例案例。数字仍是示例推演，不是这个客户的真实回复。",
  };
  return {
    version: 1,
    settings: DEFAULT_SETTINGS,
    workspace: {
      market: "US",
      category: "all",
      compareIds: [],
      reportProductIds: saved.selectedProductIds,
      reportCaseId: saved.id,
    },
    inquiries: [SEED_INQUIRY],
    cases: [saved],
    customers: [],
    assignCustomerId: null,
    measured: [],
    serp: [],
    notes: {},
    checks: {},
  };
}

function mergeState(raw: unknown): AppState {
  const base = seedState();
  if (!raw || typeof raw !== "object") return base;
  const data = raw as Partial<AppState>;
  const customers = normalizeCustomers(data.customers);
  const customerIds = new Set(customers.map((item) => item.id));
  const assignCustomerId = typeof data.assignCustomerId === "string" && customerIds.has(data.assignCustomerId) ? data.assignCustomerId : null;
  return {
    ...base,
    ...data,
    version: 1,
    settings: {
      ...base.settings,
      ...(data.settings ?? {}),
      markets: mergeSavedMarkets(data.settings?.markets),
    },
    workspace: { ...base.workspace, ...(data.workspace ?? {}) },
    inquiries: data.inquiries ?? base.inquiries,
    cases: data.cases ?? base.cases,
    customers,
    assignCustomerId,
    measured: normalizeMeasured(data.measured, customerIds),
    serp: data.serp ?? [],
    notes: data.notes ?? {},
    checks: data.checks ?? {},
  };
}

interface StoreValue {
  state: AppState;
  settings: Settings;
  workspace: Workspace;
  updateSettings: (patch: Partial<Settings>) => void;
  setMarket: (market: MarketId) => void;
  setCategory: (category: CategoryId | "all") => void;
  toggleCompare: (id: string) => void;
  clearCompare: () => void;
  setReportProducts: (ids: string[], caseId?: string | null) => void;
  saveCase: (inquiry: Omit<Inquiry, "id" | "createdAt" | "sampleCase">, note?: string) => string;
  deleteCase: (id: string) => void;
  addCustomer: (name: string) => { ok: true; customer: Customer } | { ok: false; message: string };
  removeCustomer: (id: string) => void;
  setAssignCustomer: (id: string | null) => void;
  addMeasured: (rows: Omit<MeasuredKeyword, "id" | "pastedAt">[]) => void;
  updateMeasured: (id: string, patch: Partial<Pick<MeasuredKeyword, "customerId" | "origin" | "keyword">>) => void;
  removeMeasured: (id: string) => void;
  addSerp: (rows: Omit<SerpRow, "id" | "pastedAt">[]) => void;
  removeSerp: (id: string) => void;
  setNote: (productId: string, body: string) => void;
  setCheck: (productId: string, label: string, patch: Partial<CheckState>) => void;
  resetAll: () => void;
}

const StoreContext = createContext<Omit<StoreValue, "state" | "settings" | "workspace"> | null>(null);

function uid(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

const SERVER_STATE = seedState();
let cachedRaw: string | null = null;
let cachedState: AppState = SERVER_STATE;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function persist(next: AppState) {
  cachedState = next;
  cachedRaw = JSON.stringify(next);
  if (typeof window !== "undefined") localStorage.setItem(KEY, cachedRaw);
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener("storage", onStorage);
    listeners.delete(listener);
  };
}

function getServerSnapshot() {
  return SERVER_STATE;
}

function getSnapshot() {
  if (typeof window === "undefined") return SERVER_STATE;
  const raw = localStorage.getItem(KEY);
  if (!raw) return SERVER_STATE;
  if (raw !== cachedRaw) {
    try {
      cachedRaw = raw;
      cachedState = mergeState(JSON.parse(raw));
    } catch {
      return SERVER_STATE;
    }
  }
  return cachedState;
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const value = useMemo<Omit<StoreValue, "state" | "settings" | "workspace">>(() => {
    const patch = (updater: (prev: AppState) => AppState) => persist(updater(getSnapshot()));
    return {
      updateSettings: (next) => patch((prev) => ({ ...prev, settings: { ...prev.settings, ...next } })),
      setMarket: (market) => patch((prev) => ({ ...prev, workspace: { ...prev.workspace, market } })),
      setCategory: (category) => patch((prev) => ({ ...prev, workspace: { ...prev.workspace, category } })),
      toggleCompare: (id) =>
        patch((prev) => {
          const has = prev.workspace.compareIds.includes(id);
          const compareIds = has
            ? prev.workspace.compareIds.filter((item) => item !== id)
            : prev.workspace.compareIds.length >= 3
              ? prev.workspace.compareIds
              : [...prev.workspace.compareIds, id];
          return { ...prev, workspace: { ...prev.workspace, compareIds } };
        }),
      clearCompare: () => patch((prev) => ({ ...prev, workspace: { ...prev.workspace, compareIds: [] } })),
      setReportProducts: (ids, caseId) =>
        patch((prev) => ({
          ...prev,
          workspace: {
            ...prev.workspace,
            reportProductIds: ids.slice(0, 8),
            reportCaseId: caseId === undefined ? prev.workspace.reportCaseId : caseId,
          },
        })),
      saveCase: (inquiryInput, note) => {
        const inquiry: Inquiry = {
          ...inquiryInput,
          id: uid("inq"),
          createdAt: new Date().toISOString(),
          sampleCase: false,
        };
        const results = toStored(recommendFor(inquiry));
        const saved: SavedCase = {
          id: uid("case"),
          createdAt: new Date().toISOString(),
          inquiry,
          results,
          selectedProductIds: results.slice(0, 3).map((item) => item.productId),
          note: note ?? "",
        };
        patch((prev) => ({
          ...prev,
          inquiries: [inquiry, ...prev.inquiries],
          cases: [saved, ...prev.cases],
          workspace: {
            ...prev.workspace,
            reportCaseId: saved.id,
            reportProductIds: saved.selectedProductIds,
            market: inquiry.market,
          },
        }));
        return saved.id;
      },
      deleteCase: (id) =>
        patch((prev) => ({
          ...prev,
          cases: prev.cases.filter((item) => item.id !== id),
          workspace:
            prev.workspace.reportCaseId === id
              ? { ...prev.workspace, reportCaseId: null }
              : prev.workspace,
        })),
      addCustomer: (name) => {
        const trimmed = name.trim().slice(0, 40);
        if (!trimmed) return { ok: false, message: "请先写客户名字。" };
        const current = getSnapshot();
        if (current.customers.some((item) => item.name === trimmed)) {
          return { ok: false, message: "已经有这个客户。" };
        }
        const customer: Customer = { id: uid("cust"), name: trimmed, createdAt: new Date().toISOString() };
        patch((prev) => ({ ...prev, customers: [...prev.customers, customer] }));
        return { ok: true, customer };
      },
      removeCustomer: (id) =>
        patch((prev) => ({
          ...prev,
          customers: prev.customers.filter((item) => item.id !== id),
          assignCustomerId: prev.assignCustomerId === id ? null : prev.assignCustomerId,
          measured: prev.measured.map((row) => (row.customerId === id ? { ...row, customerId: null } : row)),
        })),
      setAssignCustomer: (id) =>
        patch((prev) => ({
          ...prev,
          assignCustomerId: id && prev.customers.some((item) => item.id === id) ? id : null,
        })),
      addMeasured: (rows) =>
        patch((prev) => {
          const allowed = new Set(prev.customers.map((item) => item.id));
          return {
            ...prev,
            measured: [
              ...rows.map((row) => ({
                ...row,
                id: uid("kw"),
                pastedAt: new Date().toISOString(),
                origin: isKeywordOrigin(row.origin) ? row.origin : "custom",
                customerId: row.customerId && allowed.has(row.customerId) ? row.customerId : null,
                source: row.source?.trim() || originLabel(isKeywordOrigin(row.origin) ? row.origin : "custom"),
              })),
              ...prev.measured,
            ],
          };
        }),
      updateMeasured: (id, next) =>
        patch((prev) => ({
          ...prev,
          measured: prev.measured.map((row) => {
            if (row.id !== id) return row;
            const origin = next.origin && isKeywordOrigin(next.origin) ? next.origin : row.origin;
            const customerId = next.customerId === undefined
              ? row.customerId
              : next.customerId && prev.customers.some((item) => item.id === next.customerId)
                ? next.customerId
                : null;
            const keyword = next.keyword === undefined ? row.keyword : next.keyword.trim() || row.keyword;
            return {
              ...row,
              keyword,
              origin,
              customerId,
              source: next.origin && next.origin !== row.origin ? originLabel(origin) : row.source,
            };
          }),
        })),
      removeMeasured: (id) => patch((prev) => ({ ...prev, measured: prev.measured.filter((row) => row.id !== id) })),
      addSerp: (rows) =>
        patch((prev) => ({
          ...prev,
          serp: [...rows.map((row) => ({ ...row, id: uid("serp"), pastedAt: new Date().toISOString() })), ...prev.serp],
        })),
      removeSerp: (id) => patch((prev) => ({ ...prev, serp: prev.serp.filter((row) => row.id !== id) })),
      setNote: (productId, body) => patch((prev) => ({ ...prev, notes: { ...prev.notes, [productId]: body } })),
      setCheck: (productId, label, next) =>
        patch((prev) => {
          const current = prev.checks[productId]?.[label] ?? { marked: false, note: "" };
          return {
            ...prev,
            checks: {
              ...prev.checks,
              [productId]: { ...prev.checks[productId], [label]: { ...current, ...next } },
            },
          };
        }),
      resetAll: () => {
        clearAtpSession();
        clearDfsSession();
        persist(seedState());
      },
    };
  }, []);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const value = useContext(StoreContext);
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  if (!value) throw new Error("useStore 必须在 StoreProvider 内使用");
  return { ...value, state, settings: state.settings, workspace: state.workspace };
}
