import { useState } from 'react';
import { ChevronDown, ChevronUp, Clock, Database, FileOutput, CheckCircle2, Circle } from 'lucide-react';
import type { SOPStep } from '@/types';

interface SOPStepCardProps {
  step: SOPStep;
  index: number;
  onToggle: (id: string) => void;
}

export function SOPStepCard({ step, index, onToggle }: SOPStepCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`border rounded-lg transition-all ${
      step.isCompleted ? 'bg-green-50/50 border-green-200' : 'bg-white border-gray-200'
    }`}>
      <div
        className="flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-50/50"
        onClick={() => setExpanded(!expanded)}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggle(step.id);
          }}
          className="flex-shrink-0"
        >
          {step.isCompleted ? (
            <CheckCircle2 className="w-5 h-5 text-green-500" />
          ) : (
            <Circle className="w-5 h-5 text-gray-300" />
          )}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-500">步骤 {index + 1}</span>
            {step.isRequired && (
              <span className="text-[10px] px-1.5 py-0.5 bg-red-50 text-red-600 rounded font-medium">必需</span>
            )}
          </div>
          <h4 className={`font-semibold text-sm ${step.isCompleted ? 'line-through opacity-60' : ''}`}>
            {step.title}
          </h4>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Clock className="w-3.5 h-3.5" />
          <span>{step.estimatedMinutes}min</span>
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </div>

      {expanded && (
        <div className="px-3 pb-3 pt-1 border-t border-gray-100">
          <p className="text-sm text-gray-600 mb-3">{step.description}</p>

          <div className="space-y-3">
            <div>
              <h5 className="text-xs font-semibold text-gray-700 mb-1.5 flex items-center gap-1">
                <FileOutput className="w-3.5 h-3.5" /> 操作指引
              </h5>
              <ol className="text-xs text-gray-600 space-y-1 ml-4 list-decimal">
                {step.instructions.map((inst, i) => (
                  <li key={i}>{inst}</li>
                ))}
              </ol>
            </div>

            <div>
              <h5 className="text-xs font-semibold text-gray-700 mb-1 flex items-center gap-1">
                <Database className="w-3.5 h-3.5" /> 数据来源
              </h5>
              <div className="flex flex-wrap gap-1">
                {step.dataSources.map((src, i) => (
                  <span key={i} className="text-[10px] px-2 py-0.5 bg-blue-50 text-blue-600 rounded">
                    {src}
                  </span>
                ))}
              </div>
            </div>

            <div className="bg-gray-50 rounded p-2">
              <h5 className="text-xs font-semibold text-gray-700 mb-0.5">预期输出</h5>
              <p className="text-xs text-gray-600">{step.expectedOutput}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
