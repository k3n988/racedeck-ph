type EventBannerProps = {
  eventName: string;
  imageUrl: string | null;
};

/** Shared, centered event banner used on both event details and registration. */
export function EventBanner({ eventName, imageUrl }: EventBannerProps) {
  return (
    <div className="relative aspect-[4/1] min-h-40 w-full overflow-hidden bg-[#071b41]">
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={`${eventName} banner`}
          className="h-full w-full object-contain object-center"
        />
      ) : (
        <div className="flex h-full min-h-40 items-center justify-center px-5 text-center text-xl font-bold text-white sm:text-2xl">
          {eventName}
        </div>
      )}
    </div>
  );
}
