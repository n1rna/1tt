"use client";

import { createContext, useContext, useState, useCallback } from "react";

interface CollapsibleContextValue {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CollapsibleContext = createContext<CollapsibleContextValue>({
  open: false,
  onOpenChange: () => {},
});

function Collapsible({
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  defaultOpen = false,
  children,
  className,
  ...props
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultOpen?: boolean;
  children: React.ReactNode;
  className?: string;
} & React.HTMLAttributes<HTMLDivElement>) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const open = controlledOpen ?? uncontrolledOpen;
  const onOpenChange = useCallback(
    (v: boolean) => {
      controlledOnOpenChange?.(v);
      if (controlledOpen === undefined) setUncontrolledOpen(v);
    },
    [controlledOpen, controlledOnOpenChange]
  );

  return (
    <CollapsibleContext.Provider value={{ open, onOpenChange }}>
      <div className={className} {...props}>
        {children}
      </div>
    </CollapsibleContext.Provider>
  );
}

function CollapsibleTrigger({
  children,
  className,
  asChild,
  ...props
}: {
  children: React.ReactNode;
  className?: string;
  asChild?: boolean;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { open, onOpenChange } = useContext(CollapsibleContext);
  return (
    <button
      type="button"
      aria-expanded={open}
      className={className}
      onClick={() => onOpenChange(!open)}
      {...props}
    >
      {children}
    </button>
  );
}

function CollapsibleContent({
  children,
  className,
  ...props
}: {
  children: React.ReactNode;
  className?: string;
} & React.HTMLAttributes<HTMLDivElement>) {
  const { open } = useContext(CollapsibleContext);
  if (!open) return null;
  return (
    <div className={className} {...props}>
      {children}
    </div>
  );
}

export { Collapsible, CollapsibleTrigger, CollapsibleContent };
