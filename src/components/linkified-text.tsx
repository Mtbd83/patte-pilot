const URL_PATTERN = /(https?:\/\/[^\s]+)/g;

/** Renders free text typed by the public (report descriptions, comments) with any http(s) URL turned into a clickable link — a raw long URL otherwise reads as unreadable noise. */
export function LinkifiedText({ text }: { text: string }) {
  const parts = text.split(URL_PATTERN);
  return (
    <>
      {parts.map((part, i) =>
        /^https?:\/\//.test(part) ? (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="break-all text-primary underline"
          >
            {part}
          </a>
        ) : (
          part
        ),
      )}
    </>
  );
}
