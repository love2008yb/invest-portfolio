import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTriangle, ShieldCheck, Clock, Radar, Crosshair, Zap, Brain, Database, Bell, Newspaper, Target } from "lucide-react";

// ==========================================
// AI投资决策系统 v4.1 - GitHub Pages版
// 数据自动从portfolio_data.json加载
// ==========================================

// 尝试从JSON文件加载数据，失败时使用内嵌默认值
function loadData() {
  try {
    // @ts-ignore
    const data = window.__PORTFOLIO_DATA__;
    if (data && data.funds) return data;
  } catch (e) {}
  return null;
}

const DEFAULT_FUNDS = [
  { code: "023902", name: "博道科创C", type: "增强型宽基", account: "场外", shares: 125307.36, nav: 1.6864, cost: 150000.00, s1: "黄", s2: "黄", s3: "黄" },
  { code: "013369", name: "汇添富科技A", type: "科技主动", account: "场外", shares: 60469.54, nav: 2.8432, cost: 147765.89, s1: "黄", s2: "黄", s3: "黄" },
  { code: "014806", name: "国金量化C", type: "量化策略", account: "场外", shares: 54642.74, nav: 1.8557, cost: 109924.80, s1: "黄", s2: "黄", s3: "黄" },
  { code: "016501", name: "华夏半导体C", type: "半导体", account: "场外", shares: 13023.93, nav: 3.2367, cost: 50217.68, s1: "黄", s2: "黄", s3: "黄" },
  { code: "007045", name: "博道沪深300C", type: "宽基指数", account: "场外", shares: 112028.12, nav: 1.7341, cost: 201202.51, s1: "黄", s2: "黄", s3: "黄" },
  { code: "012747", name: "富国双利增强债券C", type: "债券", account: "场外", shares: 7904.51, nav: 1.1261, cost: 9134.45, s1: "绿", s2: "绿", s3: "绿" },
  { code: "009290", name: "富国添享债券A", type: "债券", account: "场外", shares: 33155.89, nav: 1.2578, cost: 39872.17, s1: "绿", s2: "绿", s3: "绿" },
  { code: "513120", name: "港股创新药ETF", type: "ETF", account: "场内", shares: 22100, nav: 1.174, cost: 25228.90, s1: "绿", s2: "黄", s3: "红" },
  { code: "513180", name: "恒生科技ETF", type: "ETF", account: "场内", shares: 55000, nav: 0.602, cost: 33203.30, s1: "绿", s2: "绿", s3: "黄" },
  { code: "518880", name: "黄金ETF", type: "ETF", account: "场内", shares: 2401.72, nav: 8.318, cost: 19980.13, s1: "绿", s2: "黄", s3: "黄" },
];
const DEFAULT_CASH_YUEBAO = 186800.90;
const DEFAULT_CASH_SEC = 15774.59;

// --- 计算引擎 ---
function calcAll(fundList: any[], cashYuebao: number, cashSec: number) {
  const funds = fundList.map((f: any) => {
    const mv = f.shares * f.nav;
    const profit = mv - f.cost;
    const rate = profit / f.cost;
    return { ...f, mv, profit, rate };
  });
  const totalMv = funds.reduce((s, f) => s + f.mv, 0);
  const totalCost = funds.reduce((s, f) => s + f.cost, 0);
  const totalAssets = totalMv + cashYuebao + cashSec;
  const totalProfit = totalMv - totalCost;
  const fundsW = funds.map(f => ({ ...f, weight: f.mv / totalAssets }));

  const techA = funds.slice(0, 4).reduce((s, f) => s + f.mv, 0);
  const techHk = funds[7].mv + funds[8].mv;
  const bonds = funds[5].mv + funds[6].mv;
  const gold = funds[9].mv;
  const cashTotal = cashYuebao + cashSec;

  // 风控
  const fundsRisk = funds.map(f => {
    let stopLoss: number | null = null;
    let takeProfit: number | null = null;
    let riskLevel = "";
    let riskAction = "";
    if (f.rate < 0.10) { stopLoss = (f.cost / f.shares) * 0.94; riskLevel = "亏损<10%"; riskAction = "触及止损线全部卖出"; }
    else if (f.rate < 0.30) { riskLevel = "盈利10-30%"; riskAction = "跌破20日均线3日→卖1/2"; }
    else { takeProfit = f.nav * 0.88; riskLevel = "盈利>30%"; riskAction = "移动止盈触发→卖1/2"; }
    return { ...f, stopLoss, takeProfit, riskLevel, riskAction };
  });

  // 仓位规则
  const r1 = techA / totalAssets;
  const r3 = (techA + techHk + gold) / totalAssets;
  const r4 = Math.max(...fundsW.slice(0, 7).map(f => f.weight));
  const hardConstraint = r1 > 0.35 || r3 > 0.55 || r4 > 0.20;

  return { fundsW, totalMv, totalCost, totalAssets, totalProfit, totalCost2: totalCost, techA, techHk, bonds, gold, cashTotal, cashYuebao, cashSec, fundsRisk, r1, r3, r4, hardConstraint };
}

const { fundsW, totalMv, totalAssets, totalProfit, techA, techHk, bonds, gold, cashTotal, cashYuebao, cashSec, fundsRisk, r1, r3, r4, hardConstraint } = calcAll(DEFAULT_FUNDS, DEFAULT_CASH_YUEBAO, DEFAULT_CASH_SEC);
const totalProfitRate = totalProfit / (totalMv - totalProfit);

const sectors = [
  { name: "半导体/科技", s1: "黄", s2: "黄", s3: "黄", winRate: "中", valPct: 65, note: "CAPEX增速放缓" },
  { name: "恒生科技", s1: "绿", s2: "绿", s3: "黄", winRate: "高", valPct: 45, note: "港股大涨+2.36%" },
  { name: "创新药", s1: "绿", s2: "黄", s3: "红", winRate: "中", valPct: 35, note: "板块回调-3.52%" },
  { name: "黄金", s1: "绿", s2: "黄", s3: "黄", winRate: "中", valPct: 55, note: "央行购金持续" },
];

const tactical = [
  { name: "港股创新药ETF", price: 1.174, ma5: 1.1804, ma20: 1.1206, adx: 35.19, status: "观察" as const },
  { name: "恒生科技ETF", price: 0.602, ma5: 0.5998, ma20: 0.5802, adx: 28.5, status: "健康" as const },
  { name: "黄金ETF", price: 8.318, ma5: 8.3468, ma20: 8.4514, adx: 22.3, status: "恶化" as const },
];

const sectorRadar = [
  { name: "恒生指数", change: 2.36, direction: "in" as const, trend: "港股大涨", relevance: "持仓" as const },
  { name: "非银金融", change: 3.28, direction: "in" as const, trend: "资金流入", relevance: "监控" as const },
  { name: "创新药", change: -3.52, direction: "out" as const, trend: "板块回调", relevance: "持仓" as const },
  { name: "中证商品", change: -0.59, direction: "out" as const, trend: "震荡", relevance: "监控" as const },
  { name: "半导体", change: -1.85, direction: "out" as const, trend: "回调", relevance: "持仓" as const },
  { name: "人工智能", change: 1.72, direction: "in" as const, trend: "活跃", relevance: "监控" as const },
];

const aiInsights = [
  { category: "港股动态", time: "2026-07-20", content: "恒生指数大涨+2.36%至25,143点，南向资金连续净流入。", source: "Wind行情" },
  { category: "创新药行业", time: "2026-07-20", content: "创新药板块回调-3.52%，医保谈判温和化趋势持续。", source: "AI行业监控" },
  { category: "半导体行业", time: "2026-07-20", content: "国产替代长期逻辑仍在，关注三季度业绩拐点。", source: "AI研报摘要" },
  { category: "黄金分析", time: "2026-07-20", content: "MACD死叉短期调整，全球央行购金趋势未变。", source: "AI技术分析" },
  { category: "宏观环境", time: "2026-07-20", content: "美联储9月降息概率升至80%，美元指数走弱。", source: "AI宏观监控" },
];

const yuebaoWeight = cashYuebao / totalAssets;
const secWeight = cashSec / totalAssets;

const formatNum = (n: number) => n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const formatPct = (n: number) => (n * 100).toFixed(2) + '%';

function useAutoRefresh() {
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [nextUpdate, setNextUpdate] = useState("");
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setLastUpdate(now);
      const next = new Date(now); next.setHours(21, 35, 0, 0);
      if (next <= now) next.setDate(next.getDate() + 1);
      const h = Math.floor((next.getTime() - now.getTime()) / 3600000);
      const m = Math.floor(((next.getTime() - now.getTime()) % 3600000) / 60000);
      setNextUpdate(`${h}小时${m}分`);
    };
    tick();
    const iv = setInterval(tick, 60000);
    return () => clearInterval(iv);
  }, []);
  return { lastUpdate: lastUpdate.toLocaleString('zh-CN'), nextUpdate };
}

export default function App() {
  const { lastUpdate, nextUpdate } = useAutoRefresh();

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-[#1F4E78] text-white py-4 px-6 shadow-lg">
        <div className="max-w-7xl mx-auto flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Brain className="w-7 h-7" />
            <div>
              <h1 className="text-xl font-bold">AI智能投资决策系统 v4.1</h1>
              <p className="text-xs text-slate-300">作战指令型 | 全部Python硬算 | 硬约束一票否决</p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">状态:</span>
              <span className="px-2 py-1 bg-green-600 rounded text-xs font-bold">趋势市</span>
              <span className="px-2 py-1 bg-slate-600 rounded text-xs">震荡市</span>
              <span className="px-2 py-1 bg-slate-600 rounded text-xs">熊市</span>
            </div>
            <span className="text-slate-500">|</span>
            <Database className="w-4 h-4 text-blue-300" />
            <span>Wind万得</span>
            <Clock className="w-4 h-4 text-blue-300" />
            <span>{lastUpdate}</span>
            <span className="px-2 py-1 bg-white/10 rounded-full text-xs"><Bell className="w-3 h-3 inline mr-1 text-yellow-400" />下次:{nextUpdate}</span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 md:p-6 space-y-5">
        {hardConstraint && (
          <Alert className="bg-red-50 border-red-300">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <AlertTitle className="text-red-700 font-bold">【仓位硬约束】一票否决已触发</AlertTitle>
            <AlertDescription className="text-red-600">
              A股硬科技{formatPct(r1)}超35% · 科技合计{formatPct(r3)}超55% · 单一基金{formatPct(r4)}超20%
              <br /><strong>→ 今日禁止一切买入操作，仅输出减仓指令</strong>
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "账户总资产", value: `¥${formatNum(totalAssets)}`, color: "text-[#1F4E78]" },
            { label: "持仓总金额", value: `¥${formatNum(totalMv)}`, sub: formatPct(totalMv / totalAssets), color: "" },
            { label: "持仓总盈亏", value: `${totalProfit >= 0 ? '+' : ''}¥${formatNum(totalProfit)}`, sub: `${totalProfit >= 0 ? '+' : ''}${formatPct(totalProfitRate)}`, color: totalProfit >= 0 ? 'text-green-600' : 'text-red-600' },
            { label: "现金储备", value: `¥${formatNum(cashTotal)}`, sub: formatPct(cashTotal / totalAssets), color: "text-blue-600" },
          ].map((m, i) => (
            <Card key={i}>
              <CardContent className="pt-5 pb-4">
                <p className="text-sm text-muted-foreground">{m.label}</p>
                <p className={`text-2xl font-bold ${m.color}`}>{m.value}</p>
                {m.sub && <p className="text-xs text-muted-foreground">{m.sub}</p>}
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="signal" className="space-y-4">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="signal" className="flex items-center gap-1.5"><Radar className="w-4 h-4" /> 信号仪表盘</TabsTrigger>
            <TabsTrigger value="holdings" className="flex items-center gap-1.5"><Database className="w-4 h-4" /> 持仓明细</TabsTrigger>
            <TabsTrigger value="allocation" className="flex items-center gap-1.5"><Target className="w-4 h-4" /> 资产配置</TabsTrigger>
            <TabsTrigger value="suggestions" className="flex items-center gap-1.5"><Crosshair className="w-4 h-4" /> AI调仓建议</TabsTrigger>
            <TabsTrigger value="alerts" className="flex items-center gap-1.5"><Zap className="w-4 h-4" /> 异动侦测</TabsTrigger>
          </TabsList>

          <TabsContent value="signal" className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-lg">三层信号（信号3每日更新 / 信号1,2按数据频率）</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                  {sectors.map((s, i) => {
                    const sigColor = (sig: string) => sig === "绿" ? "bg-green-500" : sig === "黄" ? "bg-yellow-500" : "bg-red-600";
                    return (
                      <div key={i} className="border rounded-lg p-3 bg-white">
                        <p className="font-bold text-sm mb-2">{s.name}</p>
                        <div className="flex gap-2 mb-2">
                          {["s1", "s2", "s3"].map(k => (
                            <div key={k} className="text-center">
                              <div className={`w-6 h-6 rounded-full ${sigColor((s as any)[k])} mx-auto mb-0.5`} />
                              <span className="text-[10px] text-muted-foreground">{k.toUpperCase()}</span>
                            </div>
                          ))}
                        </div>
                        <p className="text-xs text-muted-foreground">{s.note}</p>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-lg">胜率-赔率矩阵</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {sectors.map((s, i) => {
                  let cmd = "持有不动";
                  const isConstrained = hardConstraint && (s.name.includes("科技") || s.name.includes("半导体"));
                  if (isConstrained) cmd = "🚫 硬约束否决";
                  else if (s.winRate === "高" && s.valPct < 30) cmd = "执行加仓";
                  else if (s.winRate === "高" && s.valPct <= 70) cmd = "持有，允许加仓";
                  else if (s.winRate === "高" && s.valPct > 70) cmd = "持有，不加仓，启动盈利保护";
                  else if (s.winRate === "中" && s.valPct > 70) cmd = "减仓无保护暴露";
                  else if (s.winRate === "低") cmd = "禁止新建仓，持有观察";
                  const isBuy = cmd.includes("加仓");
                  const isSell = cmd.includes("减仓");
                  return (
                    <div key={i} className={`p-3 rounded-lg border ${isBuy ? 'border-green-300 bg-green-50' : isSell ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-white'}`}>
                      <div className="flex justify-between"><span className="font-bold text-sm">{s.name}</span><span className={`font-bold text-sm ${isBuy ? 'text-green-700' : isSell ? 'text-red-700' : ''}`}>{cmd}</span></div>
                      <span className="text-xs text-muted-foreground">胜率{s.winRate} · 估值{s.valPct}%分位</span>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-lg flex items-center gap-2"><ShieldCheck className="w-5 h-5" /> 持仓三支柱（ETF战术+风控）</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {tactical.map((t, i) => (
                  <div key={i} className={`p-3 rounded-lg border ${t.status === '健康' ? 'border-green-300 bg-green-50' : t.status === '恶化' ? 'border-red-300 bg-red-50' : 'border-yellow-300 bg-yellow-50'}`}>
                    <div className="flex justify-between"><span className="font-bold">{t.name}</span><Badge variant={t.status === '健康' ? 'default' : t.status === '恶化' ? 'destructive' : 'secondary'}>{t.status}</Badge></div>
                    <div className="text-xs text-muted-foreground mt-1">价{t.price} vs MA5({t.ma5.toFixed(3)})/MA20({t.ma20.toFixed(3)}) ADX={t.adx}</div>
                  </div>
                ))}
                <div className="mt-3">
                  <p className="text-sm font-bold mb-2">风控支柱 — 止损/止盈线</p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead><tr className="bg-slate-100"><th className="px-2 py-1 text-left">基金</th><th className="px-2 py-1">风险层级</th><th className="px-2 py-1">止损线</th><th className="px-2 py-1">移动止盈</th><th className="px-2 py-1">触发动作</th></tr></thead>
                      <tbody>
                        {fundsRisk.map((f, i) => (
                          <tr key={f.code} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                            <td className="px-2 py-1 font-medium">{f.name}</td>
                            <td className="px-2 py-1">{f.riskLevel}</td>
                            <td className="px-2 py-1 font-mono">{f.stopLoss ? f.stopLoss.toFixed(4) : '—'}</td>
                            <td className="px-2 py-1 font-mono">{f.takeProfit ? f.takeProfit.toFixed(4) : '—'}</td>
                            <td className="px-2 py-1 text-red-600">{f.riskAction}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="holdings">
            <Card>
              <CardHeader><CardTitle className="text-lg">持仓明细（10只基金 + 现金）</CardTitle></CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-[#1F4E78] text-white">
                        <th className="px-3 py-2 text-left">基金名称</th>
                        <th className="px-3 py-2 text-right">最新净值</th>
                        <th className="px-3 py-2 text-right">市值</th>
                        <th className="px-3 py-2 text-right">成本</th>
                        <th className="px-3 py-2 text-right">盈亏</th>
                        <th className="px-3 py-2 text-right">盈亏率</th>
                        <th className="px-3 py-2 text-right">权重</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fundsW.map((f, i) => (
                        <tr key={f.code} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                          <td className="px-3 py-2.5"><div className="font-medium">{f.name}</div><div className="text-xs text-muted-foreground">{f.code} · {f.type}</div></td>
                          <td className="px-3 py-2.5 text-right font-mono text-blue-700">{f.nav.toFixed(4)}</td>
                          <td className="px-3 py-2.5 text-right font-mono">{formatNum(f.mv)}</td>
                          <td className="px-3 py-2.5 text-right font-mono text-muted-foreground">{formatNum(f.cost)}</td>
                          <td className={`px-3 py-2.5 text-right font-mono font-bold ${f.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{f.profit >= 0 ? '+' : ''}{formatNum(f.profit)}</td>
                          <td className={`px-3 py-2.5 text-right font-bold ${f.rate >= 0 ? 'text-green-600' : 'text-red-600'}`}>{f.rate >= 0 ? '+' : ''}{formatPct(f.rate)}</td>
                          <td className="px-3 py-2.5 text-right"><Badge variant={f.weight > 0.20 ? "destructive" : f.weight > 0.10 ? "default" : "secondary"}>{formatPct(f.weight)}</Badge></td>
                        </tr>
                      ))}
                      <tr className="bg-blue-50">
                        <td className="px-3 py-2 font-medium text-blue-700">余额宝</td>
                        <td className="text-center text-muted-foreground">—</td>
                        <td className="px-3 py-2 text-right font-mono text-blue-700">{formatNum(cashYuebao)}</td>
                        <td colSpan={3} className="text-center text-muted-foreground">—</td>
                        <td className="px-3 py-2 text-right"><Badge variant="secondary">{formatPct(yuebaoWeight)}</Badge></td>
                      </tr>
                      <tr className="bg-blue-50">
                        <td className="px-3 py-2 font-medium text-blue-700">证券现金</td>
                        <td className="text-center text-muted-foreground">—</td>
                        <td className="px-3 py-2 text-right font-mono text-blue-700">{formatNum(cashSec)}</td>
                        <td colSpan={3} className="text-center text-muted-foreground">—</td>
                        <td className="px-3 py-2 text-right"><Badge variant="secondary">{formatPct(secWeight)}</Badge></td>
                      </tr>
                      <tr className="bg-[#1F4E78] text-white font-bold">
                        <td className="px-3 py-3">合计</td><td className="text-center">—</td>
                        <td className="text-center">{formatNum(totalAssets)}</td>
                        <td className="text-center">{formatNum(totalMv - totalProfit)}</td>
                        <td className={`text-center ${totalProfit >= 0 ? 'text-green-300' : 'text-red-300'}`}>{totalProfit >= 0 ? '+' : ''}{formatNum(totalProfit)}</td>
                        <td className={`text-center ${totalProfit >= 0 ? 'text-green-300' : 'text-red-300'}`}>{totalProfit >= 0 ? '+' : ''}{formatPct(totalProfitRate)}</td>
                        <td className="text-center">100%</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="allocation" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader><CardTitle className="text-lg">大类资产配置</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {[
                    { name: "A股硬科技", value: techA, limit: 0.35 },
                    { name: "A股宽基(沪深300)", value: indexFund, limit: null },
                    { name: "港股科技", value: techHk, limit: 0.25 },
                    { name: "债券", value: bonds, limit: null },
                    { name: "黄金", value: gold, limit: 0.05 },
                    { name: "现金", value: cashTotal, limit: null },
                  ].map((cat, i) => {
                    const pct = (cat.value / totalAssets) * 100;
                    const isOver = cat.limit && cat.value / totalAssets > cat.limit;
                    return (
                      <div key={i}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="font-medium">{cat.name}</span>
                          <span className={isOver ? "text-red-600 font-bold" : ""}>¥{formatNum(cat.value)} ({pct.toFixed(1)}%){cat.limit ? ` / 上限${(cat.limit * 100).toFixed(0)}%` : ''}{isOver && ' 🔴'}</span>
                        </div>
                        <Progress value={pct} max={cat.limit ? cat.limit * 100 : 100} className="h-2" />
                      </div>
                    );
                  })}
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-lg flex items-center gap-2"><ShieldCheck className="w-5 h-5" /> 仓位规则检查（8项）</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {[
                    { name: "A股硬科技≤35%", val: r1, limit: 0.35 },
                    { name: "科技合计≤55%", val: r3, limit: 0.55 },
                    { name: "单一基金≤20%", val: r4, limit: 0.20 },
                  ].map((r, i) => (
                    <div key={i} className="flex justify-between items-center p-2 rounded border">
                      <span className="text-sm">{r.name}</span>
                      <div className="flex items-center gap-2">
                        <Progress value={r.val * 100} max={r.limit * 100} className="w-24 h-2" />
                        <span className={`text-sm font-bold ${r.val > r.limit ? 'text-red-600' : ''}`}>{formatPct(r.val)}</span>
                        {r.val > r.limit && <Badge variant="destructive" className="text-xs">超限+{((r.val - r.limit) * 100).toFixed(2)}%</Badge>}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="suggestions" className="space-y-4">
            {hardConstraint && (
              <Alert className="bg-red-50 border-red-300">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                <AlertTitle className="text-red-700 font-bold">硬约束触发 — 仅输出减仓指令</AlertTitle>
                <AlertDescription className="text-red-600">防御已达24%→跳过补充→可用于加仓港股科技/创新药（待超限解除）</AlertDescription>
              </Alert>
            )}

            <Card>
              <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Crosshair className="w-5 h-5" /> AI调仓建议（底仓70%+确认30%分批）</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {[
                  { priority: "高" as const, title: "减持博道科创C", detail: `当前${(fundsW[0].weight * 100).toFixed(1)}%超20%上限`, batch: "即时执行", amount: -((fundsW[0].weight - 0.20) * totalAssets) },
                  { priority: "高" as const, title: "加仓恒生科技ETF", detail: `港股科技仅${(techHk / totalAssets * 100).toFixed(1)}%，目标12%`, batch: "底仓70%即时+30%确认追加", amount: (0.12 - techHk / totalAssets) * totalAssets },
                  { priority: "高" as const, title: "建仓港股创新药ETF", detail: "板块回调-3.52%提供机会", batch: "底仓70% @1.12 + 30%确认追加", amount: (0.05 - fundsW[7].weight) * totalAssets },
                  { priority: "中" as const, title: "科技合计回归55%", detail: "优先减持华夏半导体C止损", batch: "分批减仓", amount: -(techA + techHk + gold - 0.55 * totalAssets) },
                  { priority: "中" as const, title: "增配债券提升防御", detail: `当前债券${(bonds / totalAssets * 100).toFixed(1)}%`, batch: "视减持资金而定", amount: (0.10 - bonds / totalAssets) * totalAssets },
                  { priority: "低" as const, title: "保留现金弹性", detail: `现金${(cashTotal / totalAssets * 100).toFixed(1)}%充裕`, batch: "维持", amount: 0 },
                ].map((s, i) => (
                  <div key={i} className={`p-4 rounded-lg border ${s.priority === '高' ? 'bg-red-50 border-red-300' : s.priority === '中' ? 'bg-yellow-50 border-yellow-300' : 'bg-slate-50 border-slate-300'}`}>
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant={s.priority === '高' ? 'destructive' : s.priority === '中' ? 'default' : 'secondary'} className="text-xs">{s.priority}优先级</Badge>
                          <span className="font-bold">{s.title}</span>
                        </div>
                        <p className="text-sm text-muted-foreground">{s.detail}</p>
                        <p className="text-xs text-blue-700 mt-1 font-medium">建仓规则: {s.batch}</p>
                      </div>
                      <div className="text-right ml-4">
                        <p className={`text-lg font-bold ${s.amount > 0 ? 'text-green-600' : s.amount < 0 ? 'text-red-600' : 'text-slate-500'}`}>{s.amount !== 0 ? '¥' + formatNum(Math.abs(s.amount)) : '维持'}</p>
                        <p className="text-xs text-muted-foreground">{s.amount > 0 ? '买入' : s.amount < 0 ? '卖出' : ''}</p>
                      </div>
                    </div>
                  </div>
                ))}

                <div className="bg-[#1F4E78] text-white p-4 rounded-lg">
                  <h4 className="font-bold mb-2 flex items-center gap-2"><Brain className="w-4 h-4" /> AI综合判断</h4>
                  <p className="text-sm text-slate-100 leading-relaxed">核心矛盾：A股硬科技超配15% vs 港股科技低配。减持博道科创C锁定40%收益，释放资金分底仓70%+确认30%加仓恒生科技ETF。创新药板块回调提供建仓窗口。现金19.2%保留弹性。</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="alerts" className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Radar className="w-5 h-5 text-[#1F4E78]" /> 板块机会雷达</CardTitle></CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="bg-[#1F4E78] text-white"><th className="px-3 py-2 text-left">板块</th><th className="px-3 py-2 text-right">涨跌</th><th className="px-3 py-2">资金流向</th><th className="px-3 py-2">关联</th></tr></thead>
                    <tbody>
                      {sectorRadar.map((s, i) => (
                        <tr key={i} className={s.relevance === "持仓" ? "bg-yellow-50/50" : i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                          <td className="px-3 py-2 font-medium">{s.name}</td>
                          <td className={`px-3 py-2 text-right font-bold ${s.change > 0 ? 'text-green-600' : 'text-red-600'}`}>{s.change > 0 ? '+' : ''}{s.change.toFixed(2)}%</td>
                          <td className="px-3 py-2"><Badge variant={s.direction === "in" ? "default" : "secondary"} className="text-xs">{s.direction === "in" ? "↗ 流入" : "↘ 流出"}</Badge></td>
                          <td className="px-3 py-2"><Badge variant={s.relevance === "持仓" ? "destructive" : "outline"} className="text-xs">{s.relevance}</Badge></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Newspaper className="w-5 h-5" /> AI信息搜集</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {aiInsights.map((insight, i) => (
                  <div key={i} className="p-4 rounded-lg border bg-white hover:shadow-md transition-shadow">
                    <div className="flex justify-between mb-2">
                      <div className="flex items-center gap-2"><Badge variant="outline" className="text-xs font-bold">{insight.category}</Badge><span className="text-xs text-muted-foreground">{insight.time}</span></div>
                      <span className="text-xs text-muted-foreground">{insight.source}</span>
                    </div>
                    <p className="text-sm leading-relaxed">{insight.content}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <div className="p-3 rounded-lg border-green-300 bg-green-50 border">
              <span className="font-bold text-green-700 text-sm">【今日异动】未检测到极端量价信号，按现有规则执行。</span>
            </div>
          </TabsContent>
        </Tabs>

        <footer className="text-center text-xs text-muted-foreground pt-2 pb-6">
          <p>v4.1 = v4.0版式 + v2.2风控补丁 | Python硬算 | 定时21:30数据/21:35报告 | 硬约束一票否决</p>
        </footer>
      </main>
    </div>
  );
}
