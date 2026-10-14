# Design System — 嘻哈笔记 HipHop 中文站

中文说唱 / 街舞 / 潮流文化资讯站。设计语言：暗黑街头 × 金色点缀 × 噪点质感。
灵感来源：Spotify（内容优先的暗黑 + 单一强调色纪律）、The Verge（等宽大写标签、耳语与呐喊的对比）、Nike（巨型大写展示字体）。

## 1. Visual Theme

近黑画布上的街头杂志。UI 退后，内容发光。金色是唯一的强调色，只用于功能性高亮
（CTA、激活态、关键标签），绝不做装饰性大面积铺色。

## 2. Color Palette

| Token       | Value              | 用途                     |
|-------------|--------------------|--------------------------|
| 背景        | 黑灰渐变 `#1e1e24 → #0d0d10`（fixed） | 页面底色（用户要求不用纯黑） |
| `--panel`   | `#17171c`          | 卡片底                   |
| `--panel-2` | `#202028`          | 悬浮/次级面板            |
| `--ink`     | `#f5f4f0`          | 主文字（纸白）           |
| `--muted`   | `#9b9ba3`          | 次级文字                 |
| `--acc`     | `#ffe600`          | 电光黄：点缀色（Genius 式），只用于 kicker、评分、按钮、批注 |
| `--red`     | `#ff4b2e`          | 警示/新人标签            |
| `--line`    | `rgba(255,255,255,0.12)` | 1px 发丝边框       |

来源：2026-10-14 用户要求融合 Complex / The Fader / Pitchfork / XXL / Genius 五家优点并创新，
风格上偏向 Complex（杂志式栏目密度、大特稿、粗黑标题）。
- Complex：封面特稿 hero、kicker 栏目头（Fresh / Hot 100 / Freshman / Annotated…）+ View All
- Pitchfork：`.score` 黄色评分徽章（frontmatter `score` 有值才渲染，绝不编造分数）
- XXL：招牌企划气质（地下新声 = 我们的 Freshman List）
- Genius：电光黄点缀 + 歌词批注（`mark.anno` 黄线高亮 + `.anno-card` 批注卡）
- The Fader：字体即设计，编辑留白节奏
- 创新：`.waveform` 黄色波形条——全站签名元素（采样考古母题），首页歌词区与 CTA 各一处

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

- **按钮**：8px 小圆角。主按钮电光黄底黑字，hover 反白；幽灵按钮发丝边框，hover 边框变黄。
- **卡片**：12px 圆角，1px 发丝边框，扁平无阴影；头图为深灰渐变 art 块 + 大写首字（黄色款轮换出现）；hover 上浮 + 黄色边框。
- **栏目头**（Complex 式）：黄色 kicker 标签 + Anton 大标题 + 右侧 View All。
- **榜单行**：序号 + 标题/元信息 + →；`score` frontmatter 有值时显示 Pitchfork 式黄色评分徽章（无值不渲染，绝不编造）。
- **歌词批注**：`mark.anno` 黄线高亮 + `.anno-card` 批注卡（采样/双关/典故标签）。
- **文章配图**：`image` frontmatter；卡片/头图有图则渲染真图（`object-fit: cover`，hover 放大），无图回退灰盒首字。
  2026-10-14 起用 Wikimedia Commons 真实照片直链（upload.wikimedia.org，稳定可热链）：
  入坑指南=Young Thug 演出现场、Rapeter=underground 演出、Higher Brothers=Icebox 2019、歌词解析=黑胶、每周推荐=DJ 台。
  教训：AI 生成的 5 张配图因传不进 GitHub 未上线（二进制经 MCP API 必坏、Cloudflare 钥匙失效、浏览器无登录态），
  暂存 static/images/art/ 本地，以后有传输通道再换。
- **专属鼠标**：黄点 + 光环（无辉光），点击涟漪。仅精确指针设备。
- **Logo**：笔刷 H 的 SVG（电光黄），hover 旋转。
- **导航**：小字粗体，hover 下划线展开变黄。

## 5. Layout

- `--wrap: 1200px` 居中容器；8px 基准间距。
- 首页结构（2026-10-14 结构重写，不再是统一卡片流）：
  masthead → 非对称 hero（1 大特稿 + 2 次条）→ marquee →
  双栏：左信息流（资讯横排 feed-row / 地下新声 Freshman 四宫格 / 歌词解析 / 艺人厂牌）
  + 右 sticky 栏（Hot 100 榜单 rail-box + 订阅 rail-box）→
  演出日历 → 互动实验室 → CTA。
- 栏目头：黄色 kicker 标签 + Anton 大标题 + 右侧 View All。
- 移动端汉堡菜单；全站 reduced-motion 适配。

## 6. Do's and Don'ts

- Do：金色只用于功能性强调；标签一律等宽大写；展示字体只用于标题。
- Don't：不用第二强调色；不用浅色背景；按钮不用直角；正文不用 Anton；
  不在大面积色块上用金色。
