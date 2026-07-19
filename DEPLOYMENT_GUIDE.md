# 阶段二部署指南：数据自动化

> 目标：每天收盘后自动爬取天天基金网净值 → 计算 → 构建 → 部署，你只需要打开网页看结果。

---

## 你需要准备

| 项目 | 说明 | 费用 |
|------|------|------|
| GitHub账号 | 代码托管平台 | 免费 |
| 一台电脑 | 首次上传代码用 | 已有 |
| 30分钟时间 | 按本指南操作 | - |

---

## 第一步：创建GitHub私密仓库

1. 打开 https://github.com/new
2. **Repository name**: `invest-portfolio`（或其他你喜欢的名字）
3. 选择 **Private**（私密！不要选Public，因为你的持仓数据在里面）
4. 勾选 **Add a README file**
5. 点击 **Create repository**

---

## 第二步：上传代码到仓库

### 方式A：用Git命令行（推荐，如果你会用git）

```bash
# 1. 进入项目目录
cd /mnt/agents/output/app

# 2. 初始化git仓库
git init

# 3. 添加远程仓库（把 YOUR_USERNAME 换成你的GitHub用户名）
git remote add origin https://github.com/YOUR_USERNAME/invest-portfolio.git

# 4. 添加所有文件
git add .

# 5. 提交
git commit -m "init: 投资决策分析模型 V3.3"

# 6. 推送到GitHub
git push -u origin main
```

### 方式B：用GitHub网页上传（不会git的选这个）

1. 打开你刚创建的仓库页面
2. 点击 **Add file** → **Upload files**
3. 把 `/mnt/agents/output/app` 目录下的所有文件拖拽上传
4. 点击 **Commit changes**

> ⚠️ 重要：不要上传 `user_data.json` 文件！这个文件包含你的私密持仓数据，后面会通过Secrets安全存储。

---

## 第三步：准备私密数据（user_data.json）

我已经帮你生成了 `user_data.json` 文件（在 `/mnt/agents/output/user_data.json`）。

这个文件包含：
- 你的基金持仓（份额、成本、成本价）
- 现金余额
- 仓位规则上限

**请检查这个文件的内容是否正确**，特别是：
- 每只基金的份额和成本
- 现金余额
- 仓位规则上限

如果有修改，用文本编辑器打开编辑后保存。

---

## 第四步：将私密数据存入GitHub Secrets

这是最**关键**的一步，确保你的持仓数据安全：

1. 打开你的GitHub仓库页面
2. 点击 **Settings**（设置）
3. 左侧菜单点击 **Secrets and variables** → **Actions**
4. 点击 **New repository secret**
5. **Name**: `USER_DATA_JSON`
6. **Value**: 打开 `user_data.json` 文件，复制全部内容，粘贴到这里
7. 点击 **Add secret**

> ✅ 这样你的持仓数据会被GitHub加密存储，任何人都看不到（包括你自己也只能看到加密后的星号）。

---

## 第五步：启用GitHub Pages

1. 在你的GitHub仓库页面，点击 **Settings**
2. 左侧菜单点击 **Pages**
3. **Source** 选择 **GitHub Actions**
4. 等待几秒，页面会刷新

---

## 第六步：手动触发第一次运行

1. 在你的GitHub仓库页面，点击 **Actions**
2. 你会看到 **Auto Update Portfolio Data** 工作流
3. 点击它，然后点击 **Run workflow** → **Run workflow**
4. 等待约2-3分钟

### 查看运行日志

点击正在运行的工作流，可以看到每一步的日志：
```
[✓] 用户数据已解密（XXXX 字节）
[ℹ] 开始获取 9 只基金的净值...
[✓] [1/9] 023902: 净值 1.6864 (2026-07-17) 涨跌 -7.76%
...
[✓] 数据已保存: src/data/portfolio_data.json
```

### 如果失败

常见失败原因：
- ** Secrets未设置**：检查 `USER_DATA_JSON` 是否正确添加
- **Python依赖安装失败**：网络问题，重试即可
- **爬取净值失败**：天天基金网临时维护，1小时后重试

---

## 第七步：验证部署

1. 工作流运行成功后，打开 **Settings** → **Pages**
2. 你会看到一个网址，如 `https://YOUR_USERNAME.github.io/invest-portfolio/`
3. 点击打开，确认数据正确
4. 输入密码 `v321` 查看

---

## 第八步：设置定时任务（已配置好）

工作流已经配置了每天自动运行：
- **时间**：每个工作日 15:35 (UTC+8)
- **频率**：周一到周五（节假日也会运行，但数据不会变化）

你可以在 `.github/workflows/auto-update.yml` 文件中修改这个时间。

---

## 日常使用流程

自动化部署后，你的日常只需要：

```
每天 16:00 后
  ↓
打开手机/电脑
  ↓
打开 https://YOUR_USERNAME.github.io/invest-portfolio/
  ↓
输入密码 v321
  ↓
查看今日数据更新
  ↓
如有预警，再找我分析
```

**你什么都不用做**，数据已经自动更新了。

---

## 如果需要更新持仓

当你的持仓发生变化（加仓/减仓/换基）：

1. 在本地修改 `user_data.json` 文件
2. 重新执行第四步（更新GitHub Secrets中的 `USER_DATA_JSON`）
3. 手动触发一次工作流运行

---

## 技术架构图

```
定时触发（每天15:35）
    │
    ▼
┌─────────────────────────────────────┐
│  GitHub Actions                     │
│                                     │
│  1. 从Secrets读取 user_data.json   │
│     （你的私密持仓数据，加密存储）   │
│                                     │
│  2. Python脚本                      │
│     → 爬取天天基金网（9只基金）     │
│     → 计算市值/盈亏/权重            │
│     → 检查仓位规则                  │
│     → 生成 portfolio_data.json      │
│                                     │
│  3. npm run build                   │
│     → TypeScript编译                │
│     → Vite打包                      │
│     → 生成 dist/ 目录               │
│                                     │
│  4. 部署到GitHub Pages              │
│     → 自动发布网页                  │
└─────────────────────────────────────┘
    │
    ▼
https://YOUR_USERNAME.github.io/invest-portfolio/
    │
    ▼
  你查看
```

---

## 费用说明

| 项目 | 费用 | 说明 |
|------|------|------|
| GitHub账号 | 免费 | |
| GitHub Actions | 免费 | 每月2000分钟，足够用 |
| GitHub Pages | 免费 | 静态网站托管 |
| GitHub Secrets | 免费 | 加密存储 |
| **总计** | **0元** | |

---

## 安全说明

1. **仓库设为Private**：代码和配置都是私密的
2. **Secrets加密存储**：user_data.json通过GitHub Secrets加密，任何人都看不到原始内容
3. **Actions运行后自动删除临时文件**：user_data.json只在运行时存在，运行后自动删除
4. **不要提交user_data.json到仓库**：已在 `.gitignore` 中排除

---

## 常见问题

**Q: 天天基金网会封IP吗？**
A: GitHub Actions的IP是动态变化的，且脚本设置了1.5秒请求间隔，一般不会被封。如果偶尔失败，重试即可。

**Q: 可以改用其他数据源吗？**
A: 可以。修改 `scripts/update_data.py` 中的 `fetch_fund_nav` 函数即可。但需先经过你验证新数据源的准确性。

**Q: 港股ETF（513120/513180）的净值怎么获取？**
A: 天天基金网也支持场内ETF，脚本中已经兼容。

**Q: 如果某一天数据获取失败怎么办？**
A: 脚本会保留上一天的数据，网页不会显示错误。你可以在Actions日志中看到失败原因。

**Q: 我想每天收到更新通知？**
A: 可以在Actions配置中添加通知步骤（邮件/微信/钉钉），后续可以帮你配置。

---

## 下一步（阶段三）

阶段二实现了**数据自动化**，阶段三可以实现**分析自动化**：

- AI自动分析信号变化
- 异常时自动发微信/邮件通知你
- 自动生成调仓建议
- 你只需确认"执行"或"跳过"

是否需要推进到阶段三，完全取决于你在阶段二的使用体验。

---

*最后更新：2026-07-17*
