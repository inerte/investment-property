"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PlusCircle, Trash2, Copy } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Import the form schema type from MortgageCalculator
import type { FormSchema } from "./MortgageCalculator";

export type Scenario = {
  id: string;
  name: string;
  data: FormSchema;
};

interface ScenarioTabsProps {
  scenarios: Scenario[];
  activeScenario: string;
  onScenarioChange: (id: string) => void;
  onScenarioAdd: (cloneFrom?: string) => void;
  onScenarioRename: (id: string, newName: string) => void;
  onScenarioDelete: (id: string) => void;
}

export function ScenarioTabs({
  scenarios,
  activeScenario,
  onScenarioChange,
  onScenarioAdd,
  onScenarioRename,
  onScenarioDelete,
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

  const handleDelete = (id: string) => {
    if (scenarios.length > 1) {
      onScenarioDelete(id);
    }
  };

  return (
    <div className="flex items-center space-x-2 mb-4 overflow-x-auto pb-2">
      {scenarios.map((scenario) => (
        <div
          key={scenario.id}
          className="flex-shrink-0 flex items-center space-x-1"
        >
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
            <>
              <Button
                variant={activeScenario === scenario.id ? "default" : "outline"}
                className="h-8"
                onClick={() => onScenarioChange(scenario.id)}
                onDoubleClick={() => handleDoubleClick(scenario)}
              >
                {scenario.name}
              </Button>
              {scenarios.length > 1 && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDelete(scenario.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Delete this scenario</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-primary"
                      onClick={() => onScenarioAdd(scenario.id)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Create a copy of this scenario</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </>
          )}
        </div>
      ))}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => onScenarioAdd()}
            >
              <PlusCircle className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Create a new scenario</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}
