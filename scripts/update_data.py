#!/usr/bin/env python3
"""
投资决策分析模型 - 数据自动更新脚本
功能：从天天基金网爬取最新净值 → 计算市值/权重/信号 → 生成数据JSON

使用方法：
    python scripts/update_data.py --user-data user_data.json --output src/data/portfolio_data.json

环境要求：
    pip install requests beautifulsoup4
"""

import argparse
import json
import re
import sys
import time
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

try:
    import requests
    from bs4 import BeautifulSoup
except ImportError:
    print("请先安装依赖: pip install requests beautifulsoup4")
    sys.exit(1)


# ============ 配置 ============
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    "Referer": "https://fund.eastmoney.com/",
}

REQUEST_DELAY = 1.5  # 请求间隔（秒），防止被封
RETRY_TIMES = 3      # 失败重试次数


def log(msg: str, level: str = "INFO"):
    """带时间戳的日志"""
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    prefix = {"INFO": "[ℹ]", "OK": "[✓]", "WARN": "[⚠]", "ERROR": "[✗]"}.get(level, "[?]")
    print(f"{prefix} {now} {msg}")


def fetch_fund_nav(code: str) -> Optional[dict]:
    """
    从东方财富网API获取单只基金的最新净值
    返回: {"nav": float, "date": str, "change": float} 或 None
    
    API接口: http://fundgz.1234567.cn/js/{code}.js
    返回格式: jsonpgz({"fundcode":"...","name":"...","jzrq":"2026-07-17","dwjz":"1.3520","gsz":"1.3520","gszzl":"-0.62"});
    """
    # 接口1: 东方财富实时估值API
    urls = [
        f"http://fundgz.1234567.cn/js/{code}.js",
        f"https://fundmobapi.eastmoney.com/FundMNewApi/FundMNFInfo?plat=Android&appType=ttjj&product=EFund&Version=1&FCode={code}&deviceid=123",
    ]
    
    for attempt in range(RETRY_TIMES):
        for url in urls:
            try:
                resp = requests.get(url, headers=HEADERS, timeout=15)
                resp.encoding = "utf-8"
                text = resp.text
                
                # 解析API1 (fundgz)
                if "fundgz" in url:
                    match = re.search(r'jsonpgz\((\{.*?\})\)', text)
                    if match:
                        data = json.loads(match.group(1))
                        return {
                            "nav": float(data.get("dwjz", 0)),
                            "date": data.get("jzrq", "unknown"),
                            "change": float(data.get("gszzl", 0)),
                        }
                
                # 解析API2 (FundMNFInfo)
                else:
                    data = json.loads(text)
                    if data.get("Datas"):
                        d = data["Datas"]
                        return {
                            "nav": float(d.get("DWJZ", 0)),
                            "date": d.get("JZRQ", "unknown"),
                            "change": float(d.get("GSZZL", 0)),
                        }
                
            except Exception as e:
                log(f"{code}: {url} 请求失败（第{attempt+1}次）: {e}", "WARN")
                continue
        
        time.sleep(REQUEST_DELAY * (attempt + 1))
    
    return None


def fetch_fund_nav_batch(codes: list[str]) -> dict[str, Optional[dict]]:
    """批量获取多只基金的净值"""
    results = {}
    total = len(codes)
    
    log(f"开始获取 {total} 只基金的净值...")
    
    for i, code in enumerate(codes, 1):
        result = fetch_fund_nav(code)
        if result:
            log(f"[{i}/{total}] {code}: 净值 {result['nav']} ({result['date']}) 涨跌 {result['change']:+}%", "OK")
            results[code] = result
        else:
            log(f"[{i}/{total}] {code}: 获取失败", "ERROR")
            results[code] = None
        
        if i < total:
            time.sleep(REQUEST_DELAY)
    
    success = sum(1 for v in results.values() if v is not None)
    log(f"净值获取完成: {success}/{total} 只成功")
    
    return results


def calculate_portfolio(user_data: dict, nav_data: dict) -> dict:
    """
    计算组合数据
    输入: user_data (私密数据) + nav_data (爬取的净值)
    输出: 完整的组合数据JSON
    """
    holdings_result = []
    total_market_value = 0
    
    for h in user_data["holdings"]:
        code = h["code"]
        nav_info = nav_data.get(code)
        
        if nav_info and nav_info["nav"]:
            nav = nav_info["nav"]
            nav_date = nav_info["date"]
            change = nav_info["change"]
        else:
            # 使用上次已知净值（如果失败）
            nav = h.get("costPrice", 0)  # fallback
            nav_date = "unknown"
            change = 0.0
            log(f"{code}: 使用fallback净值 {nav}", "WARN")
        
        shares = h["shares"]
        cost = h["cost"]
        
        market_value = shares * nav
        profit = market_value - cost
        profit_rate = (profit / cost * 100) if cost > 0 else 0
        cost_price = cost / shares if shares > 0 else 0
        
        total_market_value += market_value
        
        holdings_result.append({
            "id": h["id"],
            "name": h["name"],
            "code": code,
            "account": h["account"],
            "assetClass": h["assetClass"],
            "fundType": h["fundType"],
            "marketValue": round(market_value, 2),
            "cost": cost,
            "profit": round(profit, 2),
            "profitRate": round(profit_rate, 2),
            "shares": shares,
            "currentPrice": nav,
            "costPrice": round(cost_price, 3),
            "navDate": nav_date,
            "dailyChange": change,
            "manager": h["manager"],
            "isCore": h["isCore"],
        })
    
    cash = user_data["cash"]
    total_assets = total_market_value + cash
    
    # 计算权重
    for h in holdings_result:
        h["weight"] = round(h["marketValue"] / total_assets * 100, 2)
    
    # 资产分类汇总
    asset_groups = {
        "a_share_tech": ["tech", "chip"],
        "hk_tech": ["hk_tech"],
        "pharma": ["pharma"],
        "gold": ["gold"],
        "bond": ["bond"],
        "index300": ["index300"],
    }
    
    group_values = {}
    for group_name, classes in asset_groups.items():
        value = sum(h["marketValue"] for h in holdings_result if h["assetClass"] in classes)
        group_values[group_name] = {
            "value": round(value, 2),
            "weight": round(value / total_assets * 100, 2),
        }
    
    group_values["cash"] = {
        "value": round(cash, 2),
        "weight": round(cash / total_assets * 100, 2),
    }
    
    # 仓位规则检查
    rules = user_data["position_rules"]
    a_share_tech_w = group_values["a_share_tech"]["weight"]
    hk_tech_w = group_values["hk_tech"]["weight"]
    total_tech_w = a_share_tech_w + hk_tech_w
    defense_w = group_values["bond"]["weight"] + group_values["cash"]["weight"]
    
    # 单一基金最大权重
    single_max_w = max(h["weight"] for h in holdings_result if h["assetClass"] in ["tech", "chip", "index300", "bond"])
    
    rule_checks = [
        {"name": "A股硬科技上限", "current": a_share_tech_w, "limit": rules["a_share_tech_max"], "status": "danger" if a_share_tech_w > rules["a_share_tech_max"] else "pass", "type": "max"},
        {"name": "港股科技上限", "current": hk_tech_w, "limit": rules["hk_tech_max"], "status": "pass" if hk_tech_w <= rules["hk_tech_max"] else "danger", "type": "max"},
        {"name": "科技合计上限", "current": total_tech_w, "limit": rules["total_tech_max"], "status": "danger" if total_tech_w > rules["total_tech_max"] else "pass", "type": "max"},
        {"name": "单一基金上限", "current": single_max_w, "limit": rules["single_fund_max"], "status": "danger" if single_max_w > rules["single_fund_max"] else "pass", "type": "max"},
        {"name": "防御仓位下限", "current": defense_w, "limit": rules["defense_min"], "status": "warning" if defense_w < rules["defense_min"] else "pass", "type": "min"},
    ]
    
    # 汇总
    result = {
        "meta": {
            "version": user_data["meta"]["version"],
            "data_source": "天天基金网",
            "last_update": datetime.now().strftime("%Y-%m-%d %H:%M"),
            "nav_date": nav_date,
            "total_assets": round(total_assets, 2),
            "total_holdings_value": round(total_market_value, 2),
            "cash": round(cash, 2),
        },
        "holdings": holdings_result,
        "asset_groups": group_values,
        "rule_checks": rule_checks,
        "alerts": [],
    }
    
    # 生成预警
    for check in rule_checks:
        if check["status"] == "danger":
            result["alerts"].append(f"{check['name']}: {check['current']:.2f}% 超出 {check['limit']}%")
        elif check["status"] == "warning":
            result["alerts"].append(f"{check['name']}: {check['current']:.2f}% 低于 {check['limit']}%")
    
    return result


def main():
    parser = argparse.ArgumentParser(description="投资组合数据自动更新")
    parser.add_argument("--user-data", required=True, help="用户私密数据JSON路径")
    parser.add_argument("--output", required=True, help="输出数据JSON路径")
    parser.add_argument("--dry-run", action="store_true", help="试运行，不保存文件")
    args = parser.parse_args()
    
    log("=" * 60)
    log("投资组合数据自动更新脚本启动")
    log("=" * 60)
    
    # 1. 读取用户数据
    log(f"读取用户数据: {args.user_data}")
    with open(args.user_data, "r", encoding="utf-8") as f:
        user_data = json.load(f)
    
    codes = [h["code"] for h in user_data["holdings"]]
    log(f"持仓基金: {codes}")
    
    # 2. 获取最新净值
    nav_data = fetch_fund_nav_batch(codes)
    
    # 3. 检查日期
    today = datetime.now().strftime("%Y-%m-%d")
    for code, nav_info in nav_data.items():
        if nav_info and nav_info["date"] != today:
            log(f"{code}: 净值日期 {nav_info['date']} 不等于今天 {today}", "WARN")
    
    # 4. 计算组合数据
    log("计算组合数据...")
    portfolio_data = calculate_portfolio(user_data, nav_data)
    
    # 5. 输出结果
    log("\n" + "=" * 60)
    log("计算结果汇总")
    log("=" * 60)
    
    meta = portfolio_data["meta"]
    log(f"总资产: ¥{meta['total_assets']:,.2f}")
    log(f"持仓市值: ¥{meta['total_holdings_value']:,.2f}")
    log(f"现金: ¥{meta['cash']:,.2f}")
    log(f"净值日期: {meta['nav_date']}")
    
    log("\n持仓明细:")
    for h in portfolio_data["holdings"]:
        log(f"  {h['name']}: ¥{h['marketValue']:,.2f} ({h['weight']:.2f}%) | "
            f"净值: {h['currentPrice']} ({h['dailyChange']:+.2f}%) | "
            f"盈亏: {h['profitRate']:+.2f}%")
    
    log("\n仓位规则检查:")
    for check in portfolio_data["rule_checks"]:
        status_icon = "✓" if check["status"] == "pass" else ("⚠" if check["status"] == "warning" else "✗")
        log(f"  {status_icon} {check['name']}: {check['current']:.2f}% / {check['limit']}%")
    
    if portfolio_data["alerts"]:
        log(f"\n⚠ 预警 ({len(portfolio_data['alerts'])}):")
        for alert in portfolio_data["alerts"]:
            log(f"  - {alert}")
    else:
        log("\n✓ 所有仓位规则合规")
    
    # 6. 保存文件
    if not args.dry_run:
        output_path = Path(args.output)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(portfolio_data, f, ensure_ascii=False, indent=2)
        
        log(f"\n✓ 数据已保存: {args.output}")
    else:
        log("\n[DRY RUN] 未保存文件")
    
    log("=" * 60)
    log("脚本执行完毕")
    log("=" * 60)


if __name__ == "__main__":
    main()
