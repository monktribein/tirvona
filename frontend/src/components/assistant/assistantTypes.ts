import type React from "react";

export interface AssistantUser {
  id: string;
  name: string;
  role: string;
  parkingRoles?: string[];
  email?: string;
}

export interface AssistantCartLine {
  productId: string;
  name: string;
  displayPrice: number;
  quantity: number;
}

/** What a node or loader may look at: who is asking and what the browser already holds. */
export interface AssistantContext {
  user: AssistantUser | null;
  /** Published menu overrides from Assistant Management; null = the built-in menu. */
  config: AssistantMenuConfig | null;
  /** Normalized role, or "guest" when signed out. */
  role: string;
  cart: AssistantCartLine[];
}

export interface AssistantEntryConfig {
  id: string;
  visible: boolean;
  enabled: boolean;
  order: number;
  label?: string;
}

export interface AssistantMenuConfig {
  revision: number;
  byId: Map<string, AssistantEntryConfig>;
}

export type Access = (ctx: AssistantContext) => boolean;
export type Values = Record<string, string>;

export interface ResultItem {
  id: string;
  title: string;
  subtitle?: string;
  meta?: string[];
  badge?: string;
  /** Existing page this record opens. */
  to?: string;
}

export interface ResultStat {
  label: string;
  value: string;
}

export interface ResultLink {
  label: string;
  to?: string;
  /** Client-side actions that only open existing UI; never a write. */
  action?: "openCart";
}

export interface ResultSet {
  stats?: ResultStat[];
  items?: ResultItem[];
  total?: number;
  note?: string;
  emptyText?: string;
  links?: ResultLink[];
}

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterSpec {
  key: string;
  label: string;
  type: "text" | "select" | "date";
  placeholder?: string;
  required?: boolean;
  options?: FilterOption[];
  /** Options come from an existing API; may depend on another filter's value. */
  loadOptions?: (ctx: AssistantContext, values: Values) => Promise<FilterOption[]>;
  dependsOn?: string;
}

export type Loader = (ctx: AssistantContext, values: Values) => Promise<ResultSet>;

type Icon = React.ComponentType<{ size?: number; className?: string }>;

interface BaseNode {
  id: string;
  /** Stable path id ("stays", "stays/find"), assigned once at start-up; this is what the configuration refers to. */
  pid?: string;
  label: string;
  description?: string;
  icon?: Icon;
  /** Who sees this option. Omitted = everyone, including guests. */
  access?: Access;
  /** Shown to guests, but selecting it asks them to sign in first. */
  needsLogin?: boolean;
}

export interface MenuNode extends BaseNode {
  kind: "menu";
  children: AssistantNode[];
}

export interface NavNode extends BaseNode {
  kind: "nav";
  to: string | ((ctx: AssistantContext) => string);
}

export interface DataNode extends BaseNode {
  kind: "data";
  filters?: FilterSpec[];
  load: Loader;
  /** Run as soon as it opens (default when no filter is required). */
  autoRun?: boolean;
  submitLabel?: string;
  /** Returns a message when the chosen values cannot be searched yet. */
  validate?: (values: Values) => string | null;
}

export type AssistantNode = MenuNode | NavNode | DataNode;
