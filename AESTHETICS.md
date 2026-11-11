# Lioran—Tokyo · P5 界面与视频模板准绳

**状态**：2026-11-11（Asia/Hong_Kong）。总督已定并再确认，准绳就此锁死：视频模板用官方 HyperFrames `product-promo` 变量模板只填空，走官方 `--variables-file` / `--strict-variables`，钉死 `hyperframes@0.9.32`；不要改用 hyperkuy 或其他非官方变量模板。不要再候总督点名骨架，也不要把候选清单再转呈点名。P5 对话框与页架边界仍按已收紧文本：对话框只按 nextjs-ollama-llm-ui。先前「按 hyperkuy 准备借用骨架、候总督点名」以及「先不按已锁死只用 product-promo 执行」的写法 **一律作废，不要再执行**。  
**落地目录**：`/workspace/hyperframes/lioran-tokyo/`（不要另起目录）。  
**不要送测试成片。**

## 0. 两源怎么用（现行准绳）

| 源 | 许可 | 用在何处 | 不要做什么 |
|---|---|---|---|
| [jakobhoeg/nextjs-ollama-llm-ui](https://github.com/jakobhoeg/nextjs-ollama-llm-ui)（原 nextjs-ollama-local-ai，MIT） | MIT | **P5 整个 Web UI / 对话交互的基准**：侧栏、消息列表、气泡、顶栏、底部输入槽、自动滚动、暗色默认 | 不要另起炉灶；不要把对话嵌进 hyperkuy「页架」；不要把 Ollama 拉模型、改用户名、表情选择器等产品逻辑做成第二套应用 |
| [muhrifqie/hyperkuy](https://github.com/muhrifqie/hyperkuy)（MIT） | MIT | **仅可作对照参考，不作出片模板、不换模板，也不是 Web 页架。** 出片锁用官方 HyperFrames `templates/product-promo/` 只填空 | 不要再按它准备或改用其 9:16 骨架；不要用它或其他非官方变量模板出片；不要深度魔改该仓；不要把它当产品 Web UI 的整站骨架或页架；不要改已锁的 15s 时间轴、官方变量通道、通用出入场、无声 |

**页架边界**：Web 结构只取 nextjs-ollama-llm-ui，不要另起页架，也不要把对话框嵌进 hyperkuy。Dusk Mode 仅是气质参考（暗色对话 + 制品卡），不是可实施的页架，不要按它搭 Web 布局。片上继续用官方 HyperFrames `templates/product-promo/` 只填空，不再改用 hyperkuy 的 9:16 骨架，也不再按 hyperkuy 准备。

landing-page-design 只作卫生门控（间距、运动、焦点、`prefers-reduced-motion`、空态成句、禁套话），不决定聊天窗口长相。聊天窗口长相以 ollama-llm-ui 为基准。

## 1. P5 对话（以 ollama-llm-ui 为基准，不要另起炉灶）

打开即是 AI 对话框，不是先扔「只贴链接」的表单。

用户进入 → 短品牌空态 + 输入槽 → 提出要求 → AI **先理解全要求，确认前不爬、不渲、不入队** → 不清则追问 → 用户解答 → **确认懂了之后** 才开始做视频 → 成片在同一对话里播放或下载（作为对话里的预览；Dusk Mode 只是气质参考，不要按其制品卡页架来搭界面）→ 再改一句仍先理解、必要时追问、确认后再增量重渲。

界面零件直接沿用该仓：

- 可缩放会话侧栏（桌面可收；手机让路给主列）
- 顶栏、消息列表、聊天气泡、底部输入槽
- 暗色默认（该仓 `defaultTheme="dark"`）

要改的只是产品身份与交互，不是另做一套布局：字标改为 **Lioran—Tokyo**；输入槽是唯一主输入（占位示例：「用这个链接做一条促销片，价格保留日元。」）；助手的追问与「请确认」在层级上分开，确认是主按钮；进度、错误、成片预览出现在对话流里。

## 2. 视频模板（总督已定：官方 `product-promo` 只填空）

**总督已定，就此锁死**：用官方 HyperFrames `templates/product-promo/` 变量模板只填空；渲染走官方 `--variables-file` / `--strict-variables`；钉死 `hyperframes@0.9.32`（不要 bump）。不要改用 hyperkuy 或其他非官方变量模板，不要再按 hyperkuy 准备，不要再候点名或建议换模板。不要用教育钩帧或 Drafting Dark / Dusk Mode 去重做或换掉这条促销模板。`references/hyperkuy/` 仅对照参考，不作出片模板。

它已具备只填空所需槽位：`brand`、`title`、`headline`、`price`、`compareAtPrice`、`cta`、`tagline`、`caption1–3`、`urlHost`、`brandMark`（Logo 优先，否则主图）、`background`、`accent`、`locale`。

不可以改：`data-duration`、三段 0–1.125 / 1.125–10.5 / 10.5–15、1080×1920、30fps、官方变量绑定、通用「Logo 优先否则主图 + 品牌名」出入场、无声、并发锁。片上文案语言跟随商品页；须保住 CJK（已有 Noto Sans SC）。

## 3. 卫生门控

- 间距：0、2、4、8、12、16、24、32、40、48、64、80、96 px。
- 按钮内边距：垂直 8px、水平 12px。
- 运动：`cubic-bezier(0.22, 1, 0.36, 1)`；只动画 transform 与 opacity；尊重 `prefers-reduced-motion`。
- 可见焦点环；加载用与布局同形的骨架；错误写在行内且具体（不要 `alert()`）。
- 不写 revolutionize / supercharge / cutting edge / effortless 一类。专有名词 **Lioran—Tokyo** 保留。
- 语义 HTML、跳过链接、favicon、`<title>`，本地工具 noindex。短页脚可链到 README「只用于你有权使用的页面」。

## 4. 审点（出样后按此过关或驳回）

1. 打开就是对话，首屏没有抢戏的贴链表单；布局能看出是 ollama-llm-ui 的聊天窗口，而不是另起的页架，也不是 hyperkuy 钩帧套壳。
2. 确认之前不会进入爬取或渲染；确认主按钮清楚。
3. 成片在同一对话里可看可下；再改一句仍先确认。
4. 视频仍是官方 HyperFrames `product-promo` 填空模板，`hyperframes@0.9.32`，走官方 `--variables-file` / `--strict-variables`；时间轴与官方变量通道未被打开；没有改用 hyperkuy 或其他非官方变量模板，也没有把 hyperkuy 或 Dusk Mode 页架搬进 Web UI。Drafting Dark 语言不铺到聊天窗口。
5. 未送测试成片。

## 5. 已废条目（勿再执行）

- 把 hyperkuy 当整站设计排版或网页页架，并把 P5 对话框嵌进去。
- 用 Dusk Mode 做 Web 页架（对话 + 制品卡布局）。Dusk Mode 仅可作气质参考，不是可实施的页架。
- 把 Drafting Dark 色板 / 字体铺到聊天窗口。
- 改用 hyperkuy 的 9:16 骨架或其他非官方变量模板替换 `product-promo`，或再按 hyperkuy 准备 / 候点名 / 转呈候选清单。
- 「先不按已锁死只用 product-promo 执行」（与总督令相反，已更正）。
