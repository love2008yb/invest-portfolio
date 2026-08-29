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


# ============================================================
# 逻辑验证状态：每日自动判断
# 规则（与 v4.5.1 阈值一致）：
#   指数/ETF趋势：价格>MA20且MA20>MA60=normal；跌破MA60=broken；其余=warning
#   债基指标1：国债ETF(511010) 60日变化 <0%=broken；0%~+0.3%=warning；其余=normal
#   债基指标2：沪深300趋势健康(3)=broken（股债跷跷板），其余=normal
# ============================================================
LOGIC_RULES = {
    "023902": [("sh000688", "trend"), ("sh512480", "trend")],
    "013369": [("sh000688", "trend"), ("sh512480", "trend")],
    "014806": [("sh000905", "trend"), ("sh000300", "trend")],
    "016501": [("sh512480", "trend"), ("sh000688", "trend")],
    "007045": [("sh000300", "trend"), ("sh000016", "trend")],
    "012747": [("sh511010", "bond60"), ("sh000300", "hs300")],
    "009290": [("sh511010", "bond60"), ("sh000300", "hs300")],
    "014847": [("sh511010", "bond60"), ("sh000300", "hs300")],
    "513120": [("sh513120", "trend")],  # 港股创新药：自身趋势（跟踪中证创新药指数）
    "513180": [("sh513180", "trend")],  # 恒生科技：自身趋势（跟踪恒生科技指数）
    "518880": [("sh518880", "trend")],  # 黄金：自身趋势
    "588950": [("sh000688", "trend"), ("sh512480", "trend")],
}


def fetch_symbol_sina(symbol):
    """新浪日K线（指数/ETF通用），返回 [(date, close), ...] 升序"""
    text = http_get(
        f"https://quotes.sina.cn/cn/api/jsonp_v2.php/x/"
        f"CN_MarketDataService.getKLineData?symbol={symbol}&scale=240&ma=no&datalen=180"
    )
    m = re.search(r"x\((.*)\)", text, re.DOTALL)
    if not m:
        raise ValueError("新浪返回格式异常")
    data = json.loads(m.group(1))
    return [(k["day"][:10], float(k["close"])) for k in data]


def judge_trend(closes):
    """趋势类指标 → normal/warning/broken"""
    ma20, ma60, _, state, _ = calc_trend(closes)
    if state is None:
        return None
    return {3: "normal", 2: "warning", 1: "warning", 0: "broken"}[state]


def judge_bond60(closes):
    """国债ETF 60日变化 → normal/warning/broken"""
    if len(closes) < 61:
        return None
    chg = (closes[-1] / closes[-61] - 1) * 100
    if chg < 0:
        return "broken"
    if chg < 0.3:
        return "warning"
    return "normal"


def judge_hs300(closes):
    """股债跷跷板：沪深300趋势健康=broken"""
    _, _, _, state, _ = calc_trend(closes)
    if state is None:
        return None
    return "broken" if state == 3 else "normal"


JUDGERS = {"trend": judge_trend, "bond60": judge_bond60, "hs300": judge_hs300}


def update_logic_status(portfolio):
    """自动计算所有基金的逻辑验证状态，写入 portfolio['logic']"""
    # 先拉取全部所需指数（去重）
    need = {sym for rules in LOGIC_RULES.values() for sym, _ in rules}
    cache = {}
    for sym in sorted(need):
        try:
            series = fetch_symbol_sina(sym)
            cache[sym] = [c for _, c in series]
            print(f"  逻辑指标 {sym} ✅ ({len(series)}日)")
        except Exception as e:
            print(f"  逻辑指标 {sym} ⚠️ 获取失败: {type(e).__name__} {str(e)[:50]}")
        time.sleep(0.5)

    logic = {}
    for code, rules in LOGIC_RULES.items():
        entry = {}
        for i, (sym, kind) in enumerate(rules, 1):
            closes = cache.get(sym)
            status = JUDGERS[kind](closes) if closes else None
            if status:
                entry[f"status{i}"] = status
        if entry:
            logic[code] = entry
    if logic:
        portfolio["logic"] = logic
    print(f"  逻辑验证状态: {len(logic)} 只基金已自动判断")


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

    print("更新逻辑验证状态...")
    try:
        update_logic_status(portfolio)
    except Exception as e:
        print(f"⚠️ 逻辑验证更新失败（不中断主流程）: {type(e).__name__} {str(e)[:80]}")

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
