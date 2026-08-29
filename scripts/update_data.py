#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
AI投资决策系统 - 每日数据自动更新脚本
由 GitHub Actions 每个交易日 21:40（北京时间）自动运行

数据源（全部免费公开API，多重备用，无需登录）：
  场外基金净值：天天基金 pingzhongdata → 备用：新浪基金接口
  场内ETF价格：新浪财经K线 → 备用：天天基金净值走势

自动更新字段：nav, prevNav, ma20/ma60/ma120, state, stateNote, dataDateOF/ETF
不更新字段：shares, cost, cashYuebao, cashSec, transactions
  （持仓变动请手动编辑 src/data/portfolio.json，或让AI助手代改）

脚本设计为幂等：同一天重复运行结果一致；数据源失败时保留旧数据并告警，不中断。
"""

import json
import re
import sys
import time
from datetime import datetime
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parent.parent
DATA_FILE = ROOT / "src" / "data" / "portfolio.json"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"
}

STATE_NAMES = {3: "趋势健康", 2: "趋势减弱", 1: "趋势危险", 0: "趋势破位"}


def http_get(url, retries=3, timeout=15):
    """带重试的GET请求"""
    last_err = None
    for i in range(retries):
        try:
            resp = requests.get(url, headers=HEADERS, timeout=timeout)
            resp.raise_for_status()
            return resp.text
        except Exception as e:
            last_err = e
            time.sleep(1.5 * (i + 1))
    raise last_err


# ============================================================
# 场外基金：天天基金（主） / 新浪（备）
# ============================================================
def fetch_of_eastmoney(code):
    """返回 [(date, nav), ...] 按时间升序"""
    text = http_get(f"http://fund.eastmoney.com/pingzhongdata/{code}.js")
    m = re.search(r"var Data_netWorthTrend = (\[.*?\]);", text, re.DOTALL)
    if not m:
        raise ValueError("未找到净值数据")
    data = json.loads(m.group(1))
    return [
        (datetime.fromtimestamp(x["x"] / 1000).strftime("%Y-%m-%d"), float(x["y"]))
        for x in data
    ]


def fetch_of_sina(code):
    """备用源，返回 [(date, nav), ...] 按时间升序"""
    text = http_get(
        f"https://stock.finance.sina.com.cn/fundInfo/api/openapi.php/"
        f"CaihuiFundInfoService.getNav?symbol={code}&page=1&num=10"
    )
    j = json.loads(text)
    rows = j["result"]["data"]["data"]
    out = [(r["fbrq"][:10], float(r["jjjz"])) for r in rows]
    out.sort(key=lambda x: x[0])
    return out


# ============================================================
# 场内ETF：新浪K线（主，市场价） / 天天基金净值（备）
# ============================================================
def fetch_etf_sina(code):
    """新浪日K线，返回 [(date, close), ...] 按时间升序"""
    symbol = ("sh" if code.startswith("5") else "sz") + code
    text = http_get(
        f"https://quotes.sina.cn/cn/api/jsonp_v2.php/x/"
        f"CN_MarketDataService.getKLineData?symbol={symbol}&scale=240&ma=no&datalen=180"
    )
    m = re.search(r"x\((.*)\)", text, re.DOTALL)
    if not m:
        raise ValueError("新浪返回格式异常")
    data = json.loads(m.group(1))
    return [(k["day"][:10], float(k["close"])) for k in data]


def fetch_etf_eastmoney(code):
    """备用源：ETF净值走势（与市场价略有差异，仅供兜底）"""
    return fetch_of_eastmoney(code)


# ============================================================
# 趋势计算
# ============================================================
def calc_trend(closes):
    """根据收盘价序列计算 MA20/60/120 和四阶段趋势状态"""
    def ma(n):
        return sum(closes[-n:]) / n if len(closes) >= n else None

    price = closes[-1]
    ma20, ma60, ma120 = ma(20), ma(60), ma(120)
    if ma20 is None or ma60 is None:
        return ma20, ma60, ma120, None, "数据不足120日"

    if price > ma20 and ma20 > ma60:
        state = 3
    elif price > ma20 and ma20 <= ma60:
        state = 2
    elif price <= ma20 and price > ma60:
        state = 1
    else:
        state = 0

    dist = (price - ma20) / ma20 * 100
    return ma20, ma60, ma120, state, dist


def try_sources(code, sources):
    """依次尝试多个数据源，返回 (series, source_name)"""
    for name, fn in sources:
        try:
            series = fn(code)
            if series and len(series) >= 2:
                return series, name
        except Exception as e:
            print(f"    [{code}] {name} 失败: {type(e).__name__} {str(e)[:60]}")
    return None, None


def main():
    with open(DATA_FILE, encoding="utf-8") as f:
        portfolio = json.load(f)

    funds = portfolio["funds"]
    of_dates, etf_dates = [], []
    fail_list = []

    for fund in funds:
        code = fund["code"]
        is_etf = fund["account"] == "场内"
        print(f"更新 {code} {fund['name']} ({'ETF' if is_etf else '场外'})...")

        if is_etf:
            series, src = try_sources(code, [
                ("新浪K线", fetch_etf_sina),
                ("天天基金", fetch_etf_eastmoney),
            ])
        else:
            series, src = try_sources(code, [
                ("天天基金", fetch_of_eastmoney),
                ("新浪基金", fetch_of_sina),
            ])

        if not series:
            fail_list.append(code)
            print(f"    ⚠️ 所有数据源均失败，保留旧数据 nav={fund['nav']}")
            continue

        latest_date, latest_nav = series[-1]
        prev_nav = series[-2][1]
        fund["nav"] = latest_nav
        fund["prevNav"] = prev_nav

        if is_etf:
            closes = [c for _, c in series]
            ma20, ma60, ma120, state, extra = calc_trend(closes)
            if state is not None:
                fund["ma20"] = round(ma20, 4)
                fund["ma60"] = round(ma60, 4)
                fund["ma120"] = round(ma120, 4) if ma120 else None
                fund["state"] = state
                mmdd = latest_date[5:].replace("-", "")
                fund["stateNote"] = f"{mmdd[:2]}-{mmdd[2:]}{STATE_NAMES[state]}，距MA20{extra:+.1f}%"
            etf_dates.append(latest_date)
        else:
            of_dates.append(latest_date)

        print(f"    ✅ {latest_date} nav={latest_nav} (来源: {src})")
        time.sleep(0.5)  # 限速，避免触发反爬

    if of_dates:
        portfolio["dataDateOF"] = max(of_dates)
    if etf_dates:
        portfolio["dataDateETF"] = max(etf_dates)

    with open(DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(portfolio, f, ensure_ascii=False, indent=2)
        f.write("\n")

    print("=" * 50)
    print(f"数据日期: 场外={portfolio['dataDateOF']} 场内={portfolio['dataDateETF']}")
    if fail_list:
        print(f"⚠️ 以下基金更新失败（已保留旧数据）: {', '.join(fail_list)}")
    else:
        print("全部基金更新成功")


if __name__ == "__main__":
    sys.exit(main())
