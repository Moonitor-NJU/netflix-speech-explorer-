# Netflix Speech Explorer

独立静态科研数据探索网页，可部署到 GitHub Pages 或 Cloudflare Pages。
包含全量统计、研究标签图谱、语种核验与中英文标签独立说明目录、文件筛选、138 段短试听及 12 段约60秒多标签情境样本。
无需 ChatGPT、服务器访问权限或后端服务。

## GitHub Pages

把本目录推送到仓库后，在 **Settings → Pages → Build and deployment** 选择：

- Source: Deploy from a branch
- Branch: main
- Folder: /docs

保存后，以 GitHub Pages 返回的实际地址访问。链接复制按钮会使用当前域名和仓库路径。

## Cloudflare Pages

### 从 GitHub 自动部署

Cloudflare Dashboard → Workers & Pages → 创建 Pages 项目 → 连接本仓库：

- Framework preset: None
- Build command: 留空（或 `exit 0`）
- Build output directory: `docs`
- Production branch: `main`

### 直接上传

在 Cloudflare Pages 的 Direct Upload 中上传同包附带的 `cloudflare-pages.zip`，或上传本仓库 `docs` 文件夹。
ZIP 根目录就是 index.html，所有文件均小于 25 MiB。不要上传完整离线单文件 HTML。

### 命令行部署

```sh
npx wrangler login
npx wrangler pages deploy docs --project-name netflix-speech-explorer --branch main
```

登录授权由账号所有者完成；不需要把 API token 写入源码。

## 本地预览

```sh
python3 -m http.server 8765 --directory docs
```

## 数据说明

20,514 个 WAV 的完整文件级统计；20,360 个配对字幕；276,292 种归一化原始描述。
138 段短音频及 12 段约60秒情境样本，按字幕定位，尚未人工听审。
独立说明目录 `docs/language-audit/` 区分目录、清单、字幕文字与实际音频的模型抽查结果，并提供逐文件证据和中英标签映射。
每文件三个短窗口的语种结果不能证明整部音频语言纯度；混合及证据不足单独保留。
无试听不表示没有对应事件；类别允许交叉，不能直接相加当作全库总数。
包含可追溯的服务器路径和少量字幕、音频候选，不包含原始整片 WAV 或凭据。
素材权利归原权利人；仓库未对原音视频素材授予新的许可。

本仓库为只读分析快照。数据日期与覆盖范围以网页和 report.md 为准。
