export function TypingIndicator() {
  return (
    <div className="flex items-center gap-1.5 px-4 py-3" aria-label="Bot is typing">
      <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:-0.3s]" />
      <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:-0.15s]" />
      <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/60" />
    </div>
  )
}
