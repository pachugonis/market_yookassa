"use client"

import { useMemo, useRef, useState } from "react"
import { Search, Upload, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { CategoryIcon } from "@/components/category-icon"
import {
  getCategoryIconOption,
  isImageIcon,
  searchCategoryIcons,
} from "@/lib/category-icons"
import { cn } from "@/lib/utils"

interface CategoryIconPickerProps {
  value: string
  onChange: (icon: string) => void
  /// Диалоги создания и редактирования висят в одном дереве, поэтому id
  /// полей разводим префиксом.
  idPrefix: string
  isUploading: boolean
  onUpload: (file: File) => void
}

export function CategoryIconPicker({
  value,
  onChange,
  idPrefix,
  isUploading,
  onUpload,
}: CategoryIconPickerProps) {
  const [query, setQuery] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)

  const groups = useMemo(() => searchCategoryIcons(query), [query])
  const selectedOption = getCategoryIconOption(value)

  const selectedLabel = selectedOption
    ? selectedOption.label
    : isImageIcon(value)
      ? "Загруженная картинка"
      : "Свой символ"

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) onUpload(file)
    // Тот же файл после удаления иконки иначе не выберется повторно.
    event.target.value = ""
  }

  const clearIcon = () => {
    onChange("")
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  return (
    <div className="space-y-3">
      <Label>Иконка</Label>

      {value && (
        <div className="flex items-center gap-3 rounded-lg border border-border bg-secondary/40 p-3">
          <div className="relative">
            <div className="flex h-14 w-14 items-center justify-center rounded-lg border border-border bg-background">
              <CategoryIcon
                icon={value}
                label={selectedLabel}
                size={56}
                className="h-7 w-7 text-2xl"
                imageClassName="h-14 w-14 rounded-lg"
              />
            </div>
            <Button
              type="button"
              size="icon"
              variant="destructive"
              className="absolute -right-2 -top-2 h-6 w-6 rounded-full"
              onClick={clearIcon}
              aria-label="Убрать иконку"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium">{selectedLabel}</p>
            <p className="truncate text-xs text-muted-foreground">{value}</p>
          </div>
        </div>
      )}

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id={`${idPrefix}-icon-search`}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Поиск иконки: скрипт, веб, музыка…"
          className="pl-9"
        />
      </div>

      <div className="max-h-60 space-y-4 overflow-y-auto rounded-lg border border-border p-3">
        {groups.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Ничего не нашлось. Загрузите свою картинку или введите эмодзи ниже.
          </p>
        ) : (
          groups.map((group) => (
            <div key={group.title}>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {group.title}
              </p>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {group.icons.map((option) => {
                  const isSelected = option.name === value
                  return (
                    <button
                      key={option.name}
                      type="button"
                      onClick={() => onChange(option.name)}
                      aria-pressed={isSelected}
                      title={option.label}
                      className={cn(
                        "flex flex-col items-center gap-1.5 rounded-lg border p-2 text-center transition-colors",
                        isSelected
                          ? "border-primary bg-primary/10"
                          : "border-transparent hover:border-border hover:bg-secondary"
                      )}
                    >
                      <option.Icon
                        className={cn(
                          "h-5 w-5",
                          isSelected ? "text-primary" : "text-muted-foreground"
                        )}
                      />
                      <span className="line-clamp-2 w-full text-[11px] leading-tight text-muted-foreground">
                        {option.label}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="flex gap-2">
        <Input
          id={`${idPrefix}-icon`}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="💻 или путь к изображению"
          className="flex-1"
        />
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="image/*"
          className="hidden"
          id={`${idPrefix}-icon-file-upload`}
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
        >
          <Upload className="mr-2 h-4 w-4" />
          {isUploading ? "Загрузка..." : "Загрузить"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Выберите иконку из набора или загрузите свою картинку либо эмодзи.
      </p>
    </div>
  )
}
