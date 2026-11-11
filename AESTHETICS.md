# Lioran—Tokyo · P5 界面与视频模板准绳

**状态**：2026-11-11（Asia/Hong_Kong）。总督已确认补令：四套社区模版都要进；界面文案、对话提示、按钮改为中英双语（可切换或同屏兼顾，默认先中文）。官方 `templates/product-promo/` **不动**，仍是默认模版，仍按 `hyperframes@0.9.32` 官方变量填模；不撤、不换。除 `cinematic-product` 外，把同仓 [hyperframes-motion](https://github.com/2boysfromtown/hyperframes-motion)（MIT）的 `kinetic-typo`、`brand-story`、`social-ad` 也列为可选出片模版：保留各自幕次与观感，时长按原定（`social-ad` 15 秒、`cinematic-product` 18 秒）。不把 hyperframes-motion 当 Web UI 页架。P5 仍只按 nextjs-ollama-llm-ui；用户可指定模版，未指定时 AI 按需求选最合适的一套，主商品宣传仍默认 official product-promo。片上文字仍跟随商品页语言。双语与五套模版随已发 0.1 之后的版本一并落地，**不要改已发布的 0.1 tag**。不要再候点名或建议另换默认模版。正式 §4 审样等到工部推仓、可 clone、且五套都能选之后再进行；稳妥节奏，勿另开并行重审。此前非正式排查里的「界面中英混排」按本令改成双语方案，不再当漏洞单独催。  
**落地目录**：`/workspace/hyperframes/lioran-tokyo/`（不要另起目录）。  
**不要送测试成片。**

## 0. 两源怎么用（现行准绳）

| 源 | 许可 | 用在何处 | 不要做什么 |
|---|---|---|---|
| [jakobhoeg/nextjs-ollama-llm-ui](https://github.com/jakobhoeg/nextjs-ollama-llm-ui)（原 nextjs-ollama-local-ai，MIT） | MIT | **P5 整个 Web UI / 对话交互的基准**：侧栏、消息列表、气泡、顶栏、底部输入槽、自动滚动、暗色默认 | 不要另起炉灶；不要把对话嵌进 hyperkuy 或 hyperframes-motion「页架」；不要把 Ollama 拉模型、改用户名、表情选择器等产品逻辑做成第二套应用 |
| 官方 HyperFrames `templates/product-promo/` | 随产品仓锁定 | **默认出片模版**：只填空；渲染走官方 `--variables-file` / `--strict-variables`；钉死 `hyperframes@0.9.32` | 不撤、不换、不改已锁的 15s 时间轴与官方变量通道 |
| [2boysfromtown/hyperframes-motion](https://github.com/2boysfromtown/hyperframes-motion) 的四套 HTML（MIT，Copyright (c) 2026 2 Boys From Town (2BFT)）：`cinematic-product`、`kinetic-typo`、`brand-story`、`social-ad` | MIT | **四套可选出片模版**：保留各自幕次与观感，时长按原定 | **不是** Web UI 页架；不要拿它们替换默认的 `product-promo`；不要改幕次结构，也不要把未规定为 15 秒的套硬压成 15 秒 |
| [muhrifqie/hyperkuy](https://github.com/muhrifqie/hyperkuy)（MIT） | MIT | **仅可作对照参考**，不作出片模版、不换模版，也不是 Web 页架 | 不要再按它准备或改用其 9:16 骨架；不要深度魔改该仓；不要把它当产品 Web UI 的整站骨架或页架 |

**页架边界**：Web 结构只取 nextjs-ollama-llm-ui，不要另起页架，也不要把对话框嵌进 hyperkuy 或 hyperframes-motion。Dusk Mode 仅是气质参考（暗色对话 + 制品卡），不是可实施的页架，不要按它搭 Web 布局。片上默认仍用官方 `product-promo` 只填空；用户指定或 AI 按需求选定时，才走四套社区模版之一。主商品宣传仍默认 product-promo。

landing-page-design 只作卫生门控（间距、运动、焦点、`prefers-reduced-motion`、空态成句、禁套话），不决定聊天窗口长相。聊天窗口长相以 ollama-llm-ui 为基准。

## 1. P5 对话（以 ollama-llm-ui 为基准，不要另起炉灶）

打开即是 AI 对话框，不是先扔「只贴链接」的表单。

用户进入 → 短品牌空态 + 输入槽 → 提出要求 → AI **先理解全要求，确认前不爬、不渲、不入队** → 不清则追问（含模版：用户可指定；未指定时 AI 按需求选最合适的一套，主商品宣传仍默认 official product-promo）→ 用户解答 → **确认懂了之后** 才开始做视频 → 成片在同一对话里播放或下载（作为对话里的预览；Dusk Mode 只是气质参考，不要按其制品卡页架来搭界面）→ 再改一句仍先理解、必要时追问、确认后再增量重渲。

界面零件直接沿用该仓：

- 可缩放会话侧栏（桌面可收；手机让路给主列）
- 顶栏、消息列表、聊天气泡、底部输入槽
- 暗色默认（该仓 `defaultTheme="dark"`）

要改的只是产品身份与交互，不是另做一套布局：字标改为 **Lioran—Tokyo**；输入槽是唯一主输入（默认中文占位示例：「用这个链接做一条促销片，价格保留日元。」）；助手的追问与「请确认」在层级上分开，确认是主按钮；进度、错误、成片预览出现在对话流里。模版可在对话里指定或由 AI 按需求选择，不要把模版选择做成抢戏的首屏表单。

**中英双语**：界面文案、对话提示、按钮都要中英双语，可切换或同屏兼顾，默认先中文。专有名词 **Lioran—Tokyo** 各语言下都保留，不要翻译。不要把界面改成只中文，也不要把「中英混排」再当漏洞单独催；按本双语方案落地即可。片上文字不走这套界面双语规则，仍跟随商品页语言。本条随已发 0.1 之后、带五套模版的版本一并落地，不要改已发布的 0.1 tag。

## 2. 视频模版

共同约束：无声；1080×1920；30fps；**片上文案语言跟随商品页**（不强制中英双语）；须保住 CJK（已有 Noto Sans SC）；不要改官方变量通道的用法；并发锁仍在。落地仍在本目录，四套社区模版建议分别放在 `templates/cinematic-product/`、`templates/kinetic-typo/`、`templates/brand-story/`、`templates/social-ad/`，不要另起产品目录。保留 MIT 版权声明。一共五套可选用：默认 official product-promo，外加上述四套可选。

### 2.1 默认：官方 `product-promo`（不动）

继续用本目录已有的 `templates/product-promo/` 作为默认锁死填空模版。渲染走官方 `--variables-file` / `--strict-variables`；钉死 `hyperframes@0.9.32`（不要 bump）。不撤、不换，也不要用社区四套、hyperkuy、教育钩帧或 Drafting Dark / Dusk Mode 去重做或换掉它。主商品宣传仍默认这一套。

已有槽位：`brand`、`title`、`headline`、`price`、`compareAtPrice`、`cta`、`tagline`、`caption1–3`、`urlHost`、`brandMark`（Logo 优先，否则主图）、`background`、`accent`、`locale`。

这一套不可以改：`data-duration`、三段 0–1.125 / 1.125–10.5 / 10.5–15、官方变量绑定、通用「Logo 优先否则主图 + 品牌名」出入场。

### 2.2 可选：hyperframes-motion 四套（保留各自幕次与原定时长）

来源 [hyperframes-motion](https://github.com/2boysfromtown/hyperframes-motion)（MIT）。只作为可选出片模版接入，不把该仓当 Web UI 页架。用户可指定其中一套；未指定时 AI 按需求选最合适的一套，主商品宣传仍默认 §2.1。填空只走变量，不要改幕次结构、幕长与观感。时长按各套原定，不必把未规定为 15 秒的套硬压成 15 秒。

1. **`cinematic-product`**：四幕产品揭示（开场 Logo/品牌名 + 标语、产品卡、卖点三栏、CTA）。原时长 18 秒（4+5+5+4），不必硬压成 15 秒。
2. **`kinetic-typo`**：四幕冲击字效（冲击大字、对拆文案、高亮框、品牌名 + CTA）。保留 glitch / 逐字揭示与弹性弹跳的观感；时长按源文件原定。
3. **`brand-story`**：四幕品牌叙事（品牌开场、故事、价值、优雅 CTA）。保留渐变、视差与 clip-path 揭示的观感；时长按源文件原定。
4. **`social-ad`**：三幕闪购广告（大字标题、产品、折扣 + CTA）。保留粗体快切与转化 CTA 的观感；原时长 15 秒。

## 3. 卫生门控

- 间距：0、2、4、8、12、16、24、32、40、48、64、80、96 px。
- 按钮内边距：垂直 8px、水平 12px。
- 运动：`cubic-bezier(0.22, 1, 0.36, 1)`；只动画 transform 与 opacity；尊重 `prefers-reduced-motion`。
- 可见焦点环；加载用与布局同形的骨架；错误写在行内且具体（不要 `alert()`）。
- 不写 revolutionize / supercharge / cutting edge / effortless 一类。专有名词 **Lioran—Tokyo** 保留。
- 界面文案、对话提示、按钮按中英双语（可切换或同屏兼顾，默认先中文）；片上文字仍跟随商品页语言。
- 语义 HTML、跳过链接、favicon、`<title>`，本地工具 noindex。短页脚可链到 README「只用于你有权使用的页面」。

## 4. 审点（工部推仓、可 clone、且五套都能选后再按此过关或驳回）

1. 打开就是对话，首屏没有抢戏的贴链表单；布局能看出是 ollama-llm-ui 的聊天窗口，而不是另起的页架，也不是 hyperkuy 或 hyperframes-motion 套壳。
2. 确认之前不会进入爬取或渲染；确认主按钮清楚。
3. 成片在同一对话里可看可下；再改一句仍先确认。
4. 五套都能选。主商品宣传、以及用户未指定且需求就是主商品宣传时，默认官方 `product-promo`：`hyperframes@0.9.32`，走官方 `--variables-file` / `--strict-variables`，15s 时间轴与官方变量通道未被打开或替换。用户可指定四套社区模版之一；未指定时 AI 按需求选最合适的一套。`cinematic-product` 仍是四幕观感、时长 18 秒（4+5+5+4），没有被硬压成 15 秒；`social-ad` 仍是三幕观感、时长 15 秒；`kinetic-typo` 与 `brand-story` 各自保留四幕观感与原定时长。五套都是无声、1080×1920、30fps。没有把 hyperkuy、hyperframes-motion 或 Dusk Mode 当 Web 页架。Drafting Dark 语言不铺到聊天窗口。
5. 界面文案、对话提示、按钮为中英双语（可切换或同屏兼顾，默认先中文）；专有名词 Lioran—Tokyo 保留。片上文字仍跟随商品页语言。不要把「中英混排」再当缺陷驳回。
6. 未送测试成片。已发布的 0.1 tag 未被改写。

## 5. 已废条目（勿再执行）

- 把 hyperkuy 或 hyperframes-motion 当整站设计排版或网页页架，并把 P5 对话框嵌进去。
- 用 Dusk Mode 做 Web 页架（对话 + 制品卡布局）。Dusk Mode 仅可作气质参考，不是可实施的页架。
- 把 Drafting Dark 色板 / 字体铺到聊天窗口。
- 用 hyperkuy 的 9:16 骨架替换默认的 `product-promo`，或再按 hyperkuy 准备 / 候点名 / 转呈候选清单。
- 撤掉或换掉官方 `product-promo`，或把任一社区模版改成默认、或把 `cinematic-product` 的 18 秒硬压成 15 秒。
- 只接入 `cinematic-product`、不把 `kinetic-typo` / `brand-story` / `social-ad` 列为可选（与本次补令相反）。
- 「先不按已锁死只用 product-promo 执行」（与先前总督令相反，已更正；现仅新增四套可选，默认仍是 product-promo，主商品宣传仍默认这一套）。
- 把界面改成只中文，或把「界面中英混排」当漏洞单独催（已由总督补令改为中英双语方案，默认先中文）。
- 改写已发布的 0.1 tag 来落地双语或五套模版。
