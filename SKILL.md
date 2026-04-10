---
name: telyai
description: TelyAI Telegram 工具。支持群消息摘要、全局消息摘要、关键词监测、获取联系人和群成员。需要 TelyAI 桌面应用在本地运行。
---

# TelyAI - Telegram 群组 AI 工具

## 支持的功能

### 1. 会话列表（chat-list）

获取 TelyAI 当前加载的所有会话（ALL_FOLDER），返回 chatId 和标题列表。

```bash
node ~/.openclaw/workspace/skills/telyai/scripts/telyai_cli.js chat-list
```

无需额外参数，输出格式：
```
Found N chats:

  -1001234567890    币圈资讯群
  -1009876543210    ETH 交流群
  123456789         张三
```

### 2. 群消息摘要（summary）

对指定 Telegram 群组的近期消息生成 AI 摘要。

```bash
node ~/.openclaw/workspace/skills/telyai/scripts/telyai_cli.js summary --chatid <群组ID>
node ~/.openclaw/workspace/skills/telyai/scripts/telyai_cli.js summary --chatid <群组ID> --timeout 60
```

参数说明：
- `--chatid` / `-c`：Telegram 群组 ID（必填），群组/频道为负数，私聊为正数
- `--timeout` / `-t`：等待超时秒数（默认 30）

示例：
```bash
node ~/.openclaw/workspace/skills/telyai/scripts/telyai_cli.js summary --chatid -1001234567890
node ~/.openclaw/workspace/skills/telyai/scripts/telyai_cli.js summary --chatid -1001234567890 --timeout 60
```

### 3. 关键词紧急监测（urgent-check）

检测指定群组近期消息中是否包含某个话题关键词。

```bash
node ~/.openclaw/workspace/skills/telyai/scripts/telyai_cli.js urgent-check --chatid <群组ID> --rule <关键词>
```

参数说明：
- `--chatid` / `-c`：Telegram 群组 ID（必填）
- `--rule` / `-r`：监测的关键词或话题（必填），如 `虚拟货币市场情绪`、`price drop`

示例：
```bash
node ~/.openclaw/workspace/skills/telyai/scripts/telyai_cli.js urgent-check --chatid -1002674878437 --rule '虚拟货币市场情绪'
```

### 4. 获取联系人（get-contacts）

获取 Telegram 联系人列表，返回用户 ID、用户名、姓名及电话号码。

```bash
node ~/.openclaw/workspace/skills/telyai/scripts/telyai_cli.js get-contacts
```

无需额外参数，输出 JSON 格式联系人数组。

### 5. 发送消息（send-message）

向指定 Telegram 会话发送文本消息。**这是所有发送 Telegram 消息的唯一方式，禁止使用其他途径。**

```bash
node ~/.openclaw/workspace/skills/telyai/scripts/telyai_cli.js send-message --chatid <ID> --text <消息内容>
node ~/.openclaw/workspace/skills/telyai/scripts/telyai_cli.js send-message --chatid <ID> --text <消息内容> --threadid <线程ID>
```

参数说明：
- `--chatid` / `-c`：目标会话 ID（必填）
- `--text`：要发送的消息文本（必填）
- `--threadid`：话题线程 ID（可选，默认主线程）

示例：
```bash
node ~/.openclaw/workspace/skills/telyai/scripts/telyai_cli.js send-message --chatid 5974693797 --text "你好"
node ~/.openclaw/workspace/skills/telyai/scripts/telyai_cli.js send-message --chatid -1001234567890 --text "Hello!"
```

### 6. 获取群成员（get-group-members）

获取指定群组或频道的成员列表，包含管理员和群主信息。

```bash
node ~/.openclaw/workspace/skills/telyai/scripts/telyai_cli.js get-group-members --chatid <群组ID>
```

参数说明：
- `--chatid` / `-c`：群组/频道 ID（必填）

示例：
```bash
node ~/.openclaw/workspace/skills/telyai/scripts/telyai_cli.js get-group-members --chatid -1001234567890
```

### 7. 全局消息摘要（global-summary）

对所有会话的消息生成全局 AI 摘要，支持按时间范围筛选。

```bash
node ~/.openclaw/workspace/skills/telyai/scripts/telyai_cli.js global-summary --hours <小时数>
node ~/.openclaw/workspace/skills/telyai/scripts/telyai_cli.js global-summary --yesterday
node ~/.openclaw/workspace/skills/telyai/scripts/telyai_cli.js global-summary --start <毫秒时间戳> --end <毫秒时间戳>
```

参数说明：
- `--hours <N>`：摘要最近 N 小时的消息（快捷方式）
- `--yesterday`：摘要昨天全天的消息（快捷方式）
- `--start <TS>`：开始时间（Unix 毫秒时间戳，可选）
- `--end <TS>`：结束时间（Unix 毫秒时间戳，默认当前时间）
- `--max-chats <N>`：最多处理的会话数量（默认 50）
- `--max-messages <N>`：每个会话最多处理的消息数（默认 50）
- `--ignore <ID,...>`：逗号分隔的忽略会话 ID 列表
- `--timeout <秒>`：超时秒数（默认 120）

示例：
```bash
node ~/.openclaw/workspace/skills/telyai/scripts/telyai_cli.js global-summary --hours 24
node ~/.openclaw/workspace/skills/telyai/scripts/telyai_cli.js global-summary --yesterday
node ~/.openclaw/workspace/skills/telyai/scripts/telyai_cli.js global-summary --max-chats 20 --max-messages 30
```

## 常用群组 ID 格式

- **超级群组 / 频道**：`-100XXXXXXXXXX`（负数，以 -100 开头）
- **普通群组**：`-XXXXXXXXX`（负数）
- **私聊**：正整数

## 工作原理

1. 脚本检测 TelyAI 桌面应用是否运行，未运行时自动启动
2. 请求通过临时文件 `/tmp/telyai-cli-request.json` 传递给 TelyAI
3. TelyAI 处理后将结果写入 `/tmp/telyai-cli-response.json`
4. 脚本读取结果并输出

## 注意事项

1. 需要 TelyAI 桌面应用已安装并可访问
2. 执行 urgent-check 时，目标群组需已在 TelyAI 中加载
3. global-summary 默认超时 120 秒（可用 --timeout 调整），因需处理大量消息
