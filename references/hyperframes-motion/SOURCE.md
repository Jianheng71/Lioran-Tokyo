# SOURCE.md — hyperframes-motion 四套社区模版对照（不是 Web 页架）

| 项 | 内容 |
|----|------|
| 仓库 | https://github.com/2boysfromtown/hyperframes-motion |
| 星数 | 9（GitHub API，2026-11-11，Asia/Hong_Kong） |
| 许可 | MIT · Copyright (c) 2026 2 Boys From Town (2BFT)（见 `LICENSE`；`NOTICE` 含署名与第三方说明） |
| 分支 | `main` |
| SHA | `83cfdad9a4f2e6c370c8e3356401bdc705905f67`（2026-10-24 21:00 Asia/Hong_Kong） |

本目录落下该仓全部四套现成 HTML 模版及其声明依赖，供工部改成可填空出片模版。不要改、不要替换已锁的 `templates/product-promo/`（它仍保留，但出片不再是「只用它」）。不要当 Web UI 页架，不要另起产品目录。

对照副本在 `/workspace/vendor/lioran-tokyo-aesthetic/hyperframes-motion/`。

## 给工部：四套都要改成可填空模版

这些文件是独立 HTML + GSAP 页（GSAP 3.14.2 从 jsDelivr 加载，并以 `window.__timelines` 挂时间轴），**还不是**官方 `--variables-file` / `--strict-variables` 填空模板。工部改可填空模版时以本目录原样文件为源，不要覆盖 `templates/product-promo/`。

| 文件 | blob SHA | 场次 / 时长提示 | 可改节点（非正式 variables） | 声明依赖 |
|------|----------|-----------------|------------------------------|----------|
| `templates/cinematic-product.html` | `01e08374d41dd1115c51d5ea6e7ba74a166da069` | 四场，源码 `sceneDuration = [4, 5, 5, 4]`，约 18 秒 | `#brandLogo`、`#tagline`、`.product-badge`、`#productIcon`、`#productName`、`#productSubtitle`、`#featuresTitle` 与三列 `.feature-item`、`#ctaTitle`、`#ctaSubtitle`、`#ctaButton`、`#ctaUrl` | `../css/motion-effects.css`、`../js/text-animations.js`、GSAP CDN |
| `templates/kinetic-typo.html` | `eb05757a7b9c0553c60fd4a8e68a8c7b570381cd` | 四场，无总时长声明；时间轴靠 `onComplete` 串场 | `#impact1`（CREATE）、`#dont` / `#settle`、`#highlightBox` 内 span（FOR AVERAGE）、`#brand`（STASHED）、`#cta` | `../css/motion-effects.css`、`../js/text-animations.js`、GSAP CDN |
| `templates/brand-story.html` | `85175f4dd0432f856abf24a1090e268e641e6fe0` | 四场，无总时长声明；淡入较慢 | 文案几乎没有独立 id：欢迎标题里的 `BRAND`、第一场 `.story-text`、第二场故事段、第三场 `.highlight`（PASSION / YOU）、第四场 `JOURNEY`、`#cta` | `../css/motion-effects.css`、GSAP CDN（无 `text-animations.js`） |
| `templates/social-ad.html` | `e43edc74ce9192af0d6fba663321318311ab7455` | 三场；`#comp` 写明 `data-width="1080"` `data-height="1920"` `data-duration="15"`，是四套里唯一自带 15s / 1080×1920 声明的 | `#c1` 两行 `.big`（FLASH / SALE）、`#c2` `.product`（🎒）、`#c3` `.cta`（50% OFF）与 `.btn`（SHOP NOW） | 仅 GSAP CDN（无本地 css/js） |

另外三套场景容器是 `100vw × 100vh`，没有写死 1080×1920。`text-animations.js` 已被 cinematic-product 与 kinetic-typo 声明引用，但这两份内联时间轴并未直接调用其中 helper；仍按原样保留。

## 本目录文件

| 文件 | 用处 |
|------|------|
| `templates/cinematic-product.html` | 电影感产品揭示（原样） |
| `templates/kinetic-typo.html` | 动态字体钩句（原样） |
| `templates/brand-story.html` | 品牌故事（原样） |
| `templates/social-ad.html` | 社交广告（原样；15s / 1080×1920） |
| `css/motion-effects.css` | 声明样式依赖（原样） |
| `js/text-animations.js` | 声明脚本依赖（原样） |
| `LICENSE` | MIT 全文，署名时必须保留 |
| `NOTICE` | 署名与第三方说明 |

## 未搬

- `SKILL.md`（本轮不装 skill）
- `media/cover.png`、`media/social.png`（仓库宣传图，不是这些 HTML 的运行依赖）
- GSAP 本体（渲染时从 jsDelivr 加载，未纳入本树）

未删除、未改写 `templates/product-promo/`。
