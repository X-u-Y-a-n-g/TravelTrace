export function CountryFlag({
  code,
  className,
}: {
  code: string | null | undefined;
  className?: string;
}) {
  if (!code || code.length !== 2) return null;
  const emoji = code
    .toUpperCase()
    .split("")
    .map((character) => String.fromCodePoint(127397 + character.charCodeAt(0)))
    .join("");
  return (
    <span className={className} role="img" aria-label={code.toUpperCase()}>
      {emoji}
    </span>
  );
}
