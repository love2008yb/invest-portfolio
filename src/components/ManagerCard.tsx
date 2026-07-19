import { Star, TrendingDown, User, BarChart3 } from 'lucide-react';
import type { ManagerEvaluation } from '@/types';

interface ManagerCardProps {
  eval: ManagerEvaluation;
}

const trustConfig = {
  '高度信任': 'bg-green-50 text-green-700 border-green-200',
  '信任但观察': 'bg-yellow-50 text-yellow-700 border-yellow-200',
  '不信任': 'bg-red-50 text-red-700 border-red-200',
};

export function ManagerCard({ eval: e }: ManagerCardProps) {
  const dims = [
    { key: 'stability', label: '任职稳定性', icon: User, weight: '15%', score: e.dimensions.stability },
    { key: 'performance', label: '业绩持续性', icon: Star, weight: '25%', score: e.dimensions.performance },
    { key: 'styleConsistency', label: '风格稳定性', icon: BarChart3, weight: '20%', score: e.dimensions.styleConsistency },
    { key: 'scaleFit', label: '规模适配性', icon: BarChart3, weight: '15%', score: e.dimensions.scaleFit },
    { key: 'drawdownControl', label: '回撤控制力', icon: TrendingDown, weight: '25%', score: e.dimensions.drawdownControl },
  ];

  const percentage = (e.totalScore / e.maxScore) * 100;

  return (
    <div className="bg-white border rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h4 className="font-bold text-gray-900">{e.fundName}</h4>
          <p className="text-sm text-gray-500">{e.manager}</p>
        </div>
        <span className={`text-xs px-2 py-1 rounded-full border font-medium ${trustConfig[e.trustLevel]}`}>
          {e.trustLevel}
        </span>
      </div>

      <div className="flex items-baseline gap-2 mb-3">
        <span className="text-3xl font-bold text-gray-900">{e.totalScore}</span>
        <span className="text-sm text-gray-500">/ {e.maxScore}</span>
        <div className="ml-auto w-24 bg-gray-100 rounded-full h-2">
          <div
            className={`h-2 rounded-full ${
              percentage >= 80 ? 'bg-green-500' : percentage >= 60 ? 'bg-yellow-500' : 'bg-red-500'
            }`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>

      <div className="space-y-2">
        {dims.map((dim) => {
          const Icon = dim.icon;
          const pct = (dim.score.score / dim.score.maxScore) * 100;
          return (
            <div key={dim.key} className="flex items-center gap-2">
              <Icon className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
              <span className="text-xs text-gray-600 w-20 flex-shrink-0">{dim.label}</span>
              <span className="text-[10px] text-gray-400 w-8">{dim.weight}</span>
              <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                <div
                  className={`h-1.5 rounded-full ${
                    pct >= 80 ? 'bg-green-500' : pct >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-xs font-medium w-10 text-right">{dim.score.score}</span>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-gray-500 mt-3 pt-2 border-t">{e.dimensions.performance.note}</p>
    </div>
  );
}
