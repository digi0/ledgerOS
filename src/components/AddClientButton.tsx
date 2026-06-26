"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import ClientDialog from "./ClientDialog";

export default function AddClientButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="btn-glass inline-flex items-center gap-2 rounded-[10px] bg-[var(--color-brand)] px-3.5 py-2 text-[13px] font-medium text-white"
      >
        <Plus className="h-4 w-4" /> Add client
      </button>
      {open && <ClientDialog onClose={() => setOpen(false)} />}
    </>
  );
}
