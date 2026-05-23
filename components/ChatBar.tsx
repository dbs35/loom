interface Props {
  initialQuery?: string;
  compact?: boolean;
}

export function ChatBar({ initialQuery, compact }: Props) {
  return (
    <form
      action="/q"
      method="get"
      className={
        compact
          ? "mx-auto max-w-[760px]"
          : "mx-auto max-w-[760px] mt-0"
      }
    >
      <div className="ask-bar bg-bg-elev border border-rule rounded-[2px] px-[28px] py-[22px] flex items-center gap-[18px] shadow-[0_1px_0_var(--rule-soft)] max-[900px]:flex-col max-[900px]:items-stretch">
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="text-muted flex-shrink-0"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          name="query"
          type="text"
          required
          defaultValue={initialQuery ?? ""}
          placeholder="What are you looking for?"
          aria-label="Ask the commons"
          className="flex-1 border-0 bg-transparent outline-none font-display italic font-light text-[22px] text-ink placeholder:text-muted placeholder:opacity-90 max-[900px]:text-[18px]"
        />
        <button
          type="submit"
          className="bg-ink text-bg-elev border-0 px-[18px] py-[10px] cursor-pointer font-body text-[13px] tracking-[0.14em] uppercase hover:bg-accent"
        >
          Ask
        </button>
      </div>
    </form>
  );
}
