export function BrandMark({
  ariaLabel,
  dataTestId,
}: {
  ariaLabel?: string;
  dataTestId?: string;
}) {
  return (
    <img
      src={`${import.meta.env.BASE_URL}favicon.svg`}
      alt={ariaLabel ?? ""}
      className="size-9 shrink-0 object-contain"
      width={36}
      height={36}
      aria-hidden={ariaLabel ? undefined : true}
      data-testid={dataTestId}
    />
  );
}
