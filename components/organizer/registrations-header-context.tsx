'use client';

import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';

export type RegistrationHeaderActions = {
  onExport: () => void;
  onRefresh: () => void;
  exportDisabled: boolean;
  refreshing: boolean;
};

export type RegistrationsHeaderContextValue = {
  fromDate: string;
  toDate: string;
  setFromDate: (value: string) => void;
  setToDate: (value: string) => void;
  actions: RegistrationHeaderActions | null;
  setActions: (actions: RegistrationHeaderActions | null) => void;
  dashboardControls: ReactNode | null;
  setDashboardControls: (controls: ReactNode | null) => void;
};

export const RegistrationsHeaderContext = createContext<RegistrationsHeaderContextValue | null>(null);

export function useRegistrationsHeader() {
  const context = useContext(RegistrationsHeaderContext);
  if (!context) throw new Error('useRegistrationsHeader must be used inside OrganizerShell.');
  return context;
}
