export function BrandMark() {
  return (
    <img
      src={`${import.meta.env.BASE_URL}favicon.svg`}
      alt=""
      className="size-9 shrink-0 object-contain"
      width={36}
      height={36}
      aria-hidden="true"
    />
  );
}
