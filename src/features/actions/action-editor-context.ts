import { createContext, useContext } from 'react';

export interface ActionEditorContextValue {
  /** Open the edit dialog for the node with this id. */
  openEditor: (id: string) => void;
}

export const ActionEditorContext = createContext<ActionEditorContextValue | undefined>(undefined);

export function useActionEditor(): ActionEditorContextValue {
  const ctx = useContext(ActionEditorContext);
  if (!ctx) throw new Error('useActionEditor must be used within an ActionEditorProvider');
  return ctx;
}
