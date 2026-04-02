"use client";

import { createContext, useContext } from "react";

interface GraphActions {
    removeNode: (id: string) => void;
}
  
export const GraphContext = createContext<GraphActions>({ removeNode: () => {} });
export const useGraphActions = () => useContext(GraphContext);