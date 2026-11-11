# SOURCE.md — P5 聊天窗口零件

| 项 | 内容 |
|----|------|
| 仓库 | https://github.com/jakobhoeg/nextjs-ollama-llm-ui |
| 旧址 | https://github.com/jakobhoeg/nextjs-ollama-local-ai（301 到上址） |
| 星数 | 1428（GitHub API，2026-11-11，Asia/Hong_Kong） |
| 许可 | MIT · Copyright (c) 2024 Jakob Hoeg Mørk（见本目录 `LICENSE`） |
| 分支 | `master` |
| SHA | `79c53f4ab0db3ebe18e9389e56eb639e1371c75f`（2025-06-05 21:13 Asia/Hong_Kong） |

本目录是落进 `/workspace/hyperframes/lioran-tokyo/` 的正式零件，供工部接入 P5 对话主界面（打开即是对话框，不是先贴链接表单）。对照副本在 `/workspace/vendor/lioran-tokyo-aesthetic/nextjs-ollama-llm-ui/`。

## 搬了什么（聊天窗口零件）

- 侧栏：`components/sidebar.tsx`、`components/sidebar-skeleton.tsx`
- 窗口骨架：`components/chat/chat-layout.tsx`、`components/chat/chat-topbar.tsx`
- 消息列：`components/chat/chat-list.tsx`、`components/chat/chat-message.tsx`、`components/ui/chat/chat-message-list.tsx`、`components/ui/chat/hooks/useAutoScroll.tsx`、`components/ui/chat/message-loading.tsx`
- 气泡：`components/ui/chat/chat-bubble.tsx`
- 输入槽：`components/ui/chat/chat-input.tsx`、`components/chat/chat-bottombar.tsx`
- 配套：`styles/globals.css`、`tailwind.config.ts`、`components.json`、`lib/utils.ts`，以及装配所需的 shadcn `components/ui/*`

## 明确不搬

Ollama 拉模型、改用户名、表情选择器、API 路由、hooks/store 等产品逻辑；不要在本目录启动成第二套应用。字标与交互按 `AESTHETICS.md` 改成 Lioran—Tokyo，不要另起布局。
