import { useT } from "../i18n";

interface Props {
  kind: "chats" | "contacts";
}

export function EmptyPane({ kind }: Props) {
  const t = useT();
  return (
    <section className="wx-empty-pane">
      <div className="wx-empty-mark" aria-hidden="true">
        {kind === "chats" ? "💬" : "👥"}
      </div>
      <h2>{t("chat.empty_title")}</h2>
      <p>{kind === "chats" ? t("chat.empty_subtitle") : t("contacts.empty_subtitle")}</p>
    </section>
  );
}
