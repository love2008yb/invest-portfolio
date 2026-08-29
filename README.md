# AI智能投资决策系统 v4.5.1

个人投资组合监控仪表盘：状态监控 + 硬约束 + 逻辑验证，不做预测、不自动交易。

## 自动化机制

- **每个交易日 21:40（北京时间）**，GitHub Actions 自动运行 `scripts/update_data.py`
- 脚本从公开数据源（天天基金 / 新浪财经，多重备用）抓取最新净值与收盘价
- 自动计算 ETF 的 MA20/60/120 与四阶段趋势状态，更新 `src/data/portfolio.json`
- 数据有变化才提交并重新部署到 GitHub Pages；无变化则跳过

## 目录说明

| 路径 | 作用 |
|------|------|
| `src/data/portfolio.json` | **唯一数据源**：持仓、净值、现金、交易记录 |
| `src/App.tsx` | 页面主逻辑（展示、计算、硬约束监控） |
| `scripts/update_data.py` | 每日数据更新脚本 |
| `.github/workflows/daily-update.yml` | 自动化工作流 |

## 持仓变动时

手动编辑 `src/data/portfolio.json`（GitHub 网页上可直接编辑）：
- 买入/卖出：修改对应基金的 `shares`、`cost`，在 `transactions` 数组追加一条记录，并扣减/增加 `cashYuebao` 或 `cashSec`
- `nav`、`prevNav`、`ma20/60/120`、`state` 等字段由脚本每日自动维护，无需手动改

## 本地开发

```bash
npm install
npm run dev        # 本地预览
npm run build      # 构建到 dist/
python scripts/update_data.py   # 手动更新数据
```
