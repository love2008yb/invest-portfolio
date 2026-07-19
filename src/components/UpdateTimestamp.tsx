import { Clock } from 'lucide-react';

export function UpdateTimestamp() {
  const lastUpdated = '2026-07-16 16:18';
  const dataDate = '2026-07-16 (收盘后)';

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 flex items-center gap-2 text-xs text-amber-800">
      <Clock className="w-3.5 h-3.5 flex-shrink-0" />
      <div>
        <span className="font-medium">数据更新时间: {lastUpdated}</span>
        <span className="text-amber-600 ml-2">(数据截至: {dataDate})</span>
        <span className="text-amber-500 ml-2">| 刷新网页不会自动更新数据，需要来对话框说"更新数据"</span>
      </div>
    </div>
  );
}
