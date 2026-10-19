# 音频语种与中英文标签体系核验

结果生成时间：2026-10-20T00:43:16.799933+08:00（UTC+8）。基础文件索引与规模统计沿用 2026-10-16 快照。

逐文件三个独立音频窗口的模型抽查；不是整文件纯语种认证。

## 核心结论

wavs_zh 共 2,448 个文件：中文候选 1,913，英语候选 49，其他语种候选 6，混合／冲突或证据不足／未查 480。不能据目录名称认定全部为纯中文。

wavs 主目录已检出 185 个中文候选，因此中文候选不只存在于 wavs_zh。未被判为中文也不代表整片没有中文。

wavs_zh 的配对字幕中，2,392 份汉字字幕为主；另外 56 份没有可解析字幕，已额外检查为0字节空 SRT。这些不能算英文字幕。

原 SCP 名称中的 zh 也不是可靠的声学中文判定。字幕可能是翻译、配音配套或不完整，实际语音可以是中文、英语或其他语言。

## 四种证据分开看

| 目录 | 文件数 | 原清单 zh | 汉字字幕为主 | 音频已查 | 中文候选 | 英语候选 | 其他语种候选 | 待核／未查 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| wavs | 18,066 | 617 | 0 | 18,066 | 185 | 14,995 | 253 | 2,633 |
| wavs_zh | 2,448 | 0 | 2,392 | 2,448 | 1,913 | 49 | 6 | 480 |

## 中英文标签体系如何区分

标签文字与音频语种分开记录：英文／拉丁字母型描述经常包含人物名、发声方式、音乐或环境事件；中文／汉字型描述中也混有人物名、国语／台语／英语等语种提示、NVV、配乐与音效。它们不是两套已验证的标准情绪标签。

用同一事件类别建立语义映射，例如 laugh/chuckle 与笑声/咯咯笑，sigh 与叹气／叹息，music 与配乐／乐声。保留原文、规则版本和各目录分别计数，不把语种提示当整文件语言，也不把人名当全局说话人 ID。

### wavs 的文字类型

| 类型 | 不同原始描述 | 出现次数 |
|---|---:|---:|
| latin | 262,510 | 2,623,530 |
| han | 0 | 0 |
| han_latin_mixed | 0 | 0 |
| kana_or_mixed | 0 | 0 |
| other | 68 | 7,134 |

常见汉字型：

常见拉丁字母型：[chuckles], [sighs], [laughs], [gasps], [grunts], [man], [laughing], [narrator], [laughter], [groans]

### wavs_zh 的文字类型

| 类型 | 不同原始描述 | 出现次数 |
|---|---:|---:|
| latin | 1 | 15 |
| han | 13,699 | 57,930 |
| han_latin_mixed | 14 | 19 |
| kana_or_mixed | 0 | 0 |
| other | 0 | 0 |

常见汉字型：[台语], [国语], [英语], [杰伦], [克龙], [冠霖], [啵乐乐], [轻笑声], [杜哥], [念念]

常见拉丁字母型：[tb]

## 方法与边界

- 目录名、清单声明、字幕文字和实际语音是四种不同证据，不能互相替代。
- 每文件在20%、50%、80%位置各取约8秒；至少两个有效窗口一致才给出语种候选。
- 模型概率不是经校准的正确率；音乐、短语音、方言、混合语言均可能误判。
- 抽取窗口不能证明整部音频只有一种语言，也不能排除未抽到的中文。
- 汉字型标签不自动等同于中文语音；拉丁字母型标签包含英文描述、人名及其他语言。
- 中英标签语义映射不是官方双语标注、翻译验证或音轨对齐。
- 标签字典沿用方括号提取口径；其他括号语法未声称已完整覆盖。
- Whisper 的 zh 候选不能进一步认证普通话、粤语或台语等方言；字幕中的国语／台语也只是文字提示。

模型：[OpenAI Whisper](https://github.com/openai/whisper)，base；三个窗口独立检测，置信值≥0.7、no_speech概率<0.6、RMS≥0.001才纳入有效窗口。至少两个有效窗口同语种才给出候选；冲突和不足单独保留。复用既有文件头索引，权重哈希与版本见 summary.json。

## 完整下载

- [file-language-evidence-001.csv](file-language-evidence-001.csv)
- [file-language-evidence-002.csv](file-language-evidence-002.csv)
- [file-language-evidence-003.csv](file-language-evidence-003.csv)
- [file-language-evidence-004.csv](file-language-evidence-004.csv)
- [file-language-evidence-005.csv](file-language-evidence-005.csv)
- [bilingual-label-map.csv](bilingual-label-map.csv)
- [label-dictionary-latin-001.csv](label-dictionary-latin-001.csv)
- [label-dictionary-latin-002.csv](label-dictionary-latin-002.csv)
- [label-dictionary-latin-003.csv](label-dictionary-latin-003.csv)
- [label-dictionary-latin-004.csv](label-dictionary-latin-004.csv)
- [label-dictionary-latin-005.csv](label-dictionary-latin-005.csv)
- [label-dictionary-latin-006.csv](label-dictionary-latin-006.csv)
- [label-dictionary-latin-007.csv](label-dictionary-latin-007.csv)
- [label-dictionary-other-001.csv](label-dictionary-other-001.csv)
- [label-dictionary-han-001.csv](label-dictionary-han-001.csv)
- [label-dictionary-han_latin_mixed-001.csv](label-dictionary-han_latin_mixed-001.csv)
- [wavs-zh-non-chinese-candidates.csv](wavs-zh-non-chinese-candidates.csv)
- [wavs-chinese-candidates.csv](wavs-chinese-candidates.csv)
- [manifest-zh-disagreements.csv](manifest-zh-disagreements.csv)
- [audio-vs-subtitle-script.csv](audio-vs-subtitle-script.csv)
- [audio-vs-label-script.csv](audio-vs-label-script.csv)

逐文件证据 CSV 保存原始路径、清单、字幕类型、三窗口时间与模型概率。文件分片便于托管。标签字典不丢弃未知短语。所有音频候选尚未人工听审。
