# HipHop 中文站 · 部署步骤

## 1. 推送到 GitHub（用户在自己电脑/助手协助下操作）

```bash
cd ~/workspace/hiphop-site
git remote add origin git@github.com:<你的用户名>/hiphop-site.git
git push -u origin main
```

## 2. Cloudflare Pages 连接仓库（用户在 Cloudflare 后台操作）

1. Cloudflare Dashboard → Workers & Pages → Create → Pages → Connect to Git
2. 选中 `hiphop-site` 仓库
3. 构建设置：Framework preset 选 **Hugo**（构建命令 `hugo --minify`，输出目录 `public`）
4. Deploy，拿到 `xxx.pages.dev` 地址

## 3. 域名接入（用户在 Cloudflare DNS 操作）

1. Pages 项目 → Custom domains → 添加 `hiphop.ccwu.cc`
2. Cloudflare 会自动加 CNAME 解析，等待生效
3. 以后每次 `git push` 自动重新部署

## 4. 接入 Knocket 在线客服（用户操作）

1. 去 https://knocket.trtc.io/ 注册，创建一个小部件
2. 把 `hugo.yaml` 里 `params.knocketWidgetID` 的注释去掉，填上小部件 ID
3. 在 Knocket 后台上传 FAQ/文档做 AI 知识库，绑定 Telegram 接收转人工消息
4. `git push` 后自动生效

## 本地预览

```bash
~/workspace/tools/hugo/hugo server -D
# 打开 http://localhost:1313
```
