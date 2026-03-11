"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface ModelSelectorProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export default function ModelSelector({ value, onChange, disabled }: ModelSelectorProps) {
  return (
    <Select value={value} onValueChange={(v) => v && onChange(v)} disabled={disabled}>
      <SelectTrigger className="w-36 h-8 text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="openai">
          <span className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-green-500" />
            OpenAI
          </span>
        </SelectItem>
        <SelectItem value="claude">
          <span className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-orange-500" />
            Claude Sonnet
          </span>
        </SelectItem>
      </SelectContent>
    </Select>
  );
}
