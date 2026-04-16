"use client";

import { AuthUser, User } from "@/types/arena";
import { createContext, useContext } from "react";

interface GraphActions {
    removeNode: (id: string) => void;
    selectedOnGraph: null | string;
    setUser: (token: string | null) => void;
    user: null | AuthUser;
    makeConnection: (id: string, type: string, channels: string[]) => void;
}
  
export const GraphContext = createContext<GraphActions>({ 
    removeNode: () => {}, 
    selectedOnGraph: null,
    setUser: () => {},
    user: null,
    makeConnection: () => {}
});

export const useGraphActions = () => useContext(GraphContext);