"use client";

import * as React from "react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandLoading,
} from "cmdk";
import { Check, ChevronsUpDown, Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Projection, ProjectionInputMethod } from "@/lib/types";

interface ProjectionInputProps {
  value: string;
  onValueChange: (value: string) => void;
  label: string;
  placeholder?: string;
  defaultMethod?: ProjectionInputMethod;
}

export function ProjectionInput({
  value,
  onValueChange,
  label,
  placeholder = "Search projections...",
  defaultMethod = "search",
}: ProjectionInputProps) {
  const [open, setOpen] = React.useState(false);
  const [method, setMethod] =
    React.useState<ProjectionInputMethod>(defaultMethod);
  const [loading, setLoading] = React.useState(false);
  const [items, setItems] = React.useState<Projection[]>([]);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [manualInput, setManualInput] = React.useState("");
  const [prjFile, setPrjFile] = React.useState<File | null>(null);
  const searchTimeoutRef = React.useRef<NodeJS.Timeout>();

  // Handle projection search
  React.useEffect(() => {
    if (!searchQuery) {
      setItems([]);
      return;
    }

    clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ q: searchQuery });
        const res = await fetch(`/api/projections?${params}`);
        const data = await res.json();
        setItems(data.items);
      } catch (error) {
        console.error("Failed to fetch projections:", error);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(searchTimeoutRef.current);
  }, [searchQuery]);

  const handlePRJUpload = async (file: File) => {
    try {
      const content = await file.text();
      setPrjFile(file);
      setManualInput(content);
      onValueChange(content);
    } catch (error) {
      console.error("Failed to read PRJ file:", error);
    }
  };

  const clearPRJFile = () => {
    setPrjFile(null);
    setManualInput("");
    onValueChange("");
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
        {label}
      </label>

      <Tabs
        value={method}
        onValueChange={(v) => setMethod(v as ProjectionInputMethod)}
      >
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="search">Search</TabsTrigger>
          <TabsTrigger value="file">PRJ File</TabsTrigger>
          <TabsTrigger value="manual">Manual</TabsTrigger>
        </TabsList>

        <TabsContent value="search" className="mt-4">
          <Command className="w-full">
            <button
              className={cn(
                "flex h-10 w-full items-center justify-between rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white",
                "hover:bg-slate-100 dark:hover:bg-slate-700/50",
                "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
              )}
              onClick={() => setOpen(!open)}
            >
              {value ? (
                items.find((item) => item.id === value)?.name || value
              ) : (
                <span className="text-slate-500 dark:text-slate-400">
                  Select projection...
                </span>
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
                    onBlur={() => setOpen(false)}
                    className="w-full border-0 border-b border-slate-200 px-3 py-2 text-sm dark:border-slate-700"
                  />
                  <CommandList>
                    {loading && (
                      <CommandLoading>Loading projections...</CommandLoading>
                    )}
                    <CommandEmpty className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                      No projection found.
                    </CommandEmpty>
                    <CommandGroup className="max-h-60 overflow-auto p-1">
                      {items.map((proj) => (
                        <CommandItem
                          key={proj.id}
                          value={proj.id}
                          onSelect={(currentValue) => {
                            onValueChange(
                              currentValue === value ? "" : currentValue
                            );
                            setOpen(false);
                          }}
                          className="flex items-center justify-between px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-700"
                        >
                          <div>
                            <div className="font-medium">{proj.name}</div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                              {proj.code}
                            </div>
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
        </TabsContent>

        <TabsContent value="file" className="mt-4">
          <div className="space-y-4">
            <div
              className={cn(
                "border-2 border-dashed rounded-lg p-6 text-center transition-colors",
                "border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/30"
              )}
            >
              {!prjFile ? (
                <div className="flex flex-col items-center justify-center space-y-3">
                  <div className="p-3 bg-slate-100 dark:bg-slate-700 rounded-full">
                    <Upload className="h-6 w-6 text-slate-500 dark:text-slate-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      Drop your PRJ file here
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      or click to browse
                    </p>
                  </div>
                  <input
                    type="file"
                    accept=".prj"
                    className="hidden"
                    id="prj-upload"
                    onChange={(e) =>
                      e.target.files?.[0] && handlePRJUpload(e.target.files[0])
                    }
                  />
                  <label
                    htmlFor="prj-upload"
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 cursor-pointer"
                  >
                    Select PRJ File
                  </label>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Upload className="h-5 w-5 text-blue-600 dark:text-blue-400 mr-2" />
                    <div className="text-left">
                      <p className="text-sm font-medium text-slate-900 dark:text-white">
                        {prjFile.name}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {(prjFile.size / 1024).toFixed(2)} KB
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={clearPRJFile}
                    className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full"
                  >
                    <X className="h-5 w-5 text-slate-500 dark:text-slate-400" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="manual" className="mt-4">
          <div className="space-y-2">
            <textarea
              value={manualInput}
              onChange={(e) => {
                setManualInput(e.target.value);
                onValueChange(e.target.value);
              }}
              placeholder="Enter proj4 string or WKT definition..."
              className="w-full h-32 px-3 py-2 text-sm rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400"
            />
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Enter a valid proj4 string or WKT projection definition
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
