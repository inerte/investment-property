"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PlusCircle } from "lucide-react";

export type Scenario = {
  id: string;
  name: string;
  data: any;
};

interface ScenarioTabsProps {
  scenarios: Scenario[];
  activeScenario: string;
  onScenarioChange: (id: string) => void;
  onScenarioAdd: () => void;
  onScenarioRename: (id: string, newName: string) => void;
}

export function ScenarioTabs({
  scenarios,
  activeScenario,
  onScenarioChange,
  onScenarioAdd,
  onScenarioRename,
}: ScenarioTabsProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  const handleDoubleClick = (scenario: Scenario) => {
    setEditingId(scenario.id);
    setEditingName(scenario.name);
  };

  const handleRename = () => {
    if (editingId && editingName.trim()) {
      onScenarioRename(editingId, editingName.trim());
      setEditingId(null);
    }
  };

  return (
    <div className="flex items-center space-x-2 mb-4 overflow-x-auto pb-2">
      {scenarios.map((scenario) => (
        <div key={scenario.id} className="flex-shrink-0">
          {editingId === scenario.id ? (
            <div className="flex items-center space-x-1">
              <Input
                className="h-8 w-32"
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                onBlur={handleRename}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleRename();
                  if (e.key === "Escape") setEditingId(null);
                }}
                autoFocus
              />
            </div>
          ) : (
            <Button
              variant={activeScenario === scenario.id ? "default" : "outline"}
              className="h-8"
              onClick={() => onScenarioChange(scenario.id)}
              onDoubleClick={() => handleDoubleClick(scenario)}
            >
              {scenario.name}
            </Button>
          )}
        </div>
      ))}
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8"
        onClick={onScenarioAdd}
      >
        <PlusCircle className="h-4 w-4" />
      </Button>
    </div>
  );
}
