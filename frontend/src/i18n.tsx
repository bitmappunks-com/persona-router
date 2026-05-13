import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";

export type Lang = "zh" | "en";

const STORAGE_KEY = "persona-router.lang";

type Messages = Record<string, string>;

const zh: Messages = {
  "nav.chats": "聊天",
  "nav.contacts": "通讯录",
  "nav.brand": "Persona Router",

  "list.search": "搜索",
  "list.new_group": "发起群聊",
  "list.empty_chats": "还没有聊天",
  "list.empty_chats_cta": "发起群聊",
  "list.empty_no_match": "没有匹配的成员",
  "list.archived_section": "已归档",
  "list.archived_show": "查看已归档 ({count})",
  "list.archived_hide": "收起已归档",
  "list.no_messages": "尚无消息",

  "section.direct_chats": "单聊",
  "section.group_chats": "群聊",

  "row.archive": "归档",
  "row.unarchive": "取消归档",
  "row.more": "更多",

  "chat.empty_title": "Persona Router",
  "chat.empty_subtitle": "从左侧选择一个聊天，或点 + 发起新聊天",
  "contacts.empty_subtitle": "选择一位成员查看资料，或发起单聊",

  "chat.opening": "打开聊天…",
  "chat.send": "发送",
  "chat.continue": "继续",
  "chat.placeholder": "输入消息",
  "chat.placeholder_empty_group": "先拉成员进群",
  "chat.write_first": "写一句话再发吧",
  "chat.add_members_first": "先把人拉进群再发",
  "chat.empty_messages_with_members": "在下方发条消息开聊",
  "chat.empty_messages_no_members": "先点右上角拉人进群",
  "chat.add_members": "+ 拉人进群",
  "chat.member_info": "群信息",
  "chat.members_count": "{count} 人",
  "chat.round_n": "第 {n} 轮",
  "chat.fact_warn": "⚠ 涉及时效/事实问题，建议外部核实",
  "chat.waiting_reply": "…正在等待回复",
  "chat.streaming": "生成中…",
  "chat.sending": "发送中…",
  "chat.no_messages": "尚无消息",
  "chat.new_chat": "新聊天",
  "chat.group_chat_count": "群聊（{count}人）",
  "chat.system_dispatcher": "调度准备",

  "status.live": "在线",
  "status.mock": "mock 模式",
  "status.ready": "就绪",

  "contact.profile": "个人资料",
  "contact.signature": "个性签名",
  "contact.boundaries": "行为边界",
  "contact.dossier": "资料",
  "contact.license": "许可证",
  "contact.source": "来源",
  "contact.commit": "提交",
  "contact.domains": "领域",
  "contact.risk_low": "低风险",
  "contact.risk_medium": "中风险",
  "contact.risk_high": "高风险",
  "contact.risk_suffix": "风险",
  "contact.send_message": "发起单聊",
  "contact.opening": "正在打开…",
  "contact.not_found": "查无此人",
  "contact.back": "← 返回通讯录",
  "contact.not_provided": "未提供",

  "drawer.title": "群成员",
  "drawer.close": "关闭",
  "drawer.back": "‹ 返回",
  "drawer.current_in_group": "当前在群 · {count}",
  "drawer.clear_all": "清空",
  "drawer.empty_active": "还没拉人，下面搜索后点 + 拉进群。",
  "drawer.invitable": "可邀请 · {count}",
  "drawer.search_placeholder": "搜索 @handle / 姓名 / 领域",
  "drawer.empty_candidates": "没有匹配的成员了。",
  "drawer.kick": "踢出群组",
  "drawer.invite": "拉进群组",
  "drawer.profile_title": "成员资料",

  "create_group.title": "选择联系人",
  "create_group.confirm": "完成",
  "create_group.cancel": "取消",
  "create_group.search": "搜索",
  "create_group.name_placeholder": "群名称（可选）",
  "create_group.selected_count": "已选 {count} 人",
  "create_group.empty_selection": "至少选择 1 位成员",

  "loading": "加载中…",
  "lang.label": "语言",
  "lang.zh": "中文",
  "lang.en": "English",
};

const en: Messages = {
  "nav.chats": "Chats",
  "nav.contacts": "Contacts",
  "nav.brand": "Persona Router",

  "list.search": "Search",
  "list.new_group": "Create group chat",
  "list.empty_chats": "No chats yet",
  "list.empty_chats_cta": "Create a group chat",
  "list.empty_no_match": "No matches",
  "list.archived_section": "Archived",
  "list.archived_show": "Show archived ({count})",
  "list.archived_hide": "Hide archived",
  "list.no_messages": "No messages",

  "section.direct_chats": "Direct",
  "section.group_chats": "Groups",

  "row.archive": "Archive",
  "row.unarchive": "Unarchive",
  "row.more": "More",

  "chat.empty_title": "Persona Router",
  "chat.empty_subtitle": "Pick a chat on the left, or tap + to start a new one",
  "contacts.empty_subtitle": "Pick a contact to view profile or start a direct chat",

  "chat.opening": "Opening chat…",
  "chat.send": "Send",
  "chat.continue": "Continue",
  "chat.placeholder": "Type a message",
  "chat.placeholder_empty_group": "Add members first",
  "chat.write_first": "Write something first",
  "chat.add_members_first": "Add members to the group first",
  "chat.empty_messages_with_members": "Send a message to start the conversation",
  "chat.empty_messages_no_members": "Tap the top-right to add members",
  "chat.add_members": "+ Add members",
  "chat.member_info": "Group info",
  "chat.members_count": "{count} members",
  "chat.round_n": "Round {n}",
  "chat.fact_warn": "⚠ Time-sensitive or factual — verify externally",
  "chat.waiting_reply": "…waiting for replies",
  "chat.streaming": "Generating…",
  "chat.sending": "Sending…",
  "chat.no_messages": "No messages",
  "chat.new_chat": "New chat",
  "chat.group_chat_count": "Group ({count})",
  "chat.system_dispatcher": "Dispatcher brief",

  "status.live": "Live",
  "status.mock": "mock mode",
  "status.ready": "Ready",

  "contact.profile": "Profile",
  "contact.signature": "Signature",
  "contact.boundaries": "Boundaries",
  "contact.dossier": "Dossier",
  "contact.license": "License",
  "contact.source": "Source",
  "contact.commit": "Commit",
  "contact.domains": "Domains",
  "contact.risk_low": "low risk",
  "contact.risk_medium": "medium risk",
  "contact.risk_high": "high risk",
  "contact.risk_suffix": "risk",
  "contact.send_message": "Send a message",
  "contact.opening": "Opening…",
  "contact.not_found": "No such contact",
  "contact.back": "← Back to contacts",
  "contact.not_provided": "not provided",

  "drawer.title": "Group members",
  "drawer.close": "Close",
  "drawer.back": "‹ Back",
  "drawer.current_in_group": "In group · {count}",
  "drawer.clear_all": "Clear",
  "drawer.empty_active": "No members yet. Search below and tap + to add.",
  "drawer.invitable": "Available · {count}",
  "drawer.search_placeholder": "Search handle / name / domain",
  "drawer.empty_candidates": "No matches.",
  "drawer.kick": "Remove from group",
  "drawer.invite": "Add to group",
  "drawer.profile_title": "Member profile",

  "create_group.title": "Pick contacts",
  "create_group.confirm": "Done",
  "create_group.cancel": "Cancel",
  "create_group.search": "Search",
  "create_group.name_placeholder": "Group name (optional)",
  "create_group.selected_count": "{count} selected",
  "create_group.empty_selection": "Pick at least one contact",

  "loading": "Loading…",
  "lang.label": "Language",
  "lang.zh": "中文",
  "lang.en": "English",
};

const dicts: Record<Lang, Messages> = { zh, en };

interface I18nValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

function initialLang(): Lang {
  if (typeof window !== "undefined") {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "zh" || stored === "en") return stored;
    const nav = window.navigator.language || "";
    if (/^zh/i.test(nav)) return "zh";
    return "en";
  }
  return "zh";
}

function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, key) =>
    key in vars ? String(vars[key]) : `{${key}}`,
  );
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, next);
    }
    if (typeof document !== "undefined") {
      document.documentElement.lang = next === "zh" ? "zh-CN" : "en";
    }
  }, []);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
    }
  }, [lang]);

  const value = useMemo<I18nValue>(() => {
    const dict = dicts[lang];
    return {
      lang,
      setLang,
      t: (key, vars) => interpolate(dict[key] ?? key, vars),
    };
  }, [lang, setLang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useI18n must be used inside I18nProvider");
  }
  return ctx;
}

export function useT() {
  return useI18n().t;
}
