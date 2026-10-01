/** Shared geometry for the loaded Library views and their loading placeholders. */
import "./library-reading-room.css";
import "./library-modes.css";

export const LIBRARY_FLAT_GRID = "library-reading-grid";
export const LIBRARY_CAROUSEL_ITEM = "library-carousel-slide";
export const getShelfRowSize = (width: number, fontSize = 16) => Math.max(1, Math.min(8, Math.floor((width - fontSize) / (10 * fontSize))));
