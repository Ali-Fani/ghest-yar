import { create } from "zustand";

interface UIState {
  wizardOpen: boolean;
  wizardEditId: number | null;
  paletteOpen: boolean;
  celebrating: boolean;
  quickAddOpen: boolean;
  /** Preselected provider when quick add is opened from a provider page. */
  quickAddProviderId: number | null;
  providerDialogOpen: boolean;
  providerEditId: number | null;
  openWizard(editId?: number | null): void;
  closeWizard(): void;
  setPalette(o: boolean): void;
  celebrate(v: boolean): void;
  openQuickAdd(providerId?: number | null): void;
  closeQuickAdd(): void;
  openProviderDialog(editId?: number | null): void;
  closeProviderDialog(): void;
}

export const useUI = create<UIState>((set) => ({
  wizardOpen: false,
  wizardEditId: null,
  paletteOpen: false,
  celebrating: false,
  quickAddOpen: false,
  quickAddProviderId: null,
  providerDialogOpen: false,
  providerEditId: null,
  openWizard: (editId = null) => set({ wizardOpen: true, wizardEditId: editId }),
  closeWizard: () => set({ wizardOpen: false }),
  setPalette: (o) => set({ paletteOpen: o }),
  celebrate: (v) => set({ celebrating: v }),
  openQuickAdd: (providerId = null) => set({ quickAddOpen: true, quickAddProviderId: providerId }),
  closeQuickAdd: () => set({ quickAddOpen: false }),
  openProviderDialog: (editId = null) => set({ providerDialogOpen: true, providerEditId: editId }),
  closeProviderDialog: () => set({ providerDialogOpen: false }),
}));
