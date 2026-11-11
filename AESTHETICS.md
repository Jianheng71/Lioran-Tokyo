# Lioran—Tokyo · P5 界面与视频模板准绳

**状态**：2026-11-11（Asia/Hong_Kong）已按内阁纠令 / 废令更正。先前把 hyperkuy 当网页页架、用 Dusk Mode 做整站布局、把 Drafting Dark 代币铺到 Web UI 的写法 **一律作废，不要再执行**。  
**落地目录**：`/workspace/hyperframes/lioran-tokyo/`（不要另起目录）。  
**不要送测试成片。**

## 0. 两源怎么用（现行准绳）

| 源 | 许可 | 用在何处 | 不要做什么 |
|---|---|---|---|
| [jakobhoeg/nextjs-ollama-llm-ui](https://github.com/jakobhoeg/nextjs-ollama-llm-ui)（原 nextjs-ollama-local-ai，MIT） | MIT | **P5 整个 Web UI / 对话交互的基准**：侧栏、消息列表、气泡、顶栏、底部输入槽、自动滚动、暗色默认 | 不要另起炉灶；不要把对话嵌进 hyperkuy「页架」；不要把 Ollama 拉模型、改用户名、表情选择器等产品逻辑做成第二套应用 |
| [muhrifqie/hyperkuy](https://github.com/muhrifqie/hyperkuy)（MIT） | MIT | **只用于锁死的 9:16 视频模板**：若有现成竖屏电商排版骨架，借来只填空（标题、价格、图片等） | **不是**产品 Web UI 的整站骨架或页架；不要深度魔改该仓；不要把 66 套教育钩帧整库换进 `templates/product-promo/`；不要改已锁的 15s 时间轴、官方变量通道、通用出入场、无声 |

landing-page-design 只作卫生门控（间距、运动、焦点、`prefers-reduced-motion`、空态成句、禁套话），不决定聊天窗口长相。聊天窗口长相以 ollama-llm-ui 为基准。

## 1. P5 对话（以 ollama-llm-ui 为基准，不要另起炉灶）

打开即是 AI 对话框，不是先扔「只贴链接」的表单。

用户进入 → 短品牌空态 + 输入槽 → 提出要求 → AI **先理解全要求，确认前不爬、不渲、不入队** → 不清则追问 → 用户解答 → **确认懂了之后** 才开始做视频 → 成片在同一对话里播放或下载（作为对话里的预览，而不是 Dusk Mode 式「制品卡页架」）→ 再改一句仍先理解、必要时追问、确认后再增量重渲。

界面零件直接沿用该仓：

- 可缩放会话侧栏（桌面可收；手机让路给主列）
- 顶栏、消息列表、聊天气泡、底部输入槽
- 暗色默认（该仓 `defaultTheme="dark"`）

要改的只是产品身份与交互，不是另做一套布局：字标改为 **Lioran—Tokyo**；输入槽是唯一主输入（占位示例：「用这个链接做一条促销片，价格保留日元。」）；助手的追问与「请确认」在层级上分开，确认是主按钮；进度、错误、成片预览出现在对话流里。

## 2. 视频模板（hyperkuy 只借电商骨架，只填空）

翰林院已通读 hyperkuy 的 66 条目录：**没有**现成的「竖屏电商促销」可渲染模板（标题 + 价格 + 商品图 + CTA 一套）。绝大多数是教育钩帧；唯一带价格卡的 **Sticker Collage** 还是 reference，没有 HTML 模板，且不能深度魔改去造一套。

因此现行做法：

- **锁死并沿用** 本目录已有的 `templates/product-promo/` 作为 9:16 电商填空骨架。它已具备只填空所需槽位：`brand`、`title`、`headline`、`price`、`compareAtPrice`、`cta`、`tagline`、`caption1–3`、`urlHost`、`brandMark`（Logo 优先，否则主图）、`background`、`accent`、`locale`。
- 不要用 Drafting Dark / Dusk Mode / 其它教育钩帧去重做或换掉这条促销模板。
- 填空只走官方 `--variables-file` / `--strict-variables`。不要深度改 hyperkuy 源仓。

不可以改：`data-duration`、三段 0–1.125 / 1.125–10.5 / 10.5–15、1080×1920、30fps、官方变量绑定、通用「Logo 优先否则主图 + 品牌名」出入场、无声、并发锁。片上文案语言跟随商品页；须保住 CJK（已有 Noto Sans SC）。

若之后总督点名某一套 hyperkuy 可渲染模板、并确认它适合电商填空，再单开替换，不在本期自行挑选教育钩帧顶替。

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
4. 视频仍是锁死的 `product-promo` 填空模板，时间轴与官方变量通道未被打开；没有把 hyperkuy 教育钩帧整库或 Dusk Mode / Drafting Dark 搬进 Web UI。
5. 未送测试成片。

## 5. 已废条目（勿再执行）

- 把 hyperkuy 当整站设计排版或网页页架，并把 P5 对话框嵌进去。
- 用 Dusk Mode 做 Web 页架（对话 + 制品卡布局）。
- 把 Drafting Dark 色板 / 字体铺到聊天窗口。
