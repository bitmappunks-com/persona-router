interface Props {
  kind: "chats" | "contacts";
}

export function EmptyPane({ kind }: Props) {
  return (
    <section className="wx-empty-pane">
      <div className="wx-empty-mark" aria-hidden="true">
        {kind === "chats" ? "💬" : "👥"}
      </div>
      <h2>{kind === "chats" ? "Persona Router" : "通讯录"}</h2>
      <p>
        {kind === "chats"
          ? "从左侧选择一个聊天，或点 + 发起新聊天"
          : "选择一位成员查看资料，或发起单聊"}
      </p>
    </section>
  );
}
