import { create } from "zustand";

interface UIState {
  wizardOpen: boolean;
  wizardEditId: number | null;
  paletteOpen: boolean;
  celebrating: boolean;
  openWizard(editId?: number | null): void;
  closeWizard(): void;
  setPalette(o: boolean): void;
  celebrate(v: boolean): void;
}

export const useUI = create<UIState>((set) => ({
  wizardOpen: false,
  wizardEditId: null,
  paletteOpen: false,
  celebrating: false,
  openWizard: (editId = null) => set({ wizardOpen: true, wizardEditId: editId }),
  closeWizard: () => set({ wizardOpen: false }),
  setPalette: (o) => set({ paletteOpen: o }),
  celebrate: (v) => set({ celebrating: v }),
}));
