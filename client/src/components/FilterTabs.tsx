import React from "react";
import { Tabs, TabsList, TabsTrigger } from "./ui/tabs";

// Chat feature is disabled until moderation tooling is production-ready
type FeedFilter = "all" | "incidents";

interface FilterTabsProps {
  filter: FeedFilter;
  onFilterChange: (filter: FeedFilter) => void;
  className?: string;
}

export default function FilterTabs({ filter, onFilterChange, className = "" }: FilterTabsProps) {
  return (
    <div
      className={`border-b bg-background px-3 py-2 ${className}`}
      role="tablist"
    >
      <Tabs value={filter} onValueChange={(val) => onFilterChange(val as FeedFilter)} className="w-full">
        <TabsList className="grid w-full grid-cols-2 bg-muted rounded-lg p-1">
          <TabsTrigger 
            value="all" 
            className="rounded-md data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            data-testid="tab-all"
          >
            All
          </TabsTrigger>
          <TabsTrigger 
            value="incidents" 
            className="rounded-md data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            data-testid="tab-incidents"
          >
            Incidents
          </TabsTrigger>
          {/* Chat tab hidden until moderation tooling is production-ready
          <TabsTrigger 
            value="chat" 
            className="rounded-md data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            Chat
          </TabsTrigger>
          */}
        </TabsList>
      </Tabs>
    </div>
  );
}