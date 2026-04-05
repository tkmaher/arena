"use client";

import { createContext, useContext } from "react";

interface GraphActions {
    removeNode: (id: string) => void;
    selectedOnGraph: null | string;
}
  
export const GraphContext = createContext<GraphActions>({ removeNode: () => {}, selectedOnGraph: null });
export const useGraphActions = () => useContext(GraphContext);