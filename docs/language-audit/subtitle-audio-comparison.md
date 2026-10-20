# 字幕与音频语种一致性（模型候选）

更新时间：2026-10-20T17:36:55.224854+08:00

全部文件 20514；配对字幕已读 20360。

| 状态 | 文件数 |
|---|---:|
| 一致候选 | 16,713 |
| 音频候选不确定 | 2,911 |
| 字幕候选不确定 | 195 |
| 不一致候选 | 485 |
| 无配对字幕 | 154 |
| 空字幕 | 56 |

## 不一致方向

| 音频候选 | 字幕候选 | 文件数 |
|---|---|---:|
| ko | en | 185 |
| zh | en | 185 |
| en | zh | 47 |
| es | en | 14 |
| ja | en | 11 |
| th | en | 8 |
| fr | en | 5 |
| ta | en | 5 |
| tl | en | 3 |
| fr | zh | 3 |
| ms | en | 3 |
| it | en | 2 |
| hi | en | 2 |
| id | en | 2 |
| ml | en | 2 |
| pt | en | 2 |
| ar | en | 2 |
| ja | zh | 1 |
| es | zh | 1 |
| de | en | 1 |
| it | zh | 1 |

## 方法

OpenAI Whisper base；每文件20%、50%、80%位置各约8秒，沿用既有检测，不重跑音频。

langid 1.1.6，全部97种候选语言；在20%、50%、80%附近分别提取最多约1000字符对白，时间范围限制在各锚点±15%片长。去除方括号描述、HTML和带音乐符号的歌词条目。

每个窗口至少80个字母／汉字且模型归一化概率≥0.9。另要求至少12个非发声词拼写的拉丁词、至少5种不同词，或至少40个非拉丁对白字且至少12种不同字，排除大量 Ah、Hmm 等发声及重复语气字。至少两个不同文本窗口同语种、且无有效窗口冲突，才给出字幕语种候选。

仅当音频和字幕均有一致候选时比较语言代码；其余按缺字幕、空字幕、字幕不确定、音频不确定分别计数。

整文件的主语种候选比较；两侧窗口长度不同，不是逐句语言对齐或字幕翻译质量评估。

e2d675b6d0f511cbb5317b4770c9289754b7338dec97fce660ff09c91b3d95a7

caption-audio-language-comparison-1.1

文本在模型检测前统一做 Unicode NFKC、大小写折叠及常见引号归一化，避免全大写字幕的排版影响检测；展示证据仍保留原文。

文本模型：[langid.py](https://github.com/saffsd/langid.py)。仅使用本地模型，未将字幕发送至外部识别服务。

## 限制

- 两侧均为模型候选，尚未人工逐条听审；概率不是经校准的正确率。
- 音频和字幕的采样窗口长度不同，不表示同一句话已对齐；混合语言可能未被抽到。
- 一致候选不证明逐句翻译正确、字幕同步或全片语言纯度；不一致候选可能来自翻译字幕、不同配音或模型误判。
- 文字类型与语种识别不同：旧口径238个跨汉字／非汉字候选保留作对照，不与新口径相加。
- langid 的 zh 不认证普通话或具体方言；字幕中的国语、台语等说明不作为模型真值。

## 下载

- [subtitle-audio-mismatch-candidates.csv](subtitle-audio-mismatch-candidates.csv)
- [subtitle-audio-comparison-001.csv](subtitle-audio-comparison-001.csv)
- [subtitle-audio-comparison-002.csv](subtitle-audio-comparison-002.csv)
- [subtitle-audio-comparison-003.csv](subtitle-audio-comparison-003.csv)
- [subtitle-audio-comparison-004.csv](subtitle-audio-comparison-004.csv)
- [subtitle-audio-comparison-005.csv](subtitle-audio-comparison-005.csv)
