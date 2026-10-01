/** Shared geometry for the loaded Library views and their loading placeholders. */
import "./library-reading-room.css";

export const LIBRARY_FLAT_GRID = "library-reading-grid";
export const LIBRARY_CAROUSEL_ITEM = "basis-[86%] pl-3 sm:basis-1/2 lg:basis-1/3 2xl:basis-1/4";
export const getShelfRowSize = (width: number) => width < 768 ? 3 : width < 1024 ? 5 : width < 1440 ? 7 : 9;
