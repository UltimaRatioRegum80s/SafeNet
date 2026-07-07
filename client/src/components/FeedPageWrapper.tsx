import React, { useState, createContext, useContext } from "react";
import CommunityFeed from "../pages/community/Feed";

// Chat feature is disabled until moderation tooling is production-ready
// type FeedFilter = "all" | "incidents" | "chat";
type FeedFilter = "all" | "incidents";

const FilterContext = createContext<{
  filter: FeedFilter;
  setFilter: (filter: FeedFilter) => void;
}>({
  filter: "all",
  setFilter: () => {},
});

export const useFilter = () => useContext(FilterContext);

export default function FeedPageWrapper() {
  const [filter, setFilter] = useState<FeedFilter>("all");

  return (
    <FilterContext.Provider value={{ filter, setFilter }}>
      <CommunityFeed />
    </FilterContext.Provider>
  );
}