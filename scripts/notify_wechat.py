#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
每日持仓日报 → 微信推送（Server酱）
由 GitHub Actions 在数据更新后自动运行

前置条件：仓库 Settings → Secrets 中配置 SCT_SENDKEY
未配置时静默跳过，不影响主流程。
"""

import json
import os
import sys
from datetime import datetime
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parent.parent
DATA_FILE = ROOT / "src" / "data" / "portfolio.json"

STATE_ICON = {3: "🟢", 2: "🟡", 1: "🟠", 0: "🔴"}
STATE_NAME = {3: "趋势健康", 2: "趋势减弱", 1: "趋势危险", 0: "趋势破位"}


def fmt(n):
    return f"{n:,.0f}"


def fmt_signed(n):
    return f"+{n:,.0f}" if n >= 0 else f"{n:,.0f}"


def main():
    sendkey = os.environ.get("SCT_SENDKEY", "").strip()
    if not sendkey:
        print("未配置 SCT_SENDKEY，跳过微信推送")
        return 0

    with open(DATA_FILE, encoding="utf-8") as f:
        data = json.load(f)

    funds = data["funds"]
    cash = data["cashYuebao"] + data["cashSec"]

    total_mv = sum(f["shares"] * f["nav"] for f in funds)
    total_cost = sum(f["cost"] for f in funds)
    total_profit = total_mv - total_cost
    total_assets = total_mv + cash
    daily_total = sum((f["nav"] - f["prevNav"]) * f["shares"] for f in funds)

    tech_a = sum(f["shares"] * f["nav"] for f in funds if f["category"] == "A股硬科技")
    bonds = sum(f["shares"] * f["nav"] for f in funds if f["category"] == "债券")
    defense = (bonds + cash) / total_assets
    r1 = tech_a / total_assets

    date_cn = data["dataDateOF"][5:].replace("-", "/")

    lines = []
    lines.append(f"**总资产** {fmt(total_assets)} 元 | 当日 {fmt_signed(daily_total)}")
    lines.append(f"**总盈亏** {fmt_signed(total_profit)}（{total_profit/total_cost*100:+.2f}%）")
    lines.append("")

    # ETF 趋势
    etfs = [f for f in funds if f["account"] == "场内"]
    if etfs:
        lines.append("**ETF 趋势**")
        for f in etfs:
            st = f.get("state")
            icon = STATE_ICON.get(st, "⚪")
            name_s = STATE_NAME.get(st, "未知")
            dist = ""
            if f.get("ma20"):
                dist = f"（距MA20 {(f['nav']-f['ma20'])/f['ma20']*100:+.1f}%）"
            lines.append(f"- {icon} {f['name']} {name_s}{dist}")
        lines.append("")

    # 硬约束
    lines.append("**硬约束**")
    d_mark = "✅" if defense >= 0.15 else "🚨"
    r1_mark = "✅" if r1 <= 0.35 else "⚠️"
    lines.append(f"- {d_mark} 防御底线 {defense*100:.1f}%（要求≥15%）")
    lines.append(f"- {r1_mark} A股硬科技 {r1*100:.1f}%（建议≤35%）")

    # 异常提醒
    alerts = []
    if defense < 0.15:
        alerts.append("防御底线不足，需增配债券或留现金")
    for f in etfs:
        if f.get("state") == 0:
            alerts.append(f"{f['name']} 趋势破位，请关注")
    if alerts:
        lines.append("")
        lines.append("**⚠️ 需要注意**")
        for a in alerts:
            lines.append(f"- {a}")

    lines.append("")
    lines.append(f"[👉 查看完整仪表盘](https://love2008yb.github.io/invest-portfolio/)")

    title = f"持仓日报 {date_cn} | {fmt_signed(daily_total)}"
    desp = "\n\n".join(lines)

    print("--- 推送内容预览 ---")
    print(title)
    print(desp)
    print("-------------------")

    try:
        r = requests.post(
            f"https://sctapi.ftqq.com/{sendkey}.send",
            data={"title": title, "desp": desp},
            timeout=20,
        )
        resp = r.json()
        if resp.get("code") == 0:
            print("✅ 微信推送成功")
            return 0
        else:
            print(f"⚠️ Server酱返回异常: {resp}")
            return 0  # 推送失败不阻断主流程
    except Exception as e:
        print(f"⚠️ 推送请求失败（不阻断）: {e}")
        return 0


if __name__ == "__main__":
    sys.exit(main())
