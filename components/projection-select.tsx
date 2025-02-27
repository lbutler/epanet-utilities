"use client"

import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "cmdk"
import { cn } from "@/lib/utils"

interface ProjectionSelectProps {
  value: string
  onValueChange: (value: string) => void
  label: string
  placeholder?: string
  projections: { id: string; name: string; code: string }[]
  isLoading?: boolean
}

export function ProjectionSelect({
  value,
  onValueChange,
  label,
  placeholder = "Search projections...",
  projections,
  isLoading = false,
}: ProjectionSelectProps) {
  const [open, setOpen] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState("")

  const filteredProjections = React.useMemo(() => {
    if (!searchQuery) return projections
    const query = searchQuery.toLowerCase()
    return projections.filter(
      (proj) => proj.name.toLowerCase().includes(query) || proj.code.toLowerCase().includes(query),
    )
  }, [projections, searchQuery])

  const selectedProjection = projections.find((proj) => proj.id === value)

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</label>
      <Command className="w-full">
        <button
          className={cn(
            "flex h-10 w-full items-center justify-between rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white",
            "hover:bg-slate-100 dark:hover:bg-slate-700/50",
            "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900",
            "disabled:cursor-not-allowed disabled:opacity-50",
          )}
          onClick={() => setOpen(!open)}
          disabled={isLoading}
        >
          {isLoading ? (
            <span className="text-slate-500 dark:text-slate-400">Loading projections...</span>
          ) : value ? (
            selectedProjection?.name
          ) : (
            <span className="text-slate-500 dark:text-slate-400">Select projection...</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </button>
        {open && (
          <div className="relative mt-2">
            <div className="absolute top-0 z-50 w-full rounded-md border border-slate-200 bg-white shadow-md dark:border-slate-700 dark:bg-slate-800">
              <CommandInput
                placeholder={placeholder}
                value={searchQuery}
                onValueChange={setSearchQuery}
                className="border-0 border-b border-slate-200 px-3 py-2 text-sm dark:border-slate-700"
              />
              <CommandList>
                <CommandEmpty className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                  No projection found.
                </CommandEmpty>
                <CommandGroup className="max-h-60 overflow-auto p-1">
                  {filteredProjections.map((proj) => (
                    <CommandItem
                      key={proj.id}
                      value={proj.id}
                      onSelect={(currentValue) => {
                        onValueChange(currentValue === value ? "" : currentValue)
                        setOpen(false)
                      }}
                      className="flex items-center justify-between px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-700"
                    >
                      <div>
                        <div className="font-medium">{proj.name}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">{proj.code}</div>
                      </div>
                      {value === proj.id && <Check className="h-4 w-4" />}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </div>
          </div>
        )}
      </Command>
    </div>
  )
}

