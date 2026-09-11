/** Shared geometry for the loaded Library views and their loading placeholders. */
export const LIBRARY_FLAT_GRID = "grid gap-4 md:grid-cols-2 2xl:grid-cols-3";
export const LIBRARY_CAROUSEL_ITEM = "basis-[86%] pl-3 sm:basis-1/2 lg:basis-1/3 2xl:basis-1/4";
export const getShelfRowSize = (width: number) => width < 768 ? 3 : width < 1024 ? 5 : width < 1440 ? 7 : 9;
