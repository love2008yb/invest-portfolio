import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTriangle, Clock, Radar, Crosshair, Brain, Database, Bell, TrendingUp, TrendingDown, Activity, BarChart3, FileText } from "lucide-react";
import portfolioData from "./data/portfolio.json";

// ==========================================
// AI投资决策系统 v4.5.1 — 逻辑验证指标校准版
// 数据文件: src/data/portfolio.json（GitHub Actions 每日自动更新）
// 核心：
//   - 场外基金：逻辑验证+硬约束（无趋势阶段，数据不可靠）
//   - ETF基金：四阶段趋势跟踪+逻辑验证
//   - 不同类别用不同监控指数
//   - 建议动作模糊化（不指定具体比例）
// v4.5.1校准：
//   - 所有逻辑验证指标替换为Wind可获取数据
//   - 10年国债阈值从"3.5%"改为"净价指数60日变化<0%"
//   - 费城半导体/SOX/南向资金等不可获取指标已替换
//   - 回测结论：趋势滞后5-30天，仅作状态确认
// ==========================================

// ==========================================
// 模块：逻辑验证清单（v4.5.1校准版）
// 所有指标必须满足：①数据可获取 ②阈值可验证 ③逻辑可解释
// 回测结论：趋势滞后5-30天，无法预测拐点，仅用于"状态确认"
// ==========================================

interface LogicVerify {
  indicator1: string;      // 验证指标1
  source1: string;         // 指标1来源
  threshold1: string;      // 指标1破坏阈值
  status1: "normal" | "warning" | "broken"; // 指标1当前状态
  indicator2?: string;     // 验证指标2（可选）
  source2?: string;        // 指标2来源
  threshold2?: string;     // 指标2破坏阈值
  status2?: "normal" | "warning" | "broken";
}

// ==========================================
// 逻辑验证指标（v4.5校准版）
// 核心原则：所有指标必须满足——①数据可获取 ②阈值可验证 ③逻辑可解释
// 回测结论：趋势指标滞后5-30天，无法预测拐点，仅用于"状态确认"
// 每日更新时，AI根据Wind数据判断状态后手动更新status字段
// ==========================================

const logicVerifyMap: Record<string, LogicVerify> = {
  // A股硬科技组合：科创50+半导体ETF双验证
  "023902": {
    indicator1: "科创50指数趋势（000688.SH MA20/MA60）",
    source1: "Wind",
    threshold1: "跌破MA60=破坏；MA20上穿MA60后回落=预警",
    status1: "normal",
    indicator2: "半导体ETF趋势（512480.SH MA20/MA60）",
    source2: "Wind",
    threshold2: "跌破MA60=破坏；价格在MA20下方=预警",
    status2: "normal"
  },
  "013369": {
    indicator1: "科创50指数趋势（000688.SH MA20/MA60）",
    source1: "Wind",
    threshold1: "跌破MA60=破坏；MA20上穿MA60后回落=预警",
    status1: "normal",
    indicator2: "半导体ETF趋势（512480.SH MA20/MA60）",
    source2: "Wind",
    threshold2: "跌破MA60=破坏；价格在MA20下方=预警",
    status2: "normal"
  },
  "014806": {
    indicator1: "中证500指数趋势（000905.SH MA20/MA60）",
    source1: "Wind",
    threshold1: "跌破MA60=破坏；MA20上穿MA60后回落=预警",
    status1: "normal",
    indicator2: "沪深300指数趋势（000300.SH MA20/MA60）",
    source2: "Wind",
    threshold2: "跌破MA60=破坏；价格在MA20下方=预警",
    status2: "normal"
  },
  "016501": {
    indicator1: "半导体ETF趋势（512480.SH MA20/MA60）",
    source1: "Wind",
    threshold1: "跌破MA60=破坏；价格在MA20下方=预警",
    status1: "normal",
    indicator2: "科创50指数趋势（000688.SH MA20/MA60）",
    source2: "Wind",
    threshold2: "跌破MA60=破坏；MA20上穿MA60后回落=预警",
    status2: "normal"
  },
  // 宽基指数：沪深300+上证50双验证
  "007045": {
    indicator1: "沪深300指数趋势（000300.SH MA20/MA60）",
    source1: "Wind",
    threshold1: "跌破MA60=破坏；价格在MA20下方=预警",
    status1: "normal",
    indicator2: "上证50指数趋势（000016.SH MA20/MA60）",
    source2: "Wind",
    threshold2: "跌破MA60=破坏；价格在MA20下方=预警",
    status2: "normal"
  },
  // 债券基金：国债净价指数60日变化 + 股债跷跷板（沪深300趋势）
  // 回测结论：CBA00111.CS 20日变化仅-0.11%~+0.41%，阈值设为60日变化<0%=破坏
  "012747": {
    indicator1: "10年国债净价指数60日变化（CBA00111.CS）",
    source1: "Wind",
    threshold1: "60日变化<0%=破坏（收益率中期上升）；0%~+0.3%=预警",
    status1: "normal",
    indicator2: "沪深300趋势状态（股债跷跷板参考）",
    source2: "Wind",
    threshold2: "沪深300趋势健康(3/3)=破坏（资金可能流出债市）",
    status2: "normal"
  },
  "009290": {
    indicator1: "10年国债净价指数60日变化（CBA00111.CS）",
    source1: "Wind",
    threshold1: "60日变化<0%=破坏（收益率中期上升）；0%~+0.3%=预警",
    status1: "normal",
    indicator2: "沪深300趋势状态（股债跷跷板参考）",
    source2: "Wind",
    threshold2: "沪深300趋势健康(3/3)=破坏（资金可能流出债市）",
    status2: "normal"
  },
  "014847": {
    indicator1: "10年国债净价指数60日变化（CBA00111.CS）",
    source1: "Wind",
    threshold1: "60日变化<0%=破坏（收益率中期上升）；0%~+0.3%=预警",
    status1: "normal",
    indicator2: "沪深300趋势状态（股债跷跷板参考）",
    source2: "Wind",
    threshold2: "沪深300趋势健康(3/3)=破坏（资金可能流出债市）",
    status2: "normal"
  },
  // 港股ETF：创新药/恒生科技趋势 + 大盘参考
  "513120": {
    indicator1: "中证创新药指数趋势（H30184.CSI MA20/MA60）",
    source1: "Wind",
    threshold1: "跌破MA60=破坏；价格在MA20下方=预警",
    status1: "normal",
    indicator2: "港股创新药ETF自身趋势（513120 MA20/MA60）",
    source2: "Wind",
    threshold2: "跌破MA60=破坏；价格在MA20下方=预警",
    status2: "normal"
  },
  "513180": {
    indicator1: "恒生指数趋势（HSI.HI MA20/MA60）",
    source1: "Wind",
    threshold1: "跌破MA60=破坏；价格在MA20下方=预警",
    status1: "normal",
    indicator2: "恒生科技指数趋势（HSTECH.HI MA20/MA60，如可获取）",
    source2: "Wind",
    threshold2: "跌破MA60=破坏；价格在MA20下方=预警",
    status2: "normal"
  },
  // 黄金ETF：自身趋势 + 美元参考
  "518880": {
    indicator1: "黄金ETF自身趋势（518880 MA20/MA60）",
    source1: "Wind",
    threshold1: "跌破MA60=破坏；价格在MA20下方=预警",
    status1: "warning",
    indicator2: "美元指数DXY趋势（USDX.FX MA20/MA60）",
    source2: "Wind",
    threshold2: "DXY趋势健康(3/3)=破坏（美元强势压制金价）",
    status2: "normal"
  },
  // 科创50ETF景顺：科创50指数趋势 + 半导体ETF趋势
  "588950": {
    indicator1: "科创50指数趋势（000688.SH MA20/MA60）",
    source1: "Wind",
    threshold1: "跌破MA60=破坏；MA20上穿MA60后回落=预警",
    status1: "normal",
    indicator2: "半导体ETF趋势（512480.SH MA20/MA60）",
    source2: "Wind",
    threshold2: "跌破MA60=破坏；价格在MA20下方=预警",
    status2: "normal"
  }
};

// ==========================================
// 基金数据（唯一数据源：src/data/portfolio.json，由GitHub Actions每日自动更新）
// 手动调整持仓时：直接编辑 portfolio.json 里的 shares/cost/cash 字段
// ==========================================
interface Fund {
  code: string;
  name: string;
  type: string;
  account: string;
  shares: number;
  nav: number;
  prevNav: number;       // 前一交易日净值/收盘价（脚本自动维护）
  cost: number;
  category: string;
  monitorIndex: string;
  ma20?: number;
  ma60?: number;
  ma120?: number;
  state?: number;
  stateNote?: string;
}

const fundData = portfolioData.funds as Fund[];

// ==========================================
// 交易历史记录（记忆功能）
// ==========================================
interface Transaction {
  date: string;
  code: string;
  name: string;
  type: "买入" | "卖出";
  amount: number;
  nav: number;
  shares: number;
  note?: string;
}

const transactionHistory = portfolioData.transactions as Transaction[];

const cashYuebao = portfolioData.cashYuebao;
const cashSec = portfolioData.cashSec;
const dataDateText = `${portfolioData.dataDateOF}(场外)/${portfolioData.dataDateETF}(场内)`;

// ==========================================
// Python硬算: 市值/盈亏/权重
// ==========================================
const fundsWithCalc = fundData.map(f => {
  const mv = f.shares * f.nav;
  const profit = mv - f.cost;
  const rate = profit / f.cost;
  const distMa20 = f.account === "场内" ? ((f.nav - (f.ma20 || f.nav)) / (f.ma20 || f.nav) * 100) : 0;
  return { ...f, mv, profit, rate, distMa20 };
});
const totalMv = fundsWithCalc.reduce((s, f) => s + f.mv, 0);
const totalCost = fundsWithCalc.reduce((s, f) => s + f.cost, 0);
const totalProfit = totalMv - totalCost;
const totalProfitRate = totalProfit / totalCost;
const totalAssets = totalMv + cashYuebao + cashSec;
const fundsWithWeight = fundsWithCalc.map((f) => ({ ...f, weight: f.mv / totalAssets, daily: (f.nav - f.prevNav) * f.shares }));

// ==========================================
// Python硬算: 分类统计
// ==========================================
const techA = fundsWithCalc.filter(f => f.category === "A股硬科技").reduce((s, f) => s + f.mv, 0);
const techHk = fundsWithCalc.filter(f => f.category === "港股ETF").reduce((s, f) => s + f.mv, 0);
const bonds = fundsWithCalc.filter(f => f.category === "债券").reduce((s, f) => s + f.mv, 0);
const goldMv = fundsWithCalc.filter(f => f.category === "黄金").reduce((s, f) => s + f.mv, 0);
const cashTotal = cashYuebao + cashSec;
const indexFund = fundsWithCalc.filter(f => f.category === "宽基指数").reduce((s, f) => s + f.mv, 0);

// ==========================================
// 仓位规则监控
// ==========================================
const r1 = techA / totalAssets;
const r3 = (techA + techHk + goldMv) / totalAssets;
const r4 = Math.max(...fundsWithWeight.map(f => f.weight));
const defenseRatio = (bonds + cashTotal) / totalAssets;

const hardAlert = defenseRatio < 0.15;
const softAlert = r1 > 0.35 || r3 > 0.65 || r4 > 0.20;

// ==========================================
// 四阶段趋势判定（仅ETF）
// ==========================================
const stageColors = ["bg-red-100 text-red-700", "bg-orange-100 text-orange-700", "bg-yellow-100 text-yellow-700", "bg-green-100 text-green-700"];

function getTrendStage(f: typeof fundData[0]) {
  if (f.account !== "场内" || !f.ma20 || !f.ma60) return null;
  const nav = f.nav;
  const ma20 = f.ma20;
  const ma60 = f.ma60;
  
  // 简化判定（实际需要K线计算MA20方向）
  if (nav > ma20 && ma20 > ma60) return { stage: 3, name: "趋势健康" };
  if (nav > ma20 && ma20 <= ma60) return { stage: 2, name: "趋势减弱" };
  if (nav <= ma20 && nav > ma60) return { stage: 1, name: "趋势危险" };
  return { stage: 0, name: "趋势破位" };
}

// ==========================================
// 逻辑验证状态显示
// ==========================================
function getLogicStatusColor(status: string) {
  switch(status) {
    case "normal": return "bg-green-100 text-green-700";
    case "warning": return "bg-yellow-100 text-yellow-700";
    case "broken": return "bg-red-100 text-red-700";
    default: return "bg-slate-100 text-slate-600";
  }
}

function getLogicStatusText(status: string) {
  switch(status) {
    case "normal": return "✅ 正常";
    case "warning": return "⚠️ 预警";
    case "broken": return "❌ 破坏";
    default: return "—";
  }
}

// ==========================================
// 建议动作生成（模糊化 + 基于回测结论）
// 回测表明：趋势破位后20天胜率<50%，有参考价值但不够作为交易信号
// ==========================================
function getAdvice(f: typeof fundsWithCalc[0], stage: {stage: number, name: string} | null, logic: LogicVerify) {
  // 场外基金：基于逻辑验证
  if (f.account === "场外") {
    if (logic.status1 === "broken" && logic.status2 === "broken") return "双指标均破坏，建议考虑减仓";
    if (logic.status1 === "broken") return "主要逻辑已破坏，需结合盈亏考虑是否退出";
    if (logic.status1 === "warning") return "主要逻辑受挑战，建议关注验证指标变化";
    if (logic.status2 === "broken") return "次要指标已破坏，建议关注";
    return "逻辑正常，按硬约束监控持仓";
  }
  
  // ETF：技术面+逻辑面组合
  if (!stage) return "数据不足，关注逻辑验证";
  
  const techBroken = stage.stage <= 1;
  const logicBroken = logic.status1 === "broken" || logic.status2 === "broken";
  const logicWarning = logic.status1 === "warning" || logic.status2 === "warning";
  
  if (techBroken && logicBroken) return "技术面+逻辑面双破，可考虑减仓";
  if (techBroken && logicWarning) return "技术面走坏+逻辑预警，可考虑部分减仓";
  if (techBroken && !logicBroken && !logicWarning) return "技术面走坏但逻辑正常，可能是正常回调";
  if (!techBroken && logicBroken) return "技术面正常但逻辑破坏，警惕趋势反转";
  if (!techBroken && logicWarning) return "技术面正常但逻辑预警，保持观察";
  if (stage.stage === 3) return "趋势健康，可考虑持有";
  if (stage.stage === 2) return "趋势减弱，关注是否修复";
  return "保持观察";
}

// ==========================================
// 板块雷达
// ==========================================
const sectorRadar = [
  { name: "恒生指数", change: 2.36, direction: "in" as const, trend: "港股大涨", relevance: "持仓" as const },
  { name: "非银金融", change: 3.28, direction: "in" as const, trend: "资金流入", relevance: "监控" as const },
  { name: "创新药", change: -3.52, direction: "out" as const, trend: "板块回调", relevance: "持仓" as const },
  { name: "中证商品", change: -0.59, direction: "out" as const, trend: "震荡", relevance: "监控" as const },
  { name: "半导体", change: -1.85, direction: "out" as const, trend: "回调", relevance: "持仓" as const },
  { name: "人工智能", change: 1.72, direction: "in" as const, trend: "活跃", relevance: "监控" as const },
];

function formatNum(n: number) {
  return n.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function formatPct(n: number) {
  return (n * 100).toFixed(2) + "%";
}

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
  return { lastUpdate: lastUpdate.toLocaleString("zh-CN"), nextUpdate };
}

// ==========================================
// 主组件
// ==========================================
export default function App() {
  const { lastUpdate, nextUpdate } = useAutoRefresh();

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-[#1F4E78] text-white py-4 px-6 shadow-lg">
        <div className="max-w-7xl mx-auto flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Brain className="w-7 h-7" />
            <div>
              <h1 className="text-xl font-bold">AI智能投资决策系统 v4.5.1</h1>
              <p className="text-xs text-slate-300">逻辑验证指标校准版 | 数据日期: {dataDateText} | 每日自动更新</p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-slate-500">|</span>
            <Database className="w-4 h-4 text-blue-300" />
            <span>Wind万得</span>
            <Clock className="w-4 h-4 text-blue-300" />
            <span>{lastUpdate}</span>
            <span className="px-2 py-1 bg-white/10 rounded-full text-xs">
              <Bell className="w-3 h-3 inline mr-1 text-yellow-400" />
              下次更新: {nextUpdate}
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 space-y-4">
        {/* 硬约束 */}
        {hardAlert && (
          <Alert className="bg-red-50 border-red-300">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <AlertTitle className="text-red-700 font-bold">【防御底线不足】</AlertTitle>
            <AlertDescription className="text-red-600">
              债券+现金仅{formatPct(defenseRatio)}，低于15%底线
              <br/><strong>→ 必须增配债券或保留现金</strong>
            </AlertDescription>
          </Alert>
        )}

        {/* 一般提示 */}
        {softAlert && (
          <Alert className="bg-blue-50 border-blue-300">
            <AlertTriangle className="w-5 h-5 text-blue-600" />
            <AlertTitle className="text-blue-700 font-bold">【仓位提示】部分指标接近或超出建议范围</AlertTitle>
            <AlertDescription className="text-blue-600">
              {r1 > 0.35 && `A股硬科技${formatPct(r1)}超35%；`}
              {r3 > 0.65 && `科技合计${formatPct(r3)}超65%；`}
              {r4 > 0.20 && `单基金${formatPct(r4)}超20%`}
              <br/><strong>→ 结合盈亏情况逐步调整，非强制</strong>
            </AlertDescription>
          </Alert>
        )}

        {/* Tab */}
        <Tabs defaultValue="holdings" className="w-full">
          <TabsList className="grid grid-cols-5 w-full">
            <TabsTrigger value="radar"><Radar className="w-4 h-4 mr-1" />板块雷达</TabsTrigger>
            <TabsTrigger value="holdings"><Crosshair className="w-4 h-4 mr-1" />持仓明细</TabsTrigger>
            <TabsTrigger value="allocation"><BarChart3 className="w-4 h-4 mr-1" />资产配置</TabsTrigger>
            <TabsTrigger value="trend"><Activity className="w-4 h-4 mr-1" />趋势分析</TabsTrigger>
            <TabsTrigger value="logic"><FileText className="w-4 h-4 mr-1" />逻辑验证</TabsTrigger>
          </TabsList>

          {/* ========== 持仓明细 ========== */}
          <TabsContent value="holdings" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card className="bg-white"><CardContent className="p-4"><div className="text-sm text-muted-foreground">总资产</div><div className="text-2xl font-bold text-[#1F4E78]">{formatNum(totalAssets)}</div></CardContent></Card>
              <Card className="bg-white"><CardContent className="p-4"><div className="text-sm text-muted-foreground">持仓金额</div><div className="text-2xl font-bold">{formatNum(totalMv)}</div></CardContent></Card>
              <Card className="bg-white"><CardContent className="p-4"><div className="text-sm text-muted-foreground">总盈亏</div><div className={`text-2xl font-bold ${totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{totalProfit >= 0 ? '+' : ''}{formatNum(totalProfit)} ({formatPct(totalProfitRate)})</div></CardContent></Card>
              <Card className="bg-white"><CardContent className="p-4"><div className="text-sm text-muted-foreground">现金余额</div><div className="text-2xl font-bold text-blue-600">{formatNum(cashTotal)} ({formatPct(cashTotal / totalAssets)})</div></CardContent></Card>
            </div>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-lg">持仓明细</CardTitle></CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="bg-slate-100 text-left"><th className="px-3 py-2">基金</th><th className="px-3 py-2 text-right">最新净值</th><th className="px-3 py-2 text-right">当日涨跌</th><th className="px-3 py-2 text-right">市值</th><th className="px-3 py-2 text-right">盈亏率</th><th className="px-3 py-2 text-center">监控方式</th><th className="px-3 py-2 text-center">建议</th></tr></thead>
                    <tbody>
                      {fundsWithWeight.map((f, i) => {
                        const stage = getTrendStage(f);
                        const logic = logicVerifyMap[f.code];
                        const iconIdx = stage ? stage.stage : -1;
                        return (
                        <tr key={f.code} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                          <td className="px-3 py-2.5">
                            <div className="font-medium">{f.name}</div>
                            <div className="text-xs text-muted-foreground">{f.code} · {f.type}</div>
                            <div className="text-xs text-blue-600">{f.monitorIndex}</div>
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono text-blue-700">{f.nav.toFixed(4)}</td>
                          <td className={`px-3 py-2.5 text-right font-mono font-bold ${(f.daily >= 0) ? 'text-green-600' : 'text-red-600'}`}>{(f.daily >= 0) ? '+' : ''}{formatNum(f.daily)}</td>
                          <td className="px-3 py-2.5 text-right font-mono">{formatNum(f.mv)}</td>
                          <td className={`px-3 py-2.5 text-right font-bold ${f.rate >= 0 ? 'text-green-600' : 'text-red-600'}`}>{f.rate >= 0 ? '+' : ''}{formatPct(f.rate)}</td>
                          <td className="px-3 py-2.5 text-center">
                            {f.account === "场内" && stage && iconIdx >= 0 ? (
                              <div className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-bold ${stageColors[iconIdx]}`}>
                                {iconIdx === 0 && <TrendingDown className="w-3 h-3" />}
                                {iconIdx === 1 && <AlertTriangle className="w-3 h-3" />}
                                {iconIdx === 2 && <Activity className="w-3 h-3" />}
                                {iconIdx === 3 && <TrendingUp className="w-3 h-3" />}
                                {stage.name}
                              </div>
                            ) : (
                              <Badge variant="outline">逻辑验证</Badge>
                            )}
                            {logic && (
                              <div className={`inline-block mt-1 px-2 py-0.5 rounded text-xs ${getLogicStatusColor(logic.status1)}`}>
                                {getLogicStatusText(logic.status1)}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-center text-xs max-w-[150px]">
                            {getAdvice(f, stage, logic)}
                          </td>
                        </tr>
                      )})}
                      <tr className="bg-[#1F4E78] text-white font-bold text-base">
                        <td className="px-3 py-3">合计</td>
                        <td colSpan={3} className="text-center text-muted-foreground">—</td>
                        <td className={`px-3 py-3 text-right font-mono ${totalProfit >= 0 ? 'text-green-300' : 'text-red-300'}`}>{totalProfit >= 0 ? '+' : ''}{formatPct(totalProfitRate)}</td>
                        <td colSpan={2} className="text-center text-muted-foreground">—</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* 交易历史 */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-lg">交易历史</CardTitle></CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="bg-slate-100 text-left"><th className="px-3 py-2">日期</th><th className="px-3 py-2">基金</th><th className="px-3 py-2">类型</th><th className="px-3 py-2 text-right">金额</th><th className="px-3 py-2 text-right">净值</th><th className="px-3 py-2 text-right">份额</th><th className="px-3 py-2">备注</th></tr></thead>
                    <tbody>
                      {transactionHistory.map((t, i) => (
                        <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                          <td className="px-3 py-2">{t.date}</td>
                          <td className="px-3 py-2">{t.name} ({t.code})</td>
                          <td className="px-3 py-2"><Badge className={t.type === "买入" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}>{t.type}</Badge></td>
                          <td className="px-3 py-2 text-right font-mono">{t.amount.toLocaleString()}</td>
                          <td className="px-3 py-2 text-right font-mono">{t.nav.toFixed(4)}</td>
                          <td className="px-3 py-2 text-right font-mono">{t.shares.toFixed(2)}</td>
                          <td className="px-3 py-2 text-muted-foreground">{t.note || "—"}</td>
                        </tr>
                      ))}
                      {transactionHistory.length === 0 && (
                        <tr><td colSpan={7} className="px-3 py-4 text-center text-muted-foreground">暂无交易记录</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ========== 板块雷达 ========== */}
          <TabsContent value="radar" className="mt-4">
            <Card>
              <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Radar className="w-5 h-5" /> 板块资金流向雷达</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {sectorRadar.map(s => (
                    <div key={s.name} className={`p-3 rounded-lg border ${s.relevance === '持仓' ? 'border-blue-300 bg-blue-50' : 'border-slate-200 bg-white'}`}>
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{s.name}</span>
                        <span className={`text-lg font-bold ${s.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>{s.change >= 0 ? '+' : ''}{s.change}%</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant={s.direction === 'in' ? 'default' : 'destructive'}>{s.direction === 'in' ? '流入' : '流出'}</Badge>
                        <span className="text-xs text-muted-foreground">{s.trend}</span>
                        {s.relevance === '持仓' && <Badge className="bg-blue-500 text-white">持仓</Badge>}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ========== 资产配置 ========== */}
          <TabsContent value="allocation" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-lg">资产分类占比</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div><div className="flex justify-between text-sm mb-1"><span>A股硬科技</span><span className="font-bold">{formatPct(techA / totalAssets)}</span></div><Progress value={(techA / totalAssets) * 100} className="h-2" /></div>
                  <div><div className="flex justify-between text-sm mb-1"><span>港股科技</span><span className="font-bold">{formatPct(techHk / totalAssets)}</span></div><Progress value={(techHk / totalAssets) * 100} className="h-2 bg-blue-100" /></div>
                  <div><div className="flex justify-between text-sm mb-1"><span>宽基指数</span><span className="font-bold">{formatPct(indexFund / totalAssets)}</span></div><Progress value={(indexFund / totalAssets) * 100} className="h-2 bg-purple-100" /></div>
                  <div><div className="flex justify-between text-sm mb-1"><span>债券</span><span className="font-bold">{formatPct(bonds / totalAssets)}</span></div><Progress value={(bonds / totalAssets) * 100} className="h-2 bg-green-100" /></div>
                  <div><div className="flex justify-between text-sm mb-1"><span>黄金</span><span className="font-bold">{formatPct(goldMv / totalAssets)}</span></div><Progress value={(goldMv / totalAssets) * 100} className="h-2 bg-yellow-100" /></div>
                  <div><div className="flex justify-between text-sm mb-1"><span>现金</span><span className="font-bold">{formatPct(cashTotal / totalAssets)}</span></div><Progress value={(cashTotal / totalAssets) * 100} className="h-2 bg-slate-100" /></div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-lg">仓位规则监控</CardTitle></CardHeader>
                <CardContent className="p-0">
                  <table className="w-full text-sm">
                    <thead><tr className="bg-slate-100"><th className="px-3 py-2 text-left">规则</th><th className="px-3 py-2">当前</th><th className="px-3 py-2">建议</th><th className="px-3 py-2">状态</th></tr></thead>
                    <tbody>
                      <tr className="bg-white"><td className="px-3 py-2">A股硬科技</td><td className="px-3 py-2 text-right">{formatPct(r1)}</td><td className="px-3 py-2 text-right">≤35%</td><td className="px-3 py-2 text-center"><Badge className={r1 > 0.35 ? 'bg-blue-400 text-white' : 'bg-green-500 text-white'}>{r1 > 0.35 ? '一般提示' : '合规'}</Badge></td></tr>
                      <tr className="bg-slate-50"><td className="px-3 py-2">科技合计</td><td className="px-3 py-2 text-right">{formatPct(r3)}</td><td className="px-3 py-2 text-right">≤65%</td><td className="px-3 py-2 text-center"><Badge className={r3 > 0.65 ? 'bg-blue-400 text-white' : 'bg-green-500 text-white'}>{r3 > 0.65 ? '一般提示' : '合规'}</Badge></td></tr>
                      <tr className="bg-white"><td className="px-3 py-2">单基金上限</td><td className="px-3 py-2 text-right">{formatPct(r4)}</td><td className="px-3 py-2 text-right">≤20%</td><td className="px-3 py-2 text-center"><Badge className={r4 > 0.20 ? 'bg-blue-400 text-white' : 'bg-green-500 text-white'}>{r4 > 0.20 ? '一般提示' : '合规'}</Badge></td></tr>
                      <tr className="bg-slate-50"><td className="px-3 py-2">防御底线</td><td className="px-3 py-2 text-right">{formatPct(defenseRatio)}</td><td className="px-3 py-2 text-right">≥15%</td><td className="px-3 py-2 text-center"><Badge className={defenseRatio < 0.15 ? 'bg-red-500 text-white' : 'bg-green-500 text-white'}>{defenseRatio < 0.15 ? '不足' : '合规'}</Badge></td></tr>
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ========== 趋势分析（仅ETF） ========== */}
          <TabsContent value="trend" className="space-y-4 mt-4">
            <Card className="bg-gradient-to-r from-[#1F4E78] to-slate-700 text-white">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <Activity className="w-10 h-10 text-yellow-400 flex-shrink-0 mt-1" />
                  <div>
                    <h3 className="text-xl font-bold mb-2">ETF四阶段趋势跟踪</h3>
                    <p className="text-sm text-slate-100 leading-relaxed">
                      仅场内ETF使用K线计算趋势阶段。场外基金因无实时K线数据，采用逻辑验证。
                      <br/>趋势阶段：趋势健康→趋势减弱→趋势危险→趋势破位。不同阶段跟踪规则不同。
                      <br/>回测结论：均线完全滞后于拐点（顶部后5天转弱，底部后30天转强），仅作状态确认。
                      <strong>具体决策由您结合逻辑验证判断。</strong>
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {fundsWithCalc.filter(f => f.account === "场内").map(f => {
                const stage = getTrendStage(f);
                if (!stage) return null;
                const iconIndex = stage.stage;
                const logic = logicVerifyMap[f.code];
                return (
                  <Card key={f.code} className={stage.stage >= 2 ? 'border-green-300' : stage.stage === 1 ? 'border-yellow-300' : 'border-red-300'}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">{f.name}</CardTitle>
                        <div className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-bold ${stageColors[iconIndex]}`}>
                          {iconIndex === 0 && <TrendingDown className="w-3 h-3" />}
                          {iconIndex === 1 && <AlertTriangle className="w-3 h-3" />}
                          {iconIndex === 2 && <Activity className="w-3 h-3" />}
                          {iconIndex === 3 && <TrendingUp className="w-3 h-3" />}
                          {stage.name}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="p-2 bg-slate-50 rounded">
                          <div className="text-xs text-muted-foreground">MA20</div>
                          <div className="font-mono">{f.ma20?.toFixed(3)}</div>
                          <div className={`text-xs ${f.nav > (f.ma20 || 0) ? 'text-green-600' : 'text-red-600'}`}>{f.nav > (f.ma20 || 0) ? '价格在上' : '价格在下'}</div>
                        </div>
                        <div className="p-2 bg-slate-50 rounded">
                          <div className="text-xs text-muted-foreground">MA60</div>
                          <div className="font-mono">{f.ma60?.toFixed(3)}</div>
                          <div className={`text-xs ${(f.ma20 || 0) > (f.ma60 || 0) ? 'text-green-600' : 'text-red-600'}`}>{(f.ma20 || 0) > (f.ma60 || 0) ? 'MA20在上' : 'MA20在下'}</div>
                        </div>
                      </div>
                      {f.stateNote && <div className="text-xs text-blue-600 bg-blue-50 p-2 rounded">{f.stateNote}</div>}
                      <div className="p-2 bg-slate-50 rounded">
                        <div className="text-xs text-muted-foreground mb-1">逻辑验证</div>
                        <div className={`text-xs font-bold ${getLogicStatusColor(logic.status1)} inline-block px-2 py-0.5 rounded`}>
                          {getLogicStatusText(logic.status1)}
                        </div>
                        {logic.indicator1 && <div className="text-xs mt-1">{logic.indicator1}</div>}
                      </div>
                      <div className="text-xs font-medium text-slate-700 pt-1 border-t">
                        建议：{getAdvice(f, stage, logic)}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          {/* ========== 逻辑验证（核心Tab） ========== */}
          <TabsContent value="logic" className="space-y-4 mt-4">
            <Card className="bg-gradient-to-r from-[#1F4E78] to-slate-700 text-white">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <FileText className="w-10 h-10 text-yellow-400 flex-shrink-0 mt-1" />
                  <div>
                    <h3 className="text-xl font-bold mb-2">逻辑验证追踪（v4.5.1校准版）</h3>
                    <p className="text-sm text-slate-100 leading-relaxed">
                      系统根据基金类型自动推断应监控的指标，每日更新时搜索判断指标状态。
                      <br/>所有指标已校准为Wind可获取数据，阈值基于2021-2026回测设定。
                      <br/>趋势指标滞后5-30天，无法预测拐点，仅用于"状态确认"。
                      <strong>决策由您做，系统负责监控和提醒。</strong>
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 场外基金逻辑验证 */}
            <div className="space-y-3">
              <h3 className="text-lg font-bold text-slate-700">场外基金（逻辑验证为主）</h3>
              <div className="text-xs text-slate-500 bg-slate-100 p-2 rounded">所有指标已校准为Wind可获取数据，不可回测指标（费城半导体/SOX/南向资金/存储芯片/DXI/创新药出海）已替换为可回测替代指标</div>
              {fundsWithCalc.filter(f => f.account === "场外").map(f => {
                const logic = logicVerifyMap[f.code];
                if (!logic) return null;
                return (
                  <Card key={f.code}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">{f.name} <span className="text-sm font-normal text-muted-foreground">{f.code}</span></CardTitle>
                        <div className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-bold ${getLogicStatusColor(logic.status1)}`}>
                          {getLogicStatusText(logic.status1)}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="p-3 bg-slate-50 rounded-lg">
                          <div className="text-xs text-muted-foreground mb-1">验证指标1</div>
                          <div className="font-medium">{logic.indicator1}</div>
                          <div className="text-xs text-slate-500 mt-1">来源：{logic.source1}</div>
                          <div className="text-xs text-slate-500">破坏阈值：{logic.threshold1}</div>
                          <div className={`text-xs font-bold mt-1 inline-block px-2 py-0.5 rounded ${getLogicStatusColor(logic.status1)}`}>
                            {getLogicStatusText(logic.status1)}
                          </div>
                        </div>
                        {logic.indicator2 && (
                          <div className="p-3 bg-slate-50 rounded-lg">
                            <div className="text-xs text-muted-foreground mb-1">验证指标2</div>
                            <div className="font-medium">{logic.indicator2}</div>
                            <div className="text-xs text-slate-500 mt-1">来源：{logic.source2}</div>
                            <div className="text-xs text-slate-500">破坏阈值：{logic.threshold2}</div>
                            <div className={`text-xs font-bold mt-1 inline-block px-2 py-0.5 rounded ${getLogicStatusColor(logic.status2 || "normal")}`}>
                              {getLogicStatusText(logic.status2 || "normal")}
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="p-2 bg-blue-50 rounded text-xs text-blue-700">
                        <span className="font-bold">建议：</span>{getAdvice(f, null, logic)}
                      </div>
                      <div className="text-xs text-muted-foreground">更新频率：每日15:30自动更新 | 指标状态需AI根据Wind数据判断后手动更新</div>
                      <div className="text-xs text-orange-600 bg-orange-50 p-1 rounded mt-1">v4.5.1校准：不可回测指标已替换为Wind可获取数据</div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* ETF逻辑验证 */}
            <div className="space-y-3">
              <h3 className="text-lg font-bold text-slate-700">ETF（趋势+逻辑双验证）</h3>
              <div className="text-xs text-slate-500 bg-slate-100 p-2 rounded">趋势指标滞后5-30天，仅作状态确认；回测显示破位后20天胜率&lt;50%，有参考价值但非交易信号</div>
              {fundsWithCalc.filter(f => f.account === "场内").map(f => {
                const logic = logicVerifyMap[f.code];
                const stage = getTrendStage(f);
                if (!logic || !stage) return null;
                return (
                  <Card key={f.code} className={stage.stage >= 2 ? 'border-l-4 border-l-green-400' : stage.stage === 1 ? 'border-l-4 border-l-yellow-400' : 'border-l-4 border-l-red-400'}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">{f.name} <span className="text-sm font-normal text-muted-foreground">{f.code}</span></CardTitle>
                        <div className="flex gap-2">
                          <div className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-bold ${stageColors[stage.stage]}`}>
                            {stage.name}
                          </div>
                          <div className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-bold ${getLogicStatusColor(logic.status1)}`}>
                            {getLogicStatusText(logic.status1)}
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="p-2 bg-slate-50 rounded">
                          <div className="text-xs text-muted-foreground">监控指数</div>
                          <div className="font-medium">{f.monitorIndex}</div>
                        </div>
                        <div className="p-2 bg-slate-50 rounded">
                          <div className="text-xs text-muted-foreground">趋势阶段</div>
                          <div className={`font-medium ${stage.stage >= 2 ? 'text-green-600' : stage.stage === 1 ? 'text-yellow-600' : 'text-red-600'}`}>{stage.name}</div>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="p-3 bg-slate-50 rounded-lg">
                          <div className="text-xs text-muted-foreground mb-1">验证指标1</div>
                          <div className="font-medium">{logic.indicator1}</div>
                          <div className="text-xs text-slate-500">阈值：{logic.threshold1}</div>
                          <div className={`text-xs font-bold mt-1 inline-block px-2 py-0.5 rounded ${getLogicStatusColor(logic.status1)}`}>
                            {getLogicStatusText(logic.status1)}
                          </div>
                        </div>
                        {logic.indicator2 && (
                          <div className="p-3 bg-slate-50 rounded-lg">
                            <div className="text-xs text-muted-foreground mb-1">验证指标2</div>
                            <div className="font-medium">{logic.indicator2}</div>
                            <div className="text-xs text-slate-500">阈值：{logic.threshold2}</div>
                            <div className={`text-xs font-bold mt-1 inline-block px-2 py-0.5 rounded ${getLogicStatusColor(logic.status2 || "normal")}`}>
                              {getLogicStatusText(logic.status2 || "normal")}
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="p-3 bg-blue-50 rounded-lg text-sm">
                        <div className="font-bold text-blue-800 mb-1">组合判断</div>
                        <div className="text-blue-700">技术面：{stage.name} | 逻辑面：{getLogicStatusText(logic.status1).replace(/[✅⚠️❌]/, '').trim()}</div>
                        <div className="text-blue-700 mt-1">建议：{getAdvice(f, stage, logic)}</div>
                        <div className="text-xs text-muted-foreground mt-2">更新频率：每日15:30自动更新 | 指标状态需AI根据Wind数据判断后手动更新</div>
                        <div className="text-xs text-orange-600 bg-orange-50 p-1 rounded mt-1">v4.5.1校准：趋势滞后5-30天，仅作状态确认；破位后20天胜率约35-42%</div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
