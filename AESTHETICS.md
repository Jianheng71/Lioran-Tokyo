# Lioran—Tokyo · P5 界面与视频模板准绳

**状态**：2026-11-11（Asia/Hong_Kong）。总督已确认改顺序：**先不做**另外四套社区模版（`cinematic-product` / `kinetic-typo` / `brand-story` / `social-ad`）。先把现行 0.1（对话窗 + 官方 `product-promo`）的问题修好，修好再做那四套。四套仍在后续范围，只是现在暂缓。

本轮优先：对话页视觉与交互以 Grok 对话页为标准（布局、输入框、消息气泡、工具栏、提示文案等，Grok 对话页有的这边都要有）；产品身份仍是 Lioran—Tokyo，不要把 Grok / xAI 的标志、字标或受保护素材当可搬素材。界面文案、对话提示、按钮为中英双语（可切换或同屏兼顾，默认先中文）；片上文字仍跟随商品页语言；专有名词 Lioran—Tokyo 保留。一并收非正式美术问题：标志未接入、对话页缺 CJK（自托管 Noto Sans SC）；此前「界面中英混排」按双语方案落地，不再当漏洞单独催。文档与 `doctor` 写清 Chrome/Chromium、ffmpeg、Hermes（`http://127.0.0.1:43127`），以免再出启动失败，确认后能真正出片。

官方 `templates/product-promo/` **不动**，仍是默认模版，仍按 `hyperframes@0.9.32` 官方变量填模；不撤、不换。P5 原以 [jakobhoeg/nextjs-ollama-llm-ui](https://github.com/jakobhoeg/nextjs-ollama-llm-ui) 为底，现在视觉与交互以 Grok 对话页为标准；该仓仅可作现有代码底。不改已发布的 `v0.1.0` tag，必要时另打 0.1.x。正式 §4 审样等到本轮 0.1 修好、可 clone、确认后能真正出片之后再进行；稳妥节奏，勿另开并行重审。  
**落地目录**：`/workspace/hyperframes/lioran-tokyo/`（不要另起目录）。  
**不要送测试成片。**

## 0. 两源怎么用（现行准绳）

| 源 | 许可 | 用在何处 | 不要做什么 |
|---|---|---|---|
| Grok 对话页（视觉与交互标准） | 只作观感与交互参照，**不是**可搬运的素材库 | **本轮 P5 对话页的视觉与交互标准**：布局、输入框、消息气泡、工具栏、提示文案等，Grok 对话页有的这边都要有 | **不要**把 Grok / xAI 的标志、字标、品牌色当自家品牌、官方插画或受保护素材写入简报或产品；不要把产品做成 Grok / xAI 的换皮；身份仍是 Lioran—Tokyo（已确认的圆角方标 + 字标） |
| [jakobhoeg/nextjs-ollama-llm-ui](https://github.com/jakobhoeg/nextjs-ollama-llm-ui)（原 nextjs-ollama-local-ai，MIT） | MIT | **仅可作现有代码底**：侧栏、消息列表、气泡、顶栏、底部输入槽等零件若仍够用可以留，但长相与交互不再以它为标准 | 不要再按它的视觉当过关标准；不要把 Ollama 拉模型、改用户名、表情选择器等产品逻辑做成第二套应用；不要把它或 hyperkuy / hyperframes-motion 当必须遵守的页架 |
| 官方 HyperFrames `templates/product-promo/` | 随产品仓锁定 | **默认出片模版，本轮只修这一套**：只填空；渲染走官方 `--variables-file` / `--strict-variables`；钉死 `hyperframes@0.9.32` | 不撤、不换、不改已锁的 15s 时间轴与官方变量通道 |
| [2boysfromtown/hyperframes-motion](https://github.com/2boysfromtown/hyperframes-motion) 的四套 HTML（MIT，Copyright (c) 2026 2 Boys From Town (2BFT)）：`cinematic-product`、`kinetic-typo`、`brand-story`、`social-ad` | MIT | **后续可选出片模版**：保留各自幕次与观感，时长按原定。**本轮暂缓，先修好 0.1 再做** | **不是** Web UI 页架；本轮不要接入、不要与 0.1 修复捆在一次交付里；不要拿它们替换默认的 `product-promo` |
| [muhrifqie/hyperkuy](https://github.com/muhrifqie/hyperkuy)（MIT） | MIT | **仅可作对照参考**，不作出片模版、不换模版，也不是 Web 页架 | 不要再按它准备或改用其 9:16 骨架；不要深度魔改该仓；不要把它当产品 Web UI 的整站骨架或页架 |

**页架边界**：对话页的视觉与交互以 Grok 对话页为标准，不要另起与 Grok 对话页无关的页架，也不要把对话框嵌进 hyperkuy 或 hyperframes-motion。不要再把 nextjs-ollama-llm-ui 的长相当成必须遵守的页架。Dusk Mode 仅是气质参考（暗色对话 + 制品卡），不是可实施的页架，不要按它搭 Web 布局。产品身份仍是 Lioran—Tokyo，不要做成 Grok / xAI 换皮。本轮片上只用官方 `product-promo` 只填空。

landing-page-design 只作卫生门控（间距、运动、焦点、`prefers-reduced-motion`、空态成句、禁套话），不决定聊天窗口长相。聊天窗口长相以 Grok 对话页为标准。

## 1. P5 对话（本轮优先：视觉与交互以 Grok 对话页为标准）

打开即是 AI 对话框，不是先扔「只贴链接」的表单。对话页要完全模仿 Grok 的对话页面：布局、输入框、消息气泡、工具栏、提示文案等，Grok 对话页有的这边都要有。对照的是公开可见的对话布局与交互，不是把 Grok / xAI 的标志、字标或受保护素材搬过来。字标与图标用 **Lioran—Tokyo** 及已确认的圆角方标（白框 + 绯红竖条）。本轮要把该标志接到 favicon、侧栏与顶栏。

用户进入 → 短品牌空态 + 输入槽 → 提出要求 → AI **先理解全要求，确认前不爬、不渲、不入队** → 不清则追问（本轮未指定模版时走官方 product-promo；四套社区模版暂缓，不要在对话里先开放选用）→ 用户解答 → **确认懂了之后** 才开始做视频 → 成片在同一对话里播放或下载（作为对话里的预览；Dusk Mode 只是气质参考，不要按其制品卡页架来搭界面）→ 再改一句仍先理解、必要时追问、确认后再增量重渲。

现有 nextjs-ollama-llm-ui 零件若仍够用可以留作代码底，但要通过改到接近 Grok 对话页的布局与交互，而不是停在该仓原样：

- 会话侧栏与历史（桌面可收；手机让路给主列）
- 顶栏、消息列表、聊天气泡、底部输入槽与工具栏
- 暗色默认

输入槽是唯一主输入（默认中文占位示例：「用这个链接做一条促销片，价格保留日元。」）；助手的追问与「请确认」在层级上分开，确认是主按钮；进度、错误、成片预览出现在对话流里。

**中英双语**：界面文案、对话提示、按钮都要中英双语，可切换或同屏兼顾，默认先中文。专有名词 **Lioran—Tokyo** 各语言下都保留，不要翻译。不要把界面改成只中文，也不要把「中英混排」再当漏洞单独催；按本双语方案落地即可。片上文字不走这套界面双语规则，仍跟随商品页语言。对话页须自托管 CJK 字体（复用 `product-promo` 已有的 Noto Sans SC，不打 Google Fonts），避免中日文落到系统默认字体、和拉丁字母并排露拼贴感。

本轮随已发 `v0.1.0` 之后的 0.1.x（必要时另打）落地，**不要改已发布的 `v0.1.0` tag**。

## 2. 视频模版

共同约束：无声；1080×1920；30fps；**片上文案语言跟随商品页**（不强制中英双语）；须保住 CJK（已有 Noto Sans SC）；不要改官方变量通道的用法；并发锁仍在。落地仍在本目录。

### 2.1 本轮只修：官方 `product-promo`（不动结构）

继续用本目录已有的 `templates/product-promo/` 作为默认锁死填空模版。渲染走官方 `--variables-file` / `--strict-variables`；钉死 `hyperframes@0.9.32`（不要 bump）。不撤、不换，也不要用社区四套、hyperkuy、教育钩帧或 Drafting Dark / Dusk Mode 去重做或换掉它。本轮未指定模版时走这一套。

已有槽位：`brand`、`title`、`headline`、`price`、`compareAtPrice`、`cta`、`tagline`、`caption1–3`、`urlHost`、`brandMark`（Logo 优先，否则主图）、`background`、`accent`、`locale`。

这一套不可以改：`data-duration`、三段 0–1.125 / 1.125–10.5 / 10.5–15、官方变量绑定、通用「Logo 优先否则主图 + 品牌名」出入场。

本轮目标包括：确认之后能真正出片（不只是界面看起来能确认）。

### 2.2 后续再做（本轮暂缓）：hyperframes-motion 四套

来源 [hyperframes-motion](https://github.com/2boysfromtown/hyperframes-motion)（MIT）。只作为可选出片模版，不把该仓当 Web UI 页架。**先把现行 0.1 修好，再做这四套**；本轮不要接入。到时保留各自幕次与观感，时长按原定，不必把未规定为 15 秒的套硬压成 15 秒；落到 1080×1920，补 Noto Sans SC；kinetic 不按字母拆中日文、不用负字距挤破版心；不用 STASHED / FLASH SALE / 演示 emoji 当出片默认。

1. **`cinematic-product`**：四幕产品揭示（开场 Logo/品牌名 + 标语、产品卡、卖点三栏、CTA）。原时长 18 秒（4+5+5+4）。
2. **`kinetic-typo`**：四幕冲击字效（冲击大字、对拆文案、高亮框、品牌名 + CTA）。保留 glitch / 逐字揭示与弹性弹跳的观感。
3. **`brand-story`**：四幕品牌叙事（品牌开场、故事、价值、优雅 CTA）。保留渐变、视差与 clip-path 揭示的观感。
4. **`social-ad`**：三幕闪购广告（大字标题、产品、折扣 + CTA）。保留粗体快切与转化 CTA 的观感；原时长 15 秒。

## 3. 卫生门控

- 间距：0、2、4、8、12、16、24、32、40、48、64、80、96 px。
- 按钮内边距：垂直 8px、水平 12px。
- 运动：`cubic-bezier(0.22, 1, 0.36, 1)`；只动画 transform 与 opacity；尊重 `prefers-reduced-motion`。
- 可见焦点环；加载用与布局同形的骨架；错误写在行内且具体（不要 `alert()`）。
- 不写 revolutionize / supercharge / cutting edge / effortless 一类。专有名词 **Lioran—Tokyo** 保留。
- 界面文案、对话提示、按钮按中英双语（可切换或同屏兼顾，默认先中文）；片上文字仍跟随商品页语言。
- 语义 HTML、跳过链接、favicon、`<title>`，本地工具 noindex。短页脚可链到 README「只用于你有权使用的页面」。

## 3.1 启动与出片（本轮文档 / `doctor` 必须写清）

README 与 `doctor` 须写清本机依赖，以免再出启动失败：

- Chrome / Chromium（渲染出片用）
- ffmpeg
- Hermes，地址 `http://127.0.0.1:43127`

确认之后要能真正出片，而不是卡在缺依赖或地址不明。

## 4. 审点（本轮 0.1 修好、可 clone、确认后能真正出片后再按此过关或驳回）

1. 打开就是对话，首屏没有抢戏的贴链表单；布局、输入框、消息气泡、工具栏、提示文案能看出是在模仿 Grok 对话页，而不是停在 nextjs-ollama-llm-ui 原样，也不是另起的页架或 hyperkuy / hyperframes-motion 套壳。产品身份仍是 Lioran—Tokyo：已确认的圆角方标已接到 favicon、侧栏与顶栏；页面上没有搬用 Grok / xAI 的标志、字标或受保护素材。
2. 确认之前不会进入爬取或渲染；确认主按钮清楚。确认之后能真正出片。
3. 成片在同一对话里可看可下；再改一句仍先确认。本轮出片仍是官方 `product-promo`，`hyperframes@0.9.32`，走官方 `--variables-file` / `--strict-variables`，15s 时间轴与官方变量通道未被打开或替换。对话里尚未开放四套社区模版（本轮暂缓）。
4. 界面文案、对话提示、按钮为中英双语（可切换或同屏兼顾，默认先中文）；专有名词 Lioran—Tokyo 保留。片上文字仍跟随商品页语言。对话页已自托管 Noto Sans SC。不要把「中英混排」再当缺陷驳回。
5. 文档与 `doctor` 已写清 Chrome/Chromium、ffmpeg、Hermes（`http://127.0.0.1:43127`）。
6. 未送测试成片。已发布的 `v0.1.0` tag 未被改写；如有新版本是另打的 0.1.x。

## 5. 已废条目（勿再执行）

- 把 hyperkuy 或 hyperframes-motion 当整站设计排版或网页页架，并把 P5 对话框嵌进去。
- 用 Dusk Mode 做 Web 页架（对话 + 制品卡布局）。Dusk Mode 仅可作气质参考，不是可实施的页架。
- 把 Drafting Dark 色板 / 字体铺到聊天窗口。
- 用 hyperkuy 的 9:16 骨架替换默认的 `product-promo`，或再按 hyperkuy 准备 / 候点名 / 转呈候选清单。
- 撤掉或换掉官方 `product-promo`，或把任一社区模版改成默认、或把 `cinematic-product` 的 18 秒硬压成 15 秒。
- 本轮就把四套社区模版（`cinematic-product` / `kinetic-typo` / `brand-story` / `social-ad`）与 0.1 修复捆在一次交付里（总督已改顺序：先修 0.1，四套暂缓）。
- 「先不按已锁死只用 product-promo 执行」（与先前总督令相反，已更正；本轮默认仍是 product-promo）。
- 把界面改成只中文，或把「界面中英混排」当漏洞单独催（已由总督补令改为中英双语方案，默认先中文）。
- 改写已发布的 `v0.1.0` tag 来落地本轮修复（必要时另打 0.1.x）。
- 把 nextjs-ollama-llm-ui 的原样长相继续当作对话页过关标准（已由总督补令改为以 Grok 对话页为视觉与交互标准）。
- 把 Grok / xAI 的标志、字标或受保护素材写入简报或产品当可搬素材，或把产品做成 Grok / xAI 换皮。
