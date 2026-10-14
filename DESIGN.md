# Design System — 嘻哈笔记 HipHop 中文站

中文说唱 / 街舞 / 潮流文化资讯站。设计语言：暗黑街头 × 金色点缀 × 噪点质感。
灵感来源：Spotify（内容优先的暗黑 + 单一强调色纪律）、The Verge（等宽大写标签、耳语与呐喊的对比）、Nike（巨型大写展示字体）。

## 1. Visual Theme

近黑画布上的街头杂志。UI 退后，内容发光。金色是唯一的强调色，只用于功能性高亮
（CTA、激活态、关键标签），绝不做装饰性大面积铺色。

## 2. Color Palette

| Token       | Value              | 用途                     |
|-------------|--------------------|--------------------------|
| `--bg`      | `#0a0a0c`          | 页面底色                 |
| `--panel`   | `#131318`          | 卡片底                   |
| `--panel-2` | `#1a1a21`          | 悬浮/次级面板            |
| `--ink`     | `#f2efe6`          | 主文字（暖白）           |
| `--muted`   | `#a39e93`          | 次级文字                 |
| `--gold`    | `#f2b234`          | 唯一强调色：CTA、激活态  |
| `--gold-soft` | `#ffd166`        | 金色高光                 |
| `--red`     | `#ff4b2e`          | 警示/新人标签            |
| `--line`    | `rgba(242,239,230,0.13)` | 1px 发丝边框       |

背景点缀：低强度金色径向微光（列表页顶部）+ 全站噪点纹理。鼠标移动时金色光晕跟随
（仅 pointer:fine 设备，prefers-reduced-motion 时关闭）。

## 3. Typography

| 角色       | 字体                                                   | 规则                                    |
|------------|--------------------------------------------------------|-----------------------------------------|
| 展示字体   | `Anton`（内嵌 woff2 data URI）→ 苹方/微软雅黑 fallback | 全大写英文 + 中文标题，line-height 0.95 |
| 正文字体   | `--font-body` 系统中文栈                               | 400/700 二元字重                        |
| 标签字体   | `--font-mono` 等宽栈                                   | **所有标签类文字**：eyebrow、chip、card-meta、时间戳，大写 + 宽字距 |

- **耳语 vs 呐喊**：eyebrow 用 12px 等宽大写（letter-spacing 0.22em）耳语，
  hero 标题用 clamp(64px,13vw,168px) Anton 呐喊。
- 按钮文字字距 0.12em，系统化标签感（Spotify 式）。
- chip：11px 等宽大写，letter-spacing 0.14em，pill 形。
- 正文不使用展示字体，保持阅读性。

## 4. Components

- **按钮**：全 pill（999px）。`.btn-gold` 金底黑字，hover 上浮 + 金色光晕阴影；
  `.btn-ghost` 1px 发丝边框，hover 边框变金。
- **卡片**：`--panel` 底，`--radius: 14px`，1px 发丝边框（The Verge 式扁平深度，
  不用重阴影）；卡片头图用渐变 art 块 + 首字大写字母。
- **榜单行**（track-list）：序号 + ▶ + 标题/元信息 + →， dense 排列，Spotify 式。
- **专属鼠标**：金点 + 金色光环（hover 链接时放大），点击涟漪。仅精确指针设备。
- **Logo**：笔刷 H 的 SVG，hover 旋转 + 金色光晕。

## 5. Layout

- `--wrap: 1160px` 居中容器；8px 基准间距。
- 首页节奏：Hero（含 marquee 跑马灯）→ 最新资讯 → 本周新歌 → 地下新声 →
  艺人厂牌 → 演出日历 → 互动实验室 → 订阅 → CTA。
- section 标题格式：`大字<span>金色字</span>`（如"地下<span>新声</span>"）。
- 移动端汉堡菜单；全站 reduced-motion 适配。

## 6. Do's and Don'ts

- Do：金色只用于功能性强调；标签一律等宽大写；展示字体只用于标题。
- Don't：不用第二强调色；不用浅色背景；按钮不用直角；正文不用 Anton；
  不在大面积色块上用金色。
