"use client";

import { User } from "@/types/arena";
import { createContext, useContext } from "react";

interface GraphActions {
    removeNode: (id: string) => void;
    selectedOnGraph: null | string;
    setUser: (token: string | null) => void;
    user: null | User;
    
}
  
export const GraphContext = createContext<GraphActions>({ 
    removeNode: () => {}, 
    selectedOnGraph: null,
    setUser: () => {},
    user: null
});

export const useGraphActions = () => useContext(GraphContext);