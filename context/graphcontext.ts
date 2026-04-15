"use client";

import { User } from "@/types/arena";
import { createContext, useContext } from "react";

interface GraphActions {
    removeNode: (id: string) => void;
    selectedOnGraph: null | string;
    setUser: (token: string) => void;
    user: null | User;
    token: string | null;
    
}
  
export const GraphContext = createContext<GraphActions>({ 
    removeNode: () => {}, 
    selectedOnGraph: null,
    setUser: () => {},
    token: null,
    user: null
});

export const useGraphActions = () => useContext(GraphContext);